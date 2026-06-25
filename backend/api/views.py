"""
========================================================

Fichier :
views.py

Description :

Module de l'application Zemy.

Projet :
Zemy

========================================================
"""
# pyrefly: ignore [missing-import]
from drf_spectacular.utils import extend_schema, extend_schema_view, OpenApiParameter, OpenApiTypes
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model
from django.db.models import Q
from django.db import models, transaction
from django.views.decorators.csrf import csrf_exempt
import random

from .models import (
    Vehicle, UserPreference, Ride, Booking, Conversation, Message, Notification, 
    AppBranding, VerificationRequest, Promotion, MobileSettings,
    FinancialSettings, RefundRequest, Transaction, Parcel, Payment
)
from .serializers import (
    UserSerializer, AdminUserSerializer, VehicleSerializer, UserPreferenceSerializer, 
    RideSerializer, BookingSerializer, ConversationSerializer, MessageSerializer, NotificationSerializer, AppBrandingSerializer,
    VerificationRequestSerializer, PromotionSerializer, MobileSettingsSerializer,
    FinancialSettingsSerializer, RefundRequestSerializer, TransactionSerializer, ParcelSerializer
)
from .fcm import send_fcm_to_user, send_fcm_to_all_users, create_and_send_notification

User = get_user_model()

import firebase_admin
from firebase_admin import credentials, auth as firebase_auth
from django.conf import settings
import os

# Initialize Firebase Admin
try:
    if not firebase_admin._apps:
        cred_path = os.path.join(settings.BASE_DIR, 'firebase-adminsdk.json')
        if os.path.exists(cred_path):
            cred = credentials.Certificate(cred_path)
            firebase_admin.initialize_app(cred)
        else:
            pass
except Exception as e:
    pass
@extend_schema(request=dict, responses={200: dict, 400: dict}, tags=['Vérification des comptes'])
@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def verify_code(request):
    """
    Vérifie le code OTP saisi par l'utilisateur.
    """
    firebase_token = request.data.get('firebase_token')
    full_name = request.data.get('full_name', '') # For registration
    phone = request.data.get('phone', '') # Sent by frontend in dev mode
    
    if not firebase_token:
        return Response({'error': 'Jeton Firebase requis.'}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        # DEV MODE BYPASS
        if firebase_token == '123456':
            if not phone:
                return Response({'error': 'Numéro de téléphone requis pour le mode dev.'}, status=status.HTTP_400_BAD_REQUEST)
        else:
            if not firebase_admin._apps:
                return Response({'error': 'Firebase Admin non configuré sur le serveur.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
                
            # Verify the Firebase token normally
            decoded_token = firebase_auth.verify_id_token(firebase_token)
            phone = decoded_token.get('phone_number')
            
            if not phone:
                return Response({'error': 'Le jeton ne contient pas de numéro de téléphone vérifié.'}, status=status.HTTP_400_BAD_REQUEST)
        # Get or create user
        user, created = User.objects.get_or_create(phone=phone)
        if created and full_name:
            user.full_name = full_name
            user.save()
            
        refresh = RefreshToken.for_user(user)
        
        return Response({
            'refresh': str(refresh),
            'access': str(refresh.access_token),
            'user': UserSerializer(user).data,
            'is_new_user': created
        })
    except Exception as e:
        return Response({'error': 'Code invalide ou expiré.'}, status=status.HTTP_400_BAD_REQUEST)

@extend_schema(request=dict, responses={200: dict}, tags=['Notifications'])
@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def save_fcm_token(request):
    """
    Enregistre le token FCM de l'appareil de l'utilisateur connecté.
    Appelé par le mobile après la connexion ou au lancement de l'app.
    """
    token = request.data.get('fcm_token', '').strip()
    if not token:
        return Response({'error': 'fcm_token requis.'}, status=status.HTTP_400_BAD_REQUEST)
    request.user.fcm_token = token
    request.user.save(update_fields=['fcm_token'])
    return Response({'status': 'FCM token enregistré avec succès.'})

@extend_schema(
    parameters=[
        OpenApiParameter('email', str, description='Email à vérifier', required=False),
        OpenApiParameter('phone', str, description='Numéro de téléphone à vérifier', required=False),
    ],
    responses={200: dict},
    tags=['Authentification']
)
@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def check_availability(request):
    """
    Vérifie si un email ou un numéro de téléphone est déjà utilisé.
    
    Paramètres GET :
        - email  : adresse email à tester
        - phone  : numéro de téléphone à tester
    
    Retourne :
        - email_available  : True si l'email est libre
        - phone_available  : True si le numéro est libre
    """
    email = request.query_params.get('email', '').strip()
    phone = request.query_params.get('phone', '').strip()

    result = {}

    if email:
        result['email_available'] = not User.objects.filter(email__iexact=email).exists()

    if phone:
        # Vérification directe ET avec préfixe +229 pour compatibilité
        phone_taken = User.objects.filter(phone=phone).exists()
        result['phone_available'] = not phone_taken

    if not email and not phone:
        return Response(
            {'error': 'Fournir au moins email ou phone.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    return Response(result)

@extend_schema(request=dict, responses={201: dict, 400: dict}, tags=['Authentification'])
@api_view(['POST'])
@permission_classes([permissions.AllowAny])
@csrf_exempt
def register_user(request):
    """
    Enregistre un nouvel utilisateur.
    
    Args:
        request: Requête contenant le téléphone et les données de base.
    
    Returns:
        Response: 201 (Créé) avec un token JWT et les informations de l'utilisateur,
                  ou 400 (Erreur) si le numéro existe déjà.
    """
    from .serializers import RegisterSerializer
    serializer = RegisterSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()
        refresh = RefreshToken.for_user(user)
        return Response({
            'refresh': str(refresh),
            'access': str(refresh.access_token),
            'user': UserSerializer(user).data
        }, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@extend_schema(request=dict, responses={200: dict, 400: dict}, tags=['Authentification'])
@api_view(['POST'])
@permission_classes([permissions.AllowAny])
@csrf_exempt
def login_user(request):
    """
    Connecte un utilisateur existant.
    
    Args:
        request: Requête contenant le téléphone (ou email) et le mot de passe.
    
    Returns:
        Response: 200 avec token JWT si succès, ou 400 si identifiants invalides.
    """
    identifier = request.data.get('identifier')
    password = request.data.get('password')

    if not identifier or not password:
        return Response({'error': 'Veuillez fournir un identifiant et un mot de passe.'}, status=status.HTTP_400_BAD_REQUEST)

    user = User.objects.filter(phone=identifier).first()
    if not user and identifier.isdigit():
        user = User.objects.filter(phone=f'+229{identifier}').first()
    if not user:
        user = User.objects.filter(email=identifier).first()

    if user and user.check_password(password):
        refresh = RefreshToken.for_user(user)
        user_data = UserSerializer(user).data
        user_data['is_staff'] = user.is_staff
        user_data['is_superuser'] = user.is_superuser
        return Response({
            'refresh': str(refresh),
            'access': str(refresh.access_token),
            'user': user_data
        })
    return Response({'error': 'Identifiants invalides.'}, status=status.HTTP_401_UNAUTHORIZED)

@extend_schema(request=dict, responses={200: dict, 400: dict}, tags=['Vérification des comptes'])
@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def request_verification(request):
    """
    Le passager soumet une demande de vérification d'identité avec images.
    """
    user = request.user
    if user.is_verified:
        return Response({'message': 'Votre compte est déjà vérifié.'}, status=status.HTTP_200_OK)

    # Vérifier s'il y a déjà une demande en attente
    existing = VerificationRequest.objects.filter(user=user).first()
    if existing and existing.status == 'pending':
        return Response({'error': 'Une demande est déjà en cours de traitement.'}, status=status.HTTP_400_BAD_REQUEST)

    selfie = request.FILES.get('selfie')
    id_front = request.FILES.get('id_front')
    id_back = request.FILES.get('id_back')

    if not all([selfie, id_front, id_back]):
        return Response({'error': 'Tous les documents (selfie, recto, verso) sont requis.'}, status=status.HTTP_400_BAD_REQUEST)

    # Par défaut, utiliser le selfie comme photo de profil (avatar)
    user.avatar = selfie
    user.save(update_fields=['avatar'])

    # Créer ou mettre à jour la demande de vérification
    VerificationRequest.objects.update_or_create(
        user=user,
        defaults={
            'selfie': selfie,
            'id_front': id_front,
            'id_back': id_back,
            'status': 'pending'
        }
    )

    return Response({
        'message': 'Votre demande de vérification a été envoyée avec succès.'
    }, status=status.HTTP_200_OK)


@extend_schema(responses={200: dict}, tags=['Vérification des comptes'])
@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def verification_status(request):
    """
    Retourne le statut de la demande de vérification de l'utilisateur connecté.
    """
    user = request.user
    if user.is_verified:
        return Response({'status': 'approved', 'is_verified': True})
    existing = VerificationRequest.objects.filter(user=user).first()
    if existing:
        return Response({'status': existing.status, 'is_verified': False})
    return Response({'status': 'none', 'is_verified': False})


def get_valid_callback_url(request, path):
    """
    Construit une URL absolue pour le callback. Si le serveur tourne en local
    avec une adresse IP privée (ex: 192.168.x.x) ou localhost, on convertit le
    hôte en utilisant le service DNS nip.io (ex: 192.168.x.x.nip.io) afin que
    FedaPay accepte l'URL comme valide et qu'elle pointe quand même vers notre machine locale.
    """
    import re
    from urllib.parse import urlparse, urlunparse
    
    uri = request.build_absolute_uri(path)
    parsed = urlparse(uri)
    netloc = parsed.netloc
    
    if ':' in netloc:
        host, port = netloc.split(':', 1)
        port_suffix = f":{port}"
    else:
        host = netloc
        port_suffix = ""
        
    ip_pattern = r'^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$'
    if re.match(ip_pattern, host):
        new_host = f"{host}.nip.io"
        new_netloc = f"{new_host}{port_suffix}"
        parsed = parsed._replace(netloc=new_netloc)
    elif host.lower() == 'localhost':
        new_host = "127.0.0.1.nip.io"
        new_netloc = f"{new_host}{port_suffix}"
        parsed = parsed._replace(netloc=new_netloc)
        
    return urlunparse(parsed)


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def payment_callback(request):
    """
    Endpoint de redirection FedaPay.
    Reçoit la redirection après paiement et redirige le navigateur du mobile vers le schéma deep link 'zemy://'.
    """
    booking_id = request.GET.get('booking_id')
    parcel_id = request.GET.get('parcel_id')
    redirect_to = request.GET.get('redirect_to')
    
    if redirect_to:
        import urllib.parse
        parsed_redirect = urllib.parse.urlparse(redirect_to)
        query_params = urllib.parse.parse_qs(parsed_redirect.query)
        if booking_id and 'booking_id' not in query_params:
            query_params['booking_id'] = [booking_id]
        if parcel_id and 'parcel_id' not in query_params:
            query_params['parcel_id'] = [parcel_id]
        
        new_query = urllib.parse.urlencode(query_params, doseq=True)
        parsed_redirect = parsed_redirect._replace(query=new_query)
        redirect_url = urllib.parse.urlunparse(parsed_redirect)
    else:
        app_scheme = "zemy://payments"
        redirect_url = app_scheme
        if booking_id:
            redirect_url += f"?booking_id={booking_id}"
        elif parcel_id:
            redirect_url += f"?parcel_id={parcel_id}"
        
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>Redirection Zemy...</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
            body {{
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                height: 100vh;
                margin: 0;
                background-color: #F9FAFB;
                color: #1F2937;
                text-align: center;
                padding: 20px;
            }}
            .spinner {{
                border: 4px solid rgba(0, 0, 0, 0.1);
                width: 36px;
                height: 36px;
                border-radius: 50%;
                border-left-color: #2F80ED;
                animation: spin 1s linear infinite;
                margin-bottom: 20px;
            }}
            @keyframes spin {{
                0% {{ transform: rotate(0deg); }}
                100% {{ transform: rotate(360deg); }}
            }}
            h2 {{
                font-size: 20px;
                font-weight: 600;
                margin: 0 0 10px 0;
            }}
            p {{
                font-size: 14px;
                color: #6B7280;
                margin: 0 0 20px 0;
            }}
            a {{
                color: #2F80ED;
                text-decoration: none;
                font-weight: 500;
            }}
        </style>
        <script>
            window.onload = function() {{
                // Redirection vers le deep link
                window.location.href = "{redirect_url}";
                
                // Fallback de sécurité au bout de 2 secondes
                setTimeout(function() {{
                    document.getElementById('fallback').style.display = 'block';
                }}, 2000);
            }};
        </script>
    </head>
    <body>
        <div class="spinner"></div>
        <h2>Redirection vers l'application...</h2>
        <p>Votre paiement a été traité. Nous vous ramenons vers l'application Zemy.</p>
        <div id="fallback" style="display: none;">
            <p>Si la redirection ne fonctionne pas, <a href="{redirect_url}">cliquez ici pour revenir à l'application</a>.</p>
        </div>
    </body>
    </html>
    """
    from django.http import HttpResponse
    return HttpResponse(html_content, content_type="text/html; charset=utf-8")


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
@csrf_exempt
def fedapay_webhook(request):
    """
    Webhook FedaPay pour valider les paiements de manière asynchrone.
    """
    import json
    try:
        payload = json.loads(request.body)
    except Exception as e:
        return Response({"error": "JSON invalide"}, status=status.HTTP_400_BAD_REQUEST)

    entity = payload.get('entity', {})
    transaction_id = str(entity.get('id'))

    if not transaction_id:
        return Response({"error": "ID de transaction absent"}, status=status.HTTP_400_BAD_REQUEST)

    # Récupérer ou créer l'enregistrement de paiement de façon atomique
    from django.db import transaction
    with transaction.atomic():
        payment = Payment.objects.filter(transaction_id=transaction_id).select_for_update().first()
        
        booking = Booking.objects.filter(transaction_id=transaction_id).first()
        parcel = Parcel.objects.filter(payments__transaction_id=transaction_id).first() or Parcel.objects.filter(id=entity.get('custom_metadata', {}).get('parcel_id') or entity.get('metadata', {}).get('parcel_id')).first()
        
        user = None
        if booking:
            user = booking.passenger
        elif parcel:
            user = parcel.sender_user
            
        if not payment:
            payment = Payment.objects.create(
                transaction_id=transaction_id,
                amount=int(entity.get('amount', 0)),
                user=user or User.objects.filter(is_staff=True).first(),
                booking=booking,
                parcel=parcel,
                status='PENDING'
            )
            
        old_status = payment.status
        fedapay_status = entity.get('status', '').lower()
        
        new_status = 'PENDING'
        if fedapay_status == 'approved':
            new_status = 'SUCCESS'
        elif fedapay_status in ['declined', 'failed']:
            new_status = 'FAILED'
        elif fedapay_status == 'canceled':
            new_status = 'CANCELLED'
        elif fedapay_status == 'refunded':
            new_status = 'REFUNDED'
            
        payment.status = new_status
        if not payment.booking and booking:
            payment.booking = booking
        if not payment.parcel and parcel:
            payment.parcel = parcel
        payment.save()
        
        if new_status == 'SUCCESS' and old_status != 'SUCCESS':
            # Valider Booking
            if payment.booking:
                b = payment.booking
                if b.payment_status != 'escrow':
                    b.payment_status = 'escrow'
                    b.status = 'confirmed'
                    b.save()
                    
                    amount_due = int(b.amount_due_to_driver)
                    commission = int(b.amount_paid_online)
                    
                    create_and_send_notification(
                        user=b.passenger,
                        title="Réservation confirmée ✅",
                        message=f"Commission de {commission} FCFA payée. Prévoyez {amount_due} FCFA en espèces à remettre au conducteur pour le trajet {b.ride.departure_location} -> {b.ride.arrival_location}.",
                        data={'type': 'payment_confirmed', 'booking_id': str(b.id), 'screen': 'trips'}
                    )
                    
                    if b.ride.driver_details:
                        create_and_send_notification(
                            user=b.ride.driver_details,
                            title="Nouvelle Réservation 🚗",
                            message=f"{b.passenger.full_name} a réservé {b.seats_booked} place(s). Il/Elle vous paiera {amount_due} FCFA en espèces lors du trajet.",
                            data={'type': 'new_booking', 'booking_id': str(b.id), 'screen': 'rides'}
                        )
                        
            # Valider Parcel
            if payment.parcel:
                p = payment.parcel
                if p.payment_status != 'escrow':
                    p.payment_status = 'escrow'
                    p.status = 'accepted'
                    p.save()
                    
                    amount_due = p.driver_payout
                    create_and_send_notification(
                        user=p.ride.driver,
                        title="Nouveau Colis Confirmé 📦",
                        message=f"{p.sender_name} a confirmé l'envoi d'un colis. Vous recevrez {amount_due} FCFA en espèces.",
                        data={'type': 'parcel_confirmed', 'parcel_id': str(p.id), 'screen': 'rides'}
                    )

    return Response({"status": "ok"})


@extend_schema(responses={200: dict}, tags=['Statistiques'])
@extend_schema(responses={200: dict}, tags=['Statistiques'])
@api_view(['GET'])
@permission_classes([permissions.IsAdminUser])
def dashboard_stats(request):
    """
    Renvoie les statistiques agrégées pour le tableau de bord Administrateur.
    
    Returns:
        Response: Dictionnaire contenant les KPI (chiffre d'affaires, utilisateurs, trajets actifs...).
    """
    from django.utils import timezone
    from datetime import timedelta
    from django.db.models import Sum, Count

    now = timezone.now()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    # Users
    total_users = User.objects.count()
    verified_users = User.objects.filter(is_verified=True).count()
    unverified_users = total_users - verified_users
    # Rough estimate of passengers vs drivers: drivers have vehicles
    drivers = Vehicle.objects.values('owner').distinct().count()
    passengers = total_users - drivers
    pending_verifications = VerificationRequest.objects.filter(status='pending').count()

    # Rides
    active_rides = Ride.objects.filter(status__in=['active', 'started']).count()
    today_rides = Ride.objects.filter(created_at__gte=today_start).count()
    completed_rides = Ride.objects.filter(status='completed').count()
    cancelled_rides = Ride.objects.filter(status='cancelled').count()

    # Bookings
    today_bookings = Booking.objects.filter(created_at__gte=today_start).count()
    monthly_bookings = Booking.objects.filter(created_at__gte=month_start).count()
    confirmed_bookings = Booking.objects.filter(status='confirmed').count()
    cancelled_bookings = Booking.objects.filter(status='cancelled').count()

    # Parcels
    sent_parcels = Parcel.objects.count()
    delivered_parcels = Parcel.objects.filter(status='delivered').count()

    # Financials
    transactions = Transaction.objects.filter(status='completed')
    total_revenue = transactions.aggregate(Sum('amount'))['amount__sum'] or 0
    monthly_revenue = transactions.filter(created_at__gte=month_start).aggregate(Sum('amount'))['amount__sum'] or 0
    total_commission = transactions.aggregate(Sum('zemy_commission'))['zemy_commission__sum'] or 0
    
    refunds = RefundRequest.objects.filter(status='approved')
    total_refunded = refunds.aggregate(Sum('amount'))['amount__sum'] or 0
    pending_refunds = RefundRequest.objects.filter(status='pending').count()

    # Time series (last 7 days revenue)
    revenue_chart = []
    rides_chart = []
    # French days
    days_fr = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
    for i in range(6, -1, -1):
        d_start = today_start - timedelta(days=i)
        d_end = d_start + timedelta(days=1)
        day_rev = transactions.filter(created_at__gte=d_start, created_at__lt=d_end).aggregate(Sum('amount'))['amount__sum'] or 0
        day_rides = Ride.objects.filter(created_at__gte=d_start, created_at__lt=d_end).count()
        label = days_fr[d_start.weekday()]
        revenue_chart.append({'x': label, 'y': float(day_rev)})
        rides_chart.append({'x': label, 'y': day_rides})

    # Recent activity
    recent_bookings = Booking.objects.select_related('passenger').order_by('-created_at')[:5]
    recent_rides = Ride.objects.select_related('driver').order_by('-created_at')[:5]
    
    activities = []
    for b in recent_bookings:
        activities.append({
            'id': f'b_{b.id}',
            'type': 'Nouvelle réservation',
            'user': b.passenger.full_name if b.passenger.full_name else b.passenger.phone,
            'time': b.created_at,
            'icon': 'ph:ticket-fill',
            'color': 'bg-primary/20 text-primary'
        })
    for r in recent_rides:
        activities.append({
            'id': f'r_{r.id}',
            'type': 'Nouveau trajet',
            'user': r.driver.full_name if r.driver.full_name else r.driver.phone,
            'time': r.created_at,
            'icon': 'ph:car-fill',
            'color': 'bg-secondary/20 text-secondary'
        })
    
    activities.sort(key=lambda x: x['time'], reverse=True)
    for a in activities:
        a['time'] = a['time'].isoformat()
    activities = activities[:6]

    # Map Data: active rides coordinates (mock fallback since some rides might lack lat/lng)
    active_rides_qs = Ride.objects.filter(status__in=['active', 'started'])[:20]
    map_data = []
    for r in active_rides_qs:
        lat = r.departure_lat
        lng = r.departure_lng
        # Si pas de coordonnées, on génère un point au pif proche du centre (Cotonou, Bénin)
        if not lat or not lng:
            import random
            lat = 6.36536 + random.uniform(-0.05, 0.05)
            lng = 2.41833 + random.uniform(-0.05, 0.05)
        map_data.append({
            'id': r.id,
            'lat': float(lat),
            'lng': float(lng),
            'driver': r.driver.full_name if r.driver.full_name else r.driver.phone,
            'status': r.status
        })

    return Response({
        'users': {
            'total': total_users,
            'verified': verified_users,
            'unverified': unverified_users,
            'drivers': drivers,
            'passengers': passengers,
            'pending_verifications': pending_verifications
        },
        'rides': {
            'active': active_rides,
            'today': today_rides,
            'completed': completed_rides,
            'cancelled': cancelled_rides
        },
        'bookings': {
            'today': today_bookings,
            'monthly': monthly_bookings,
            'confirmed': confirmed_bookings,
            'cancelled': cancelled_bookings
        },
        'parcels': {
            'sent': sent_parcels,
            'delivered': delivered_parcels
        },
        'financials': {
            'total_revenue': float(total_revenue),
            'monthly_revenue': float(monthly_revenue),
            'total_commission': float(total_commission),
            'total_refunded': float(total_refunded),
            'pending_refunds': pending_refunds
        },
        'charts': {
            'revenue_7d': revenue_chart,
            'rides_7d': rides_chart
        },
        'activities': activities,
        'map_data': map_data
    })

class UserViewSet(viewsets.ModelViewSet):
    """
    ViewSet permettant de gérer les utilisateurs (CRUD).
    
    Endpoints :
        - GET /api/users/ : Liste des utilisateurs
        - POST /api/users/ : Création (Administrateur uniquement)
        - GET /api/users/{id}/ : Détails d'un utilisateur
        - PATCH /api/users/{id}/ : Mise à jour partielle
    
    Permissions :
        IsAuthenticated (Lecture), IsAdminUser (Création/Suppression)
    """
    serializer_class = AdminUserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_staff:
            return User.objects.all().order_by('-created_at')
        # Si c'est un utilisateur normal, il ne peut voir que lui-même
        return User.objects.filter(id=user.id)

    @action(detail=True, methods=['post'], url_path='rate')
    def rate_user(self, request, pk=None):
        user_to_rate = self.get_object()
        rating = request.data.get('rating')
        if rating is None:
            return Response({"error": "Note requise."}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            rating = float(rating)
            if rating < 1 or rating > 5:
                raise ValueError()
        except ValueError:
            return Response({"error": "Note invalide (doit être entre 1 et 5)."}, status=status.HTTP_400_BAD_REQUEST)
            
        if user_to_rate.rating == 0.0:
            user_to_rate.rating = rating
        else:
            user_to_rate.rating = (user_to_rate.rating + rating) / 2.0
            
        user_to_rate.save(update_fields=['rating'])
        
        # Trigger "Avis reçu" notification
        create_and_send_notification(
            user=user_to_rate,
            title="Avis reçu ⭐",
            message=f"Vous avez reçu une nouvelle note de {rating}/5 de la part d'un utilisateur.",
            data={'type': 'rating_received', 'screen': 'profile'}
        )
        
        return Response({"status": "Note enregistrée avec succès.", "new_rating": user_to_rate.rating})

class VehicleViewSet(viewsets.ModelViewSet):
    """
    ViewSet pour la gestion des véhicules des conducteurs.
    
    Endpoints :
        - GET /api/vehicles/ : Liste des véhicules appartenant à l'utilisateur
        - POST /api/vehicles/ : Ajouter un véhicule
    """
    serializer_class = VehicleSerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = Vehicle.objects.none()

    def get_queryset(self):
        user = self.request.user
        if user.is_staff:
            return Vehicle.objects.all()
        return Vehicle.objects.filter(owner=user)

class UserPreferenceViewSet(viewsets.ModelViewSet):
    """
    ViewSet gérant les préférences de trajet (musique, discussion, etc.).
    """
    queryset = UserPreference.objects.all()
    serializer_class = UserPreferenceSerializer

    def get_queryset(self):
        return UserPreference.objects.filter(user=self.request.user)

    def create(self, request, *args, **kwargs):
        user_id = request.data.get('user')
        if not user_id:
            return Response({'error': 'User ID is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        pref, created = UserPreference.objects.update_or_create(
            user_id=user_id,
            defaults={
                'music': request.data.get('music', True),
                'smoking': request.data.get('smoking', False),
                'chatty': request.data.get('chatty', True),
                'air_conditioner': request.data.get('air_conditioner', True),
                'pets_allowed': request.data.get('pets_allowed', False),
                'luggage_allowed': request.data.get('luggage_allowed', True),
                'stops_allowed': request.data.get('stops_allowed', True),
            }
        )
        serializer = self.get_serializer(pref)
        return Response(serializer.data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

class RideViewSet(viewsets.ModelViewSet):
    """
    ViewSet principal pour la gestion des trajets.
    
    Endpoints supplémentaires :
        - GET /api/rides/search/ : Recherche avancée de trajets
        - POST /api/rides/{id}/cancel/ : Annulation par le conducteur
        - POST /api/rides/{id}/start/ : Démarrer un trajet
        - POST /api/rides/{id}/complete/ : Terminer un trajet
        - POST /api/rides/{id}/update_location/ : Mettre à jour la position GPS
    """
    queryset = Ride.objects.all().order_by('-created_at')
    serializer_class = RideSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        queryset = super().get_queryset().select_related('driver', 'vehicle').prefetch_related('driver__vehicles', 'driver__rides_driven')
        driver_id = self.request.query_params.get('driver')
        ride_type = self.request.query_params.get('type')
        if driver_id:
            queryset = queryset.filter(driver_id=driver_id)
        elif getattr(self, 'action', '') == 'list' and not self.request.user.is_staff:
            from datetime import date, timedelta
            from django.utils.timezone import now
            one_hour_ago = now() - timedelta(hours=1)
            queryset = queryset.filter(departure_date__gte=date.today()).exclude(status='cancelled').exclude(status='completed', updated_at__lt=one_hour_ago)
        
        if ride_type == 'parcel':
            queryset = queryset.filter(accepts_parcels=True)
            
        return queryset

    def create(self, request, *args, **kwargs):
        from rest_framework.exceptions import ValidationError
        from datetime import datetime, timedelta
        from django.db import transaction
        
        is_recurrent = request.data.get('is_recurrent', False)
        
        if is_recurrent:
            if not request.user.is_verified:
                raise ValidationError({"error": "Votre compte doit être vérifié pour publier un trajet."})
                
            start_date_str = request.data.get('start_date')
            end_date_str = request.data.get('end_date')
            repeat_type = request.data.get('repeat_type', 'daily')
            week_days = request.data.get('week_days', [])
            
            if not start_date_str or not end_date_str:
                raise ValidationError({"error": "Date de début et date de fin requises pour un trajet récurrent."})
                
            start_date = datetime.strptime(start_date_str, "%Y-%m-%d").date()
            end_date = datetime.strptime(end_date_str, "%Y-%m-%d").date()
            
            if end_date < start_date:
                raise ValidationError({"error": "La date de fin ne peut pas être antérieure à la date de début."})
                
            if repeat_type == 'weekly' and not week_days:
                raise ValidationError({"error": "Veuillez sélectionner au moins un jour pour la récurrence."})
            
            departure_location = request.data.get('departure_location')
            arrival_location = request.data.get('arrival_location')
            departure_time = request.data.get('departure_time')
            driver_payout = int(request.data.get('driver_payout', 0))
            
            dep_lat = request.data.get('departure_latitude')
            dep_lon = request.data.get('departure_longitude')
            arr_lat = request.data.get('arrival_latitude')
            arr_lon = request.data.get('arrival_longitude')
            
            from .models import FinancialSettings
            settings = FinancialSettings.load()
            if settings.is_commission_active:
                zemy_commission = int(driver_payout * (settings.commission_percentage / 100.0))
                if zemy_commission < settings.min_commission:
                    zemy_commission = settings.min_commission
                if settings.max_commission and zemy_commission > settings.max_commission:
                    zemy_commission = settings.max_commission
            else:
                zemy_commission = 0
            
            price_per_seat = driver_payout + zemy_commission
            total_seats = request.data.get('total_seats')
            vehicle_id = request.data.get('vehicle')
            
            accepts_parcels = request.data.get('accepts_parcels', False)
            max_parcels = int(request.data.get('max_parcels', 0)) if request.data.get('max_parcels') else 0
            max_weight_per_parcel = float(request.data.get('max_weight_per_parcel', 0.0)) if request.data.get('max_weight_per_parcel') else 0.0
            max_dimensions = request.data.get('max_dimensions', '')
            price_per_parcel = int(request.data.get('price_per_parcel', 0)) if request.data.get('price_per_parcel') else 0
            allowed_parcel_types = request.data.get('allowed_parcel_types', [])
            
            with transaction.atomic():
                from .models import RideSeries, Ride, Vehicle
                vehicle_obj = None
                if vehicle_id:
                    vehicle_obj = Vehicle.objects.filter(id=vehicle_id).first()
                
                series = RideSeries.objects.create(
                    driver=request.user,
                    start_date=start_date,
                    end_date=end_date,
                    repeat_type=repeat_type,
                    week_days=week_days,
                    departure_time=departure_time,
                    departure_location=departure_location,
                    arrival_location=arrival_location,
                    price_per_seat=price_per_seat,
                    driver_payout=driver_payout,
                    zemy_commission=zemy_commission,
                    total_seats=total_seats,
                    vehicle=vehicle_obj,
                    accepts_parcels=accepts_parcels,
                    max_parcels=max_parcels,
                    max_weight_per_parcel=max_weight_per_parcel,
                    max_dimensions=max_dimensions,
                    price_per_parcel=price_per_parcel,
                    allowed_parcel_types=allowed_parcel_types,
                    departure_latitude=dep_lat,
                    departure_longitude=dep_lon,
                    arrival_latitude=arr_lat,
                    arrival_longitude=arr_lon
                )
                
                current_date = start_date
                created_count = 0
                while current_date <= end_date:
                    create_this_day = False
                    if repeat_type == 'daily':
                        create_this_day = True
                    elif repeat_type == 'weekly':
                        if current_date.weekday() in week_days:
                            create_this_day = True
                    
                    if create_this_day:
                        Ride.objects.create(
                            series=series,
                            driver=request.user,
                            vehicle=vehicle_obj,
                            departure_location=departure_location,
                            arrival_location=arrival_location,
                            departure_date=current_date,
                            departure_time=departure_time,
                            price_per_seat=price_per_seat,
                            driver_payout=driver_payout,
                            zemy_commission=zemy_commission,
                            total_seats=total_seats,
                            seats_available=total_seats,
                            accepts_parcels=accepts_parcels,
                            max_parcels=max_parcels,
                            parcels_available=max_parcels,
                            max_weight_per_parcel=max_weight_per_parcel,
                            max_dimensions=max_dimensions,
                            price_per_parcel=price_per_parcel,
                            allowed_parcel_types=allowed_parcel_types,
                            departure_latitude=dep_lat,
                            departure_longitude=dep_lon,
                            arrival_latitude=arr_lat,
                            arrival_longitude=arr_lon
                        )
                        created_count += 1
                        
                    current_date += timedelta(days=1)
            
            return Response({"message": f"{created_count} trajets générés avec succès."}, status=status.HTTP_201_CREATED)
            
        else:
            return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        from rest_framework.exceptions import ValidationError
        from .models import FinancialSettings
        if not self.request.user.is_verified:
            raise ValidationError({"error": "Votre compte doit être vérifié pour publier un trajet."})
            
        driver_payout = serializer.validated_data.get('driver_payout', 0)
        settings = FinancialSettings.load()
        if settings.is_commission_active:
            zemy_commission = int(driver_payout * (settings.commission_percentage / 100.0))
            if zemy_commission < settings.min_commission:
                zemy_commission = settings.min_commission
            if settings.max_commission and zemy_commission > settings.max_commission:
                zemy_commission = settings.max_commission
        else:
            zemy_commission = 0
            
        price_per_seat = driver_payout + zemy_commission
        
        max_parcels = serializer.validated_data.get('max_parcels', 0)
        
        serializer.save(
            driver=self.request.user,
            zemy_commission=zemy_commission,
            price_per_seat=price_per_seat,
            parcels_available=max_parcels
        )

    @action(detail=True, methods=['post'], url_path='cancel')
    def cancel_ride(self, request, pk=None):
        from .models import RefundRequest
        
        ride = self.get_object()
        if ride.driver != request.user and not request.user.is_staff:
            return Response({"error": "Non autorisé."}, status=status.HTTP_403_FORBIDDEN)
        
        if ride.status == 'cancelled':
            return Response({"error": "Trajet déjà annulé."}, status=status.HTTP_400_BAD_REQUEST)
            
        ride.status = 'cancelled'
        ride.save()
        
        bookings = ride.bookings.filter(status__in=['pending', 'confirmed'])
        for booking in bookings:
            booking.status = 'cancelled'
            booking.payment_status = 'refunded'
            booking.save()
            ride.seats_available += booking.seats_booked
            
            # Create a RefundRequest for each passenger automatically approved
            price_paid = ride.price_per_seat * booking.seats_booked
            RefundRequest.objects.create(
                booking=booking,
                passenger=booking.passenger,
                driver=ride.driver,
                amount=price_paid,
                reason="Annulation globale du trajet par le conducteur",
                status='approved'
            )
            
            # Passager: Réservation annulée (du fait de l'annulation du trajet entier par le conducteur)
            create_and_send_notification(
                user=booking.passenger,
                title="Réservation annulée ❌",
                message=f"Le conducteur a annulé le trajet de {ride.departure_location} vers {ride.arrival_location}. Remboursement garanti.",
                data={'type': 'booking_cancelled', 'booking_id': str(booking.id), 'screen': 'trips'}
            )
            
        parcels = ride.parcels.filter(status__in=['pending', 'accepted'])
        for parcel in parcels:
            parcel.status = 'cancelled'
            parcel.payment_status = 'refunded'
            parcel.save()
            ride.parcels_available += 1
            
            if parcel.sender_user:
                create_and_send_notification(
                    user=parcel.sender_user,
                    title="Envoi de colis annulé ❌",
                    message=f"Le conducteur a annulé le trajet de {ride.departure_location} vers {ride.arrival_location}. Remboursement garanti.",
                    data={'type': 'parcel_cancelled', 'parcel_id': str(parcel.id), 'screen': 'trips'}
                )
            
        ride.save()
        return Response({"status": "Trajet annulé avec succès."})

    @action(detail=True, methods=['post'], url_path='complete')
    def complete_ride(self, request, pk=None):
        ride = self.get_object()
        if ride.driver != request.user and not request.user.is_staff:
            return Response({"error": "Non autorisé."}, status=status.HTTP_403_FORBIDDEN)
        
        if ride.status == 'completed':
            return Response({"status": "Trajet déjà terminé."})
            
        ride.status = 'completed'
        ride.save()
        
        bookings = ride.bookings.filter(status__in=['pending', 'confirmed'])
        for booking in bookings:
            booking.status = 'completed'
            booking.save()
            
            # Create Transaction for Wallet
            from .models import Transaction
            if booking.payment_status in ['paid', 'escrow']:
                Transaction.objects.create(
                    user=ride.driver,
                    ride=ride,
                    transaction_type='ride',
                    amount=booking.amount_due_to_driver,
                    status='completed'
                )

            # Passager: Trajet terminé
            create_and_send_notification(
                user=booking.passenger,
                title="Trajet terminé 🏁",
                message=f"Votre trajet {ride.departure_location} -> {ride.arrival_location} est terminé. Merci d'avoir voyagé avec nous !",
                data={'type': 'ride_completed', 'booking_id': str(booking.id), 'screen': 'trips'}
            )
            # Conducteur: Passager arrivé
            create_and_send_notification(
                user=ride.driver,
                title="Passager arrivé 🏁",
                message=f"Le passager {booking.passenger.full_name or booking.passenger.phone} est bien arrivé à destination.",
                data={'type': 'passenger_arrived', 'booking_id': str(booking.id), 'screen': 'trips'}
            )
            
        return Response({"status": "Trajet terminé avec succès."})

    @action(detail=True, methods=['post'], url_path='start')
    def start_ride(self, request, pk=None):
        ride = self.get_object()
        if ride.driver != request.user and not request.user.is_staff:
            is_passenger = ride.bookings.filter(passenger=request.user, status__in=['pending', 'confirmed', 'active']).exists()
            if not is_passenger:
                return Response({"error": "Non autorisé."}, status=status.HTTP_403_FORBIDDEN)
            
        ride.status = 'started'
        ride.save()
            
        # Send notifications
        # 1. Driver: Trajet commencé
        create_and_send_notification(
            user=ride.driver,
            title="Trajet commencé 🚗",
            message=f"Votre trajet {ride.departure_location} -> {ride.arrival_location} a commencé. Bonne route !",
            data={'type': 'ride_started_driver', 'ride_id': str(ride.id), 'screen': 'trips'}
        )
        
        # 2. Passengers: Conducteur en route & Trajet commencé
        bookings = ride.bookings.filter(status__in=['pending', 'confirmed'])
        for booking in bookings:
            # Conducteur en route
            create_and_send_notification(
                user=booking.passenger,
                title="Conducteur en route 🚗",
                message=f"Le conducteur {ride.driver.full_name or ride.driver.phone} est en route pour le trajet {ride.departure_location} -> {ride.arrival_location}.",
                data={'type': 'driver_en_route', 'booking_id': str(booking.id), 'screen': 'trips'}
            )
            # Trajet commencé
            create_and_send_notification(
                user=booking.passenger,
                title="Trajet commencé 🚀",
                message=f"Le trajet {ride.departure_location} -> {ride.arrival_location} a commencé. Voyagez en toute sécurité !",
                data={'type': 'ride_started_passenger', 'booking_id': str(booking.id), 'screen': 'trips'}
            )
            
        return Response({"status": "Trajet commencé."})

class BookingViewSet(viewsets.ModelViewSet):
    """
    ViewSet gérant les réservations de places dans un trajet.
    
    Endpoints supplémentaires :
        - POST /api/bookings/{id}/accept/ : Le conducteur accepte la réservation
        - POST /api/bookings/{id}/reject/ : Le conducteur refuse
        - POST /api/bookings/{id}/cancel/ : Le passager annule
    """
    queryset = Booking.objects.all()
    serializer_class = BookingSerializer

    def get_queryset(self):
        user = self.request.user
        queryset = super().get_queryset().select_related('passenger', 'ride', 'ride__driver', 'ride__vehicle').prefetch_related('passenger__vehicles', 'ride__driver__vehicles', 'passenger__rides_driven', 'ride__driver__rides_driven')
        
        if not user.is_staff:
            from django.db.models import Q
            queryset = queryset.filter(Q(passenger=user) | Q(ride__driver=user))
            
        passenger_id = self.request.query_params.get('passenger')
        ride_driver_id = self.request.query_params.get('ride_driver')
        ride_id = self.request.query_params.get('ride')
        if passenger_id:
            queryset = queryset.filter(passenger_id=passenger_id)
        if ride_driver_id:
            queryset = queryset.filter(ride__driver_id=ride_driver_id)
        if ride_id:
            queryset = queryset.filter(ride_id=ride_id)
        return queryset

    def create(self, request, *args, **kwargs):
        from rest_framework.exceptions import ValidationError
        from datetime import date
        from django.db import transaction
        
        if not request.user.is_verified:
            raise ValidationError({"error": "Votre compte doit être vérifié pour réserver."})
        
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        ride_id = request.data.get('ride')
        seats_to_book = serializer.validated_data.get('seats_booked', 1)

        with transaction.atomic():
            # VERROUILLAGE DE LA LIGNE EN BASE DE DONNÉES POUR EMPÊCHER LES RACE CONDITIONS
            try:
                ride = Ride.objects.select_for_update().get(id=ride_id)
            except Ride.DoesNotExist:
                raise ValidationError({"error": "Trajet introuvable."})

            if ride.driver == request.user:
                raise ValidationError({"error": "Vous ne pouvez pas réserver votre propre trajet."})
                
            if ride.departure_date < date.today():
                raise ValidationError({"error": "Ce trajet est déjà passé (archivé)."})
                
            if ride.status in ['started', 'completed', 'cancelled']:
                raise ValidationError({"error": "Ce trajet n'est plus disponible pour la réservation."})
                
            # Empêcher les doublons
            existing_booking = Booking.objects.filter(ride=ride, passenger=request.user).exclude(status='cancelled').first()
            if existing_booking:
                if existing_booking.payment_status == 'pending':
                    # Vérifier si un paiement a déjà été effectué via FedaPay
                    if existing_booking.transaction_id:
                        try:
                            from django.conf import settings
                            import requests
                            api_key = settings.FEDAPAY_SECRET_KEY
                            is_sandbox = settings.FEDAPAY_ENVIRONMENT == 'sandbox'
                            if api_key.startswith('sk_live_'):
                                is_sandbox = False
                            base_url = "https://sandbox-api.fedapay.com/v1" if is_sandbox else "https://api.fedapay.com/v1"
                            headers = {
                                "Authorization": f"Bearer {api_key}",
                                "Content-Type": "application/json"
                            }
                            res = requests.get(f"{base_url}/transactions/{existing_booking.transaction_id}", headers=headers)
                            if res.status_code == 200:
                                tx_data = res.json().get('v1/transaction', {})
                                if tx_data.get('status') == 'approved':
                                    existing_booking.payment_status = 'escrow'
                                    existing_booking.status = 'confirmed'
                                    existing_booking.save()
                                    
                                    # Notifier le passager et le conducteur
                                    from .fcm import create_and_send_notification
                                    amount_due = int(existing_booking.amount_due_to_driver)
                                    commission = int(existing_booking.amount_paid_online)
                                    create_and_send_notification(
                                        user=existing_booking.passenger,
                                        title="Réservation confirmée ✅",
                                        message=f"Commission de {commission} FCFA payée. Prévoyez {amount_due} FCFA en espèces à remettre au conducteur.",
                                        data={'type': 'payment_confirmed', 'booking_id': str(existing_booking.id), 'screen': 'trips'}
                                    )
                                    if ride.driver:
                                        create_and_send_notification(
                                            user=ride.driver,
                                            title="Nouvelle réservation 🚗",
                                            message=f"{existing_booking.passenger.full_name or existing_booking.passenger.phone} vous paiera {amount_due} FCFA en espèces lors du trajet.",
                                            data={'type': 'new_booking', 'booking_id': str(existing_booking.id), 'screen': 'rides'}
                                        )
                                    raise ValidationError({"error": "Vous avez déjà une réservation confirmée suite à votre paiement."})
                        except ValidationError:
                            raise
                        except Exception:
                            pass
                    
                    # Réutiliser la réservation existante en attente de paiement
                    # Évite de détruire le lien vers la transaction FedaPay en cours de validation
                    serializer = self.get_serializer(existing_booking)
                    
                    # S'assurer que la conversation existe
                    passenger = request.user
                    driver = ride.driver
                    existing_conv = Conversation.objects.filter(
                        ride=ride,
                        conversation_type='ride'
                    ).filter(
                        Q(participant_1=passenger, participant_2=driver) |
                        Q(participant_1=driver, participant_2=passenger)
                    ).first()
                    if not existing_conv:
                        Conversation.objects.create(
                            conversation_type='ride',
                            ride=ride,
                            participant_1=passenger,
                            participant_2=driver,
                        )
                    return Response(serializer.data, status=status.HTTP_200_OK)
                else:
                    raise ValidationError({"error": "Vous avez déjà une réservation pour ce trajet."})
                
            if ride.seats_available < seats_to_book:
                raise ValidationError({"error": "Pas assez de places disponibles pour cette réservation."})

            # Decrement seats securely
            ride.seats_available -= seats_to_book
            ride.save()
            
            # Save the new booking
            booking = serializer.save(passenger=request.user)
        
        # Notifications temporairement désactivées à la création car la réservation n'est pas encore validée (payée)
        # 1. Passager: Réservation envoyée
        # create_and_send_notification(
        #     user=booking.passenger,
        #     title="Réservation envoyée 🚗",
        #     message=f"Votre demande de réservation pour le trajet {ride.departure_location} -> {ride.arrival_location} a été envoyée.",
        #     data={'type': 'booking_sent', 'booking_id': str(booking.id), 'screen': 'trips'}
        # )
        # 2. Conducteur: Nouvelle réservation
        # create_and_send_notification(
        #     user=ride.driver,
        #     title="Nouvelle réservation 👥",
        #     message=f"Le passager {booking.passenger.full_name or booking.passenger.phone} a réservé {booking.seats_booked} place(s) sur votre trajet {ride.departure_location} -> {ride.arrival_location}.",
        #     data={'type': 'new_booking', 'booking_id': str(booking.id), 'screen': 'trips'}
        # )

        
        # Auto-create a conversation between the passenger and the driver for this ride
        passenger = request.user
        driver = ride.driver
        
        existing_conv = Conversation.objects.filter(
            ride=ride,
            conversation_type='ride'
        ).filter(
            Q(participant_1=passenger, participant_2=driver) |
            Q(participant_1=driver, participant_2=passenger)
        ).first()
        
        if not existing_conv:
            existing_conv = Conversation.objects.create(
                conversation_type='ride',
                ride=ride,
                participant_1=passenger,
                participant_2=driver,
            )
            # Message automatique pour les bagages
            Message.objects.create(
                conversation=existing_conv,
                sender=driver,  # Envoyé au nom du conducteur
                content="[Message Automatique] Bonjour ! Veuillez préciser dans cette discussion si vous voyagez avec des bagages (nombre, taille, etc.) pour ce trajet.",
                message_type='text'
            )
        
        response_data = BookingSerializer(booking).data
        response_data['conversation_id'] = str(existing_conv.id)
        
        return Response(response_data, status=status.HTTP_201_CREATED)

    def perform_update(self, serializer):
        old_instance = self.get_object()
        old_status = old_instance.status
        booking = serializer.save()
        new_status = booking.status
        
        if old_status != new_status:
            ride = booking.ride
            passenger = booking.passenger
            driver = ride.driver
            
            if new_status == 'cancelled' and old_status != 'cancelled':
                # Restore seats securely
                with transaction.atomic():
                    locked_ride = Ride.objects.select_for_update().get(id=ride.id)
                    locked_ride.seats_available += booking.seats_booked
                    locked_ride.save()
                
                if old_status == 'confirmed':
                    request_user = self.request.user
                    if request_user == driver:
                        # Cancelled by driver
                        create_and_send_notification(
                            user=passenger,
                            title="Réservation annulée ❌",
                            message=f"Le conducteur a annulé votre réservation pour le trajet {ride.departure_location} -> {ride.arrival_location}.",
                            data={'type': 'booking_cancelled', 'booking_id': str(booking.id), 'screen': 'trips'}
                        )
                    else:
                        # Cancelled by passenger
                        create_and_send_notification(
                            user=driver,
                            title="Réservation annulée ❌",
                            message=f"Le passager {passenger.full_name or passenger.phone} a annulé sa réservation sur votre trajet {ride.departure_location} -> {ride.arrival_location}.",
                            data={'type': 'booking_cancelled_driver', 'booking_id': str(booking.id), 'screen': 'trips'}
                        )
            
            elif new_status == 'confirmed':
                # Conducteur: Réservation acceptée
                create_and_send_notification(
                    user=driver,
                    title="Réservation acceptée ✅",
                    message=f"Vous avez accepté la réservation du passager {passenger.full_name or passenger.phone} ({booking.seats_booked} place(s)) sur votre trajet {ride.departure_location} -> {ride.arrival_location}.",
                    data={'type': 'booking_accepted_driver', 'booking_id': str(booking.id), 'screen': 'trips'}
                )
                # Passager: Réservation acceptée
                create_and_send_notification(
                    user=passenger,
                    title="Réservation acceptée ✅",
                    message=f"Votre réservation de {booking.seats_booked} place(s) pour le trajet {ride.departure_location} -> {ride.arrival_location} a été acceptée par le conducteur !",
                    data={'type': 'booking_accepted_passenger', 'booking_id': str(booking.id), 'screen': 'trips'}
                )
                # Passager: Paiement confirmé
                create_and_send_notification(
                    user=passenger,
                    title="Paiement confirmé 💳",
                    message=f"Le paiement pour votre réservation sur le trajet {ride.departure_location} -> {ride.arrival_location} a été validé avec succès.",
                    data={'type': 'payment_confirmed', 'booking_id': str(booking.id), 'screen': 'trips'}
                )
            
            elif new_status == 'completed':
                # Conducteur: Passager arrivé
                create_and_send_notification(
                    user=driver,
                    title="Passager arrivé 🏁",
                    message=f"Le passager {passenger.full_name or passenger.phone} est bien arrivé à destination.",
                    data={'type': 'passenger_arrived', 'booking_id': str(booking.id), 'screen': 'trips'}
                )
                # Passager: Trajet terminé
                create_and_send_notification(
                    user=passenger,
                    title="Trajet terminé 🏁",
                    message=f"Votre trajet {ride.departure_location} -> {ride.arrival_location} est terminé. Merci d'avoir voyagé avec nous !",
                    data={'type': 'ride_completed', 'booking_id': str(booking.id), 'screen': 'trips'}
                )

    @action(detail=True, methods=['post'], url_path='cancel')
    def cancel_booking(self, request, pk=None):
        from datetime import datetime, timedelta
        from django.utils.timezone import make_aware, now
        from .models import RefundRequest
        
        booking = self.get_object()
        if booking.passenger != request.user and booking.ride.driver != request.user and not request.user.is_staff:
            return Response({"error": "Non autorisé."}, status=status.HTTP_403_FORBIDDEN)
            
        if booking.status == 'cancelled':
            return Response({"status": "Réservation déjà annulée."})
            
        old_status = booking.status
        booking.status = 'cancelled'
        booking.save()
        
        # Restore seats if it was confirmed/pending
        if old_status != 'cancelled':
            with transaction.atomic():
                locked_ride = Ride.objects.select_for_update().get(id=booking.ride.id)
                locked_ride.seats_available += booking.seats_booked
                locked_ride.save()
                
            ride = booking.ride
            passenger = booking.passenger
            driver = ride.driver
            
            # --- Financial Refund Logic ---
            price_paid = ride.price_per_seat * booking.seats_booked
            
            if request.user == driver:
                # Driver cancels -> 100% Refund automatically approved
                booking.payment_status = 'refunded'
                booking.save()
                RefundRequest.objects.create(
                    booking=booking,
                    passenger=passenger,
                    driver=driver,
                    amount=price_paid,
                    reason="Annulation par le conducteur",
                    status='approved'
                )
            else:
                # Passenger cancels
                ride_dt = datetime.combine(ride.departure_date, ride.departure_time)
                if not ride_dt.tzinfo:
                    try:
                        ride_dt = make_aware(ride_dt)
                    except ValueError:
                        pass
                
                time_diff = ride_dt - now()
                
                if price_paid >= 1000 and time_diff > timedelta(hours=5):
                    # Eligible for refund -> pending
                    RefundRequest.objects.create(
                        booking=booking,
                        passenger=passenger,
                        driver=driver,
                        amount=price_paid,
                        reason="Annulation par le passager à plus de 5h du départ",
                        status='pending'
                    )
                else:
                    # No refund
                    pass
            
            # Send notifications only if the booking was already confirmed/validated
            if old_status == 'confirmed':
                if request.user == driver:
                    create_and_send_notification(
                        user=passenger,
                        title="Réservation annulée ❌",
                        message=f"Le conducteur a annulé votre réservation pour le trajet {ride.departure_location} -> {ride.arrival_location}. Remboursement intégral garanti.",
                        data={'type': 'booking_cancelled', 'booking_id': str(booking.id), 'screen': 'trips'}
                    )
                    
                    conversation, _ = Conversation.objects.get_or_create(
                        conversation_type='ride',
                        ride=ride,
                        participant_1=passenger if passenger.id < driver.id else driver,
                        participant_2=driver if passenger.id < driver.id else passenger
                    )
                    Message.objects.create(
                        conversation=conversation,
                        sender=driver,
                        content=f"Bonjour, j'ai malheureusement dû annuler votre réservation pour le trajet {ride.departure_location} -> {ride.arrival_location}.",
                        message_type='text'
                    )
                else:
                    create_and_send_notification(
                        user=driver,
                        title="Réservation annulée ❌",
                        message=f"Le passager {passenger.full_name or passenger.phone} a annulé sa réservation sur votre trajet {ride.departure_location} -> {ride.arrival_location}.",
                        data={'type': 'booking_cancelled_driver', 'booking_id': str(booking.id), 'screen': 'trips'}
                    )
                    
                    conversation, _ = Conversation.objects.get_or_create(
                        conversation_type='ride',
                        ride=ride,
                        participant_1=passenger if passenger.id < driver.id else driver,
                        participant_2=driver if passenger.id < driver.id else passenger
                    )
                    Message.objects.create(
                        conversation=conversation,
                        sender=passenger,
                        content=f"Bonjour, j'ai annulé ma réservation pour le trajet {ride.departure_location} -> {ride.arrival_location}. Bonne route !",
                        message_type='text'
                    )
                
        return Response({"status": "Réservation annulée avec succès."})

    @action(detail=True, methods=['post'], url_path='complete')
    def complete_booking(self, request, pk=None):
        """Permet au passager de marquer sa réservation comme terminée."""
        booking = self.get_object()
        if booking.passenger != request.user and not request.user.is_staff:
            return Response({"error": "Non autorisé."}, status=status.HTTP_403_FORBIDDEN)
            
        if booking.status == 'completed':
            return Response({"status": "Réservation déjà terminée."})
            
        booking.status = 'completed'
        booking.save()
        
        # Trigger notifications
        ride = booking.ride
        passenger = booking.passenger
        driver = ride.driver
        
        # Conducteur: Passager arrivé
        create_and_send_notification(
            user=driver,
            title="Passager arrivé 🏁",
            message=f"Le passager {passenger.full_name or passenger.phone} est bien arrivé à destination.",
            data={'type': 'passenger_arrived', 'booking_id': str(booking.id), 'screen': 'trips'}
        )
        # Passager: Trajet terminé
        create_and_send_notification(
            user=passenger,
            title="Trajet terminé 🏁",
            message=f"Votre trajet {ride.departure_location} -> {ride.arrival_location} est terminé. Merci d'avoir voyagé avec nous !",
            data={'type': 'ride_completed', 'booking_id': str(booking.id), 'screen': 'trips'}
        )
        
        return Response({"status": "Réservation terminée avec succès."})

    @action(detail=True, methods=['post'], url_path='pay')
    def pay_booking(self, request, pk=None):
        import requests
        from django.conf import settings
        
        booking = self.get_object()
        if booking.passenger != request.user and not request.user.is_staff:
            return Response({"error": "Non autorisé."}, status=status.HTTP_403_FORBIDDEN)
            
        # Bloquer si déjà payé avec succès (escrow ou paid)
        if booking.payment_status in ['escrow', 'paid']:
            return Response({"error": "Cette réservation est déjà payée."}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            api_key = settings.FEDAPAY_SECRET_KEY
            is_sandbox = settings.FEDAPAY_ENVIRONMENT == 'sandbox'
            
            if api_key.startswith('sk_live_'):
                is_sandbox = False
                
            base_url = "https://sandbox-api.fedapay.com/v1" if is_sandbox else "https://api.fedapay.com/v1"
            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            }
            
            import urllib.parse
            frontend_callback = request.data.get('callback_url') or 'zemy://payments'
            gateway_path = f'/api/payments/callback/?booking_id={booking.id}&redirect_to={urllib.parse.quote(frontend_callback)}'
            callback_url = get_valid_callback_url(request, gateway_path)

            amount_to_pay = max(100, int(booking.amount_paid_online))

            # ============================================================
            # ANTI-DOUBLON : Réutiliser la transaction existante si PENDING
            # ============================================================
            existing_payment = Payment.objects.filter(
                booking=booking, status='PENDING'
            ).order_by('-created_at').first()
            
            if existing_payment and existing_payment.transaction_id and booking.transaction_id:
                # Régénérer un token pour la transaction existante
                transaction_id = existing_payment.transaction_id
                token_res = requests.post(
                    f"{base_url}/transactions/{transaction_id}/token",
                    headers=headers
                )
                if token_res.status_code in [200, 201]:
                    token_json = token_res.json()
                    url = token_json.get('url')
                    if not url:
                        node = token_json.get('v1/token') or token_json.get('token')
                        if isinstance(node, dict):
                            url = node.get('url')
                        elif isinstance(node, str) and node.startswith('tok_'):
                            checkout_base = "https://checkout.fedapay.com/pay/" if not is_sandbox else "https://sandbox-checkout.fedapay.com/pay/"
                            url = checkout_base + node
                    if url:
                        return Response({"url": url, "transaction_id": int(transaction_id)})
                # Si la régénération échoue, on continue pour en créer une nouvelle

            # ============================================================
            # Créer une nouvelle transaction FedaPay
            # ============================================================
            payload = {
                "description": f"Commission Zemy pour trajet {booking.ride.departure_location} -> {booking.ride.arrival_location}",
                "amount": amount_to_pay,
                "currency": {"iso": "XOF"},
                "callback_url": callback_url,
                "customer": {
                    "firstname": booking.passenger.full_name or "Passager",
                    "lastname": "Zemy",
                    "email": booking.passenger.email or "client@zemy.bj",
                    "phone_number": {
                        "number": booking.passenger.phone or "+22900000000",
                        "country": "bj"
                    }
                }
            }
                
            tx_res = requests.post(f"{base_url}/transactions", json=payload, headers=headers)
            if tx_res.status_code not in [200, 201]:
                return Response({"error": "Erreur FedaPay: " + tx_res.text}, status=status.HTTP_400_BAD_REQUEST)
                
            tx_json = tx_res.json()
            transaction_data = tx_json.get('v1/transaction') or tx_json.get('transaction') or {}
            transaction_id = transaction_data.get('id')
            
            if not transaction_id:
                return Response({"error": "Impossible de créer la transaction FedaPay. Réponse: " + str(tx_json)}, status=status.HTTP_400_BAD_REQUEST)
                
            booking.transaction_id = str(transaction_id)
            booking.save()
            
            # Enregistrement Payment (update si même transaction, sinon créer)
            Payment.objects.update_or_create(
                transaction_id=str(transaction_id),
                defaults={
                    'amount': amount_to_pay,
                    'user': booking.passenger,
                    'booking': booking,
                    'status': 'PENDING',
                    'provider': 'fedapay'
                }
            )
                 
            # Générer le token de paiement
            token_res = requests.post(f"{base_url}/transactions/{transaction_id}/token", headers=headers)
            if token_res.status_code not in [200, 201]:
                return Response({"error": "Erreur Token FedaPay: " + token_res.text}, status=status.HTTP_400_BAD_REQUEST)
                
            token_json = token_res.json()
            url = token_json.get('url')
            
            if not url:
                node = token_json.get('v1/token') or token_json.get('token')
                if isinstance(node, dict):
                    url = node.get('url')
                elif isinstance(node, str) and node.startswith('tok_'):
                    checkout_base = "https://checkout.fedapay.com/pay/" if not is_sandbox else "https://sandbox-checkout.fedapay.com/pay/"
                    url = checkout_base + node
                    
            if not url:
                return Response({"error": "Impossible d'obtenir l'URL de paiement."}, status=status.HTTP_400_BAD_REQUEST)
                
            return Response({"url": url, "transaction_id": transaction_id})
            
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


    @action(detail=True, methods=['post'], url_path='verify-payment')
    def verify_payment(self, request, pk=None):
        import requests
        from django.conf import settings
        from django.db import transaction
        from .models import Payment
        
        booking = self.get_object()
        transaction_id = request.data.get('transaction_id') or booking.transaction_id
        
        if not transaction_id:
            return Response({"error": "transaction_id requis."}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            payment = Payment.objects.filter(transaction_id=transaction_id).first()
            if payment and payment.status == 'SUCCESS':
                return Response({"already_processed": True, "status": "Paiement déjà validé avec succès."})
                
            api_key = settings.FEDAPAY_SECRET_KEY
            is_sandbox = settings.FEDAPAY_ENVIRONMENT == 'sandbox'
            
            if api_key.startswith('sk_live_'):
                is_sandbox = False
                
            base_url = "https://sandbox-api.fedapay.com/v1" if is_sandbox else "https://api.fedapay.com/v1"
            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            }
            
            res = requests.get(f"{base_url}/transactions/{transaction_id}", headers=headers)
            if res.status_code != 200:
                return Response({"error": "Impossible de récupérer la transaction: " + res.text}, status=status.HTTP_400_BAD_REQUEST)
                
            transaction_data = res.json().get('v1/transaction', {})
            tx_status = transaction_data.get('status')
            
            if tx_status == 'approved':
                with transaction.atomic():
                    payment, created = Payment.objects.select_for_update().get_or_create(
                        transaction_id=transaction_id,
                        defaults={
                            'amount': int(transaction_data.get('amount', 0)),
                            'user': booking.passenger,
                            'booking': booking,
                            'status': 'PENDING',
                            'provider': 'fedapay'
                        }
                    )
                    
                    if payment.status == 'SUCCESS':
                        return Response({"already_processed": True, "status": "Paiement déjà validé avec succès."})
                        
                    payment.status = 'SUCCESS'
                    payment.save()
                    
                    if booking.payment_status != 'escrow':
                        booking.payment_status = 'escrow'
                        booking.status = 'confirmed'
                        booking.save()
                        
                        amount_due = int(booking.amount_due_to_driver)
                        commission = int(booking.amount_paid_online)
                        
                        from .models import create_and_send_notification
                        create_and_send_notification(
                            user=booking.passenger,
                            title="Réservation confirmée ✅",
                            message=f"Commission de {commission} FCFA payée. Prévoyez {amount_due} FCFA en espèces à remettre au conducteur pour le trajet {booking.ride.departure_location} -> {booking.ride.arrival_location}.",
                            data={'type': 'payment_confirmed', 'booking_id': str(booking.id), 'screen': 'trips'}
                        )
                        
                        if booking.ride.driver_details:
                            create_and_send_notification(
                                user=booking.ride.driver_details,
                                title="Nouvelle Réservation 🚗",
                                message=f"{booking.passenger.full_name} a réservé {booking.seats_booked} place(s). Il/Elle vous paiera {amount_due} FCFA en espèces lors du trajet.",
                                data={'type': 'new_booking', 'booking_id': str(booking.id), 'screen': 'rides'}
                            )
                            
                return Response({"status": "Paiement validé avec succès."})
            elif tx_status in ['pending', 'processing', 'started', 'waiting']:
                # Distinguer : utilisateur n'a pas payé (mode=null) vs opérateur traite (mode renseigné)
                tx_mode = transaction_data.get('mode')
                payment_not_started = (tx_status == 'pending' and not tx_mode)
                return Response({
                    "status": "pending",
                    "message": "Paiement en cours de validation." if not payment_not_started else "Le paiement n'a pas été complété sur FedaPay.",
                    "payment_not_started": payment_not_started,
                    "booking_id": str(booking.id),
                    "ride_id": str(booking.ride.id) if hasattr(booking.ride, 'id') else str(booking.ride)
                })
            else:
                new_status = 'PENDING'
                if tx_status in ['declined', 'failed']:
                    new_status = 'FAILED'
                elif tx_status == 'canceled':
                    new_status = 'CANCELLED'
                elif tx_status == 'refunded':
                    new_status = 'REFUNDED'
                
                Payment.objects.filter(transaction_id=transaction_id).update(status=new_status)
                return Response({"error": f"Le paiement a échoué (statut: {tx_status})."}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class FinancialSettingsViewSet(viewsets.ModelViewSet):
    """
    ViewSet pour configurer les taux de commission globaux de Zemy.
    """
    from .models import FinancialSettings
    queryset = FinancialSettings.objects.all()
    serializer_class = FinancialSettingsSerializer

    def get_permissions(self):
        if self.request.method in permissions.SAFE_METHODS:
            return [permissions.IsAuthenticated()]
        return [permissions.IsAdminUser()]

    def get_queryset(self):
        return self.queryset.filter(pk=1)

class RefundRequestViewSet(viewsets.ModelViewSet):
    """
    ViewSet pour la gestion des litiges et demandes de remboursement.
    """
    from .models import RefundRequest
    queryset = RefundRequest.objects.all().order_by('-created_at')
    serializer_class = RefundRequestSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_staff:
            return self.queryset
        return self.queryset.filter(Q(passenger=user) | Q(driver=user))

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        if not request.user.is_staff:
            return Response({"error": "Non autorisé."}, status=status.HTTP_403_FORBIDDEN)
        
        refund = self.get_object()
        if refund.status != 'pending':
            return Response({"error": "La demande n'est plus en attente."}, status=status.HTTP_400_BAD_REQUEST)
        
        refund.status = 'approved'
        refund.booking.payment_status = 'refunded'
        refund.booking.save()
        refund.save()
        
        create_and_send_notification(
            user=refund.passenger,
            title="Remboursement approuvé 💸",
            message=f"Votre demande de remboursement de {refund.amount} FCFA a été approuvée.",
            data={'type': 'refund_approved', 'refund_id': str(refund.id)}
        )
        return Response({"status": "Remboursement approuvé."})

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        if not request.user.is_staff:
            return Response({"error": "Non autorisé."}, status=status.HTTP_403_FORBIDDEN)
        
        refund = self.get_object()
        if refund.status != 'pending':
            return Response({"error": "La demande n'est plus en attente."}, status=status.HTTP_400_BAD_REQUEST)
        
        refund.status = 'rejected'
        # The money will go to the driver
        refund.booking.payment_status = 'paid'
        refund.booking.save()
        refund.save()
        
        create_and_send_notification(
            user=refund.passenger,
            title="Remboursement refusé ❌",
            message=f"Votre demande de remboursement de {refund.amount} FCFA a été refusée par l'administration.",
            data={'type': 'refund_rejected', 'refund_id': str(refund.id)}
        )
        return Response({"status": "Remboursement refusé."})

class TransactionViewSet(viewsets.ModelViewSet):
    """
    ViewSet gérant l'historique financier des utilisateurs (Portefeuille).
    """
    from .models import Transaction
    queryset = Transaction.objects.all().order_by('-created_at')
    serializer_class = TransactionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_staff:
            return self.queryset
        return self.queryset.filter(user=user)


class ConversationViewSet(viewsets.ModelViewSet):
    """
    ViewSet gérant les conversations (Messagerie).
    """
    queryset = Conversation.objects.all()
    serializer_class = ConversationSerializer

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return Conversation.objects.none()
        
        qs = Conversation.objects.select_related('participant_1', 'participant_2', 'ride', 'ride__driver', 'ride__vehicle').prefetch_related('messages')
        
        # Admin sees all support conversations
        if user.is_staff and self.request.query_params.get('type') == 'support':
            return qs.filter(conversation_type='support').order_by('-updated_at')
        return (qs.filter(participant_1=user) | qs.filter(participant_2=user)).order_by('-updated_at')

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context

    @action(detail=False, methods=['get', 'post'], url_path='support-chat')
    def support_chat(self, request):
        """Get or create the support conversation for the current user."""
        if not request.user.is_authenticated:
            return Response({'error': 'Authentication required.'}, status=status.HTTP_401_UNAUTHORIZED)

        # Find an existing support conversation for this user
        conversation = Conversation.objects.filter(
            participant_1=request.user,
            conversation_type='support'
        ).first()

        if not conversation:
            # Create a new support conversation (participant_2 = None = admin will respond)
            conversation = Conversation.objects.create(
                participant_1=request.user,
                conversation_type='support'
            )

        serializer = ConversationSerializer(conversation, context={'request': request})
        return Response(serializer.data)

    @action(detail=False, methods=['post'], url_path='report-problem')
    def report_problem(self, request):
        if not request.user.is_authenticated:
            return Response({'error': 'Authentication required.'}, status=status.HTTP_401_UNAUTHORIZED)
            
        ride_id = request.data.get('ride_id')
        problem_desc = request.data.get('problem', 'Problème signalé.')
        latitude = request.data.get('latitude')
        longitude = request.data.get('longitude')
        
        role = "Utilisateur"
        if ride_id:
            try:
                ride = Ride.objects.get(pk=ride_id)
                if ride.driver == request.user:
                    role = "Conducteur"
                else:
                    role = "Passager"
            except Exception:
                pass
        
        conversation = Conversation.objects.filter(
            participant_1=request.user,
            conversation_type='support'
        ).first()

        if not conversation:
            conversation = Conversation.objects.create(
                participant_1=request.user,
                conversation_type='support'
            )
            
        msg_content = f"🚨 PROBLÈME SIGNALÉ 🚨\nTrajet ID: {ride_id}\nRôle: {role}\n\nDescription: {problem_desc}"
        
        Message.objects.create(
            conversation=conversation,
            sender=request.user,
            content=msg_content,
            message_type='text',
            is_urgent=True,
        )
        
        if latitude is not None and longitude is not None:
            Message.objects.create(
                conversation=conversation,
                sender=request.user,
                content="📍 Position du signalement",
                message_type='location',
                location_lat=latitude,
                location_lng=longitude,
                is_urgent=True,
            )
        
        return Response({"status": "Problème signalé à l'administration avec succès."})

    @action(detail=False, methods=['post'], url_path='ride-chat')
    def ride_chat(self, request):
        """Get or create a ride conversation between the current user and the driver."""
        if not request.user.is_authenticated:
            return Response({'error': 'Authentication required.'}, status=status.HTTP_401_UNAUTHORIZED)

        ride_id = request.data.get('ride_id')
        if not ride_id:
            return Response({'error': 'ride_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            ride = Ride.objects.get(pk=ride_id)
        except Ride.DoesNotExist:
            return Response({'error': 'Trajet introuvable.'}, status=status.HTTP_404_NOT_FOUND)

        passenger = request.user
        driver = ride.driver

        # If current user is the driver, they can also open the chat
        if passenger == driver:
            return Response({'error': 'Vous ne pouvez pas discuter avec vous-même.'}, status=status.HTTP_400_BAD_REQUEST)

        # Find or create the conversation
        conversation = Conversation.objects.filter(
            ride=ride,
            conversation_type='ride'
        ).filter(
            Q(participant_1=passenger, participant_2=driver) |
            Q(participant_1=driver, participant_2=passenger)
        ).first()

        created = False
        if not conversation:
            conversation = Conversation.objects.create(
                conversation_type='ride',
                ride=ride,
                participant_1=passenger,
                participant_2=driver,
            )
            created = True

        # If newly created, add a system welcome message
        if created:
            system_message = (
                f"🤝 Bienvenue dans votre espace de discussion !\n\n"
                f"Trajet : {ride.departure_location} → {ride.arrival_location} "
                f"le {ride.departure_date} à {str(ride.departure_time)[:5]}.\n\n"
                f"📋 Rappel des règles :\n"
                f"• Ne partagez pas votre numéro de téléphone ici\n"
                f"• Soyez respectueux et ponctuel\n"
                f"• En cas de problème, contactez le support\n\n"
                f"Bonne route ! 🚗"
            )
            Message.objects.create(
                conversation=conversation,
                sender=driver,  # Sent as driver (system-like)
                content=system_message,
                message_type='text',
            )

        serializer = ConversationSerializer(conversation, context={'request': request})
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='unread_count')
    def unread_count(self, request):
        if not request.user.is_authenticated:
            return Response({'count': 0})
            
        # Get conversations where the current user is a participant
        conversations = self.get_queryset()
        
        # Count messages that are not read and not sent by the current user
        from django.db.models import Count, Q
        unread_count = Message.objects.filter(
            conversation__in=conversations,
            is_read=False
        ).exclude(sender=request.user).count()
        
        return Response({'count': unread_count})

class MessageViewSet(viewsets.ModelViewSet):
    """
    ViewSet gérant les messages envoyés dans une conversation.
    Gère également l'upload de médias (audio, images).
    """
    queryset = Message.objects.all()
    serializer_class = MessageSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        user = self.request.user
        queryset = super().get_queryset().select_related('sender', 'conversation')
        
        if not user.is_staff:
            from django.db.models import Q
            queryset = queryset.filter(Q(conversation__participant_1=user) | Q(conversation__participant_2=user))
            
        conversation_id = self.request.query_params.get('conversation')
        if conversation_id:
            queryset = queryset.filter(conversation_id=conversation_id)
        return queryset

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context

    def perform_create(self, serializer):
        msg = serializer.save(sender=self.request.user)
        # Mark conversation as updated
        msg.conversation.save()  # triggers updated_at

    @action(detail=True, methods=['post'], url_path='mark-read')
    def mark_read(self, request, pk=None):
        """Mark all messages in a conversation as read for the current user."""
        try:
            conversation = Conversation.objects.get(pk=pk)
            conversation.messages.exclude(sender=request.user).update(is_read=True)
            return Response({'status': 'messages marked as read'})
        except Conversation.DoesNotExist:
            return Response({'error': 'Conversation not found'}, status=status.HTTP_404_NOT_FOUND)

class NotificationViewSet(viewsets.ModelViewSet):
    """
    ViewSet pour l'historique des notifications de l'utilisateur.
    """
    queryset = Notification.objects.all()
    serializer_class = NotificationSerializer

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return Notification.objects.none()
        if user.is_staff:
            # Admins voient toutes les notifications
            return Notification.objects.all().order_by('-created_at')
        # Clients voient uniquement leurs propres notifications (pas les globales user=None)
        return Notification.objects.filter(user=user).order_by('-created_at')

    @action(detail=False, methods=['post'], url_path='mark-read')
    def mark_all_read(self, request):
        if not request.user.is_authenticated:
            return Response({'error': 'Authentication required.'}, status=status.HTTP_401_UNAUTHORIZED)
        Notification.objects.filter(user=request.user, is_read=False).update(is_read=True)
        return Response({'status': 'All notifications marked as read'})

    @action(detail=True, methods=['post'], url_path='read')
    def mark_read(self, request, pk=None):
        try:
            notif = self.get_object()
            notif.is_read = True
            notif.save()
            return Response({'status': 'Notification marked as read'})
        except Notification.DoesNotExist:
            return Response({'error': 'Not found'}, status=404)

from rest_framework.views import APIView

@extend_schema(responses={200: dict}, tags=['Administration'])
class AppBrandingView(APIView):
    """
    Vue permettant de récupérer ou de modifier l'apparence (Branding) de l'application.
    """
    permission_classes = [permissions.AllowAny]
    parser_classes = (MultiPartParser, FormParser, JSONParser)

    @extend_schema(responses={200: dict})
    @extend_schema(responses={200: dict})
    def get(self, request):
        branding = AppBranding.objects.filter(is_active=True).first()
        if not branding:
            return Response({'logo': None, 'logo_scale': 1.0, 'logo_position_x': 0.0, 'logo_position_y': 0.0})
        serializer = AppBrandingSerializer(branding, context={'request': request})
        return Response(serializer.data)

    @extend_schema(request=dict, responses={200: dict})
    @extend_schema(request=dict, responses={200: dict})
    @extend_schema(request=dict, responses={200: dict})
    def put(self, request):
        if not request.user.is_authenticated or not getattr(request.user, 'is_staff', False):
            return Response({'error': 'Admin required'}, status=403)
        
        branding = AppBranding.objects.filter(is_active=True).first()
        
        # Determine if we are receiving multipart form data (with file) or JSON (just positions)
        if 'logo' in request.FILES:
            serializer = AppBrandingSerializer(branding, data=request.data, partial=True, context={'request': request})
        else:
            if not branding:
                branding = AppBranding.objects.create()
            serializer = AppBrandingSerializer(branding, data=request.data, partial=True, context={'request': request})
            
        if serializer.is_valid():
            serializer.save(is_active=True)
            return Response(serializer.data)
        return Response(serializer.errors, status=400)

class VerificationRequestViewSet(viewsets.ModelViewSet):
    """
    ViewSet pour soumettre et gérer les demandes de vérification d'identité (CNI, Selfie).
    L'administration peut approuver ou rejeter les requêtes.
    """
    queryset = VerificationRequest.objects.all().order_by('-created_at')
    serializer_class = VerificationRequestSerializer
    permission_classes = [permissions.IsAdminUser]

    @action(detail=True, methods=['post'], url_path='approve')
    def approve(self, request, pk=None):
        req = self.get_object()
        motif = request.data.get('motif', '').strip()
        req.status = 'approved'
        req.save()

        # Mettre à jour l'utilisateur directement en base
        req.user.is_verified = True
        req.user.save(update_fields=['is_verified'])

        # Notifier l'utilisateur avec le motif
        msg = "Votre demande de vérification d'identité a été approuvée. Vous pouvez maintenant utiliser toutes les fonctionnalités de l'application !"
        if motif:
            msg += f"\n\nMotif : {motif}"
        Notification.objects.create(
            user=req.user,
            title="Identité vérifiée ✅",
            message=msg,
            is_read=False,
        )
        # Envoyer notification FCM
        send_fcm_to_user(
            req.user,
            title="Identité vérifiée ✅",
            body="Votre demande de vérification a été approuvée !",
            data={'type': 'verification_approved', 'screen': 'notifications'},
        )
        return Response({'status': 'approved'})

    @action(detail=True, methods=['post'], url_path='reject')
    def reject(self, request, pk=None):
        req = self.get_object()
        motif = request.data.get('motif', '').strip()
        req.status = 'rejected'
        req.save()

        # Notifier l'utilisateur avec le motif obligatoire
        msg = "Votre demande de vérification d'identité a été rejetée."
        if motif:
            msg += f"\n\nMotif : {motif}"
        else:
            msg += " Veuillez vérifier que vos documents sont lisibles et soumettre à nouveau."
        Notification.objects.create(
            user=req.user,
            title="Vérification rejetée ❌",
            message=msg,
            is_read=False,
        )
        # Envoyer notification FCM
        send_fcm_to_user(
            req.user,
            title="Vérification rejetée ❌",
            body="Votre demande de vérification a été rejetée. Vérifiez vos documents.",
            data={'type': 'verification_rejected', 'screen': 'notifications'},
        )
        return Response({'status': 'rejected'})

class PromotionViewSet(viewsets.ModelViewSet):
    """
    ViewSet gérant les bannières promotionnelles sur l'accueil mobile.
    """
    queryset = Promotion.objects.all()
    serializer_class = PromotionSerializer
    
    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [permissions.AllowAny()]
        return [permissions.IsAdminUser()]

    def get_queryset(self):
        user = self.request.user
        if user.is_authenticated and getattr(user, 'is_staff', False):
            return Promotion.objects.all()
        return Promotion.objects.filter(is_active=True)

    def perform_create(self, serializer):
        promotion = serializer.save()
        # Notifier tous les utilisateurs de la nouvelle promotion
        send_fcm_to_all_users(
            title="🎉 Nouvelle promotion disponible !",
            body=promotion.title,
            data={'type': 'new_promotion', 'screen': 'home'},
        )

    def perform_update(self, serializer):
        promotion = serializer.save()
        if promotion.is_active:
            send_fcm_to_all_users(
                title="🔄 Promotion mise à jour",
                body=promotion.title,
                data={'type': 'promotion_updated', 'screen': 'home'},
            )

@extend_schema(responses={200: dict}, tags=['Administration'])
class MobileSettingsView(APIView):
    """
    Vue gérant les paramètres d'affichage de l'application mobile.
    """
    permission_classes = [permissions.AllowAny]

    @extend_schema(responses={200: dict})
    def get(self, request):
        settings = MobileSettings.load()
        serializer = MobileSettingsSerializer(settings)
        return Response(serializer.data)

    @extend_schema(request=dict, responses={200: dict})
    @extend_schema(request=dict, responses={200: dict})
    @extend_schema(request=dict, responses={200: dict})
    def put(self, request):
        if not request.user.is_authenticated or not getattr(request.user, 'is_staff', False):
            return Response({'error': 'Admin required'}, status=403)
        
        settings = MobileSettings.load()
        serializer = MobileSettingsSerializer(settings, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=400)
    
    def patch(self, request):
        return self.put(request)

class ParcelViewSet(viewsets.ModelViewSet):
    """
    ViewSet pour l'envoi et la gestion des colis.
    Gère la création, la tarification et le suivi (QR Code) des expéditions.
    """
    queryset = Parcel.objects.all().order_by('-created_at')
    serializer_class = ParcelSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        if not user.is_staff:
            queryset = queryset.filter(Q(sender_user=user) | Q(ride__driver=user))
            
        ride_id = self.request.query_params.get('ride')
        if ride_id:
            queryset = queryset.filter(ride_id=ride_id)
        return queryset

    def perform_create(self, serializer):
        from rest_framework.exceptions import ValidationError
        from .models import FinancialSettings
        import uuid
        
        if not self.request.user.is_verified:
            raise ValidationError({"error": "Votre compte doit être vérifié pour envoyer un colis."})
            
        ride = serializer.validated_data.get('ride')
        if not ride.accepts_parcels:
            raise ValidationError({"error": "Ce trajet n'accepte pas les colis."})
        if ride.parcels_available < 1:
            raise ValidationError({"error": "Il n'y a plus de place pour les colis dans ce trajet."})
            
        # Finance
        driver_payout = ride.price_per_parcel
        settings = FinancialSettings.load()
        if settings.is_parcel_commission_active:
            zemy_commission = int(driver_payout * (settings.parcel_commission_percentage / 100.0))
            if zemy_commission < settings.min_parcel_commission:
                zemy_commission = settings.min_parcel_commission
            if settings.max_parcel_commission and zemy_commission > settings.max_parcel_commission:
                zemy_commission = settings.max_parcel_commission
        else:
            zemy_commission = 0
            
        total_price = driver_payout + zemy_commission
        qr_data = str(uuid.uuid4())
        
        # Lock ride
        with transaction.atomic():
            locked_ride = Ride.objects.select_for_update().get(id=ride.id)
            if locked_ride.parcels_available < 1:
                raise ValidationError({"error": "Il n'y a plus de place pour les colis dans ce trajet."})
            locked_ride.parcels_available -= 1
            locked_ride.save()
            
            parcel = serializer.save(
                sender_user=self.request.user,
                price=total_price,
                zemy_commission=zemy_commission,
                driver_payout=driver_payout,
                qr_code_data=qr_data
            )
            
        # Notifications
        create_and_send_notification(
            user=ride.driver,
            title="Nouveau colis 📦",
            message=f"Une nouvelle demande de colis a été effectuée sur votre trajet.",
            data={'type': 'new_parcel', 'parcel_id': str(parcel.id), 'screen': 'trips'}
        )

    @action(detail=True, methods=['post'], url_path='pay')
    def pay_parcel(self, request, pk=None):
        import requests
        from django.conf import settings
        
        parcel = self.get_object()
        if parcel.sender_user != request.user and not request.user.is_staff:
            return Response({"error": "Non autorisé."}, status=status.HTTP_403_FORBIDDEN)
            
        # Bloquer si déjà payé avec succès
        if parcel.payment_status in ['escrow', 'paid']:
            return Response({"error": "Cette expédition est déjà payée."}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            api_key = settings.FEDAPAY_SECRET_KEY
            is_sandbox = settings.FEDAPAY_ENVIRONMENT == 'sandbox'
            if api_key.startswith('sk_live_'):
                is_sandbox = False
                
            base_url = "https://sandbox-api.fedapay.com/v1" if is_sandbox else "https://api.fedapay.com/v1"
            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            }
            
            import urllib.parse
            frontend_callback = request.data.get('callback_url') or 'zemy://payments'
            gateway_path = f'/api/payments/callback/?parcel_id={parcel.id}&redirect_to={urllib.parse.quote(frontend_callback)}'
            callback_url = get_valid_callback_url(request, gateway_path)

            amount_to_pay = max(100, int(parcel.zemy_commission))

            # ============================================================
            # ANTI-DOUBLON : Réutiliser la transaction existante si PENDING
            # ============================================================
            existing_payment = Payment.objects.filter(
                parcel=parcel, status='PENDING'
            ).order_by('-created_at').first()
            
            if existing_payment and existing_payment.transaction_id:
                transaction_id = existing_payment.transaction_id
                token_res = requests.post(
                    f"{base_url}/transactions/{transaction_id}/token",
                    headers=headers
                )
                if token_res.status_code in [200, 201]:
                    token_json = token_res.json()
                    url = token_json.get('url')
                    if not url:
                        node = token_json.get('v1/token') or token_json.get('token')
                        if isinstance(node, dict):
                            url = node.get('url')
                        elif isinstance(node, str) and node.startswith('tok_'):
                            checkout_base = "https://checkout.fedapay.com/pay/" if not is_sandbox else "https://sandbox-checkout.fedapay.com/pay/"
                            url = checkout_base + node
                    if url:
                        return Response({"url": url, "transaction_id": int(transaction_id)})
            
            # ============================================================
            # Créer une nouvelle transaction FedaPay
            # ============================================================
            payload = {
                "description": f"Commission Zemy colis {parcel.ride.departure_location} -> {parcel.ride.arrival_location}",
                "amount": amount_to_pay,
                "currency": {"iso": "XOF"},
                "callback_url": callback_url,
                "customer": {
                    "firstname": parcel.sender_user.full_name or "Client",
                    "lastname": "Zemy",
                    "email": parcel.sender_user.email or "client@zemy.bj",
                    "phone_number": {
                        "number": parcel.sender_user.phone or "+22900000000",
                        "country": "bj"
                    }
                }
            }
                
            tx_res = requests.post(f"{base_url}/transactions", json=payload, headers=headers)
            if tx_res.status_code not in [200, 201]:
                return Response({"error": "Erreur FedaPay: " + tx_res.text}, status=status.HTTP_400_BAD_REQUEST)
                
            tx_json = tx_res.json()
            transaction_data = tx_json.get('v1/transaction') or tx_json.get('transaction') or {}
            transaction_id = transaction_data.get('id')
            
            if not transaction_id:
                return Response({"error": "Impossible de créer la transaction FedaPay."}, status=status.HTTP_400_BAD_REQUEST)
                
            Payment.objects.update_or_create(
                transaction_id=str(transaction_id),
                defaults={
                    'amount': amount_to_pay,
                    'user': parcel.sender_user,
                    'parcel': parcel,
                    'status': 'PENDING',
                    'provider': 'fedapay'
                }
            )
                
            token_res = requests.post(f"{base_url}/transactions/{transaction_id}/token", headers=headers)
            if token_res.status_code not in [200, 201]:
                return Response({"error": "Erreur Token FedaPay: " + token_res.text}, status=status.HTTP_400_BAD_REQUEST)
                
            token_json = token_res.json()
            url = token_json.get('url')
            
            if not url:
                node = token_json.get('v1/token') or token_json.get('token')
                if isinstance(node, dict):
                    url = node.get('url')
                elif isinstance(node, str) and node.startswith('tok_'):
                    checkout_base = "https://checkout.fedapay.com/pay/" if not is_sandbox else "https://sandbox-checkout.fedapay.com/pay/"
                    url = checkout_base + node
                    
            if not url:
                return Response({"error": "Impossible d'obtenir l'URL de paiement."}, status=status.HTTP_400_BAD_REQUEST)
                
            return Response({"url": url, "transaction_id": transaction_id})
            
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'], url_path='verify-payment')
    def verify_payment(self, request, pk=None):
        import requests
        from django.conf import settings
        from django.db import transaction
        from .models import Payment
        
        parcel = self.get_object()
        payment = Payment.objects.filter(parcel=parcel).first()
        transaction_id = request.data.get('transaction_id') or (payment.transaction_id if payment else None)
        
        if not transaction_id:
            return Response({"error": "transaction_id requis."}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            payment = Payment.objects.filter(transaction_id=transaction_id).first()
            if payment and payment.status == 'SUCCESS':
                return Response({"already_processed": True, "status": "Paiement déjà validé avec succès."})
                
            api_key = settings.FEDAPAY_SECRET_KEY
            is_sandbox = settings.FEDAPAY_ENVIRONMENT == 'sandbox'
            if api_key.startswith('sk_live_'):
                is_sandbox = False
                
            base_url = "https://sandbox-api.fedapay.com/v1" if is_sandbox else "https://api.fedapay.com/v1"
            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            }
            
            res = requests.get(f"{base_url}/transactions/{transaction_id}", headers=headers)
            if res.status_code != 200:
                return Response({"error": "Impossible de récupérer la transaction: " + res.text}, status=status.HTTP_400_BAD_REQUEST)
                
            transaction_data = res.json().get('v1/transaction', {})
            tx_status = transaction_data.get('status')
            
            if tx_status == 'approved':
                with transaction.atomic():
                    payment, created = Payment.objects.select_for_update().get_or_create(
                        transaction_id=transaction_id,
                        defaults={
                            'amount': int(transaction_data.get('amount', 0)),
                            'user': parcel.sender_user,
                            'parcel': parcel,
                            'status': 'PENDING',
                            'provider': 'fedapay'
                        }
                    )
                    
                    if payment.status == 'SUCCESS':
                        return Response({"already_processed": True, "status": "Paiement déjà validé avec succès."})
                        
                    payment.status = 'SUCCESS'
                    payment.save()
                    
                    if parcel.payment_status != 'escrow':
                        parcel.payment_status = 'escrow'
                        parcel.status = 'accepted'
                        parcel.save()
                        
                        amount_due = parcel.driver_payout
                        
                        from .models import create_and_send_notification
                        create_and_send_notification(
                            user=parcel.ride.driver,
                            title="Nouveau Colis Confirmé 📦",
                            message=f"{parcel.sender_name} a confirmé l'envoi d'un colis. Vous recevrez {amount_due} FCFA en espèces.",
                            data={'type': 'parcel_confirmed', 'parcel_id': str(parcel.id), 'screen': 'rides'}
                        )
                        
                return Response({"status": "Paiement validé avec succès."})
            elif tx_status in ['pending', 'processing', 'started', 'waiting']:
                tx_mode = transaction_data.get('mode')
                payment_not_started = (tx_status == 'pending' and not tx_mode)
                return Response({
                    "status": "pending",
                    "message": "Paiement en cours de validation." if not payment_not_started else "Le paiement n'a pas été complété sur FedaPay.",
                    "payment_not_started": payment_not_started,
                    "parcel_id": str(parcel.id)
                })
            else:
                new_status = 'PENDING'
                if tx_status in ['declined', 'failed']:
                    new_status = 'FAILED'
                elif tx_status == 'canceled':
                    new_status = 'CANCELLED'
                elif tx_status == 'refunded':
                    new_status = 'REFUNDED'
                
                Payment.objects.filter(transaction_id=transaction_id).update(status=new_status)
                return Response({"error": f"Le paiement a échoué (statut: {tx_status})."}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'], url_path='scan_qr')
    def scan_qr(self, request, pk=None):
        parcel = self.get_object()
        qr_data = request.data.get('qr_code_data')
        action_type = request.data.get('action') # 'pickup' or 'dropoff'
        
        if not qr_data or qr_data != parcel.qr_code_data:
            return Response({"error": "QR Code invalide."}, status=status.HTTP_400_BAD_REQUEST)
            
        if request.user != parcel.ride.driver and not request.user.is_staff:
            return Response({"error": "Non autorisé."}, status=status.HTTP_403_FORBIDDEN)
            
        if action_type == 'pickup':
            if parcel.status != 'accepted' and parcel.status != 'pending':
                return Response({"error": "Statut invalide pour la récupération."}, status=status.HTTP_400_BAD_REQUEST)
            parcel.status = 'picked_up'
            parcel.save()
            if parcel.sender_user:
                create_and_send_notification(
                    user=parcel.sender_user,
                    title="Colis récupéré 📦",
                    message=f"Le conducteur a récupéré votre colis.",
                    data={'type': 'parcel_picked_up', 'parcel_id': str(parcel.id), 'screen': 'trips'}
                )
            
        elif action_type == 'dropoff':
            if parcel.status not in ['picked_up', 'in_transit']:
                return Response({"error": "Statut invalide pour la livraison."}, status=status.HTTP_400_BAD_REQUEST)
            parcel.status = 'delivered'
            parcel.payment_status = 'paid'
            parcel.save()
            
            # Create Transaction for Wallet
            from .models import Transaction
            Transaction.objects.create(
                user=parcel.ride.driver,
                parcel=parcel,
                transaction_type='parcel',
                amount=parcel.driver_payout,
                status='completed'
            )
            
            # Update user stats
            driver = parcel.ride.driver
            driver.parcels_completed += 1
            driver.save(update_fields=['parcels_completed'])
            
            if parcel.sender_user:
                create_and_send_notification(
                    user=parcel.sender_user,
                    title="Colis livré ✅",
                    message=f"Votre colis a été livré avec succès.",
                    data={'type': 'parcel_delivered', 'parcel_id': str(parcel.id), 'screen': 'trips'}
                )
            
        return Response({"status": f"Colis mis à jour : {parcel.status}"})

from .models import PopularPlace
from .serializers import PopularPlaceSerializer

class PopularPlaceViewSet(viewsets.ModelViewSet):
    queryset = PopularPlace.objects.all()
    serializer_class = PopularPlaceSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        queryset = super().get_queryset()
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search) | Q(city__icontains=search)
            )
        return queryset