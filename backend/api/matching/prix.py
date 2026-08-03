from typing import Any, Dict

class PriceCalculator:
    """Service estimant les tarifs pour les trajets et segments d'itinéraires."""

    @staticmethod
    def calculate_segment_price(ride: Any, dep_leg_idx: int, arr_leg_idx: int, seats: int = 1) -> Dict[str, Any]:
        """Calcule le tarif pour le segment de trajet défini par dep_leg_idx à arr_leg_idx."""
        from api.services.pricing_service import PricingService
        try:
            return PricingService.calculate_price_by_legs(ride, dep_leg_idx, arr_leg_idx, seats=seats)
        except Exception:
            # Fallback simple
            price = ride.price_per_seat
            return {
                'base_price': price,
                'commission': 0,
                'total_price': price,
                'driver_payout': price
            }
