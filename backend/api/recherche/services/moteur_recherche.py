from typing import Any, Optional, Dict, List
from ...matching.moteur import MatchingEngine

class SearchService:
    """Service d'orchestration déléguant les requêtes de recherche de trajets au nouveau moteur de matching."""

    MAX_RADIUS_KM = 20.0

    @staticmethod
    def find_rides(
        departure_lat: Optional[float],
        departure_lon: Optional[float],
        arrival_lat: Optional[float],
        arrival_lon: Optional[float],
        target_date: Any,
        seats_requested: int = 1,
        departure_place_id: Optional[str] = None,
        arrival_place_id: Optional[str] = None,
        time_filter: Optional[str] = None
    ) -> Dict[str, List[Any]]:
        """
        Recherche de trajets directe ou avec correspondances le long des corridors géographiques.
        Délègue l'exécution au MatchingEngine.
        """
        return MatchingEngine.find_rides(
            departure_lat=departure_lat,
            departure_lon=departure_lon,
            arrival_lat=arrival_lat,
            arrival_lon=arrival_lon,
            target_date=target_date,
            seats_requested=seats_requested,
            departure_place_id=departure_place_id,
            arrival_place_id=arrival_place_id,
            time_filter=time_filter
        )
