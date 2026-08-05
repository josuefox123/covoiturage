import logging
from typing import List, Dict, Tuple, Optional, Any
from .google.directions import GoogleDirectionsProvider
from .polyline import decode_polyline
from ..calculs.calcul_distance import haversine_km

logger = logging.getLogger(__name__)

class RoutesOrchestrator:
    """Orchestrateur unifié pour la cartographie utilisant 100% l'API Google Maps."""

    @staticmethod
    def get_route(
        origin_lat: float,
        origin_lon: float,
        dest_lat: float,
        dest_lon: float,
        stopovers: Optional[List[Dict[str, Any]]] = None,
        origin_place_id: str = '',
        dest_place_id: str = '',
        default_duration_min: int = 120
    ) -> Tuple[List[Tuple[float, float]], List[Dict[str, Any]], bool]:
        """
        Calcule l'itinéraire via l'API Google Directions officielle.
        Retourne un tuple (polyline_points, legs_raw, resolved).
        """
        route_resolved = False
        polyline = []
        legs_raw = []

        # 1. Google Directions API officiel
        try:
            route_data = GoogleDirectionsProvider.get_route(
                origin_lat=origin_lat,
                origin_lon=origin_lon,
                dest_lat=dest_lat,
                dest_lon=dest_lon,
                stopovers=stopovers or [],
                origin_place_id=origin_place_id,
                dest_place_id=dest_place_id
            )
            if route_data and 'routes' in route_data and len(route_data['routes']) > 0:
                route = route_data['routes'][0]
                overview_polyline_str = route.get('overview_polyline', {}).get('points', '')
                legs_raw = route.get('legs', [])
                if overview_polyline_str:
                    polyline = decode_polyline(overview_polyline_str)
                    route_resolved = True
        except Exception as e:
            logger.warning(f"Google Directions API execution failed: {e}")

        # 2. Fallback de secours minimal si coordonnées invalides
        if not route_resolved or not polyline:
            polyline = [
                (origin_lat, origin_lon),
                (dest_lat, dest_lon)
            ]
            total_duration_sec = default_duration_min * 60
            dist_m = int(haversine_km(origin_lat, origin_lon, dest_lat, dest_lon) * 1000)
            legs_raw = [{
                'duration': {'value': total_duration_sec},
                'distance': {'value': dist_m},
                'steps': []
            }]
            route_resolved = True

        return polyline, legs_raw, route_resolved
