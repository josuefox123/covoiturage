import logging
from typing import List, Dict, Tuple, Optional, Any
from .google.directions import GoogleDirectionsProvider
from .osrm.engine import OSRMRouteProvider
from .polyline import decode_polyline
from ..calculs.calcul_distance import haversine_km

logger = logging.getLogger(__name__)

class RoutesOrchestrator:
    """Orchestrateur unifié pour la cartographie avec fallback de Google Maps vers OSRM."""

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
        Calcule l'itinéraire :
        1. Via Google Directions API.
        2. Fallback OSRM en cas d'erreur/absence de clé.
        3. Fallback Haversine en ligne droite si tout échoue.
        
        Retourne un tuple (polyline_points, legs_raw, resolved).
        """
        route_resolved = False
        polyline = []
        legs_raw = []

        # 1. Tentative Google Directions
        try:
            route_data = GoogleDirectionsProvider.get_route(
                origin_lat=origin_lat,
                origin_lon=origin_lon,
                dest_lat=dest_lat,
                dest_lon=dest_lon,
                stopovers=stopovers,
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
            logger.warning(f"Google Directions API failed: {e}")

        # 2. Fallback OSRM
        if not route_resolved:
            try:
                osrm_data = OSRMRouteProvider.get_route(
                    origin_lat=origin_lat,
                    origin_lon=origin_lon,
                    dest_lat=dest_lat,
                    dest_lon=dest_lon,
                    stopovers=stopovers
                )
                if osrm_data and 'routes' in osrm_data and len(osrm_data['routes']) > 0:
                    route = osrm_data['routes'][0]
                    legs_raw = route.get('legs', [])
                    coords = route.get('geometry', {}).get('coordinates', [])
                    polyline = [(pt[1], pt[0]) for pt in coords]
                    route_resolved = True
            except Exception as e:
                logger.warning(f"OSRM engine fallback failed: {e}")

        # 3. Fallback Haversine (ligne droite)
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
