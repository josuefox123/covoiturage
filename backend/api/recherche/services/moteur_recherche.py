from typing import Any, Optional, Dict, List
from ...matching.moteur import MatchingEngine

class SearchService:
    """Service d'orchestration déléguant les requêtes de recherche de trajets au nouveau moteur de matching."""

    MAX_RADIUS_KM = 50.0  # LM-003 FIX : étendu à 50 km (cohérent avec rides.py)
    MIN_RADIUS_KM = 1.0

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
        time_filter: Optional[str] = None,
        search_mode: Optional[str] = None,
        radius: Optional[float] = None
    ) -> Dict[str, List[Any]]:
        """
        Recherche de trajets directe ou avec correspondances le long des corridors géographiques.
        Délègue l'exécution au MatchingEngine.
        """
        # LM-003 FIX : Plafonner le radius même si la couche vue a échoué.
        # La constante était déclarée mais jamais appliquée à ce niveau.
        if radius is not None:
            radius = max(SearchService.MIN_RADIUS_KM, min(float(radius), SearchService.MAX_RADIUS_KM))

        return MatchingEngine.find_rides(
            departure_lat=departure_lat,
            departure_lon=departure_lon,
            arrival_lat=arrival_lat,
            arrival_lon=arrival_lon,
            target_date=target_date,
            seats_requested=seats_requested,
            departure_place_id=departure_place_id,
            arrival_place_id=arrival_place_id,
            time_filter=time_filter,
            search_mode=search_mode,
            radius=radius
        )
