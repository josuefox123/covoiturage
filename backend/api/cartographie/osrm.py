import requests
import logging
from typing import Optional, List, Dict, Any

logger = logging.getLogger(__name__)

class OSRMRouteProvider:
    """Fournisseur d'itinéraires alternatif en cas de panne de l'API Google, utilisant OSRM."""

    @staticmethod
    def get_route(
        origin_lat: float,
        origin_lon: float,
        dest_lat: float,
        dest_lon: float,
        stopovers: List[Dict[str, Any]] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Requête l'itinéraire auprès de l'API publique OSRM.
        """
        try:
            coords = [f"{origin_lon},{origin_lat}"]
            stopovers_list = stopovers or []
            for s in stopovers_list:
                coords.append(f"{s.get('longitude')},{s.get('latitude')}")
            coords.append(f"{dest_lon},{dest_lat}")
            
            coords_str = ";".join(coords)
            url = f"https://router.project-osrm.org/route/v1/driving/{coords_str}?overview=full&geometries=geojson&steps=true"
            
            response = requests.get(url, timeout=10)
            if response.status_code == 200:
                res_json = response.json()
                if res_json.get('code') == 'Ok':
                    logger.info("Itinéraire résolu avec succès via OSRM.")
                    return res_json
                else:
                    logger.error(f"Erreur API OSRM: {res_json.get('code')}")
            else:
                logger.error(f"Erreur HTTP OSRM: {response.status_code}")
        except Exception as e:
            logger.error(f"Échec de l'appel OSRM: {e}")

        return None
