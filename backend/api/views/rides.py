# pyrefly: ignore [missing-import]
# force deploy v2
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
    FinancialSettings, RefundRequest, Transaction, Parcel, Payment, PasswordResetOTP, PopularPlace
)
from ..serializers import (
    UserSerializer, AdminUserSerializer, VehicleSerializer, UserPreferenceSerializer, 
    RideSerializer, BookingSerializer, ConversationSerializer, MessageSerializer, NotificationSerializer, AppBrandingSerializer,
    VerificationRequestSerializer, PromotionSerializer, MobileSettingsSerializer,
    FinancialSettingsSerializer, RefundRequestSerializer, TransactionSerializer, ParcelSerializer, PopularPlaceSerializer
)
from ..fcm import send_fcm_to_user, send_fcm_to_all_users, create_and_send_notification
from .auth import get_valid_callback_url

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
    query_params = request.query_params if hasattr(request, 'query_params') else request.GET
    email = query_params.get('email', '').strip()
    phone = query_params.get('phone', '').strip()

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

class RideViewSet(viewsets.ModelViewSet):
    """
    ViewSet principal pour la gestion des trajets.
    
    Endpoints supplémentaires :
        - GET /api/rides/suggest-price/ : Suggestion de prix basée sur la distance
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
        
        # Filtres de recherche/filtrage envoyés par le frontend
        departure = self.request.query_params.get('departure')
        destination = self.request.query_params.get('destination')
        vehicle_type = self.request.query_params.get('vehicle_type')
        date_str = self.request.query_params.get('date')
        seats_str = self.request.query_params.get('seats')
        
        driver_id = self.request.query_params.get('driver')
        ride_type = self.request.query_params.get('type')
        
        user = getattr(self.request, 'user', None)
        is_staff = getattr(user, 'is_staff', False)

        if driver_id:
            queryset = queryset.filter(driver_id=driver_id)
        elif getattr(self, 'action', '') == 'list' and not is_staff:
            from datetime import date, timedelta
            from django.utils.timezone import now
            from django.db.models import Q
            one_hour_ago = now() - timedelta(hours=1)
            queryset = queryset.filter(
                Q(departure_date__gte=date.today()) | Q(status='started')
            ).exclude(status='cancelled').exclude(status='completed')
        
        # Appliquer les filtres de recherche
        if vehicle_type:
            queryset = queryset.filter(vehicle__vehicle_type=vehicle_type)
        if seats_str:
            try:
                # We filter for rides with at least 1 seat available, and warn on frontend if insufficient
                queryset = queryset.filter(seats_available__gte=1)
            except ValueError:
                pass
        if ride_type == 'parcel':
            queryset = queryset.filter(accepts_parcels=True)

        # ── Smart Location & Compatibility Matching (including stopovers) ──
        if departure or destination:
            def extract_city(loc_str):
                if not loc_str:
                    return ""
                parts = [p.strip() for p in loc_str.replace('/', ',').split(',') if p.strip()]
                if not parts:
                    return loc_str.strip().lower()
                ignore = {'bénin', 'benin', 'togo', 'nigeria', 'ghana', 'burkina', 'france'}
                clean_parts = [p for p in parts if p.lower() not in ignore]
                return clean_parts[-1] if clean_parts else parts[0]

            dep_clean = departure.strip() if departure else ""
            dest_clean = destination.strip() if destination else ""
            dep_city = extract_city(dep_clean).lower()
            dest_city = extract_city(dest_clean).lower()

            from django.db.models import Q
            
            # Initial DB filter to pre-select rides containing dep_city or dest_city to optimize queryset size
            db_filter = Q()
            if dep_city:
                db_filter &= (
                    Q(departure_location__icontains=dep_city) |
                    Q(arrival_location__icontains=dep_city) |
                    Q(stopovers__icontains=dep_city)
                )
            if dest_city:
                db_filter &= (
                    Q(departure_location__icontains=dest_city) |
                    Q(arrival_location__icontains=dest_city) |
                    Q(stopovers__icontains=dest_city)
                )
                
            candidate_qs = queryset.filter(db_filter)
            
            # Precise Python-level filtering to ensure chronological ordering
            matching_ids = []
            for ride in candidate_qs:
                places = [ride.departure_location]
                if ride.stopovers and isinstance(ride.stopovers, list):
                    for s in ride.stopovers:
                        if isinstance(s, dict) and s.get('name'):
                            places.append(s['name'])
                        elif isinstance(s, str):
                            places.append(s)
                places.append(ride.arrival_location)
                
                place_cities = [extract_city(p).lower() for p in places]
                
                dep_idx = -1
                dest_idx = -1
                
                if dep_city:
                    for idx, pc in enumerate(place_cities):
                        if dep_city in pc:
                            dep_idx = idx
                            break
                else:
                    dep_idx = 0
                    
                if dep_idx != -1:
                    if dest_city:
                        for idx, pc in enumerate(place_cities):
                            if dest_city in pc and idx > dep_idx:
                                dest_idx = idx
                                break
                    else:
                        dest_idx = len(place_cities) - 1
                        
                if (not dep_city or dep_idx != -1) and (not dest_city or dest_idx != -1):
                    matching_ids.append(ride.id)
                    
            queryset = queryset.filter(id__in=matching_ids)

        # ── Date filtering (strict matching) ──
        if date_str:
            try:
                from datetime import datetime
                target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
                queryset = queryset.filter(departure_date=target_date)
            except ValueError:
                pass

        return queryset

    @action(detail=False, methods=['get'], url_path='suggest-price', permission_classes=[permissions.IsAuthenticated])
    def suggest_price(self, request):
        """
        Retourne un prix conseillé et les bornes min/max basés sur la distance.

        Paramètres GET :
            - distance_km : distance du trajet en kilomètres (obligatoire)

        Retourne :
            - suggested_price : prix conseillé (arrondi à 100 FCFA)
            - min_price : borne basse autorisée
            - max_price : borne haute autorisée
            - price_per_km : tarif configuré (FCFA/km)
            - margin_percent : marge appliquée
        """
        try:
            query_params = request.query_params if hasattr(request, 'query_params') else request.GET
            distance_km = float(query_params.get('distance_km', 0))
        except (ValueError, TypeError):
            return Response({'error': 'distance_km invalide.'}, status=status.HTTP_400_BAD_REQUEST)

        if distance_km <= 0:
            return Response({'error': 'distance_km doit être un nombre positif.'}, status=status.HTTP_400_BAD_REQUEST)

        fin_settings = FinancialSettings.load()
        price_per_km = fin_settings.price_per_km
        margin = fin_settings.price_margin_percent

        raw_price = distance_km * price_per_km
        # Arrondir au multiple de 100 le plus proche
        suggested_price = int(round(raw_price / 100.0) * 100)
        min_price = int(round(suggested_price * (1 - margin / 100.0) / 100.0) * 100)
        max_price = int(round(suggested_price * (1 + margin / 100.0) / 100.0) * 100)

        return Response({
            'suggested_price': suggested_price,
            'min_price': min_price,
            'max_price': max_price,
            'price_per_km': price_per_km,
            'margin_percent': margin,
        })

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
            
            from ..models import FinancialSettings
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
            
            # Préférences conducteur
            music = request.data.get('music', True)
            smoking = request.data.get('smoking', False)
            chatty = request.data.get('chatty', True)
            air_conditioner = request.data.get('air_conditioner', True)
            pets_allowed = request.data.get('pets_allowed', False)
            luggage_allowed = request.data.get('luggage_allowed', True)
            stops_allowed = request.data.get('stops_allowed', True)
            description = request.data.get('description', '')
            distance_km_val = request.data.get('distance_km')
            duration_min_val = request.data.get('duration_min')

            with transaction.atomic():
                from ..models import RideSeries, Ride, Vehicle
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
                            arrival_longitude=arr_lon,
                            # Préférences
                            music=music,
                            smoking=smoking,
                            chatty=chatty,
                            air_conditioner=air_conditioner,
                            pets_allowed=pets_allowed,
                            luggage_allowed=luggage_allowed,
                            stops_allowed=stops_allowed,
                            description=description,
                            distance_km=float(distance_km_val) if distance_km_val else None,
                            duration_min=int(duration_min_val) if duration_min_val else None,
                        )
                        created_count += 1
                        
                    current_date += timedelta(days=1)
            
            return Response({"message": f"{created_count} trajets générés avec succès."}, status=status.HTTP_201_CREATED)
            
        else:
            return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        from rest_framework.exceptions import ValidationError
        from ..models import FinancialSettings
        if not self.request.user.is_verified:
            raise ValidationError({"error": "Votre compte doit être vérifié pour publier un trajet."})
            
        driver_payout = serializer.validated_data.get('driver_payout', 0)
        fin_settings = FinancialSettings.load()
        if fin_settings.is_commission_active:
            zemy_commission = int(driver_payout * (fin_settings.commission_percentage / 100.0))
            if zemy_commission < fin_settings.min_commission:
                zemy_commission = fin_settings.min_commission
            if fin_settings.max_commission and zemy_commission > fin_settings.max_commission:
                zemy_commission = fin_settings.max_commission
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
        from ..models import RefundRequest
        
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
            from ..models import Transaction
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
            # Le passager voit ses réservations (y compris en attente pour régulariser le paiement)
            # Le conducteur ne voit QUE les réservations ayant réellement payé (payment_status != 'pending')
            queryset = queryset.filter(
                Q(passenger=user) | 
                (Q(ride__driver=user) & ~Q(payment_status='pending') & Q(status__in=['confirmed', 'active', 'completed']))
            )
            
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
        
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        ride_id = request.data.get('ride')
        seats_to_book = serializer.validated_data.get('seats_booked', 1)
        
        from ..bookings.services import BookingService
        booking, created = BookingService.create_booking(
            passenger=request.user,
            ride_id=ride_id,
            seats_booked=seats_to_book
        )
        
        if not created:
            return Response(self.get_serializer(booking).data, status=status.HTTP_200_OK)
            
        existing_conv = Conversation.objects.filter(
            ride=booking.ride,
            conversation_type='ride'
        ).filter(
            Q(participant_1=request.user, participant_2=booking.ride.driver) |
            Q(participant_1=booking.ride.driver, participant_2=request.user)
        ).first()
        
        if existing_conv:
            Message.objects.get_or_create(
                conversation=existing_conv,
                sender=booking.ride.driver,
                content="[Message Automatique] Bonjour ! Veuillez préciser dans cette discussion si vous voyagez avec des bagages (nombre, taille, etc.) pour ce trajet.",
                defaults={'message_type': 'text'}
            )
            
        response_data = BookingSerializer(booking).data
        if existing_conv:
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
        booking = self.get_object()
        if booking.passenger != request.user and booking.ride.driver != request.user and not request.user.is_staff:
            return Response({"error": "Non autorisé."}, status=status.HTTP_403_FORBIDDEN)
            
        from ..services.booking_service import BookingService
        success, msg = BookingService.cancel_booking(booking, cancelled_by_user=request.user)
        return Response({"status": msg})

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
        """
        Génère l'URL de paiement WebView pour FeexPay.
        """
        booking = self.get_object()
        if booking.passenger != request.user and not request.user.is_staff:
            return Response({"error": "Non autorisé."}, status=status.HTTP_403_FORBIDDEN)
            
        if booking.payment_status in ['escrow', 'paid']:
            return Response({"error": "Cette réservation est déjà payée."}, status=status.HTTP_400_BAD_REQUEST)

        # Bloquer si le trajet est terminé ou annulé
        if booking.ride and booking.ride.status in ['completed', 'cancelled']:
            return Response({"error": "Ce trajet est terminé. Le paiement n'est plus possible."}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            import urllib.parse
            amount_to_pay = max(100, int(booking.amount_paid_online))
            description = f"Commission Zemy - Trajet {booking.ride.departure_location} -> {booking.ride.arrival_location}"
            
            import time
            # Construire l'URL absolue vers notre page de checkout de paiement
            path = (
                f"/api/payments/checkout/"
                f"?amount={amount_to_pay}"
                f"&custom_id={booking.id}"
                f"&fullname={urllib.parse.quote(booking.passenger.full_name or 'Client Zemy')}"
                f"&email={urllib.parse.quote(booking.passenger.email or 'client@zemy.bj')}"
                f"&phone={urllib.parse.quote(booking.passenger.phone or '')}"
                f"&description={urllib.parse.quote(description)}"
                f"&_t={int(time.time())}"
            )
            url = request.build_absolute_uri(path)
            
            # Retourner l'URL de paiement
            return Response({
                "url": url, 
                "booking_id": str(booking.id),
                "amount": amount_to_pay
            })
            
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)



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




