from typing import Any, Tuple, List, Optional
from ..calculs.calcul_distance import haversine_km

class WaypointMatcher:
    """Service gérant la localisation et la proximité des points de passage (waypoints)."""

    @staticmethod
    def find_closest_waypoint(
        waypoints: List[Any],
        lat: float,
        lon: float,
        max_radius_km: Optional[float] = None
    ) -> Tuple[Optional[Any], float]:
        """
        Trouve le point de passage le plus proche d'un point GPS donné
        selon les rayons d'attraction autorisés par type (5km pour arrêts officiels, 3km pour communes, 1km pour GPS).
        """
        best_wp = None
        best_dist = 9999.0

        for wp in waypoints:
            d = haversine_km(lat, lon, wp.latitude, wp.longitude)
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

        return best_wp, (best_dist if best_wp else 9999.0)
