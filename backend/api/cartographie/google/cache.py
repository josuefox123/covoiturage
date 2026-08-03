import hashlib
from typing import Optional, Dict
from ...models.trajet import DirectionsCache

class DirectionsLocalCache:
    """Interface d'accès au cache local de Google Directions."""

    @staticmethod
    def hash_route(departure_key: str, waypoints_str: str, arrival_key: str) -> str:
        """Génère la clé de hashage sha256 unique pour l'itinéraire demandé."""
        hash_input = f"{departure_key}|{waypoints_str}|{arrival_key}"
        return hashlib.sha256(hash_input.encode('utf-8')).hexdigest()

    @staticmethod
    def get_cached_route(waypoints_hash: str) -> Optional[dict]:
        """Récupère l'itinéraire mis en cache à partir de son hash unique."""
        cache_entry = DirectionsCache.objects.filter(waypoints_hash=waypoints_hash).first()
        if cache_entry:
            return cache_entry.route_data
        return None

    @staticmethod
    def set_cached_route(
        waypoints_hash: str,
        origin_place_id: str,
        destination_place_id: str,
        route_data: dict
    ) -> DirectionsCache:
        """Enregistre un itinéraire Google Directions dans le cache local."""
        return DirectionsCache.objects.create(
            waypoints_hash=waypoints_hash,
            origin_place_id=origin_place_id or '',
            destination_place_id=destination_place_id or '',
            route_data=route_data
        )
