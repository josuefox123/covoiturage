# pyrefly: ignore [missing-import]
from drf_spectacular.utils import extend_schema, extend_schema_view, OpenApiParameter, OpenApiTypes
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from django.contrib.auth import get_user_model
from django.db.models import Q
from django.db import models, transaction
from django.views.decorators.csrf import csrf_exempt
from django.utils import timezone
from datetime import timedelta
import random
import os
import logging
from django.conf import settings
from django.core.mail import EmailMultiAlternatives
import email
import email.policy

logger = logging.getLogger(__name__)

from ..models import (
    Vehicle, UserPreference, Ride, Booking, Conversation, Message, Notification, 
    AppBranding, VerificationRequest, Promotion, MobileSettings,
    FinancialSettings, RefundRequest, Transaction, Parcel, Payment, PasswordResetOTP, PopularPlace,
    AuditLog
)
from ..serializers import (
    UserSerializer, AdminUserSerializer, VehicleSerializer, UserPreferenceSerializer, 
    RideSerializer, BookingSerializer, ConversationSerializer, MessageSerializer, NotificationSerializer, AppBrandingSerializer,
    VerificationRequestSerializer, PromotionSerializer, MobileSettingsSerializer,
    FinancialSettingsSerializer, RefundRequestSerializer, TransactionSerializer, ParcelSerializer, PopularPlaceSerializer
)
from ..fcm import send_fcm_to_user, send_fcm_to_all_users, create_and_send_notification

User = get_user_model()

import firebase_admin
from firebase_admin import credentials, auth as firebase_auth

try:
    if not firebase_admin._apps:
        cred_path = os.path.join(settings.BASE_DIR, 'firebase-adminsdk.json')
        if os.path.exists(cred_path):
            cred = credentials.Certificate(cred_path)
            firebase_admin.initialize_app(cred)
except Exception:
    pass

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
        if getattr(user, 'is_archived', False):
            return Response({
                "detail": "Votre compte a été archivé. Veuillez contacter le support Zemy."
            }, status=status.HTTP_403_FORBIDDEN)
            
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
    from ..serializers import RegisterSerializer
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

    if user and getattr(user, 'is_archived', False):
        return Response({
            "detail": "Votre compte a été archivé. Veuillez contacter le support Zemy."
        }, status=status.HTTP_403_FORBIDDEN)

    if user and user.check_password(password):
        refresh = RefreshToken.for_user(user)
        user_data = UserSerializer(user).data
        user_data['is_staff'] = getattr(user, 'is_staff', False)
        user_data['is_superuser'] = getattr(user, 'is_superuser', False)
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
        if user.is_authenticated and getattr(user, 'is_staff', False):
            if self.action == 'list':
                qs = User.objects.filter(is_archived=False)
                is_staff_param = self.request.query_params.get('is_staff')
                if is_staff_param == 'true':
                    qs = qs.filter(is_staff=True)
                elif is_staff_param == 'false':
                    qs = qs.filter(is_staff=False)
                return qs.order_by('-created_at')
            return User.objects.all().order_by('-created_at')
        if user.is_authenticated:
            return User.objects.filter(id=user.id, is_archived=False)
        return User.objects.none()

    @action(detail=False, methods=['post'], url_path='create-admin', permission_classes=[permissions.IsAdminUser])
    def create_admin(self, request):
        full_name = request.data.get('full_name')
        email = request.data.get('email')
        phone = request.data.get('phone')

        if not email or not full_name:
            return Response({"error": "Nom et email sont requis."}, status=status.HTTP_400_BAD_REQUEST)
        
        if User.objects.filter(email=email).exists():
            return Response({"error": "Un utilisateur avec cet email existe déjà."}, status=status.HTTP_400_BAD_REQUEST)
        
        if phone and User.objects.filter(phone=phone).exists():
            return Response({"error": "Un utilisateur avec ce téléphone existe déjà."}, status=status.HTTP_400_BAD_REQUEST)

        import secrets
        password = secrets.token_hex(6)  # Generates 12 hex characters password
        
        with transaction.atomic():
            user = User.objects.create(
                email=email,
                full_name=full_name,
                phone=phone,
                is_staff=True,
                is_active=True,
                is_verified=True
            )
            user.set_password(password)
            user.save()
            
            subject = "Création de votre compte Administrateur Zemy"
            html_message = f"""
            <!DOCTYPE html>
            <html>
            <head><meta charset="utf-8"></head>
            <body style="font-family: Arial, sans-serif; background-color: #F8FAFC; color: #0F172A; padding: 40px;">
                <div style="max-width: 580px; margin: 0 auto; background: #FFFFFF; padding: 40px; border-radius: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
                    <h2 style="color: #2563EB;">Bienvenue sur Zemy !</h2>
                    <p>Bonjour {full_name},</p>
                    <p>Un compte administrateur a été créé pour vous sur le tableau de bord Zemy.</p>
                    <p>Voici vos identifiants de connexion :</p>
                    <p><strong>Email :</strong> {email}</p>
                    <p><strong>Mot de passe :</strong> {password}</p>
                    <p>Nous vous conseillons de vous connecter et de modifier ce mot de passe depuis votre profil dès que possible.</p>
                    <p>Cordialement,<br>L'équipe Zemy</p>
                </div>
            </body>
            </html>
            """
            
            msg = EmailMultiAlternatives(
                subject=subject,
                body=f"Bonjour {full_name},\nVotre mot de passe est : {password}",
                from_email=settings.DEFAULT_FROM_EMAIL,
                to=[email]
            )
            msg.attach_alternative(html_message, "text/html")
            msg.send(fail_silently=True)

        return Response({"status": "Administrateur créé avec succès.", "email": email})

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAdminUser])
    def archive(self, request, pk=None):
        user = self.get_object()
        reason = request.data.get('reason', '')
        
        with transaction.atomic():
            user.is_archived = True
            user.is_active = False
            user.archived_at = timezone.now()
            user.archived_by = request.user
            user.archive_reason = reason
            user.save(update_fields=['is_archived', 'is_active', 'archived_at', 'archived_by', 'archive_reason'])
            
            # Invalidate Django sessions
            from django.contrib.sessions.models import Session
            for s in Session.objects.filter(expire_date__gte=timezone.now()):
                data = s.get_decoded()
                if data.get('_auth_user_id') == str(user.id):
                    s.delete()
                    
            # Create AuditLog
            AuditLog.objects.create(
                admin_user=request.user,
                target_user=user,
                action="archive",
                reason=reason
            )
            
        return Response({"status": "Utilisateur archivé avec succès."})

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAdminUser])
    def restore(self, request, pk=None):
        user = self.get_object()
        
        with transaction.atomic():
            user.is_archived = False
            user.is_active = True
            user.archived_at = None
            user.archived_by = None
            user.archive_reason = ''
            user.save(update_fields=['is_archived', 'is_active', 'archived_at', 'archived_by', 'archive_reason'])
            
            # Create AuditLog
            AuditLog.objects.create(
                admin_user=request.user,
                target_user=user,
                action="restore",
                reason="Restauration du compte utilisateur"
            )
            
        return Response({"status": "Utilisateur restauré avec succès."})

    @action(detail=True, methods=['delete'], url_path='permanent-delete', permission_classes=[permissions.IsAdminUser])
    def permanent_delete(self, request, pk=None):
        user = self.get_object()
        full_name = getattr(user, 'full_name', 'Anonyme') or 'Anonyme'
        phone = getattr(user, 'phone', 'N/A')
        email = getattr(user, 'email', 'N/A')
        user_details = f"{full_name} (Tél: {phone}, Email: {email})"
        
        with transaction.atomic():
            # Create AuditLog
            AuditLog.objects.create(
                admin_user=request.user,
                target_user=None,
                action="permanent_delete",
                reason=f"Suppression définitive de l'utilisateur : {user_details}"
            )
            # Delete user (will cascade delete related objects)
            user.delete()
            
        return Response({"status": "Utilisateur supprimé définitivement avec succès."})

    @action(detail=False, methods=['get'], permission_classes=[permissions.IsAdminUser])
    def archived(self, request):
        queryset = User.objects.filter(is_archived=True).order_by('-archived_at')
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
            
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

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
        if getattr(user, 'is_staff', False):
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


logger = logging.getLogger(__name__)

# SafeEmailMultiAlternatives class was removed. Standard Django EmailMultiAlternatives and MIMEImage are used instead.


def send_zemy_reset_email(full_name, email, code):
    subject = "Réinitialisation de votre mot de passe Zemy"
    
    html_message = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>{subject}</title>
        <style>
            body {{
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                background-color: #F8FAFC;
                color: #0F172A;
                margin: 0;
                padding: 0;
                -webkit-font-smoothing: antialiased;
            }}
            .container {{
                max-width: 580px;
                margin: 30px auto;
                background: #FFFFFF;
                border-radius: 20px;
                padding: 40px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
                border: 1px solid #E2E8F0;
            }}
            .header {{
                text-align: center;
                margin-bottom: 30px;
            }}
            .logo-image {{
                height: 50px;
                vertical-align: middle;
                display: inline-block;
            }}
            .brand-name {{
                font-size: 28px;
                font-weight: 800;
                color: #0F172A;
                letter-spacing: 0.5px;
                vertical-align: middle;
                display: inline-block;
                margin-left: 8px;
            }}
            .logo-tagline {{
                font-size: 12px;
                color: #94A3B8;
                font-weight: 500;
                letter-spacing: 0.5px;
                margin-top: 8px;
            }}
            h1 {{
                font-size: 20px;
                font-weight: 700;
                color: #0F172A;
                margin-top: 0;
                margin-bottom: 20px;
            }}
            p {{
                font-size: 15px;
                line-height: 24px;
                color: #475569;
                margin-bottom: 20px;
            }}
            .otp-container {{
                background-color: #F1F5F9;
                border-radius: 14px;
                padding: 24px;
                text-align: center;
                margin: 25px 0;
                border: 1px solid #E2E8F0;
            }}
            .otp-code {{
                font-size: 32px;
                font-weight: 800;
                letter-spacing: 6px;
                color: #2563EB;
                margin: 0;
            }}
            .warning-text {{
                font-size: 13px;
                color: #94A3B8;
                line-height: 20px;
            }}
            .footer {{
                margin-top: 35px;
                border-top: 1px solid #E2E8F0;
                padding-top: 25px;
                text-align: center;
            }}
            .footer-brand {{
                font-weight: 700;
                color: #0F172A;
                font-size: 14px;
                margin-bottom: 4px;
            }}
            .footer-tagline {{
                font-size: 12px;
                color: #94A3B8;
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div style="display: inline-block; vertical-align: middle;">
                    <img src="cid:logo_zemy" class="logo-image" alt="Logo Zemy" />
                  
                </div>
                <div class="logo-tagline" style="margin-top: 4px;">Transport & covoiturage</div>
            </div>
            
            <h1>Bonjour {full_name},</h1>
            
            <p>Nous avons reçu une demande de réinitialisation de votre mot de passe Zemy.</p>
            
            <p>Votre code de vérification est :</p>
            
            <div class="otp-container">
                <div class="otp-code">{code}</div>
            </div>
            
            <p>Ce code est valable pendant <strong>10 minutes</strong>.</p>
            
            <p class="warning-text">Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email en toute sécurité.</p>
            
            <p>Merci de votre confiance.</p>
            
            <div class="footer">
                <div class="footer-brand">L'équipe Zemy</div>
                <div class="footer-tagline">Transport • Livraison • Mobilité</div>
            </div>
        </div>
    </body>
    </html>
    """
    
    text_message = f"""Bonjour {full_name},

Nous avons reçu une demande de réinitialisation de votre mot de passe Zemy.

Votre code de vérification est :

{code}

Ce code est valable pendant 10 minutes.

Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email en toute sécurité.

Merci de votre confiance.

L'équipe Zemy
Transport • Livraison • Mobilité"""

    try:
        from django.core.mail import EmailMultiAlternatives
        from email.mime.image import MIMEImage

        msg = EmailMultiAlternatives(
            subject=subject,
            body=text_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[email]
        )
        msg.attach_alternative(html_message, "text/html")

        # Attacher le fichier logozemy.png en tant que ressource inline
        logo_path = os.path.join(settings.BASE_DIR, 'static', 'logozemy.png')
        if os.path.exists(logo_path):
            with open(logo_path, 'rb') as f:
                img_data = f.read()
                image = MIMEImage(img_data)
                image.add_header('Content-ID', '<logo_zemy>')
                image.add_header('Content-Disposition', 'inline', filename='logozemy.png')
                msg.attach(image)
        else:
            logger.warning(f"Fichier logo non trouvé à l'emplacement : {logo_path}")

        msg.send(fail_silently=False)
        logger.info(f"Email OTP de réinitialisation de mot de passe envoyé avec succès à {email}")
        return True
    except Exception as e:
        logger.error(f"Échec de l'envoi de l'email OTP à {email} : {str(e)}")
        raise e



@extend_schema(request=dict, responses={200: dict, 400: dict, 500: dict}, tags=['Authentification'])
@api_view(['POST'])
@permission_classes([permissions.AllowAny])
@csrf_exempt
def send_reset_code(request):
    """
    Génère et envoie un code OTP à l'adresse e-mail spécifiée pour réinitialiser le mot de passe.
    """
    email = request.data.get('email') or request.data.get('email_or_phone')
    if not email:
        return Response({'error': "L'adresse email est requise."}, status=status.HTTP_400_BAD_REQUEST)
    
    email = email.strip()
    user = User.objects.filter(email__iexact=email).first()
    if not user:
        return Response({'error': "Aucun compte n'est associé à cette adresse email."}, status=status.HTTP_404_NOT_FOUND)
    
    # Supprimer les OTP précédents pour cet e-mail
    PasswordResetOTP.objects.filter(email__iexact=email).delete()
    
    # Générer le code
    code = str(random.randint(100000, 999999))
    PasswordResetOTP.objects.create(email=email.lower(), code=code)
    
    # Envoyer l'email
    try:
        send_zemy_reset_email(user.full_name or "Utilisateur Zemy", email, code)
        return Response({'message': "Code de réinitialisation envoyé avec succès par email."}, status=status.HTTP_200_OK)
    except Exception as e:
        return Response({'error': "Une erreur est survenue lors de l'envoi de l'e-mail. Veuillez vérifier votre configuration."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@extend_schema(request=dict, responses={200: dict, 400: dict}, tags=['Authentification'])
@api_view(['POST'])
@permission_classes([permissions.AllowAny])
@csrf_exempt
def verify_reset_code(request):
    """
    Vérifie si le code OTP fourni pour un e-mail est correct, non expiré et n'a pas dépassé les tentatives.
    """
    email = request.data.get('email') or request.data.get('email_or_phone')
    code = request.data.get('code')
    
    if not email or not code:
        return Response({'error': "L'adresse email et le code OTP sont requis."}, status=status.HTTP_400_BAD_REQUEST)
    
    email = email.strip()
    otp = PasswordResetOTP.objects.filter(email__iexact=email).first()
    if not otp:
        return Response({'error': "Aucun code n'a été demandé pour cette adresse email."}, status=status.HTTP_400_BAD_REQUEST)
    
    if otp.is_verified:
        return Response({'message': "Code déjà vérifié avec succès."}, status=status.HTTP_200_OK)
        
    if otp.attempts >= 5:
        return Response({'error': "Nombre maximum de tentatives de validation dépassé. Veuillez demander un nouveau code."}, status=status.HTTP_400_BAD_REQUEST)
        
    # Vérification de la date d'expiration (10 minutes)
    if timezone.now() - otp.created_at > timedelta(minutes=10):
        return Response({'error': "Le code de validation a expiré. Veuillez en demander un nouveau."}, status=status.HTTP_400_BAD_REQUEST)
        
    if otp.code != code:
        otp.attempts += 1
        otp.save()
        remaining = 5 - otp.attempts
        if remaining <= 0:
            return Response({'error': "Nombre maximum de tentatives dépassé. Veuillez demander un nouveau code."}, status=status.HTTP_400_BAD_REQUEST)
        return Response({'error': f"Code de validation incorrect. Il vous reste {remaining} tentatives."}, status=status.HTTP_400_BAD_REQUEST)
        
    # Validation réussie
    otp.is_verified = True
    otp.save()
    return Response({'message': "Code vérifié avec succès."}, status=status.HTTP_200_OK)


@extend_schema(request=dict, responses={200: dict, 400: dict, 404: dict}, tags=['Authentification'])
@api_view(['POST'])
@permission_classes([permissions.AllowAny])
@csrf_exempt
def reset_password(request):
    """
    Modifie le mot de passe après vérification réussie du code OTP.
    """
    email = request.data.get('email') or request.data.get('email_or_phone')
    code = request.data.get('code')
    password = request.data.get('password')
    
    if not email or not code or not password:
        return Response({'error': "Tous les champs sont requis."}, status=status.HTTP_400_BAD_REQUEST)
        
    email = email.strip()
    otp = PasswordResetOTP.objects.filter(email__iexact=email).first()
    if not otp or not otp.is_verified:
        return Response({'error': "Veuillez d'abord vérifier le code de validation OTP."}, status=status.HTTP_400_BAD_REQUEST)
        
    if timezone.now() - otp.created_at > timedelta(minutes=10):
        return Response({'error': "Le code de validation a expiré. Veuillez recommencer la procédure."}, status=status.HTTP_400_BAD_REQUEST)
        
    user = User.objects.filter(email__iexact=email).first()
    if not user:
        return Response({'error': "Utilisateur introuvable."}, status=status.HTTP_404_NOT_FOUND)
        
    # Modifier le mot de passe
    user.set_password(password)
    user.save()
    
    # Supprimer l'OTP pour empêcher toute réutilisation
    otp.delete()
    
    return Response({'message': "Votre mot de passe a été modifié avec succès."}, status=status.HTTP_200_OK)

@extend_schema(request=dict, responses={200: dict, 400: dict}, tags=['Authentification'])
@api_view(['PUT'])
@permission_classes([permissions.IsAuthenticated])
def update_profile(request):
    """
    Permet à l'administrateur connecté de modifier ses informations.
    """
    user = request.user
    full_name = request.data.get('full_name')
    email = request.data.get('email')
    phone = request.data.get('phone')

    if email and email != user.email and User.objects.filter(email=email).exclude(id=user.id).exists():
        return Response({'error': 'Cet email est déjà utilisé.'}, status=status.HTTP_400_BAD_REQUEST)
    
    if phone and phone != user.phone and User.objects.filter(phone=phone).exclude(id=user.id).exists():
        return Response({'error': 'Ce numéro de téléphone est déjà utilisé.'}, status=status.HTTP_400_BAD_REQUEST)

    if full_name:
        user.full_name = full_name
    if email:
        user.email = email
    if phone:
        user.phone = phone
        
    user.save()
    
    if user.is_staff:
        data = AdminUserSerializer(user, context={'request': request}).data
    else:
        data = UserSerializer(user, context={'request': request}).data
        
    return Response({"status": "Profil mis à jour", "user": data})

@extend_schema(request=dict, responses={200: dict, 400: dict}, tags=['Authentification'])
@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def change_password(request):
    """
    Permet à l'administrateur de modifier son mot de passe depuis le profil.
    """
    user = request.user
    old_password = request.data.get('old_password')
    new_password = request.data.get('new_password')
    
    if not old_password or not new_password:
        return Response({"error": "Veuillez fournir l'ancien et le nouveau mot de passe."}, status=status.HTTP_400_BAD_REQUEST)
        
    if not user.check_password(old_password):
        return Response({"error": "L'ancien mot de passe est incorrect."}, status=status.HTTP_400_BAD_REQUEST)
        
    user.set_password(new_password)
    user.save()
    
    return Response({"status": "Mot de passe modifié avec succès."})
