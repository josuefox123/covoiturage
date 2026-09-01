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
        
        bookings = ride.bookings.filter(status__in=['pending', 'confirmed'])
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
                title="Gains disponibles 💰",
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
            create_and_send_notification(
                user=booking.passenger,
                title="Conducteur en route",
                message=f"Le conducteur {ride.driver.full_name or ride.driver.phone} est en route pour le trajet {b_dep} -> {b_arr}.",
                data={'type': 'driver_en_route', 'booking_id': str(booking.id), 'screen': 'trips'}
            )
            create_and_send_notification(
                user=booking.passenger,
                title="Trajet commencé",
                message=f"Le trajet {b_dep} -> {b_arr} a commencé. Voyagez en toute sécurité !",
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
                    title="Arrivée à votre arrêt 📍",
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
