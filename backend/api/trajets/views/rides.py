from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Q
from django.db import transaction
from django.utils import timezone
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

from ...models.trajet import Ride, RideSeries
from ...models.utilisateur import Vehicle
from ...serializers import RideSerializer
from .helpers import validate_driver_and_vehicle
from .ride_actions import RideActionsMixin

class RideViewSet(RideActionsMixin, viewsets.ModelViewSet):
    """
    ViewSet principal pour la gestion des trajets.
    
    Endpoints supplémentaires :
        - GET /api/rides/suggest-price/ : Suggestion de prix basée sur la distance
        - POST /api/rides/{id}/cancel/ : Annulation par le conducteur (hérité de RideActionsMixin)
        - POST /api/rides/{id}/start/ : Démarrer un trajet (hérité de RideActionsMixin)
        - POST /api/rides/{id}/complete/ : Terminer un trajet (hérité de RideActionsMixin)
        - POST /api/rides/{id}/update_location/ : Mettre à jour la position GPS
        - POST /api/rides/{id}/next_leg/ : Passer au tronçon suivant (hérité de RideActionsMixin)
    """
    queryset = Ride.objects.all().order_by('-created_at')
    serializer_class = RideSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def list(self, request, *args, **kwargs):
        dep_lat_str = request.query_params.get('departure_latitude')
        dep_lon_str = request.query_params.get('departure_longitude')
        arr_lat_str = request.query_params.get('arrival_latitude')
        arr_lon_str = request.query_params.get('arrival_longitude')
        date_str = request.query_params.get('date')
        seats_str = request.query_params.get('seats', '1')

        dep_place_id = request.query_params.get('departure_place_id')
        arr_place_id = request.query_params.get('arrival_place_id')
        time_filter = request.query_params.get('time')

        has_gps_search = (dep_lat_str and dep_lon_str) or (arr_lat_str and arr_lon_str)

        if has_gps_search and date_str:
            try:
                dep_lat = float(dep_lat_str) if (dep_lat_str and dep_lon_str) else None
                dep_lon = float(dep_lon_str) if (dep_lat_str and dep_lon_str) else None
                arr_lat = float(arr_lat_str) if (arr_lat_str and arr_lon_str) else None
                arr_lon = float(arr_lon_str) if (arr_lat_str and arr_lon_str) else None
                seats = int(seats_str)
            except ValueError:
                return Response({"error": "Paramètres géographiques ou nombre de places invalides."}, status=status.HTTP_400_BAD_REQUEST)

            from api.services.search_service import SearchService
            matches = SearchService.find_rides(
                dep_lat, dep_lon, arr_lat, arr_lon, date_str, seats,
                departure_place_id=dep_place_id,
                arrival_place_id=arr_place_id,
                time_filter=time_filter
            )

            serialized_directs = []
            for item in matches['directs']:
                ride_data = self.get_serializer(item['ride']).data
                ride_data['price_per_seat'] = item['price']
                dep_t = item['departure_time']
                arr_t = item['arrival_time']
                ride_data['departure_time'] = dep_t.strftime('%H:%M:%S') if hasattr(dep_t, 'strftime') else str(dep_t)
                ride_data['arrival_time'] = arr_t.strftime('%H:%M:%S') if hasattr(arr_t, 'strftime') else str(arr_t)
                ride_data['duration_segment_min'] = item.get('duration_segment_min', ride_data.get('duration_min'))
                ride_data['seats_available'] = item['seats_available']
                ride_data['walk_distance_origin_km'] = round(item['walk_distance_origin_km'], 2)
                ride_data['walk_distance_dest_km'] = round(item['walk_distance_dest_km'], 2)
                ride_data['dep_waypoint_order'] = item.get('dep_waypoint_order')
                ride_data['arr_waypoint_order'] = item.get('arr_waypoint_order')
                ride_data['approach_duration_text'] = item.get('approach_duration_text')
                ride_data['approach_duration_sec'] = item.get('approach_duration_sec')
                ride_data['approach_distance_m'] = item.get('approach_distance_m')
                serialized_directs.append(ride_data)

            serialized_connections = []
            for item in matches['connections']:
                ride_1_data = self.get_serializer(item['ride_1']).data
                ride_2_data = self.get_serializer(item['ride_2']).data

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

            if serialized_directs or serialized_connections:
                return Response({
                    'directs': serialized_directs,
                    'connections': serialized_connections
                }, status=status.HTTP_200_OK)

            logger.info("GPS search returned 0 results, falling back to text search.")
            return super().list(request, *args, **kwargs)

        return super().list(request, *args, **kwargs)

    def get_queryset(self):
        queryset = super().get_queryset().select_related('driver', 'vehicle').prefetch_related('driver__vehicles')
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
            from datetime import date
            queryset = queryset.filter(
                Q(departure_date__gte=date.today()) | Q(status='started')
            ).exclude(status='cancelled').exclude(status='completed')
        
        if vehicle_type:
            queryset = queryset.filter(vehicle__vehicle_type=vehicle_type)
        if seats_str:
            try:
                queryset = queryset.filter(seats_available__gte=1)
              except ValueError:
                pass
        if ride_type == 'parcel':
            queryset = queryset.filter(accepts_parcels=True)

        if departure or destination:
            dep_clean = departure.strip().lower() if departure else ""
            dest_clean = destination.strip().lower() if destination else ""

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

                if dep_kws:
                    for idx, p in enumerate(places):
                        if any(kw in p for kw in dep_kws):
                            dep_idx = idx
                            break
                else:
                    dep_idx = 0

                if dep_idx != -1:
                    if dest_kws:
                        for idx, p in enumerate(places):
                            if any(kw in p for kw in dest_kws) and idx > dep_idx:
                                dest_idx = idx
                                break
                    else:
                        dest_idx = len(places) - 1

                if (not dep_kws or dep_idx != -1) and (not dest_kws or dest_idx != -1):
                    matching_ids.append(ride.id)

            queryset = queryset.filter(id__in=matching_ids)

        if date_str:
            try:
                target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
                queryset = queryset.filter(departure_date=target_date)
            except ValueError:
                pass

        return queryset

    @action(detail=False, methods=['get'], url_path='suggest-price', permission_classes=[permissions.IsAuthenticated])
    def suggest_price(self, request):
        try:
            query_params = request.query_params if hasattr(request, 'query_params') else request.GET
            distance_km = float(query_params.get('distance_km', 0))
        except (ValueError, TypeError):
            return Response({'error': 'distance_km invalide.'}, status=status.HTTP_400_BAD_REQUEST)

        if distance_km <= 0:
            return Response({'error': 'distance_km doit être un nombre positif.'}, status=status.HTTP_400_BAD_REQUEST)

        from ...models.paiement import FinancialSettings
        fin_settings = FinancialSettings.load()
        price_per_km = fin_settings.price_per_km
        margin = fin_settings.price_margin_percent

        raw_price = distance_km * price_per_km
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
            
            from ...models.paiement import FinancialSettings
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
                        from api.services.ride_service import RideService
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
        from ...models.paiement import FinancialSettings
        
        driver_payout = serializer.validated_data.get('driver_payout', 0)
        vehicle = serializer.validated_data.get('vehicle')
        if not vehicle:
            vehicle = Vehicle.objects.filter(owner=self.request.user).first()

        departure_date = serializer.validated_data.get('departure_date')
        departure_time = serializer.validated_data.get('departure_time')
        duration_min = serializer.validated_data.get('duration_min')

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
        from api.services.ride_service import RideService
        try:
            RideService.generate_legs(ride)
        except Exception as e:
            logger.error(f"Error generating legs for ride {ride.id}: {e}")

    @action(detail=True, methods=['patch', 'post'], url_path='update_location')
    def update_location(self, request, pk=None):
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

    @action(detail=True, methods=['get'], url_path='booking-state')
    def ride_booking_state(self, request, pk=None):
        ride = self.get_object()
        dep_order = request.query_params.get('departure_order')
        arr_order = request.query_params.get('arrival_order')

        from api.bookings.booking_state_service import BookingStateService
        state = BookingStateService.get_state(request.user, ride, dep_order, arr_order)
        return Response(state)
