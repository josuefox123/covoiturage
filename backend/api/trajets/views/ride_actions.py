import logging
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import status
from django.db import transaction
from django.utils import timezone
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

from ...models import Ride
from ...models.paiement import RefundRequest, Transaction
from ...fcm import create_and_send_notification

class RideActionsMixin:
    """
    Mixin regroupant les actions du cycle de vie des trajets
    pour alléger le RideViewSet principal.
    """
    def get_object(self) -> Ride:
        """Méthode de ViewSet fournie au runtime."""
        return super().get_object()  # type: ignore

    @action(detail=True, methods=['post'], url_path='cancel')
    def cancel_ride(self, request, pk=None):
        ride = self.get_object()
        if ride.driver != request.user and not getattr(request.user, 'is_staff', False):
            return Response({"error": "Non autorisé."}, status=status.HTTP_403_FORBIDDEN)
        
        if ride.status == 'cancelled':
            return Response({"error": "Trajet déjà annulé."}, status=status.HTTP_400_BAD_REQUEST)
            
        ride.status = 'cancelled'
        ride.save()
        
        bookings = ride.bookings.filter(status__in=['pending', 'confirmed'])
        for booking in bookings:
            booking.status = 'cancelled'
            booking.payment_status = 'refunded'
            booking.save()
            ride.seats_available += booking.seats_booked
            
            price_paid = ride.price_per_seat * booking.seats_booked
            RefundRequest.objects.create(
                booking=booking,
                passenger=booking.passenger,
                driver=ride.driver,
                amount=price_paid,
                reason="Annulation globale du trajet par le conducteur",
                status='approved'
            )
            
            b_dep = booking.departure_location or ride.departure_location or ''
            b_arr = booking.arrival_location or ride.arrival_location or ''
            create_and_send_notification(
                user=booking.passenger,
                title="Réservation annulée",
                message=f"Le conducteur a annulé le trajet de {b_dep} vers {b_arr}. Remboursement garanti.",
                data={'type': 'booking_cancelled', 'booking_id': str(booking.id), 'screen': 'trips'}
            )
            
        parcels = ride.parcels.filter(status__in=['pending', 'accepted'])
        for parcel in parcels:
            parcel.status = 'cancelled'
            parcel.payment_status = 'refunded'
            parcel.save()
            ride.parcels_available += 1
            
            if parcel.sender_user:
                create_and_send_notification(
                    user=parcel.sender_user,
                    title="Envoi de colis annulé",
                    message=f"Le conducteur a annulé le trajet de {ride.departure_location} vers {ride.arrival_location}. Remboursement garanti.",
                    data={'type': 'parcel_cancelled', 'parcel_id': str(parcel.id), 'screen': 'trips'}
                )
            
        ride.save()
        return Response({"status": "Trajet annulé avec succès."})

    @action(detail=True, methods=['post'], url_path='complete')
    def complete_ride(self, request, pk=None):
        ride = self.get_object()
        if ride.driver != request.user and not getattr(request.user, 'is_staff', False):
            return Response({"error": "Non autorisé."}, status=status.HTTP_403_FORBIDDEN)
        
        if ride.status == 'completed':
            return Response({"status": "Trajet déjà terminé."})
            
        ride.status = 'completed'
        ride.save()
        
        bookings = ride.bookings.exclude(status__in=['cancelled', 'expired', 'payment_failed', 'payment_refunded'])
        total_driver_gain = 0
        for booking in bookings:
            booking.status = 'completed'
            booking.save()
            
            if booking.payment_status in ['paid', 'escrow']:
                gain = 0
                try:
                    gain = int(booking.amount_due_to_driver)
                except Exception:
                    pass
                total_driver_gain += gain
                Transaction.objects.create(
                    user=ride.driver,
                    ride=ride,
                    transaction_type='ride',
                    amount=gain,
                    status='completed'
                )

            b_dep = booking.departure_location or ride.departure_location or ''
            b_arr = booking.arrival_location or ride.arrival_location or ''
            create_and_send_notification(
                user=booking.passenger,
                title="Trajet terminé",
                message=f"Votre trajet {b_dep} -> {b_arr} est terminé. Merci d'avoir voyagé avec nous !",
                data={'type': 'ride_completed', 'booking_id': str(booking.id), 'screen': 'trips'}
            )

        # Notification conducteur : gains disponibles
        if ride.driver and total_driver_gain > 0:
            create_and_send_notification(
                user=ride.driver,
                title="Gains disponibles",
                message=(
                    f"Trajet {ride.departure_location} → {ride.arrival_location} terminé. "
                    f"Vos gains de {total_driver_gain:,} FCFA sont maintenant disponibles. "
                    f"Rendez-vous dans 'Mes revenus' pour effectuer un retrait."
                ).replace(',', ' '),
                data={'type': 'driver_gains_available', 'ride_id': str(ride.id), 'screen': 'earnings'}
            )
            
        return Response({"status": "Trajet terminé avec succès."})

    @action(detail=True, methods=['post'], url_path='start')
    def start_ride(self, request, pk=None):
        ride = self.get_object()
        if ride.driver != request.user and not getattr(request.user, 'is_staff', False):
            is_passenger = ride.bookings.filter(passenger=request.user, status__in=['pending', 'confirmed', 'active']).exists()
            if not is_passenger:
                return Response({"error": "Non autorisé."}, status=status.HTTP_403_FORBIDDEN)
            
        ride.status = 'started'
        ride.save()
            
        create_and_send_notification(
            user=ride.driver,
            title="Trajet commencé",
            message=f"Votre trajet {ride.departure_location} -> {ride.arrival_location} a commencé. Bonne route !",
            data={'type': 'ride_started_driver', 'ride_id': str(ride.id), 'screen': 'trips'}
        )
        
        bookings = ride.bookings.filter(status__in=['pending', 'confirmed'])
        for booking in bookings:
            b_dep = booking.departure_location or ride.departure_location or ''
            b_arr = booking.arrival_location or ride.arrival_location or ''
            # BUG4 FIX : fusionner "Conducteur en route" + "Trajet commencé" en une seule notification
            # (2 push simultanés pour le même événement = bruit inutile)
            create_and_send_notification(
                user=booking.passenger,
                title="Votre trajet a commencé",
                message=f"Le conducteur {ride.driver.full_name or ride.driver.phone} est en route. Trajet {b_dep} → {b_arr} en cours. Bon voyage !",
                data={'type': 'ride_started_passenger', 'booking_id': str(booking.id), 'screen': 'trips'}
            )
            
        return Response({"status": "Trajet commencé."})

    @action(detail=True, methods=['post'], url_path='next_leg')
    def next_leg(self, request, pk=None):
        ride = self.get_object()
        if ride.driver != request.user and not getattr(request.user, 'is_staff', False):
            return Response({"error": "Non autorisé."}, status=status.HTTP_403_FORBIDDEN)

        if ride.status not in ['active', 'started']:
            return Response({"error": "Le trajet n'est pas en cours."}, status=status.HTTP_400_BAD_REQUEST)

        legs = list(getattr(ride, 'legs').all().order_by('order'))
        if not legs:
            return Response({"error": "Ce trajet ne possède pas de tronçons."}, status=status.HTTP_400_BAD_REQUEST)

        current_idx = ride.current_leg_index
        total_legs = len(legs)

        if current_idx >= total_legs:
            return Response({"error": "Tous les tronçons ont déjà été parcourus."}, status=status.HTTP_400_BAD_REQUEST)

        current_leg = legs[current_idx]
        current_leg.leg_status = 'completed'
        current_leg.save(update_fields=['leg_status'])

        freed_seats_total = 0
        from api.services.matching_service import MatchingService
        alighting_passengers = []

        for booking in ride.bookings.filter(status='confirmed').select_related('passenger'):
            arr_idx = MatchingService.get_leg_indices_for_booking(
                ride,
                booking.departure_location or ride.departure_location,
                booking.arrival_location or ride.arrival_location
            )[1]

            if arr_idx == current_idx:
                booking.status = 'completed'
                booking.save(update_fields=['status'])
                dep_idx = MatchingService.get_leg_indices_for_booking(
                    ride,
                    booking.departure_location or ride.departure_location,
                    booking.arrival_location or ride.arrival_location
                )[0]
                MatchingService.deallocate_seats_for_segment(
                    ride, current_idx + 1, total_legs - 1, booking.seats_booked
                )
                freed_seats_total += booking.seats_booked
                alighting_passengers.append(booking.passenger)

                create_and_send_notification(
                    user=booking.passenger,
                    title="Arrivée à votre arrêt",
                    message=f"Vous êtes arrivé(e) à {current_leg.end_location}. Merci d'avoir voyagé avec Zemy !",
                    data={'type': 'passenger_alighting', 'booking_id': str(booking.id), 'ride_id': str(ride.id)}
                )

        next_idx = current_idx + 1
        ride.current_leg_index = next_idx
        ride.status = 'started'

        if next_idx < total_legs:
            next_leg_obj = legs[next_idx]
            next_leg_obj.leg_status = 'active'
            next_leg_obj.save(update_fields=['leg_status'])
        else:
            ride.status = 'completed'
            ride.bookings.exclude(status__in=['cancelled', 'expired', 'payment_failed', 'payment_refunded']).update(status='completed')

        ride.save(update_fields=['current_leg_index', 'status'])

        if freed_seats_total > 0:
            try:
                passenger_names = ", ".join([p.full_name or "Un passager" for p in alighting_passengers])
                next_leg_seats = legs[next_idx].seats_available if next_idx < total_legs else 0
                
                seats_freed_msg = (
                    f"{passenger_names} vient/viennent de descendre à {current_leg.end_location}. "
                    f"Vous disposez encore de {next_leg_seats} places libres."
                ) if next_idx < total_legs else (
                    f"{passenger_names} vient/viennent de descendre à {current_leg.end_location}."
                )
                
                create_and_send_notification(
                    user=ride.driver,
                    title="1 place vient d'être libérée" if freed_seats_total == 1 else "Des places viennent de se libérer",
                    message=seats_freed_msg,
                    data={
                        'type': 'leg_seats_freed_driver',
                        'ride_id': str(ride.id),
                        'seats_available': next_leg_seats,
                        'screen': 'rides'
                    }
                )
            except Exception:
                pass

        if freed_seats_total > 0 and next_idx < total_legs:
            try:
                from api.tasks import notify_compatible_passengers_task
                from typing import Any
                task: Any = notify_compatible_passengers_task
                if hasattr(task, 'apply_async'):
                    task.apply_async(
                        args=(str(ride.id), next_idx, freed_seats_total), countdown=5
                    )
                else:
                    task(str(ride.id), next_idx, freed_seats_total)
            except Exception:
                from api.services.matching_service import MatchingService as MS
                compatible = MS.find_compatible_search_alerts(ride, next_idx, freed_seats_total)
                for item in compatible:
                    create_and_send_notification(
                        user=item['passenger'],
                        title="Place disponible sur votre trajet",
                        message=f"Une place vient de se libérer sur le trajet {ride.departure_location} → {ride.arrival_location} ! Réservez maintenant.",
                        data={'type': 'seat_available', 'ride_id': str(ride.id)}
                    )

        current_leg_name = current_leg.end_location
        next_leg_name = legs[next_idx].start_location if next_idx < total_legs else "Destination finale"

        return Response({
            "status": "ok",
            "current_leg_index": next_idx,
            "completed_leg": current_leg_name,
            "next_stop": next_leg_name,
            "freed_seats": freed_seats_total,
            "alighting_passengers": len(alighting_passengers),
            "ride_status": ride.status,
        })

    # =========================================================================
    # Confirmation de départ 30 min avant (alerte conducteur)
    # =========================================================================

    @action(detail=True, methods=['post'], url_path='confirm-departure')
    def confirm_departure(self, request, pk=None):
        """
        Endpoint appelé quand le conducteur répond à l'alerte de confirmation 30 min avant départ.

        Body JSON:
            { "confirmed": true }  → Le trajet tient
            { "confirmed": false } → Le conducteur annule

        Si confirmed=False :
            - Le trajet passe en 'cancelled'
            - Tous les passagers confirmés (escrow) sont remboursés automatiquement (RefundRequest)
            - Chaque passager reçoit une notification + email d'excuse
            - Le conducteur reçoit une notification récapitulative
        """
        ride = self.get_object()

        # Seul le conducteur peut confirmer
        if ride.driver != request.user:
            return Response({"error": "Seul le conducteur peut confirmer ce trajet."}, status=status.HTTP_403_FORBIDDEN)

        if ride.status in ['cancelled', 'completed']:
            return Response({"error": f"Ce trajet est déjà {ride.status}."}, status=status.HTTP_400_BAD_REQUEST)

        confirmed = request.data.get('confirmed')
        if confirmed is None:
            return Response({"error": "Le champ 'confirmed' est requis (true/false)."}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            ride.driver_confirmed_departure = bool(confirmed)
            ride.save(update_fields=['driver_confirmed_departure'])

            # ——— OUI : le trajet tient ———
            if confirmed:
                logger.info(f"[DepartureConfirm] Conducteur {ride.driver.id} a confirmé le trajet {ride.id}")
                return Response({
                    "status": "confirmed",
                    "message": "Parfait ! Une fenêtre de démarrage vous sera envoyée 10 minutes avant le départ."
                })

            # ——— NON : annulation du trajet ———
            logger.info(f"[DepartureConfirm] Conducteur {ride.driver.id} a annulé le trajet {ride.id}")

            ride.status = 'cancelled'
            ride.save(update_fields=['status'])

            dep = ride.departure_location or ''
            arr = ride.arrival_location or ''
            driver_name = ride.driver.full_name or ride.driver.phone or 'Le conducteur'

            # Rembourser tous les passagers confirmés (payment_status='escrow')
            confirmed_bookings = ride.bookings.filter(status='confirmed', payment_status='escrow')
            refund_count = 0
            for booking in confirmed_bookings:
                # Marquer comme annulé + remboursé
                booking.status = 'cancelled'
                booking.payment_status = 'refunded'
                booking.save(update_fields=['status', 'payment_status'])

                # Libérer les places (update atomique, pas d'assignation F() sur l'instance)
                from django.db.models import F
                Ride.objects.filter(pk=ride.pk).update(
                    seats_available=F('seats_available') + booking.seats_booked
                )

                # Créer la demande de remboursement approuvée automatiquement
                from ...models.paiement import RefundRequest as RF
                amount_to_refund = booking.total_amount
                RF.objects.create(
                    booking=booking,
                    passenger=booking.passenger,
                    driver=ride.driver,
                    amount=amount_to_refund,
                    reason=f"Annulation du trajet par le conducteur 30 min avant le départ ({dep} → {arr})",
                    status='approved'
                )
                refund_count += 1

                # Notification d'excuse au passager (urgente)
                b_dep = booking.departure_location or dep
                b_arr = booking.arrival_location or arr
                excuse_message = (
                    f"Trajet annulé - {b_dep} -> {b_arr}\n\n"
                    f"{driver_name} a malheureusement dû annuler ce trajet 30 min avant le départ. "
                    f"Toutes nos excuses pour la gêne occasionnée. "
                    f"Votre remboursement de {amount_to_refund} FCFA est en cours et sera crédité sous 24-48h. "
                    f"L'équipe Zemy reste disponible pour vous aider à trouver un autre trajet."
                )
                create_and_send_notification(
                    user=booking.passenger,
                    title="Trajet annulé - Remboursement en cours",
                    message=excuse_message,
                    data={
                        'type': 'ride_cancelled_by_driver',
                        'booking_id': str(booking.id),
                        'ride_id': str(ride.id),
                        'screen': 'trips',
                        'requires_acknowledgment': 'true',
                    }
                )

            # Notification récapitulative au conducteur
            create_and_send_notification(
                user=ride.driver,
                title="Trajet annulé",
                message=(
                    f"Votre trajet {dep} → {arr} a été annulé. "
                    f"{refund_count} passager(s) ont été remboursés automatiquement. "
                    f"Merci de prévenir à l'avance la prochaine fois."
                ),
                data={
                    'type': 'driver_cancelled_own_ride',
                    'ride_id': str(ride.id),
                    'screen': 'rides',
                }
            )

            return Response({
                "status": "cancelled",
                "message": f"Trajet annulé. {refund_count} passager(s) ont été remboursés automatiquement.",
                "refund_count": refund_count,
            })

