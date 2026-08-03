from typing import List, Dict, Any

class SearchRanker:
    """Service classant et ordonnant les trajets trouvés par pertinence (approche, prix, horaire)."""

    @staticmethod
    def rank_matches(matches: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Trie les trajets candidats par rayon d'approche,
        puis par distance de marche totale, prix croissant et enfin heure de départ.
        """
        return sorted(
            matches,
            key=lambda x: (
                x.get('radius_category', 15.0),
                x.get('walk_distance_origin_km', 0.0) + x.get('walk_distance_dest_km', 0.0),
                x.get('price', 99999),
                x.get('departure_time')
            )
        )
