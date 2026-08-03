from typing import List, Dict, Any
from ...calculs.calcul_prix import arrondir_prix_50

class GestionSegmentsDomain:
    """Règles de calcul et de modélisation pour la gestion des tronçons (RideLeg)."""

    @staticmethod
    def calculer_prix_prorata(price_per_seat: int, legs_data: List[Dict[str, Any]]) -> List[int]:
        """
        Calcule les prix proportionnels pour chaque tronçon sur la base de la distance,
        avec un minimum de 100 XOF et arrondi à 50 XOF près.
        """
        num_legs = len(legs_data)
        if num_legs <= 0:
            return []

        leg_prices = []
        total_legs_distance_m = sum(leg['distance_m'] for leg in legs_data)
        
        if total_legs_distance_m > 0:
            for leg_info in legs_data:
                pct = leg_info['distance_m'] / total_legs_distance_m
                price_prorated = arrondir_prix_50(price_per_seat * pct)
                leg_prices.append(max(100, price_prorated))
        else:
            for _ in range(num_legs):
                leg_prices.append(max(100, arrondir_prix_50(price_per_seat / num_legs)))
                
        return leg_prices
