from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Q
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

from ...models import Ride
from ...models.utilisateur import Vehicle
from ...serializers import RideSerializer
from .ride_actions import RideActionsMixin
from ...controllers.rides.ride_publication_controller import RidePublicationController

class RideViewSet(RideActionsMixin, viewsets.ModelViewSet):
    """
    ViewSet principal pour la gestion des trajets.
    
    Toute la logique de publication unique/récurrente a été déléguée
    au RidePublicationController.
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
                    if dep_idx != -1 and dest_idx != -1 and dep_idx >= dest_idx:
                        continue
                    matching_ids.append(ride.id)

            queryset = queryset.filter(id__in=matching_ids)

        if date_str:
            try:
                target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
                queryset = queryset.filter(departure_date=target_date)
            except ValueError:
                pass

        return queryset.order_by('-created_at')

    @action(detail=False, methods=['get'], url_path='suggest-price', permission_classes=[permissions.IsAuthenticated])
    def suggest_price(self, request):
        try:
            query_params = request.query_params if hasattr(request, 'query_params') else request.GET
            distance_km = float(query_params.get('distance_km', 0))
        except (ValueError, TypeError):
            return Response({'error': 'distance_km invalide.'}, status=status.HTTP_400_BAD_REQUEST)

        if distance_km <= 0:
            return Response({'error': 'distance_km doit être un nombre positif.'}, status=status.HTTP_400_BAD_REQUEST)

        result = RidePublicationController.suggest_price(distance_km)
        return Response(result, status=status.HTTP_200_OK)

    def create(self, request, *args, **kwargs):
        is_recurrent = request.data.get('is_recurrent', False)

        if is_recurrent:
            result = RidePublicationController.publish_recurrent_rides(
                user=request.user,
                data=request.data
            )
            return Response(result, status=status.HTTP_201_CREATED)
        else:
            result = RidePublicationController.publish_ride(
                user=request.user,
                data=request.data,
                serializer_class=RideSerializer
            )
            return Response(result, status=status.HTTP_201_CREATED)

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
