from typing import Any, Tuple, List, Optional
from ..calculs.calcul_distance import haversine_km

class WaypointMatcher:
    """Service gerant la localisation et la proximite des points de passage (waypoints)."""

    @staticmethod
    def find_closest_waypoint(
        waypoints: List[Any],
        lat: float,
        lon: float,
        max_radius_km: Optional[float] = None
    ) -> Tuple[Optional[Any], float]:
        """
        Trouve le point de passage le plus proche d un point GPS donne.

        RAYONS REDUITS POUR CETTE VERSION (eviter les faux-positifs geographiques) :
        - Anciens rayons : departure/arrival/stopover = 5.0 km, city = 3.0 km, gps = 1.0 km
        - Les larges rayons permettaient a "Abomey Calavi" de matcher un waypoint
          situe dans une autre ville voisine, faisant apparaitre de faux trajets intermediaires.
        """
        best_wp = None
        best_dist = 9999.0

        for wp in waypoints:
            d = haversine_km(lat, lon, wp.latitude, wp.longitude)
            w_type = getattr(wp, 'waypoint_type', 'gps')

            # Utiliser max_radius_km s'il est fourni (ex: 50.0 km)
            if max_radius_km is not None:
                allowed_radius = max_radius_km
            else:
                # RAYONS REDUITS POUR CETTE VERSION (FALLBACK)
                if w_type in ['departure', 'arrival']:
                    allowed_radius = 1.5
                elif w_type == 'stopover' or getattr(wp, 'is_stopover', False):
                    allowed_radius = 2.0
                elif w_type == 'city':
                    allowed_radius = 1.5
                else:
                    allowed_radius = 1.0

            if d <= allowed_radius and d < best_dist:
                best_dist = d
                best_wp = wp

        return best_wp, (best_dist if best_wp else 9999.0)