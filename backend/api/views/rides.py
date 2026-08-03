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

def validate_driver_and_vehicle(driver, vehicle_id, departure_date, departure_time, duration_min, current_ride_id=None):
    """
    Vérifie la validité du conducteur, du véhicule, et l'absence de chevauchements
    horaires de trajets pour assurer la faisabilité réelle du trajet publié.
    """
    from rest_framework.exceptions import ValidationError
    from datetime import datetime, timedelta
    from ..models import Vehicle, Ride

    # 1. Vérification identité / compte
    if not driver.is_active:
        raise ValidationError({"error": "Votre compte utilisateur est inactif."})
    if not driver.is_verified:
        raise ValidationError({"error": "Votre compte doit être vérifié pour publier un trajet."})

    # 2. Vérification véhicule
    if not vehicle_id:
        vehicle = Vehicle.objects.filter(owner=driver).first()
        if not vehicle:
            raise ValidationError({"error": "Vous devez associer un véhicule à ce trajet."})
        vehicle_id = vehicle.id
    else:
        vehicle = Vehicle.objects.filter(id=vehicle_id, owner=driver).first()
        if not vehicle:
            raise ValidationError({"error": "Le véhicule sélectionné est introuvable ou ne vous appartient pas."})

    # 3. Vérification de chevauchement horaire (conflit de planning)
    if isinstance(departure_time, str):
        try:
            departure_time = datetime.strptime(departure_time, "%H:%M:%S").time()
        except ValueError:
            try:
                departure_time = datetime.strptime(departure_time, "%H:%M").time()
            except ValueError:
                pass

    new_start_dt = datetime.combine(departure_date, departure_time)
    new_duration = int(duration_min) if duration_min else 240  # 4h par défaut
    new_end_dt = new_start_dt + timedelta(minutes=new_duration)

    # Récupérer les trajets actifs pour ce jour
    existing_rides = Ride.objects.filter(
        driver=driver,
        departure_date=departure_date,
        status__in=['active', 'started']
    )
    if current_ride_id:
        existing_rides = existing_rides.exclude(id=current_ride_id)

    for r in existing_rides:
        r_start_dt = datetime.combine(r.departure_date, r.departure_time)
        r_duration = r.duration_min if r.duration_min else 240
        r_end_dt = r_start_dt + timedelta(minutes=r_duration)

        # Chevauchement si (nouveau_depart < existant_fin) et (nouveau_fin > existant_depart)
        if new_start_dt < r_end_dt and new_end_dt > r_start_dt:
            time_str = r.departure_time.strftime("%H:%M")
            raise ValidationError({
                "error": f"Vous avez déjà un trajet incompatible programmé le {departure_date.strftime('%d/%m/%Y')} (départ à {time_str} vers {r.arrival_location})."
            })


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

    def list(self, request, *args, **kwargs):
        # Chercher s'il y a des coordonnées de recherche
        dep_lat_str = request.query_params.get('departure_latitude')
        dep_lon_str = request.query_params.get('departure_longitude')
        arr_lat_str = request.query_params.get('arrival_latitude')
        arr_lon_str = request.query_params.get('arrival_longitude')
        date_str = request.query_params.get('date')
        seats_str = request.query_params.get('seats', '1')

        # Paramètres optionnels enrichis (Google Places & filtre horaire)
        dep_place_id = request.query_params.get('departure_place_id')
        arr_place_id = request.query_params.get('arrival_place_id')
        time_filter = request.query_params.get('time')  # Ex: "08:30"

        has_gps_search = (dep_lat_str and dep_lon_str) or (arr_lat_str and arr_lon_str)

        if has_gps_search and date_str:
            from datetime import datetime
            try:
                dep_lat = float(dep_lat_str) if (dep_lat_str and dep_lon_str) else None
                dep_lon = float(dep_lon_str) if (dep_lat_str and dep_lon_str) else None
                arr_lat = float(arr_lat_str) if (arr_lat_str and arr_lon_str) else None
                arr_lon = float(arr_lon_str) if (arr_lat_str and arr_lon_str) else None
                seats = int(seats_str)
            except ValueError:
                return Response({"error": "Paramètres géographiques ou nombre de places invalides."}, status=status.HTTP_400_BAD_REQUEST)

            from ..services.search_service import SearchService
            matches = SearchService.find_rides(
                dep_lat, dep_lon, arr_lat, arr_lon, date_str, seats,
                departure_place_id=dep_place_id,
                arrival_place_id=arr_place_id,
                time_filter=time_filter
            )

            # Sérialiser les résultats directs
            serialized_directs = []
            for item in matches['directs']:
                ride_data = self.get_serializer(item['ride']).data
                # Injecter les infos spécifiques au segment
                ride_data['price_per_seat'] = item['price']
                dep_t = item['departure_time']
                arr_t = item['arrival_time']
                ride_data['departure_time'] = dep_t.strftime('%H:%M:%S') if hasattr(dep_t, 'strftime') else str(dep_t)
                ride_data['arrival_time'] = arr_t.strftime('%H:%M:%S') if hasattr(arr_t, 'strftime') else str(arr_t)
                ride_data['duration_segment_min'] = item.get('duration_segment_min', ride_data.get('duration_min'))
                ride_data['seats_available'] = item['seats_available']
                ride_data['walk_distance_origin_km'] = round(item['walk_distance_origin_km'], 2)
                ride_data['walk_distance_dest_km'] = round(item['walk_distance_dest_km'], 2)
                # Injecter les indices de waypoints pour que le frontend puisse les passer
                ride_data['dep_waypoint_order'] = item.get('dep_waypoint_order')
                ride_data['arr_waypoint_order'] = item.get('arr_waypoint_order')
                # Distance Matrix enrichments
                ride_data['approach_duration_text'] = item.get('approach_duration_text')
                ride_data['approach_duration_sec'] = item.get('approach_duration_sec')
                ride_data['approach_distance_m'] = item.get('approach_distance_m')
                serialized_directs.append(ride_data)

            serialized_connections = []
            for item in matches['connections']:
                ride_1_data = self.get_serializer(item['ride_1']).data
                ride_2_data = self.get_serializer(item['ride_2']).data

                # Surcharger les prix et heures par segment pour l'affichage propre
                ride_1_data['price_per_seat'] = item['arrival_leg_1'].price
                ride_2_data['price_per_seat'] = item['arrival_leg_2'].price

                serialized_connections.append({
                    'type': 'connection',
                    'ride_1': ride_1_data,
                    'ride_2': ride_2_data,
                    'connection_point_name': item['connection_point_name'],
                    'price': item['price'],
                    'departure_time_1': item['departure_time_1'].strftime('%H:%M:%S') if isinstance(item['departure_time_1'], datetime) else str(item['departure_time_1']),
                    'arrival_time_1': item['arrival_time_1'].strftime('%H:%M:%S') if isinstance(item['arrival_time_1'], datetime) else str(item['arrival_time_1']),
                    'departure_time_2': item['departure_time_2'].strftime('%H:%M:%S') if isinstance(item['departure_time_2'], datetime) else str(item['departure_time_2']),
                    'arrival_time_2': item['arrival_time_2'].strftime('%H:%M:%S') if isinstance(item['arrival_time_2'], datetime) else str(item['arrival_time_2']),
                    'waiting_time_min': item['waiting_time_min'],
                    'seats_available': item['seats_available'],
                    'walk_distance_origin_km': round(item['walk_distance_origin_km'], 2),
                    'walk_distance_dest_km': round(item['walk_distance_dest_km'], 2),
                    'approach_duration_text': item.get('approach_duration_text'),
                    'approach_duration_sec': item.get('approach_duration_sec'),
                })

            # Si la recherche GPS retourne des résultats, les renvoyer directement
            if serialized_directs or serialized_connections:
                return Response({
                    'directs': serialized_directs,
                    'connections': serialized_connections
                }, status=status.HTTP_200_OK)

            # Fallback : si la recherche GPS ne trouve rien, tenter la recherche texte
            # (couvre les trajets publiés sans coordonnées GPS précises)
            logger.info(f"GPS search returned 0 results, falling back to text search.")
            return super().list(request, *args, **kwargs)

        return super().list(request, *args, **kwargs)

    def get_queryset(self):
        queryset = super().get_queryset().select_related('driver', 'vehicle').prefetch_related('driver__vehicles')
        
        # Filtres de recherche/filtrage envoyés par le frontend
        query_params = self.request.query_params if hasattr(self.request, 'query_params') else self.request.GET
        departure = query_params.get('departure')
        destination = query_params.get('destination')
        vehicle_type = query_params.get('vehicle_type')
        date_str = query_params.get('date')
        seats_str = query_params.get('seats')
        
        driver_id = query_params.get('driver')
        ride_type = query_params.get('type')
        
        user = getattr(self.request, 'user', None)
        is_staff = getattr(user, 'is_staff', False)

        if driver_id:
            queryset = queryset.filter(driver_id=driver_id)
        elif getattr(self, 'action', '') == 'list' and not is_staff:
            from datetime import date, timedelta
            from django.utils.timezone import now
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

        # ── Smart Location & Compatibility Matching (including stopovers & neighborhoods) ──
        if departure or destination:
            dep_clean = departure.strip().lower() if departure else ""
            dest_clean = destination.strip().lower() if destination else ""

            # Tokeniser pour des recherches par mots-clés plus souples (quartiers, villes, repères)
            def get_keywords(text):
                if not text:
                    return []
                ignore = {'bénin', 'benin', 'togo', 'nigeria', 'ghana', 'burkina', 'france', 'rue', 'avenue', 'carrefour'}
                words = []
                for w in text.replace(',', ' ').replace('/', ' ').replace('-', ' ').split():
                    w = w.strip()
                    if len(w) >= 2 and w not in ignore:
                        words.append(w)
                return words

            dep_kws = get_keywords(dep_clean)
            dest_kws = get_keywords(dest_clean)

            # Filtrage initial pour présélectionner les trajets (contenant au moins un mot-clé du départ ou de l'arrivée)
            db_filter = Q()
            if dep_kws:
                dep_q = Q()
                for kw in dep_kws:
                    dep_q |= Q(departure_location__icontains=kw) | Q(arrival_location__icontains=kw) | Q(stopovers__icontains=kw)
                db_filter &= dep_q
            if dest_kws:
                dest_q = Q()
                for kw in dest_kws:
                    dest_q |= Q(departure_location__icontains=kw) | Q(arrival_location__icontains=kw) | Q(stopovers__icontains=kw)
                db_filter &= dest_q

            candidate_qs = queryset.filter(db_filter)
            matching_ids = []

            for ride in candidate_qs:
                # Construire la liste complète et ordonnée de tous les points de passage du trajet
                places = [ride.departure_location.lower()]
                if ride.stopovers and isinstance(ride.stopovers, list):
                    for s in ride.stopovers:
                        if isinstance(s, dict) and s.get('name'):
                            places.append(s['name'].lower())
                        elif isinstance(s, str):
                            places.append(s.lower())
                places.append(ride.arrival_location.lower())

                dep_idx = -1
                dest_idx = -1

                # Trouver le premier point de passage qui correspond au départ recherché
                if dep_kws:
                    for idx, p in enumerate(places):
                        if any(kw in p for kw in dep_kws):
                            dep_idx = idx
                            break
                else:
                    dep_idx = 0

                # Trouver le point de passage qui correspond à la destination recherchée (et qui est situé APRES le départ)
                if dep_idx != -1:
                    if dest_kws:
                        for idx, p in enumerate(places):
                            if any(kw in p for kw in dest_kws) and idx > dep_idx:
                                dest_idx = idx
                                break
                    else:
                        dest_idx = len(places) - 1

                # Si les deux points ont été trouvés dans le bon ordre chronologique, le trajet est valide
                if (not dep_kws or dep_idx != -1) and (not dest_kws or dest_idx != -1):
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

            departure_time_val = departure_time
            if isinstance(departure_time_val, str):
                try:
                    departure_time_val = datetime.strptime(departure_time_val, "%H:%M:%S").time()
                except ValueError:
                    try:
                        departure_time_val = datetime.strptime(departure_time_val, "%H:%M").time()
                    except ValueError:
                        pass

            with transaction.atomic():
                from ..models import RideSeries, Ride, Vehicle
                # Valider en amont le compte et le véhicule
                validate_driver_and_vehicle(
                    driver=request.user,
                    vehicle_id=vehicle_id,
                    departure_date=start_date,
                    departure_time=departure_time_val,
                    duration_min=duration_min_val
                )

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
                        # Validation du chevauchement pour chaque date individuelle de récurrence
                        validate_driver_and_vehicle(
                            driver=request.user,
                            vehicle_id=vehicle_id,
                            departure_date=current_date,
                            departure_time=departure_time_val,
                            duration_min=duration_min_val
                        )

                        ride_obj = Ride.objects.create(
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
                        from ..services.ride_service import RideService
                        try:
                            RideService.generate_legs(ride_obj)
                        except Exception as e:
                            logger.error(f"Error generating legs for recurring ride {ride_obj.id}: {e}")
                        created_count += 1
                        
                    current_date += timedelta(days=1)
            
            return Response({"message": f"{created_count} trajets générés avec succès."}, status=status.HTTP_201_CREATED)
            
        else:
            return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        from rest_framework.exceptions import ValidationError
        from ..models import FinancialSettings, Vehicle
        
        driver_payout = serializer.validated_data.get('driver_payout', 0)
        vehicle = serializer.validated_data.get('vehicle')
        if not vehicle:
            vehicle = Vehicle.objects.filter(owner=self.request.user).first()

        departure_date = serializer.validated_data.get('departure_date')
        departure_time = serializer.validated_data.get('departure_time')
        duration_min = serializer.validated_data.get('duration_min')

        # Valider l'identité, le véhicule et le planning (chevauchements)
        validate_driver_and_vehicle(
            driver=self.request.user,
            vehicle_id=vehicle.id if vehicle else None,
            departure_date=departure_date,
            departure_time=departure_time,
            duration_min=duration_min
        )

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
        
        ride = serializer.save(
            driver=self.request.user,
            vehicle=vehicle,
            zemy_commission=zemy_commission,
            price_per_seat=price_per_seat,
            parcels_available=max_parcels
        )
        from ..services.ride_service import RideService
        try:
            RideService.generate_legs(ride)
        except Exception as e:
            logger.error(f"Error generating legs for ride {ride.id}: {e}")

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

    @action(detail=True, methods=['patch', 'post'], url_path='update_location')
    def update_location(self, request, pk=None):
        """
        Met à jour la position GPS du conducteur pendant un trajet en cours.
        
        Utilise Ride.objects.get(pk) directement (sans le filtre du queryset)
        pour éviter le 404 lors des mises à jour de position fréquentes.
        
        PATCH /api/rides/{id}/update_location/
        Body: { "driver_latitude": float, "driver_longitude": float }
        """
        try:
            ride = Ride.objects.get(pk=pk)
        except Ride.DoesNotExist:
            return Response({"error": "Trajet introuvable."}, status=status.HTTP_404_NOT_FOUND)

        if ride.driver != request.user and not request.user.is_staff:
            return Response({"error": "Non autorisé."}, status=status.HTTP_403_FORBIDDEN)

        lat = request.data.get('driver_latitude')
        lon = request.data.get('driver_longitude')

        if lat is None or lon is None:
            return Response({"error": "driver_latitude et driver_longitude requis."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            ride.driver_latitude = float(lat)
            ride.driver_longitude = float(lon)
            ride.save(update_fields=['driver_latitude', 'driver_longitude'])
        except (ValueError, TypeError):
            return Response({"error": "Coordonnées GPS invalides."}, status=status.HTTP_400_BAD_REQUEST)

        return Response({"status": "ok", "driver_latitude": ride.driver_latitude, "driver_longitude": ride.driver_longitude})

    @action(detail=True, methods=['post'], url_path='next_leg')
    def next_leg(self, request, pk=None):
        """
        Passe au tronçon suivant du trajet (BlaBlaCar-like live tracking).
        
        - Marque le tronçon en cours comme 'completed'
        - Libère les places des passagers qui descendent à cet arrêt
        - Incrémente current_leg_index
        - Notifie les passagers compatibles (SearchAlert)
        
        POST /api/rides/{id}/next_leg/
        """
        ride = self.get_object()
        if ride.driver != request.user and not request.user.is_staff:
            return Response({"error": "Non autorisé."}, status=status.HTTP_403_FORBIDDEN)

        if ride.status not in ['active', 'started']:
            return Response({"error": "Le trajet n'est pas en cours."}, status=status.HTTP_400_BAD_REQUEST)

        legs = list(ride.legs.order_by('order'))
        if not legs:
            return Response({"error": "Ce trajet ne possède pas de tronçons."}, status=status.HTTP_400_BAD_REQUEST)

        current_idx = ride.current_leg_index
        total_legs = len(legs)

        if current_idx >= total_legs:
            return Response({"error": "Tous les tronçons ont déjà été parcourus."}, status=status.HTTP_400_BAD_REQUEST)

        # Marquer le tronçon courant comme complété
        current_leg = legs[current_idx]
        current_leg.leg_status = 'completed'
        current_leg.save(update_fields=['leg_status'])

        # Identifier les bookings dont l'arrêt de descente correspond à ce leg
        freed_seats_total = 0
        from ..services.matching_service import MatchingService
        alighting_passengers = []

        for booking in ride.bookings.filter(status='confirmed').select_related('passenger'):
            arr_idx = MatchingService.get_leg_indices_for_booking(
                ride,
                booking.departure_location or ride.departure_location,
                booking.arrival_location or ride.arrival_location
            )[1]

            if arr_idx == current_idx:
                # Ce passager descend ici → libérer ses places sur les legs futurs
                dep_idx = MatchingService.get_leg_indices_for_booking(
                    ride,
                    booking.departure_location or ride.departure_location,
                    booking.arrival_location or ride.arrival_location
                )[0]
                # Les legs futurs (après cet arrêt) regagnent des places
                MatchingService.deallocate_seats_for_segment(
                    ride, current_idx + 1, total_legs - 1, booking.seats_booked
                )
                freed_seats_total += booking.seats_booked
                alighting_passengers.append(booking.passenger)

                create_and_send_notification(
                    user=booking.passenger,
                    title="Arrivée à votre arrêt 📍",
                    message=f"Vous êtes arrivé(e) à {current_leg.end_location}. Merci d'avoir voyagé avec Zemy !",
                    data={'type': 'passenger_alighting', 'booking_id': str(booking.id), 'ride_id': str(ride.id)}
                )

        # Avancer au tronçon suivant
        next_idx = current_idx + 1
        ride.current_leg_index = next_idx
        ride.status = 'started'

        if next_idx < total_legs:
            next_leg_obj = legs[next_idx]
            next_leg_obj.leg_status = 'active'
            next_leg_obj.save(update_fields=['leg_status'])
        else:
            # Tous les tronçons parcourus → marquer le trajet comme terminé
            ride.status = 'completed'

        ride.save(update_fields=['current_leg_index', 'status'])

        # Notifier le conducteur si des places se sont libérées
        if freed_seats_total > 0:
            try:
                passenger_names = ", ".join([p.full_name or "Un passager" for p in alighting_passengers])
                next_leg_seats = legs[next_idx].seats_available if next_idx < total_legs else 0
                
                seats_freed_msg = (
                    f"{passenger_names} vient/viennent de descendre à {current_leg.end_location}. "
                    f"Vous disposez encore de {next_leg_seats} places libres."
                ) if next_idx < total_legs else (
                    f"{passenger_names} vient/viennent de descendre à {current_leg.end_location}."
                )
                
                create_and_send_notification(
                    user=ride.driver,
                    title="1 place vient d'être libérée 🚗" if freed_seats_total == 1 else "Des places viennent de se libérer 🚗",
                    message=seats_freed_msg,
                    data={
                        'type': 'leg_seats_freed_driver',
                        'ride_id': str(ride.id),
                        'seats_available': next_leg_seats,
                        'screen': 'rides'
                    }
                )
            except Exception:
                pass

        # Notifier les SearchAlert compatibles si des places se sont libérées
        if freed_seats_total > 0 and next_idx < total_legs:
            try:
                from ..tasks import notify_compatible_passengers_task
                if hasattr(notify_compatible_passengers_task, 'apply_async'):
                    notify_compatible_passengers_task.apply_async(
                        (str(ride.id), next_idx, freed_seats_total), countdown=5
                    )
                else:
                    # Celery non configuré ou inactif localement, exécuter la fonction en synchrone
                    notify_compatible_passengers_task(str(ride.id), next_idx, freed_seats_total)
            except Exception:
                # Si Celery n'est pas disponible, notifier directement
                from ..services.matching_service import MatchingService as MS
                compatible = MS.find_compatible_search_alerts(ride, next_idx, freed_seats_total)
                for item in compatible:
                    create_and_send_notification(
                        user=item['passenger'],
                        title="Place disponible sur votre trajet 🎉",
                        message=f"Une place vient de se libérer sur le trajet {ride.departure_location} → {ride.arrival_location} ! Réservez maintenant.",
                        data={'type': 'seat_available', 'ride_id': str(ride.id)}
                    )

        current_leg_name = current_leg.end_location
        next_leg_name = legs[next_idx].start_location if next_idx < total_legs else "Destination finale"

        return Response({
            "status": "ok",
            "current_leg_index": next_idx,
            "completed_leg": current_leg_name,
            "next_stop": next_leg_name,
            "freed_seats": freed_seats_total,
            "alighting_passengers": len(alighting_passengers),
            "ride_status": ride.status,
        })

    @action(detail=True, methods=['get'], url_path='booking-state')
    def ride_booking_state(self, request, pk=None):
        """
        Retourne l'état de réservation calculé par le backend pour le trajet
        et le segment spécifié par les paramètres departure_order et arrival_order.
        """
        ride = self.get_object()
        dep_order = request.query_params.get('departure_order')
        arr_order = request.query_params.get('arrival_order')

        from ..bookings.booking_state_service import BookingStateService
        state = BookingStateService.get_state(request.user, ride, dep_order, arr_order)
        return Response(state)



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
        # NOTE: L'expiration des réservations est gérée exclusivement par la tâche Celery
        # `expire_booking_task`. Le lazy clean-up ici causait des requêtes N+1 et des
        # notifications FCM dupliquées à chaque GET /bookings/. Supprimé intentionnellement.

        queryset = super().get_queryset().select_related('passenger', 'ride', 'ride__driver', 'ride__vehicle').prefetch_related('ride__driver__vehicles')
        
        if not getattr(user, 'is_staff', False):
            from django.db.models import Q
            # Le passager voit toutes ses réservations.
            # Le conducteur voit toutes les réservations sur ses propres trajets.
            queryset = queryset.filter(
                Q(passenger=user) | Q(ride__driver=user)
            )
            
        query_params = self.request.query_params if hasattr(self.request, 'query_params') else self.request.GET
        passenger_id = query_params.get('passenger')
        ride_driver_id = query_params.get('ride_driver')
        ride_id = query_params.get('ride')
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
        
        departure_location = request.data.get('departure_location')
        arrival_location = request.data.get('arrival_location')
        departure_latitude = request.data.get('departure_latitude')
        departure_longitude = request.data.get('departure_longitude')
        arrival_latitude = request.data.get('arrival_latitude')
        arrival_longitude = request.data.get('arrival_longitude')

        passenger_proposed_price = request.data.get('passenger_proposed_price')
        negotiation_message = request.data.get('negotiation_message')
        departure_waypoint_order = request.data.get('departure_waypoint_order')
        arrival_waypoint_order = request.data.get('arrival_waypoint_order')

        from ..bookings.services import BookingService
        booking, created = BookingService.create_booking(
            passenger=request.user,
            ride_id=ride_id,
            seats_booked=seats_to_book,
            departure_location=departure_location,
            arrival_location=arrival_location,
            departure_latitude=departure_latitude,
            departure_longitude=departure_longitude,
            arrival_latitude=arrival_latitude,
            arrival_longitude=arrival_longitude,
            passenger_proposed_price=passenger_proposed_price,
            negotiation_message=negotiation_message,
            departure_waypoint_order=departure_waypoint_order,
            arrival_waypoint_order=arrival_waypoint_order
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
            
        # Notification agressive au conducteur pour valider la demande
        create_and_send_notification(
            user=booking.ride.driver,
            title="Nouvelle demande de réservation 🚗",
            message=f"{booking.passenger.full_name or booking.passenger.phone} souhaite réserver {booking.seats_booked} place(s) sur votre trajet {booking.ride.departure_location} -> {booking.ride.arrival_location}.",
            data={
                'type': 'new_booking_request',
                'booking_id': str(booking.id),
                'screen': 'rides',
                'passenger_name': booking.passenger.full_name or 'Passager',
                'passenger_phone': booking.passenger.phone or '',
                'departure_location': booking.departure_location or booking.ride.departure_location or '',
                'arrival_location': booking.arrival_location or booking.ride.arrival_location or '',
                'seats_booked': str(booking.seats_booked),
                'total_amount': str(booking.total_amount),
                'negotiation_message': booking.negotiation_message or '',
                'created_at': booking.created_at.isoformat()
            }
        )

        # Notification au passager que sa demande a été envoyée
        if booking.status == 'pending':
            try:
                create_and_send_notification(
                    user=booking.passenger,
                    title="Demande de réservation envoyée ⏱️",
                    message="Votre demande a été envoyée. Vous recevrez une réponse dans quelques instants.",
                    data={'type': 'booking_request_sent_passenger', 'booking_id': str(booking.id), 'screen': 'trips'}
                )
            except Exception:
                pass
            
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
                # Restore seats securely using BookingService
                if old_status == 'confirmed':
                    from ..bookings.services import BookingService
                    BookingService.deallocate_seats(booking)
                
                if old_status in ['confirmed', 'pending_payment', 'pending']:
                    request_user = self.request.user
                    if request_user == driver:
                        # Cancelled/Refused by driver
                        create_and_send_notification(
                            user=passenger,
                            title="Demande de réservation refusée ❌",
                            message=f"Le conducteur a décliné votre demande de réservation pour le trajet {ride.departure_location} -> {ride.arrival_location}.",
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
            
            elif new_status == 'pending_payment' and old_status in ['pending', 'pending_driver']:
                # Chauffeur accepte la demande -> Notifier le passager pour procéder au paiement
                create_and_send_notification(
                    user=passenger,
                    title="Demande acceptée par le conducteur 🚗",
                    message=f"Votre demande de réservation pour le trajet {ride.departure_location} -> {ride.arrival_location} a été acceptée par le conducteur ! Vous pouvez maintenant procéder au paiement.",
                    data={'type': 'booking_accepted_passenger', 'booking_id': str(booking.id), 'screen': 'trips', 'ride_id': str(booking.ride.id)}
                )
            
            elif new_status == 'confirmed':
                # Passager: Paiement confirmé & Réservation confirmée
                create_and_send_notification(
                    user=passenger,
                    title="Réservation confirmée ✅",
                    message=f"Votre réservation de {booking.seats_booked} place(s) pour le trajet {ride.departure_location} -> {ride.arrival_location} is confirmée !",
                    data={'type': 'booking_accepted_passenger', 'booking_id': str(booking.id), 'screen': 'trips', 'ride_id': str(booking.ride.id)}
                )
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
            
        from ..bookings.services import BookingService
        success, msg = BookingService.cancel_booking(booking, cancelled_by_user=request.user)
        # Push WebSocket pour informer le frontend en temps réel
        _push_booking_update(booking)
        return Response({"status": msg})

    @action(detail=True, methods=['get'], url_path='state')
    def booking_state(self, request, pk=None):
        """
        Retourne l'état canonique et complet d'une réservation.
        Le frontend n'a plus à faire de logique métier — il affiche ce que cet endpoint retourne.
        """
        booking = self.get_object()
        if booking.passenger != request.user and booking.ride.driver != request.user and not request.user.is_staff:
            return Response({"error": "Non autorisé."}, status=status.HTTP_403_FORBIDDEN)

        ride = booking.ride
        driver = ride.driver

        # Calculer le moment d'expiration estimé
        expires_at = None
        try:
            from django.utils import timezone as tz
            import datetime
            ride_datetime = tz.make_aware(
                datetime.datetime.combine(ride.departure_date, ride.departure_time)
            )
            time_diff = ride_datetime - booking.created_at
            diff_hours = time_diff.total_seconds() / 3600.0
            if diff_hours <= 24:
                limit_seconds = 1800
            elif diff_hours <= 48:
                limit_seconds = 7200
            elif diff_hours <= 168:
                limit_seconds = 43200
            else:
                limit_seconds = 86400
            expires_at = (booking.created_at + datetime.timedelta(seconds=limit_seconds)).isoformat()
        except Exception:
            pass

        # Déterminer les actions disponibles selon le statut
        available_actions = []
        if booking.status in ['pending', 'pending_driver', 'pending_passenger', 'pending_payment']:
            available_actions.append('cancel')
        if booking.status == 'pending_payment' and booking.payment_status not in ['escrow', 'paid']:
            available_actions.append('pay')
        if booking.status == 'pending_passenger':
            available_actions.extend(['accept_offer', 'reject_offer'])
        if booking.status in ['confirmed', 'started']:
            available_actions.append('cancel')

        return Response({
            'booking_id': str(booking.id),
            'status': booking.status,
            'payment_status': booking.payment_status,
            'amount': booking.total_amount,
            'driver_payout': booking.amount_due_to_driver,
            'seats_booked': booking.seats_booked,
            'departure_location': booking.departure_location or ride.departure_location,
            'arrival_location': booking.arrival_location or ride.arrival_location,
            'departure_waypoint_order': booking.departure_waypoint_order,
            'arrival_waypoint_order': booking.arrival_waypoint_order,
            'driver': {
                'id': str(driver.id),
                'name': driver.full_name or driver.phone,
                'phone': driver.phone,
            },
            'ride_id': str(ride.id),
            'ride_status': ride.status,
            'available_actions': available_actions,
            'expires_at': expires_at,
            'created_at': booking.created_at.isoformat(),
            # Informations de négociation
            'passenger_proposed_price': booking.passenger_proposed_price,
            'driver_counter_price': booking.driver_counter_price,
            'custom_price': booking.custom_price,
        })


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

        # Bloquer si le conducteur n'a pas encore validé
        if booking.status != 'pending_payment':
            return Response({"error": "Vous ne pouvez pas effectuer le paiement avant la validation du chauffeur."}, status=status.HTTP_400_BAD_REQUEST)

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

    @action(detail=True, methods=['post'], url_path='accept')
    def accept_booking(self, request, pk=None):
        """
        Le conducteur accepte la demande de réservation du passager.
        Passe le statut à 'pending_passenger' (attente confirmation passager) ou 'pending_payment'.
        """
        booking = self.get_object()
        if booking.ride.driver != request.user and not request.user.is_staff:
            return Response({"error": "Seul le conducteur de ce trajet peut accepter cette réservation."}, status=status.HTTP_403_FORBIDDEN)
            
        if booking.status not in ['pending', 'pending_driver']:
            return Response({"error": f"Impossible d'accepter une réservation au statut actuel: {booking.status}."}, status=status.HTTP_400_BAD_REQUEST)
            
        price_val = request.data.get('price') or request.data.get('custom_price') or request.data.get('driver_counter_price')
        if price_val is not None:
            try:
                booking.driver_counter_price = int(price_val)
            except ValueError:
                return Response({"error": "Le prix proposé est invalide."}, status=status.HTTP_400_BAD_REQUEST)
        else:
            if booking.passenger_proposed_price is not None:
                booking.custom_price = booking.passenger_proposed_price

        # Si le chauffeur a fait une contre-proposition, le passager doit valider
        if booking.driver_counter_price is not None:
            booking.status = 'pending_passenger'
            title = "Nouvelle offre tarifaire 🚗"
            message = f"Le chauffeur propose un tarif de {booking.total_amount} FCFA. Veuillez valider."
        else:
            # Sinon, acceptation directe sans contre-proposition -> direct au paiement
            booking.status = 'pending_payment'
            title = "Demande acceptée par le conducteur 🚗"
            message = f"Votre demande de réservation a été acceptée par le conducteur ! Vous pouvez procéder au paiement."

        booking.save()
        
        # Notifier le passager
        create_and_send_notification(
            user=booking.passenger,
            title=title,
            message=message,
            data={'type': 'booking_accepted_passenger', 'booking_id': str(booking.id), 'screen': 'trips', 'amount': str(booking.total_amount), 'ride_id': str(booking.ride.id)}
        )
        # Push WebSocket temps réel
        _push_booking_update(booking)
        return Response({"status": "Réservation acceptée.", "booking_status": booking.status})


    @action(detail=True, methods=['post'], url_path='reject')
    def reject_booking(self, request, pk=None):
        """
        Le conducteur refuse la demande de réservation du passager.
        Passe le statut à 'cancelled' (annulée).
        """
        booking = self.get_object()
        if booking.ride.driver != request.user and not request.user.is_staff:
            return Response({"error": "Seul le conducteur de ce trajet peut refuser cette réservation."}, status=status.HTTP_403_FORBIDDEN)
            
        if booking.status not in ['pending', 'pending_passenger', 'pending_payment']:
            return Response({"error": f"Impossible de refuser une réservation déjà traitée (statut actuel: {booking.status})."}, status=status.HTTP_400_BAD_REQUEST)
            
        booking.status = 'cancelled'
        booking.save()
        
        # Notifier le passager
        create_and_send_notification(
            user=booking.passenger,
            title="Demande de réservation déclinée ❌",
            message=f"Le conducteur a refusé votre demande de réservation pour le trajet {booking.ride.departure_location} -> {booking.ride.arrival_location}.",
            data={'type': 'booking_rejected_passenger', 'booking_id': str(booking.id), 'screen': 'trips'}
        )
        # Push WebSocket temps réel
        _push_booking_update(booking)
        return Response({"status": "Réservation déclinée avec succès."})


    @action(detail=True, methods=['post'], url_path='passenger_accept')
    def passenger_accept(self, request, pk=None):
        """
        Le passager accepte la proposition de prix du chauffeur.
        Passe le statut à 'pending_payment'.
        """
        booking = self.get_object()
        if booking.passenger != request.user and not request.user.is_staff:
            return Response({"error": "Seul le passager de cette réservation peut l'accepter."}, status=status.HTTP_403_FORBIDDEN)
            
        if booking.status != 'pending_passenger':
            return Response({"error": f"Statut invalide pour acceptation passager: {booking.status}."}, status=status.HTTP_400_BAD_REQUEST)
            
        if booking.driver_counter_price is not None:
            booking.custom_price = booking.driver_counter_price
        booking.status = 'pending_payment'
        booking.save()
        
        # Notifier le conducteur
        create_and_send_notification(
            user=booking.ride.driver,
            title="Offre validée par le passager 👍",
            message=f"Le passager {booking.passenger.full_name or booking.passenger.phone} a accepté votre tarif de {booking.total_amount} FCFA et procède au paiement.",
            data={'type': 'passenger_accepted_offer', 'booking_id': str(booking.id), 'screen': 'rides'}
        )
        # Push WebSocket temps réel
        _push_booking_update(booking)
        return Response({"status": "Proposition acceptée. En attente de paiement.", "booking_status": booking.status})


    @action(detail=True, methods=['post'], url_path='passenger_reject')
    def passenger_reject(self, request, pk=None):
        """
        Le passager refuse la proposition du chauffeur.
        Annule la réservation (statut 'cancelled').
        """
        booking = self.get_object()
        if booking.passenger != request.user and not request.user.is_staff:
            return Response({"error": "Seul le passager de cette réservation peut la refuser."}, status=status.HTTP_403_FORBIDDEN)
            
        if booking.status not in ['pending', 'pending_passenger', 'pending_payment']:
            return Response({"error": f"Statut invalide pour refus passager: {booking.status}."}, status=status.HTTP_400_BAD_REQUEST)
            
        booking.status = 'cancelled'
        booking.save()
        
        # Notifier le conducteur
        create_and_send_notification(
            user=booking.ride.driver,
            title="Proposition refusée ❌",
            message=f"{booking.passenger.full_name or booking.passenger.phone} a refusé votre proposition.",
            data={'type': 'passenger_refused_offer', 'booking_id': str(booking.id), 'screen': 'rides'}
        )
        # Push WebSocket temps réel
        _push_booking_update(booking)
        return Response({"status": "Proposition refusée. Réservation annulée.", "booking_status": booking.status})


def _push_booking_update(booking):
    """
    Envoie une mise à jour de statut via WebSocket au passager.
    Silencieux en cas d'erreur (Channels peut ne pas être actif en développement).
    """
    try:
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync
        channel_layer = get_channel_layer()
        if channel_layer:
            async_to_sync(channel_layer.group_send)(
                f"booking_{booking.id}",
                {
                    "type": "booking_update",
                    "booking_id": str(booking.id),
                    "status": booking.status,
                    "amount": booking.total_amount,
                    "payment_status": booking.payment_status,
                }
            )
    except Exception:
        pass




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

# updated




