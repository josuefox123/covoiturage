from typing import Any, Dict

class PriceCalculator:
    """Service estimant les tarifs pour les trajets et segments d'itinéraires."""

    @staticmethod
    def calculate_segment_price(ride: Any, dep_order: int, arr_order: int, seats: int = 1) -> Dict[str, Any]:
        """Calcule le tarif pour le segment de trajet défini par dep_order à arr_order."""
        from api.services.pricing_service import PricingService
        try:
            res = PricingService.calculate_segment_price(ride, dep_order, arr_order, seats=seats)
            if res and res.get('total_price') and res.get('total_price') > 0:
                return res
            return PricingService.calculate_price_by_legs(ride, dep_order, arr_order, seats=seats)
        except Exception:
            # Fallback simple
            price = ride.price_per_seat
            return {
                'base_price': price,
                'commission': 0,
                'total_price': price,
                'driver_payout': price
            }
