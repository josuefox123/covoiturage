import requests
import logging
from typing import Optional, List, Dict, Any
from django.conf import settings
from .cache import DirectionsLocalCache

logger = logging.getLogger(__name__)

class GoogleDirectionsProvider:
    """Fournisseur d'itinéraires utilisant l'API Google Maps Directions."""

    @staticmethod
    def get_route(
        origin_lat: float,
        origin_lon: float,
        dest_lat: float,
        dest_lon: float,
        stopovers: Optional[List[Dict[str, Any]]] = None,
        origin_place_id: str = '',
        dest_place_id: str = ''
    ) -> Optional[Dict[str, Any]]:
        """
        Requête l'itinéraire auprès de l'API Google Directions avec gestion du cache local.
        """
        api_key = getattr(settings, 'GOOGLE_MAPS_API_KEY', '')
        if not api_key:
            logger.warning("Clé API Google Maps manquante dans les configurations.")
            return None

        # Construction de la clé de cache
        dep_key = origin_place_id or f"{origin_lat},{origin_lon}"
        arr_key = dest_place_id or f"{dest_lat},{dest_lon}"
        
        stopovers_list = stopovers or []
        waypoints_str = "|".join(
            s.get('place_id') or f"{s.get('latitude')},{s.get('longitude')}"
            for s in stopovers_list
        )

        waypoints_hash = DirectionsLocalCache.hash_route(dep_key, waypoints_str, arr_key)
        
        # Lecture depuis le cache local
        cached_data = DirectionsLocalCache.get_cached_route(waypoints_hash)
        if cached_data:
            logger.info("Itinéraire Google Directions récupéré depuis le cache local.")
            return cached_data

        # Cache-miss, appel API
        try:
            origin = f"{origin_lat},{origin_lon}"
            destination = f"{dest_lat},{dest_lon}"
            params = {
                'origin': origin,
                'destination': destination,
                'key': api_key
            }
            if stopovers_list:
                params['waypoints'] = "|".join(
                    f"{s.get('latitude')},{s.get('longitude')}"
                    for s in stopovers_list
                )

            url = "https://maps.googleapis.com/maps/api/directions/json"
            response = requests.get(url, params=params, timeout=10)
            if response.status_code == 200:
                res_json = response.json()
                if res_json.get('status') == 'OK':
                    # Mise en cache
                    DirectionsLocalCache.set_cached_route(
                        waypoints_hash=waypoints_hash,
                        origin_place_id=origin_place_id,
                        destination_place_id=dest_place_id,
                        route_data=res_json
                    )
                    logger.info("Nouvel itinéraire Google Directions mis en cache.")
                    return res_json
                else:
                    logger.error(f"Erreur API Google Directions: {res_json.get('status')}")
            else:
                logger.error(f"Erreur HTTP Google Directions: {response.status_code}")
        except Exception as e:
            logger.error(f"Échec de l'appel Google Directions: {e}")

        return None
