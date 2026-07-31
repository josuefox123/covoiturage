"""
========================================================
Fichier :
pricing_service.py

Description :
Service de calcul de prix intelligent au prorata du km.
Utilisé lors de la recherche pour calculer le prix exact
d'un segment passager sur un trajet conducteur.

Projet :
Zemy
========================================================
"""
import logging
from ..models import Ride, RideLeg, RideWaypoint, FinancialSettings

logger = logging.getLogger(__name__)


class PricingService:
    """
    Calcule le prix d'un segment passager au prorata de la distance réelle.
    
    Exemple :
        Trajet Calavi → Parakou, 7000 FCFA, 400 km
        Passager Allada → Bohicon = 60 km
        Prix = (60 / 400) * 7000 = 1050 FCFA → arrondi à 1050 FCFA
    """

    @staticmethod
    def calculate_segment_price(
        ride: Ride,
        dep_waypoint_order: int,
        arr_waypoint_order: int,
        seats: int = 1
    ) -> dict:
        """
        Calcule le prix d'un segment entre deux waypoints (par leur order).
        
        Retourne un dict avec :
            - base_price : Prix brut (sans commission) en FCFA
            - commission : Commission Zemy en FCFA
            - total_price : Prix final à payer par le passager
            - driver_payout : Montant net au conducteur
            - price_per_km : Prix au km appliqué
            - segment_distance_m : Distance du segment en mètres
        """
        try:
            # Récupérer tous les waypoints ordonnés
            waypoints = list(ride.waypoints.order_by('order'))
            if not waypoints:
                # Fallback : prix complet du trajet
                return PricingService._fallback_price(ride, seats)

            # Trouver les waypoints de départ et d'arrivée
            dep_wp = next((w for w in waypoints if w.order == dep_waypoint_order), None)
            arr_wp = next((w for w in waypoints if w.order == arr_waypoint_order), None)

            if not dep_wp or not arr_wp or dep_waypoint_order >= arr_waypoint_order:
                return PricingService._fallback_price(ride, seats)

            # Calculer la distance du segment depuis distance_from_start_m
            segment_distance_m = arr_wp.distance_from_start_m - dep_wp.distance_from_start_m
            if segment_distance_m <= 0:
                return PricingService._fallback_price(ride, seats)

            # Distance totale du trajet (dernier waypoint)
            total_distance_m = waypoints[-1].distance_from_start_m
            if total_distance_m <= 0:
                # Fallback via legs
                total_distance_m = sum(
                    leg.distance_m for leg in ride.legs.all()
                ) or 1

            # Calcul au prorata
            ratio = segment_distance_m / total_distance_m
            base_price_raw = ride.price_per_seat * ratio * seats

            # Arrondi à 50 FCFA le plus proche, minimum 100 FCFA
            base_price = max(100, int(round(base_price_raw / 50.0) * 50))

            # Calcul de la commission Zemy
            commission, driver_payout = PricingService._calculate_commission(base_price)

            # Prix au km
            price_per_km = (base_price / (segment_distance_m / 1000)) if segment_distance_m > 0 else 0

            return {
                'base_price': base_price,
                'commission': commission,
                'total_price': base_price,  # Le passager paie base_price (commission incluse dans le split)
                'driver_payout': driver_payout,
                'price_per_km': round(price_per_km, 1),
                'segment_distance_m': segment_distance_m,
                'segment_distance_km': round(segment_distance_m / 1000, 1),
            }

        except Exception as e:
            logger.error(f"PricingService.calculate_segment_price error for ride {ride.id}: {e}")
            return PricingService._fallback_price(ride, seats)

    @staticmethod
    def calculate_price_by_legs(ride: Ride, dep_leg_idx: int, arr_leg_idx: int, seats: int = 1) -> dict:
        """
        Calcule le prix d'un segment en cumulant les prix des RideLeg couverts.
        Méthode alternative plus rapide si les waypoints ne sont pas disponibles.
        """
        try:
            legs = list(ride.legs.order_by('order'))
            if not legs:
                return PricingService._fallback_price(ride, seats)

            dep_leg_idx = max(0, dep_leg_idx)
            arr_leg_idx = min(arr_leg_idx, len(legs) - 1)

            total_price = 0
            total_distance_m = 0
            for i in range(dep_leg_idx, arr_leg_idx + 1):
                if i < len(legs):
                    total_price += legs[i].price
                    total_distance_m += legs[i].distance_m

            total_price = max(100, total_price * seats)
            commission, driver_payout = PricingService._calculate_commission(total_price)

            price_per_km = (total_price / (total_distance_m / 1000)) if total_distance_m > 0 else 0

            return {
                'base_price': total_price,
                'commission': commission,
                'total_price': total_price,
                'driver_payout': driver_payout,
                'price_per_km': round(price_per_km, 1),
                'segment_distance_m': total_distance_m,
                'segment_distance_km': round(total_distance_m / 1000, 1),
            }

        except Exception as e:
            logger.error(f"PricingService.calculate_price_by_legs error: {e}")
            return PricingService._fallback_price(ride, seats)

    @staticmethod
    def _calculate_commission(base_price: int) -> tuple:
        """Retourne (commission, driver_payout) en FCFA."""
        try:
            settings_obj = FinancialSettings.objects.first()
            if settings_obj and settings_obj.is_commission_active:
                commission = int((base_price * settings_obj.commission_percentage) / 100)
                commission = max(commission, settings_obj.min_commission)
                if settings_obj.max_commission:
                    commission = min(commission, settings_obj.max_commission)
            else:
                commission = max(100, int(base_price * 0.10))
        except Exception:
            commission = max(100, int(base_price * 0.10))

        driver_payout = base_price - commission
        return commission, driver_payout

    @staticmethod
    def _fallback_price(ride: Ride, seats: int = 1) -> dict:
        """Prix de secours = prix_par_place * places."""
        base_price = ride.price_per_seat * seats
        commission, driver_payout = PricingService._calculate_commission(base_price)
        return {
            'base_price': base_price,
            'commission': commission,
            'total_price': base_price,
            'driver_payout': driver_payout,
            'price_per_km': 0,
            'segment_distance_m': 0,
            'segment_distance_km': 0,
        }
