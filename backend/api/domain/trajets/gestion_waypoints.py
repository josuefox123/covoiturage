from typing import List, Dict, Any

class GestionWaypointsDomain:
    """Règles métier pour le filtrage, tri et dédoublonnement des points de passage (RideWaypoint)."""

    @staticmethod
    def filtrer_et_trier(candidates: List[Dict[str, Any]], haversine_func) -> List[Dict[str, Any]]:
        """
        Dédoublonne et trie les waypoints selon les règles de distance (2000m)
        et les priorités de type de point de passage (departure/arrival > stopover > city > gps).
        """
        if not candidates:
            return []

        # Tri initial par distance cumulée depuis le départ
        candidates_sorted = sorted(candidates, key=lambda x: x['distance'])
        
        merged_waypoints = []
        priority_map = {'departure': 4, 'arrival': 4, 'stopover': 3, 'city': 2, 'gps': 1}

        for c in candidates_sorted:
            if not merged_waypoints:
                merged_waypoints.append(c)
                continue

            last = merged_waypoints[-1]
            dist_to_last = haversine_func(last['latitude'], last['longitude'], c['latitude'], c['longitude']) * 1000

            if dist_to_last < 2000:
                p_last = priority_map.get(last['waypoint_type'], 1)
                p_curr = priority_map.get(c['waypoint_type'], 1)
                if p_curr > p_last:
                    # Remplace par un point de passage plus important
                    merged_waypoints[-1] = c
                elif p_curr == p_last:
                    # Si même priorité, enrichit le nom si manquant
                    if not last['name'] and c['name']:
                        last['name'] = c['name']
            else:
                # Évite les doublons de noms consécutifs
                if c['name'] and last['name'] and c['name'].lower().strip() == last['name'].lower().strip():
                    continue
                merged_waypoints.append(c)

        return merged_waypoints

    @staticmethod
    def localiser_leg_index(dist_m: float, leg_limits: List[int]) -> int:
        """Détermine dans quel tronçon (leg) se situe une distance cumulée donnée."""
        if not leg_limits:
            return 0
        for idx, limit in enumerate(leg_limits):
            if dist_m <= limit:
                return idx
        return max(0, len(leg_limits) - 1)
