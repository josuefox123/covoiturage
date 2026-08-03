import math
import logging
import hashlib
from datetime import datetime, timedelta
from django.utils import timezone
from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger(__name__)

from ...models.trajet import Ride, RideLeg, RideWaypoint, DirectionsCache

def get_haversine_distance(lat1, lon1, lat2, lon2):
    """Calcule la distance Haversine en km entre deux points GPS."""
    if not all([lat1, lon1, lat2, lon2]):
        return 9999.0
    R = 6371.0
    try:
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
        return R * c
    except Exception:
        return 9999.0

def decode_polyline(polyline_str):
    """Décode une chaîne de caractères polyline de Google Maps en liste de coordonnées GPS (lat, lon)."""
    if not polyline_str:
        return []
    index, lat, lng = 0, 0, 0
    coordinates = []
    while index < len(polyline_str):
        b, shift, result = 0, 0, 0
        while True:
            b = ord(polyline_str[index]) - 63
            index += 1
            result |= (b & 0x1f) << shift
            shift += 5
            if b < 0x20:
                break
        dlat = ~(result >> 1) if (result & 1) else (result >> 1)
        lat += dlat
        shift, result = 0, 0
        while True:
            b = ord(polyline_str[index]) - 63
            index += 1
            result |= (b & 0x1f) << shift
            shift += 5
            if b < 0x20:
                break
        dlng = ~(result >> 1) if (result & 1) else (result >> 1)
        lng += dlng
        coordinates.append((lat / 1e5, lng / 1e5))
    return coordinates

def get_ride_polyline_points(ride):
    """
    Récupère la polyline Google Maps du trajet depuis le DirectionsCache.
    """
    try:
        dep_key = ride.departure_place_id or f"{ride.departure_latitude},{ride.departure_longitude}"
        arr_key = ride.arrival_place_id or f"{ride.arrival_latitude},{ride.arrival_longitude}"
        stopovers = ride.stopovers or []
        waypoints_str = "|".join(
            s.get('place_id') or f"{s.get('latitude')},{s.get('longitude')}"
            for s in stopovers
        )
        hash_input = f"{dep_key}|{waypoints_str}|{arr_key}"
        waypoints_hash = hashlib.sha256(hash_input.encode('utf-8')).hexdigest()
        cache_obj = DirectionsCache.objects.filter(waypoints_hash=waypoints_hash).first()
        if cache_obj and cache_obj.route_data:
            routes = cache_obj.route_data.get('routes', [])
            if routes:
                points_str = routes[0].get('overview_polyline', {}).get('points', '')
                if points_str:
                    return decode_polyline(points_str)
    except Exception as e:
        logger.warning(f"Error retrieving polyline for ride {ride.id}: {e}")
    return []

def _find_closest_waypoint(waypoints, lat, lon, max_radius_km=None):
    best_wp = None
    best_dist = 9999.0

    for wp in waypoints:
        d = get_haversine_distance(lat, lon, wp.latitude, wp.longitude)
        w_type = getattr(wp, 'waypoint_type', 'gps')
        if w_type in ['departure', 'arrival', 'stopover'] or getattr(wp, 'is_stopover', False):
            allowed_radius = 5.0
        elif w_type == 'city':
            allowed_radius = 3.0
        else:
            allowed_radius = 1.0
            
        if d <= allowed_radius and d < best_dist:
            best_dist = d
            best_wp = wp

    return best_wp, best_dist if best_wp else 9999.0

def _categorize_approach(distance_km):
    dist_m = distance_km * 1000
    if distance_km <= 0.5:
        return 0.5, f"{max(1, int(dist_m / 83))} min à pied"
    elif distance_km <= 1.0:
        return 1.0, f"{max(1, int(dist_m / 416))} min en zem"
    elif distance_km <= 3.0:
        return 3.0, f"{max(1, int(dist_m / 416))} min en zem"
    elif distance_km <= 5.0:
        return 5.0, f"{max(1, int(dist_m / 500))} min en taxi"
    elif distance_km <= 10.0:
        return 10.0, f"{max(1, int(dist_m / 500))} min en taxi / zem"
    else:
        return 15.0, f"{max(1, int(dist_m / 500))} min en taxi"


class SearchService:
    MAX_RADIUS_KM = 2.0

    @staticmethod
    def find_rides(departure_lat, departure_lon, arrival_lat, arrival_lon, target_date,
                   seats_requested=1, departure_place_id=None, arrival_place_id=None,
                   time_filter=None):
        """
        Recherche de trajets BlaBlaCar-like.
        """
        if isinstance(target_date, str):
            target_date = datetime.strptime(target_date, "%Y-%m-%d").date()

        lat_d_r = round(departure_lat, 3) if departure_lat is not None else 0.0
        sample_lon_d = round(departure_lon, 3) if departure_lon is not None else 0.0
        lat_a_r = round(arrival_lat, 3) if arrival_lat is not None else 0.0
        sample_lon_a = round(arrival_lon, 3) if arrival_lon is not None else 0.0
        
        cache_key = f"search_v2_{lat_d_r}_{sample_lon_d}_{lat_a_r}_{sample_lon_a}_{target_date}_{seats_requested}"
        if departure_place_id:
            cache_key += f"_{departure_place_id}"
        if arrival_place_id:
            cache_key += f"_{arrival_place_id}"
        if time_filter:
            cache_key += f"_{time_filter}"

        cached_res = cache.get(cache_key)
        if cached_res:
            logger.info(f"Serve search results from cache: {cache_key}")
            return cached_res

        base_filters = {
            'departure_date': target_date,
            'status__in': ['active', 'started'],
        }
        candidate_rides = (
            Ride.objects
            .filter(**base_filters)
            .select_related('driver', 'vehicle')
            .prefetch_related('legs', 'waypoints')
        )

        if time_filter:
            try:
                wanted_time = datetime.strptime(time_filter, "%H:%M").time()
                dt_ref = datetime.combine(target_date, wanted_time)
                dt_min = timezone.make_aware(dt_ref - timedelta(hours=1))
                dt_max = timezone.make_aware(dt_ref + timedelta(hours=1))
                candidate_rides = candidate_rides.filter(
                    departure_time__gte=dt_min.time(),
                    departure_time__lte=dt_max.time()
                )
            except Exception:
                pass

        direct_matches = []
        for ride in candidate_rides:
            result = SearchService._match_ride(
                ride, departure_lat, departure_lon, arrival_lat, arrival_lon,
                seats_requested
            )
            if result:
                direct_matches.append(result)

        direct_matches = sorted(
            direct_matches,
            key=lambda x: (
                x.get('radius_category', 15.0),
                x.get('walk_distance_origin_km', 0.0) + x.get('walk_distance_dest_km', 0.0),
                x.get('price', 99999),
                x.get('departure_time')
            )
        )

        results = {'directs': direct_matches, 'connections': []}
        cache.set(cache_key, results, 120)
        return results

    @staticmethod
    def _match_ride(ride, departure_lat, departure_lon, arrival_lat, arrival_lon, seats_requested):
        MAX_RADIUS_KM = SearchService.MAX_RADIUS_KM

        waypoints = list(ride.waypoints.order_by('order'))
        if waypoints:
            return SearchService._match_via_waypoints(
                ride, waypoints, departure_lat, departure_lon,
                arrival_lat, arrival_lon, seats_requested, MAX_RADIUS_KM
            )

        polyline = get_ride_polyline_points(ride)

        if not polyline:
            legs = list(ride.legs.order_by('order'))
            for leg in legs:
                if leg.start_latitude and abs(leg.start_latitude) > 0.001:
                    polyline.append((leg.start_latitude, leg.start_longitude))
            if legs:
                last = legs[-1]
                if last.end_latitude and abs(last.end_latitude) > 0.001:
                    polyline.append((last.end_latitude, last.end_longitude))

        if not polyline:
            if ride.departure_latitude and abs(ride.departure_latitude) > 0.001:
                polyline.append((ride.departure_latitude, ride.departure_longitude))
            if ride.arrival_latitude and abs(ride.arrival_latitude) > 0.001:
                polyline.append((ride.arrival_latitude, ride.arrival_longitude))

        if not polyline:
            return None

        return SearchService._match_via_polyline(
            ride, polyline, departure_lat, departure_lon,
            arrival_lat, arrival_lon, seats_requested, MAX_RADIUS_KM
        )

    @staticmethod
    def _match_via_waypoints(ride, waypoints, dep_lat, dep_lon, arr_lat, arr_lon,
                              seats_requested, max_radius_km):
        dep_wp, dep_dist = (
            _find_closest_waypoint(waypoints, dep_lat, dep_lon, max_radius_km)
            if dep_lat is not None else (waypoints[0], 0.0)
        )
        arr_wp, arr_dist = (
            _find_closest_waypoint(waypoints, arr_lat, arr_lon, max_radius_km)
            if arr_lat is not None else (waypoints[-1], 0.0)
        )

        if dep_lat is not None and dep_wp is None:
            return None
        if arr_lat is not None and arr_wp is None:
            return None

        dep_order = dep_wp.order if dep_wp else 0
        arr_order = arr_wp.order if arr_wp else len(waypoints) - 1

        if dep_order >= arr_order:
            return None

        dep_leg_idx = dep_wp.leg_index if dep_wp else 0
        arr_leg_idx = arr_wp.leg_index if arr_wp else max(0, ride.legs.count() - 1)

        segment_wps = [wp for wp in waypoints if dep_order <= wp.order < arr_order]
        if segment_wps:
            available_seats = min(wp.seats_available for wp in segment_wps)
        else:
            available_seats = ride.seats_available

        if available_seats < seats_requested:
            return None

        from api.services.pricing_service import PricingService
        pricing = PricingService.calculate_price_by_legs(ride, dep_leg_idx, arr_leg_idx, seats=1)
        price = pricing['base_price']

        if not price:
            price = ride.price_per_seat

        max_approach = max(dep_dist, arr_dist)
        radius_category, approach_text = _categorize_approach(max_approach)

        legs_list = list(ride.legs.order_by('order'))
        dep_leg = legs_list[dep_leg_idx] if dep_leg_idx < len(legs_list) else None
        arr_leg = legs_list[arr_leg_idx] if arr_leg_idx < len(legs_list) else None

        dep_time = ride.departure_time
        arr_time = ride.departure_time
        duration_segment_min = 0

        try:
            dep_sec = getattr(dep_wp, 'duration_from_start_sec', 0) if dep_wp else 0
            arr_sec = getattr(arr_wp, 'duration_from_start_sec', 0) if arr_wp else 0
            
            if dep_sec == 0 and arr_sec == 0:
                total_dist_m = ride.distance_km * 1000 if ride.distance_km else 0
                if total_dist_m <= 0 and waypoints:
                    total_dist_m = waypoints[-1].distance_from_start_m
                total_duration_min = ride.duration_min if ride.duration_min else 0
                if total_dist_m > 0 and total_duration_min > 0:
                    dep_fraction = dep_wp.distance_from_start_m / total_dist_m if dep_wp else 0.0
                    dep_min = total_duration_min * dep_fraction
                    arr_fraction = arr_wp.distance_from_start_m / total_dist_m if arr_wp else 1.0
                    arr_min = total_duration_min * arr_fraction
                    duration_segment_min = max(1, int(arr_min - dep_min))
                    
                    start_dt = datetime.combine(datetime.min, ride.departure_time)
                    dep_dt = start_dt + timedelta(minutes=dep_min)
                    arr_dt = start_dt + timedelta(minutes=arr_min)
                    dep_time = dep_dt.time()
                    arr_time = arr_dt.time()
            else:
                duration_segment_min = max(1, int(round((arr_sec - dep_sec) / 60.0)))
                start_dt = datetime.combine(datetime.min, ride.departure_time)
                dep_dt = start_dt + timedelta(seconds=dep_sec)
                arr_dt = start_dt + timedelta(seconds=arr_sec)
                dep_time = dep_dt.time()
                arr_time = arr_dt.time()
        except Exception:
            pass

        return {
            'type': 'direct',
            'ride': ride,
            'departure_leg': dep_leg,
            'arrival_leg': arr_leg,
            'dep_leg_idx': dep_leg_idx,
            'arr_leg_idx': arr_leg_idx,
            'dep_waypoint_order': dep_order,
            'arr_waypoint_order': arr_order,
            'price': price,
            'pricing_detail': pricing,
            'departure_time': dep_time,
            'arrival_time': arr_time,
            'duration_segment_min': duration_segment_min,
            'seats_available': available_seats,
            'walk_distance_origin_km': dep_dist,
            'walk_distance_dest_km': arr_dist,
            'radius_category': radius_category,
            'approach_duration_text': approach_text,
            'approach_duration_sec': int(dep_dist * 3600 / 5) if max_approach <= 0.5 else int(dep_dist * 3600 / 25),
            'approach_distance_m': int(dep_dist * 1000),
            'search_method': 'waypoints',
        }

    @staticmethod
    def _match_via_polyline(ride, polyline, dep_lat, dep_lon, arr_lat, arr_lon,
                             seats_requested, max_radius_km):
        min_dep_dist = 9999.0
        idx_dep = -1
        if dep_lat is not None:
            for idx, pt in enumerate(polyline):
                d = get_haversine_distance(dep_lat, dep_lon, pt[0], pt[1])
                if d < min_dep_dist:
                    min_dep_dist = d
                    idx_dep = idx
        else:
            min_dep_dist = 0.0
            idx_dep = 0

        min_arr_dist = 9999.0
        idx_arr = -1
        if arr_lat is not None:
            for idx, pt in enumerate(polyline):
                d = get_haversine_distance(arr_lat, arr_lon, pt[0], pt[1])
                if d < min_arr_dist:
                    min_arr_dist = d
                    idx_arr = idx
        else:
            min_arr_dist = 0.0
            idx_arr = len(polyline) - 1

        dep_ok = (dep_lat is None or min_dep_dist <= max_radius_km)
        arr_ok = (arr_lat is None or min_arr_dist <= max_radius_km)

        if not (dep_ok and arr_ok and idx_dep <= idx_arr):
            return None

        ride_legs = list(ride.legs.order_by('order'))
        dep_leg_idx = 0
        arr_leg_idx = len(ride_legs) - 1

        for idx_leg, leg in enumerate(ride_legs):
            d_start = get_haversine_distance(polyline[idx_dep][0], polyline[idx_dep][1],
                                             leg.start_latitude, leg.start_longitude)
            if d_start <= 6.0:
                dep_leg_idx = idx_leg
                break

        for idx_leg, leg in enumerate(ride_legs):
            d_end = get_haversine_distance(polyline[idx_arr][0], polyline[idx_arr][1],
                                           leg.end_latitude, leg.end_longitude)
            if d_end <= 6.0:
                arr_leg_idx = idx_leg

        if arr_leg_idx < dep_leg_idx:
            arr_leg_idx = len(ride_legs) - 1

        seats_ok = True
        min_seats = ride.seats_available
        calculated_price = 0

        for idx_leg in range(dep_leg_idx, arr_leg_idx + 1):
            if idx_leg < len(ride_legs):
                leg = ride_legs[idx_leg]
                if leg.seats_available < seats_requested:
                    seats_ok = False
                    break
                min_seats = min(min_seats, leg.seats_available)
                calculated_price += leg.price

        if not seats_ok:
            return None

        if not calculated_price:
            calculated_price = ride.price_per_seat

        max_approach = max(min_dep_dist, min_arr_dist)
        radius_category, approach_text = _categorize_approach(max_approach)

        return {
            'type': 'direct',
            'ride': ride,
            'departure_leg': ride_legs[dep_leg_idx] if ride_legs else None,
            'arrival_leg': ride_legs[arr_leg_idx] if ride_legs else None,
            'dep_leg_idx': dep_leg_idx,
            'arr_leg_idx': arr_leg_idx,
            'dep_waypoint_order': 0,
            'arr_waypoint_order': 99999,
            'price': calculated_price,
            'pricing_detail': {'base_price': calculated_price, 'commission': 0, 'total_price': calculated_price, 'driver_payout': calculated_price},
            'departure_time': ride.departure_time,
            'arrival_time': ride.departure_time,
            'seats_available': min_seats,
            'walk_distance_origin_km': min_dep_dist,
            'walk_distance_dest_km': min_arr_dist,
            'radius_category': radius_category,
            'approach_duration_text': approach_text,
            'approach_duration_sec': int(min_dep_dist * 3600 / 5) if max_approach <= 0.5 else int(min_dep_dist * 3600 / 25),
            'approach_distance_m': int(min_dep_dist * 1000),
            'search_method': 'polyline',
        }
