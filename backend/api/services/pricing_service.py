"""
========================================================
pricing_service.py

REGLE FONDAMENTALE (BlaBlaCar-style) :
  - driver_price  = ce que le conducteur souhaite recevoir
  - commission    = Zemy applique sa commission SUR driver_price
  - total_to_pay  = driver_price + commission  (ce que paie le passager)
  - driver_amount = driver_price               (ce que recoit le conducteur)
  - zemy_amount   = commission                 (ce que garde Zemy)

Il n existe qu une seule fonction de calcul : PricingService.compute()
Tous les autres helpers l appellent.
========================================================
"""
import logging
from dataclasses import dataclass
from ..models import Ride, RideLeg, RideWaypoint, FinancialSettings

logger = logging.getLogger(__name__)


@dataclass
class PricingResult:
    """Resultat immuable d un calcul de prix."""
    driver_price: int
    commission: int
    total_to_pay: int
    driver_amount: int
    zemy_amount: int
    seats: int
    segment_distance_m: int
    segment_distance_km: float

    def to_dict(self) -> dict:
        return {
            'driver_price': self.driver_price,
            'commission': self.commission,
            'total_to_pay': self.total_to_pay,
            'driver_amount': self.driver_amount,
            'zemy_amount': self.zemy_amount,
            'seats': self.seats,
            'segment_distance_m': self.segment_distance_m,
            'segment_distance_km': self.segment_distance_km,
        }


class PricingService:
    @staticmethod
    def compute(driver_price: int, seats: int = 1, segment_distance_m: int = 0) -> 'PricingResult':
        if driver_price < 0:
            driver_price = 0
        try:
            settings = FinancialSettings.objects.first()
        except Exception:
            settings = None
        commission = PricingService._apply_commission_rules(driver_price, settings)
        unit_total = driver_price + commission
        total_to_pay = unit_total * seats
        driver_amount = driver_price * seats
        zemy_amount = commission * seats
        return PricingResult(
            driver_price=driver_price,
            commission=commission,
            total_to_pay=total_to_pay,
            driver_amount=driver_amount,
            zemy_amount=zemy_amount,
            seats=seats,
            segment_distance_m=segment_distance_m,
            segment_distance_km=round(segment_distance_m / 1000, 1),
        )

    @staticmethod
    def compute_for_booking(booking) -> 'PricingResult':
        # 1. Calculer le tarif de base (sans les surcharges d'option)
        if not booking.custom_price and not booking.driver_counter_price and not booking.passenger_proposed_price:
            ride = booking.ride
            seats = booking.seats_booked
            if booking.departure_waypoint_order is not None and booking.arrival_waypoint_order is not None:
                base_result = PricingService.compute_for_segment(
                    ride,
                    booking.departure_waypoint_order,
                    booking.arrival_waypoint_order,
                    seats
                )
            else:
                base_result = PricingResult(
                    driver_price=ride.driver_payout,
                    commission=ride.zemy_commission,
                    total_to_pay=ride.price_per_seat * seats,
                    driver_amount=ride.driver_payout * seats,
                    zemy_amount=ride.zemy_commission * seats,
                    seats=seats,
                    segment_distance_m=0,
                    segment_distance_km=0.0
                )
        else:
            driver_price = (
                booking.custom_price
                or booking.driver_counter_price
                or booking.passenger_proposed_price
            )
            base_result = PricingService.compute(driver_price=int(driver_price), seats=booking.seats_booked)

        # 2. Ajouter les surcharges d'options (sans frais Zemy)
        pickup_surcharge = getattr(booking, 'pickup_surcharge', 0) or 0
        dropoff_surcharge = getattr(booking, 'dropoff_surcharge', 0) or 0
        total_surcharge = pickup_surcharge + dropoff_surcharge

        if total_surcharge > 0:
            return PricingResult(
                driver_price=base_result.driver_price,
                commission=base_result.commission,
                total_to_pay=base_result.total_to_pay + total_surcharge,
                driver_amount=base_result.driver_amount + total_surcharge,
                zemy_amount=base_result.zemy_amount,
                seats=base_result.seats,
                segment_distance_m=base_result.segment_distance_m,
                segment_distance_km=base_result.segment_distance_km
            )

        return base_result

    @staticmethod
    def compute_for_segment(ride, dep_waypoint_order: int, arr_waypoint_order: int, seats: int = 1) -> 'PricingResult':
        try:
            waypoints = list(ride.waypoints.order_by('order'))
            if not waypoints:
                return PricingService._fallback(ride, seats)
            if dep_waypoint_order == waypoints[0].order and arr_waypoint_order == waypoints[-1].order:
                return PricingService._fallback(ride, seats)
            dep_wp = next((w for w in waypoints if w.order == dep_waypoint_order), None)
            arr_wp = next((w for w in waypoints if w.order == arr_waypoint_order), None)
            if not dep_wp or not arr_wp or dep_waypoint_order >= arr_waypoint_order:
                return PricingService._fallback(ride, seats)
            segment_distance_m = arr_wp.distance_from_start_m - dep_wp.distance_from_start_m
            if segment_distance_m <= 0:
                return PricingService._fallback(ride, seats)
            total_distance_m = waypoints[-1].distance_from_start_m
            if total_distance_m <= 0:
                total_distance_m = sum(leg.distance_m for leg in ride.legs.all()) or 1
            ratio = segment_distance_m / total_distance_m
            
            # Prorata du prix passager (price_per_seat)
            passenger_price_raw = ride.price_per_seat * ratio
            passenger_price = max(100, int(round(passenger_price_raw / 50.0) * 50))
            
            # Prorata du gain conducteur (driver_payout)
            driver_price_raw = ride.driver_payout * ratio
            driver_price = max(100, int(round(driver_price_raw / 50.0) * 50))
            
            if passenger_price < driver_price:
                passenger_price = driver_price
                
            commission = passenger_price - driver_price

            if commission < 50 and ride.zemy_commission > 0:
                commission = 50
                driver_price = max(50, passenger_price - 50)
            
            return PricingResult(
                driver_price=driver_price,
                commission=commission,
                total_to_pay=passenger_price * seats,
                driver_amount=driver_price * seats,
                zemy_amount=commission * seats,
                seats=seats,
                segment_distance_m=int(segment_distance_m),
                segment_distance_km=round(segment_distance_m / 1000, 1)
            )
        except Exception as e:
            logger.error(f"PricingService.compute_for_segment error for ride {ride.id}: {e}")
            return PricingService._fallback(ride, seats)

    @staticmethod
    def compute_for_legs(ride, dep_leg_idx: int, arr_leg_idx: int, seats: int = 1) -> 'PricingResult':
        try:
            legs = list(ride.legs.order_by('order'))
            if not legs:
                return PricingService._fallback(ride, seats)
            dep_leg_idx = max(0, dep_leg_idx)
            arr_leg_idx = min(arr_leg_idx, len(legs) - 1)
            if dep_leg_idx == 0 and arr_leg_idx == len(legs) - 1:
                return PricingService._fallback(ride, seats)
            
            passenger_price = sum(legs[i].price for i in range(dep_leg_idx, arr_leg_idx + 1))
            
            sub_distance = sum(legs[i].distance_m for i in range(dep_leg_idx, arr_leg_idx + 1))
            total_distance = sum(lg.distance_m for lg in legs) or 1
            ratio = sub_distance / total_distance
            
            driver_price_raw = ride.driver_payout * ratio
            driver_price = max(100, int(round(driver_price_raw / 50.0) * 50))
            
            if passenger_price < driver_price:
                passenger_price = driver_price
                
            commission = passenger_price - driver_price

            if commission < 50 and ride.zemy_commission > 0:
                commission = 50
                driver_price = max(50, passenger_price - 50)
            
            return PricingResult(
                driver_price=driver_price,
                commission=commission,
                total_to_pay=passenger_price * seats,
                driver_amount=driver_price * seats,
                zemy_amount=commission * seats,
                seats=seats,
                segment_distance_m=sub_distance,
                segment_distance_km=round(sub_distance / 1000, 1)
            )
        except Exception as e:
            logger.error(f"PricingService.compute_for_legs error: {e}")
            return PricingService._fallback(ride, seats)

    @staticmethod
    def _apply_commission_rules(driver_price: int, settings) -> int:
        try:
            if settings and settings.is_commission_active:
                commission = int(driver_price * settings.commission_percentage / 100)
                commission = max(commission, settings.min_commission)
                if settings.max_commission:
                    commission = min(commission, settings.max_commission)
                return commission
        except Exception:
            pass
        return max(100, int(driver_price * 0.10))

    @staticmethod
    def _fallback(ride, seats: int) -> 'PricingResult':
        return PricingResult(
            driver_price=ride.driver_payout,
            commission=ride.zemy_commission,
            total_to_pay=ride.price_per_seat * seats,
            driver_amount=ride.driver_payout * seats,
            zemy_amount=ride.zemy_commission * seats,
            seats=seats,
            segment_distance_m=0,
            segment_distance_km=0.0
        )

    # Retro-compatibilite
    @staticmethod
    def calculate_segment_price(ride, dep_waypoint_order: int, arr_waypoint_order: int, seats: int = 1) -> dict:
        r = PricingService.compute_for_segment(ride, dep_waypoint_order, arr_waypoint_order, seats)
        return {'base_price': r.driver_price, 'commission': r.commission, 'total_price': r.total_to_pay,
                'driver_payout': r.driver_amount, 'price_per_km': 0,
                'segment_distance_m': r.segment_distance_m, 'segment_distance_km': r.segment_distance_km}

    @staticmethod
    def calculate_price_by_legs(ride, dep_leg_idx: int, arr_leg_idx: int, seats: int = 1) -> dict:
        r = PricingService.compute_for_legs(ride, dep_leg_idx, arr_leg_idx, seats)
        return {'base_price': r.driver_price, 'commission': r.commission, 'total_price': r.total_to_pay,
                'driver_payout': r.driver_amount, 'price_per_km': 0,
                'segment_distance_m': r.segment_distance_m, 'segment_distance_km': r.segment_distance_km}
