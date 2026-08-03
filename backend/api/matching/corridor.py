import hashlib
import logging
from typing import List, Tuple, Optional, Any, Dict
from ..models.trajet import DirectionsCache
from ..calculs.calcul_distance import haversine_km

logger = logging.getLogger(__name__)

class CorridorMatcher:
    """Service gérant le décodage et le matching géographique le long du tracé polyline du trajet."""

    @staticmethod
    def decode_polyline(polyline_str: str) -> List[Tuple[float, float]]:
        """Décode une polyline Google Maps en liste de coordonnées GPS (lat, lon)."""
        if not polyline_str:
            return []
        index, lat, lng = 0, 0, 0
        coordinates = []
        length = len(polyline_str)
        while index < length:
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

    @classmethod
    def get_ride_polyline_points(cls, ride: Any) -> List[Tuple[float, float]]:
        """Récupère la polyline décodée d'un trajet à partir du cache d'itinéraire."""
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
                        return cls.decode_polyline(points_str)
        except Exception as e:
            logger.warning(f"Error retrieving polyline for ride {ride.id}: {e}")
        return []

    @staticmethod
    def match_via_polyline(
        ride: Any,
        polyline: List[Tuple[float, float]],
        dep_lat: Optional[float],
        dep_lon: Optional[float],
        arr_lat: Optional[float],
        arr_lon: Optional[float],
        seats_requested: int,
        max_radius_km: float,
        pricing_calculator,
        timing_calculator
    ) -> Optional[Dict[str, Any]]:
        """
        Détermine si un trajet correspond aux critères de recherche géographique le long de sa polyline.
        """
        min_dep_dist = 9999.0
        idx_dep = -1
        if dep_lat is not None and dep_lon is not None:
            for idx, pt in enumerate(polyline):
                d = haversine_km(dep_lat, dep_lon, pt[0], pt[1])
                if d < min_dep_dist:
                    min_dep_dist = d
                    idx_dep = idx
        else:
            min_dep_dist = 0.0
            idx_dep = 0

        min_arr_dist = 9999.0
        idx_arr = -1
        if arr_lat is not None and arr_lon is not None:
            for idx, pt in enumerate(polyline):
                d = haversine_km(arr_lat, arr_lon, pt[0], pt[1])
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
            d_start = haversine_km(polyline[idx_dep][0], polyline[idx_dep][1],
                                   leg.start_latitude, leg.start_longitude)
            if d_start <= 6.0:
                dep_leg_idx = idx_leg
                break

        for idx_leg, leg in enumerate(ride_legs):
            d_end = haversine_km(polyline[idx_arr][0], polyline[idx_arr][1],
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
        radius_category, approach_text = timing_calculator.categorize_approach(max_approach)

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
            'pricing_detail': {
                'base_price': calculated_price,
                'commission': 0,
                'total_price': calculated_price,
                'driver_payout': calculated_price
            },
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
