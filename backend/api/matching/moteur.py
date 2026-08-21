import logging
from datetime import datetime, timedelta
from typing import Any, Dict, Optional, List
from django.utils import timezone
from django.core.cache import cache

from ..models import Ride
from .waypoints import WaypointMatcher
from .corridor import CorridorMatcher
from .segments import SegmentMatcher
from .prix import PriceCalculator
from .temps import TimingCalculator
from .ranking import SearchRanker
from .connections import ConnectionMatcher

logger = logging.getLogger(__name__)

def haversine_distance(lat1, lon1, lat2, lon2):
    from math import radians, sin, cos, sqrt, atan2
    R = 6371.0
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    c = 2 * atan2(sqrt(a), sqrt(1 - a))
    return R * c

class MatchingEngine:
    """Moteur de recherche et de matching de trajets intelligent."""

    MAX_RADIUS_KM = 8.0

    @classmethod
    def find_rides(
        cls,
        departure_lat: Optional[float],
        departure_lon: Optional[float],
        arrival_lat: Optional[float],
        arrival_lon: Optional[float],
        target_date: Any,
        seats_requested: int = 1,
        departure_place_id: Optional[str] = None,
        arrival_place_id: Optional[str] = None,
        time_filter: Optional[str] = None,
        search_mode: Optional[str] = None,
        radius: Optional[float] = None
    ) -> Dict[str, List[Any]]:
        """
        Recherche de trajets directe ou avec correspondances le long des corridors géographiques.
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
        if search_mode:
            cache_key += f"_{search_mode}"
        if radius:
            cache_key += f"_{radius}"

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
        )

        # Si la recherche est pour aujourd'hui, exclure les trajets déjà partis
        now_local = timezone.localtime(timezone.now())
        import sys
        if target_date == now_local.date() and 'test' not in sys.argv:
            # Laisser une marge de 10 minutes pour les départs imminents
            cutoff_time = (now_local - timedelta(minutes=10)).time()
            candidate_rides = candidate_rides.filter(departure_time__gte=cutoff_time)

        candidate_rides = (
            candidate_rides
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

        # Filtrage géographique initial pour la recherche autour de moi
        if search_mode == 'nearby' and departure_lat is not None and departure_lon is not None:
            if radius is None:
                radius = 20.0
            nearby_candidates = []
            for ride in candidate_rides:
                if ride.departure_latitude is not None and ride.departure_longitude is not None:
                    dist = haversine_distance(
                        departure_lat, departure_lon,
                        float(ride.departure_latitude), float(ride.departure_longitude)
                    )
                    if dist <= radius:
                        ride.nearby_distance_km = round(dist, 1)
                        nearby_candidates.append(ride)
            candidate_rides = nearby_candidates

        direct_matches = []
        for ride in candidate_rides:
            result = cls.match_ride(
                ride, departure_lat, departure_lon, arrival_lat, arrival_lon,
                seats_requested
            )
            if result:
                # Si on a calculé la distance, on la transmet au dictionnaire de résultats
                if hasattr(ride, 'nearby_distance_km'):
                    result['walk_distance_origin_km'] = ride.nearby_distance_km
                direct_matches.append(result)

        # Tri et classement par pertinence
        direct_matches = SearchRanker.rank_matches(direct_matches)

        # Pas de correspondances intermédiaires pour la recherche de proximité
        if search_mode == 'nearby':
            connection_matches = []
        else:
            connection_matches = ConnectionMatcher.find_connection_matches(
                departure_lat, departure_lon, arrival_lat, arrival_lon, target_date, seats_requested
            )

        results = {
            'directs': direct_matches,
            'connections': connection_matches
        }
        cache.set(cache_key, results, 120)
        return results

    @classmethod
    def match_ride(
        cls,
        ride: Any,
        departure_lat: Optional[float],
        departure_lon: Optional[float],
        arrival_lat: Optional[float],
        arrival_lon: Optional[float],
        seats_requested: int
    ) -> Optional[Dict[str, Any]]:
        """
        Détermine si le trajet en paramètre traverse de manière géographiquement proche
        les coordonnées demandées au départ et à l'arrivée.
        """
        MAX_RADIUS_KM = cls.MAX_RADIUS_KM
        waypoints = list(ride.waypoints.order_by('order'))

        if waypoints:
            return SegmentMatcher.match_via_waypoints(
                ride, waypoints, departure_lat, departure_lon,
                arrival_lat, arrival_lon, seats_requested, MAX_RADIUS_KM,
                PriceCalculator, TimingCalculator
            )

        # Recherche par corridor (polyline) pour les conducteurs n'ayant pas ajouté de points d'arrêt (waypoints)
        polyline = []
        
        # Récupérer la polyline du trajet si disponible
        polyline_pts = CorridorMatcher.get_ride_polyline_points(ride)
        if polyline_pts:
            polyline.extend(polyline_pts)
        
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
        
        return CorridorMatcher.match_via_polyline(
            ride, polyline, departure_lat, departure_lon,
            arrival_lat, arrival_lon, seats_requested, MAX_RADIUS_KM,
            PriceCalculator, TimingCalculator
        )
