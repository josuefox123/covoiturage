"""
==============================================================
Fichier :
booking_state_service.py

Description :
Service unique centralisé côté Backend pour calculer l'état canonique
et complet d'une réservation pour un segment donné sur un trajet.

Rôle :
Assurer une source de vérité unique pour le statut, les actions autorisées,
le calcul de l'expiration et les tarifs. Le frontend ne fait plus de logique.
==============================================================
"""
from typing import Optional
from django.utils import timezone
from datetime import datetime, timedelta
from ..models import Booking, Ride, FinancialSettings

class BookingStateService:
    @staticmethod
    def calculate_expires_at(booking: Booking, ride: Ride) -> Optional[str]:
        """Calcule le moment d'expiration estimé pour une réservation."""
        try:
            ride_datetime = timezone.make_aware(
                datetime.combine(ride.departure_date, ride.departure_time)
            )
            time_diff = ride_datetime - booking.created_at
            diff_hours = time_diff.total_seconds() / 3600.0
            if diff_hours <= 24:
                limit_seconds = 1800
            elif diff_hours <= 48:
                limit_seconds = 7200
            elif diff_hours <= 168:
                limit_seconds = 43200
            else:
                limit_seconds = 86400
            return (booking.created_at + timedelta(seconds=limit_seconds)).isoformat()
        except Exception:
            return None

    @staticmethod
    def get_state(passenger, ride, departure_order=None, arrival_order=None):
        """
        Calcule et retourne l'état d'affichage complet pour un trajet,
        un passager donné, et éventuellement un segment (indices des waypoints).
        """
        if not passenger or passenger.is_anonymous:
            return {"action": "reserve", "label": "Réserver", "can_cancel": False, "can_pay": False}

        # 1. Si le passager est le conducteur du trajet
        if ride.driver == passenger:
            return {
                "action": "own_ride",
                "label": "Votre trajet",
                "can_cancel": False,
                "can_pay": False,
                "price": ride.price_per_seat,
            }

        # 2. Si le trajet est terminé ou annulé
        if ride.status == 'completed':
            return {
                "action": "completed",
                "label": "Trajet terminé",
                "can_cancel": False,
                "can_pay": False,
            }
        if ride.status == 'cancelled':
            return {
                "action": "cancelled",
                "label": "Trajet annulé",
                "can_cancel": False,
                "can_pay": False,
            }

        # 3. Résolution des orders de segments
        dep_order = None
        arr_order = None
        try:
            if departure_order is not None:
                dep_order = int(departure_order)
            if arrival_order is not None:
                arr_order = int(arrival_order)
        except ValueError:
            pass

        # 4. Rechercher une reservation active pour ce passager/trajet/segment
        # Règle : si dep_order et arr_order sont fournis → filtre sur ce segment EXACT.
        # Sinon → on récupère la réservation active la plus récente (si elle existe).
        booking_query = Booking.objects.filter(
            ride=ride,
            passenger=passenger
        ).exclude(
            status__in=['cancelled', 'expired', 'rejected', 'payment_failed']
        ).order_by('-created_at')

        if dep_order is not None and arr_order is not None:
            # Segment précis fourni → filtre strict
            booking_query = booking_query.filter(
                departure_waypoint_order=dep_order,
                arrival_waypoint_order=arr_order
            )

        booking = booking_query.first()

        # Calcul de l'heure de passage estimée si un point de départ est spécifié
        estimated_passage_time = None
        if dep_order is not None:
            try:
                wps = list(ride.waypoints.all().order_by('order')) if hasattr(ride, 'waypoints') else []
                if wps and dep_order < len(wps):
                    dep_wp = wps[dep_order]
                    total_dist_m = ride.distance_km * 1000 if ride.distance_km else 0
                    if total_dist_m <= 0 and wps:
                        total_dist_m = wps[-1].distance_from_start_m
                    total_duration_min = ride.duration_min if ride.duration_min else 0
                    if total_dist_m > 0 and total_duration_min > 0:
                        fraction = dep_wp.distance_from_start_m / total_dist_m
                        minutes_from_start = total_duration_min * fraction
                        start_dt = datetime.combine(ride.departure_date, ride.departure_time)
                        passage_dt = start_dt + timedelta(minutes=minutes_from_start)
                        estimated_passage_time = passage_dt.strftime("%H:%M")
            except Exception:
                pass

        # 5. Si aucune reservation active : action 'reserve'
        if not booking:
            # Calculer le prix du segment si specifi
            from ..services.pricing_service import PricingService
            if dep_order is not None and arr_order is not None:
                pricing = PricingService.compute_for_segment(ride, dep_order, arr_order, seats=1)
            else:
                from ..services.pricing_service import PricingResult
                pricing = PricingResult(
                    driver_price=ride.driver_payout,
                    commission=ride.zemy_commission,
                    total_to_pay=ride.price_per_seat,
                    driver_amount=ride.driver_payout,
                    zemy_amount=ride.zemy_commission,
                    seats=1,
                    segment_distance_m=0,
                    segment_distance_km=0.0
                )

            # Résoudre les locations spécifiques au passager depuis les waypoints
            passenger_departure_location = ride.departure_location
            passenger_arrival_location = ride.arrival_location
            try:
                wps = list(ride.waypoints.all().order_by('order')) if hasattr(ride, 'waypoints') else []
                if wps:
                    if dep_order is not None and dep_order < len(wps):
                        passenger_departure_location = wps[dep_order].name or ride.departure_location
                    if arr_order is not None and arr_order < len(wps):
                        passenger_arrival_location = wps[arr_order].name or ride.arrival_location
            except Exception:
                pass

            is_started = ride.status == 'started'
            is_full = ride.seats_available <= 0

            return {
                "action": "reserve",
                "label": "Réserver" if not is_full else "Trajet complet",
                "price": pricing.total_to_pay,
                "pricing_breakdown": pricing.to_dict(),
                "seats_available": ride.seats_available,
                "departure_location": passenger_departure_location,
                "arrival_location": passenger_arrival_location,
                "can_cancel": False,
                "can_pay": False,
                "is_started": is_started,
                "is_full": is_full,
                "estimated_departure_time": estimated_passage_time,
            }

        # 6. Il y a une réservation active : déterminer l'état
        from ..services.pricing_service import PricingService
        status = booking.status
        payment_status = booking.payment_status
        booking_pricing = PricingService.compute_for_booking(booking)
        amount = booking_pricing.total_to_pay

        # Calculer le moment d'expiration estimé
        expires_at = BookingStateService.calculate_expires_at(booking, ride)

        # Déterminer l'action et le label du bouton
        action = "reserve"
        label = "Réserver"
        can_cancel = False
        can_pay = False

        if status in ['pending', 'pending_driver']:
            action = "waiting_driver"
            label = "En attente de validation..."
            can_cancel = True
            can_pay = False
        elif status == 'pending_passenger':
            action = "offer_received"
            label = f"Proposition reçue — {(booking_pricing.driver_price + booking_pricing.commission):,} FCFA (OUI / NON)".replace(",", " ")
            can_cancel = True
            can_pay = False
        elif status == 'pending_payment':
            action = "pay"
            label = f"Payer {amount:,} FCFA".replace(",", " ")
            can_cancel = True
            can_pay = True
        elif status == 'payment_processing':
            action = "payment_processing"
            label = "Validation du paiement..."
            can_cancel = False
            can_pay = False
        elif status in ['confirmed', 'active', 'started']:
            action = "confirmed"
            label = "Annuler ma réservation"
            can_cancel = True
            can_pay = False
        elif status == 'completed':
            action = "completed"
            label = "Trajet terminé ✓"
            can_cancel = False
            can_pay = False

        return {
            "action": action,
            "label": label,
            "booking_id": str(booking.id),
            "status": status,
            "payment_status": payment_status,
            # Prix complet (driver + commission) — ce que paie le passager
            "price": amount,
            # Décomposition pour l'affichage transparent
            "pricing_breakdown": booking_pricing.to_dict(),
            "seats_booked": booking.seats_booked,
            "can_cancel": can_cancel,
            "can_pay": can_pay,
            "expires_at": expires_at,
            "departure_location": booking.departure_location or ride.departure_location,
            "arrival_location": booking.arrival_location or ride.arrival_location,
            # Identité du segment — le frontend valide que c'est bien son segment
            "departure_waypoint_order": booking.departure_waypoint_order,
            "arrival_waypoint_order": booking.arrival_waypoint_order,
            "driver_name": ride.driver.full_name or ride.driver.phone,
            "driver_phone": ride.driver.phone,
            "estimated_departure_time": estimated_passage_time,
            "negotiation": {
                "passenger_proposed_price": booking.passenger_proposed_price,
                "driver_counter_price": booking.driver_counter_price,
                "custom_price": booking.custom_price,
                "negotiation_message": booking.negotiation_message,
            }
        }
