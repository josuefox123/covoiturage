from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from datetime import timedelta
import logging

logger = logging.getLogger(__name__)

from ...models.reservation import Booking
from ...models.messagerie import Conversation, Message
from ...serializers import BookingSerializer
from ...fcm import create_and_send_notification

class BookingViewSet(viewsets.ModelViewSet):
    """
    ViewSet gérant les réservations de places dans un trajet.
    
    Endpoints supplémentaires :
        - POST /api/bookings/{id}/accept/ : Le conducteur accepte la réservation
        - POST /api/bookings/{id}/reject/ : Le conducteur refuse
        - POST /api/bookings/{id}/cancel/ : Le passager annule
    """
    queryset = Booking.objects.all()
    serializer_class = BookingSerializer

    def get_queryset(self):
        user = self.request.user
        queryset = super().get_queryset().select_related('passenger', 'ride', 'ride__driver', 'ride__vehicle').prefetch_related('ride__driver__vehicles')
        
        if not getattr(user, 'is_staff', False):
            queryset = queryset.filter(
                Q(passenger=user) | Q(ride__driver=user)
            )
            
        query_params = self.request.query_params if hasattr(self.request, 'query_params') else self.request.GET
        passenger_id = query_params.get('passenger')
        ride_driver_id = query_params.get('ride_driver')
        ride_id = query_params.get('ride')
        if passenger_id:
            queryset = queryset.filter(passenger_id=passenger_id)
        if ride_driver_id:
            queryset = queryset.filter(ride__driver_id=ride_driver_id)
        if ride_id:
            queryset = queryset.filter(ride_id=ride_id)
        return queryset.order_by('-created_at')

    def create(self, request, *args, **kwargs):
        from rest_framework.exceptions import ValidationError
        
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        ride_id = request.data.get('ride')
        seats_to_book = serializer.validated_data.get('seats_booked', 1)
        
        departure_location = request.data.get('departure_location')
        arrival_location = request.data.get('arrival_location')
        departure_latitude = request.data.get('departure_latitude')
        departure_longitude = request.data.get('departure_longitude')
        arrival_latitude = request.data.get('arrival_latitude')
        arrival_longitude = request.data.get('arrival_longitude')

        passenger_proposed_price = request.data.get('passenger_proposed_price')
        negotiation_message = request.data.get('negotiation_message')
        departure_waypoint_order = request.data.get('departure_waypoint_order')
        arrival_waypoint_order = request.data.get('arrival_waypoint_order')

        pickup_location_extra = request.data.get('pickup_location_extra')
        pickup_surcharge = request.data.get('pickup_surcharge', 0)
        dropoff_location_extra = request.data.get('dropoff_location_extra')
        dropoff_surcharge = request.data.get('dropoff_surcharge', 0)

        from api.bookings.services import BookingService
        booking, created = BookingService.create_booking(
            passenger=request.user,
            ride_id=ride_id,
            seats_booked=seats_to_book,
            departure_location=departure_location,
            arrival_location=arrival_location,
            departure_latitude=departure_latitude,
            departure_longitude=departure_longitude,
            arrival_latitude=arrival_latitude,
            arrival_longitude=arrival_longitude,
            passenger_proposed_price=passenger_proposed_price,
            negotiation_message=negotiation_message,
            departure_waypoint_order=departure_waypoint_order,
            arrival_waypoint_order=arrival_waypoint_order,
            pickup_location_extra=pickup_location_extra,
            pickup_surcharge=pickup_surcharge,
            dropoff_location_extra=dropoff_location_extra,
            dropoff_surcharge=dropoff_surcharge
        )
        
        if not created:
            return Response(self.get_serializer(booking).data, status=status.HTTP_200_OK)
            
        existing_conv = Conversation.objects.filter(
            ride=booking.ride,
            conversation_type='ride'
        ).filter(
            Q(participant_1=request.user, participant_2=booking.ride.driver) |
            Q(participant_1=booking.ride.driver, participant_2=request.user)
        ).first()
        
        if existing_conv:
            Message.objects.get_or_create(
                conversation=existing_conv,
                sender=booking.ride.driver,
                content="[Message Automatique] Bonjour ! Veuillez préciser dans cette discussion si vous voyagez avec des bagages (nombre, taille, etc.) pour ce trajet.",
                defaults={'message_type': 'text'}
            )
            
        response_data = BookingSerializer(booking).data
        if existing_conv:
            response_data['conversation_id'] = str(existing_conv.id)
            

        dep_loc = booking.departure_location or booking.ride.departure_location or ''
        arr_loc = booking.arrival_location or booking.ride.arrival_location or ''

        # Notification au conducteur : nouvelle demande de reservation
        create_and_send_notification(
            user=booking.ride.driver,
            title="Nouvelle demande de reservation",
            message=f"{booking.passenger.full_name or booking.passenger.phone} souhaite reserver {booking.seats_booked} place(s) sur votre trajet {dep_loc} -> {arr_loc}.",
            data={
                'type': 'new_booking_request',
                'booking_id': str(booking.id),
                'ride_id': str(booking.ride.id),
                'screen': 'rides',
                'passenger_name': booking.passenger.full_name or 'Passager',
                'passenger_phone': booking.passenger.phone or '',
                'departure_location': dep_loc,
                'arrival_location': arr_loc,
                'seats_booked': str(booking.seats_booked),
                'total_amount': str(booking.total_amount),
                'negotiation_message': booking.negotiation_message or '',
                'created_at': booking.created_at.isoformat()
            }
        )

        if booking.status == 'pending':
            try:
                create_and_send_notification(
                    user=booking.passenger,
                    title="Demande envoyee",
                    message="Votre demande a ete envoyee. Le conducteur vous repondra dans quelques instants.",
                    data={'type': 'booking_request_sent_passenger', 'booking_id': str(booking.id), 'ride_id': str(booking.ride.id), 'screen': 'trips'}
                )
            except Exception:
                pass

        return Response(response_data, status=status.HTTP_201_CREATED)



    def perform_update(self, serializer):
        old_instance = self.get_object()
        old_status = old_instance.status
        booking = serializer.save()
        new_status = booking.status
        
        if old_status != new_status:
            ride = booking.ride
            passenger = booking.passenger
            driver = ride.driver
            dep_loc = booking.departure_location or ride.departure_location or ''
            arr_loc = booking.arrival_location or ride.arrival_location or ''
            
            if new_status == 'cancelled' and old_status != 'cancelled':
                if old_status == 'confirmed':
                    from api.bookings.services import BookingService
                    BookingService.deallocate_seats(booking)
                
                if old_status in ['confirmed', 'pending_payment', 'pending']:
                    request_user = self.request.user
                    if request_user == driver:
                        create_and_send_notification(
                            user=passenger,
                            title="Demande de réservation refusée",
                            message=f"Le conducteur a décliné votre demande de réservation pour le trajet {dep_loc} -> {arr_loc}.",
                            data={'type': 'booking_cancelled', 'booking_id': str(booking.id), 'ride_id': str(booking.ride.id), 'screen': 'trips'}
                        )
                    else:
                        create_and_send_notification(
                            user=driver,
                            title="Réservation annulée",
                            message=f"Le passager {passenger.full_name or passenger.phone} a annulé sa réservation sur votre trajet {dep_loc} -> {arr_loc}.",
                            data={'type': 'booking_cancelled_driver', 'booking_id': str(booking.id), 'ride_id': str(booking.ride.id), 'screen': 'trips'}
                        )
            
            elif new_status == 'pending_payment' and old_status in ['pending', 'pending_driver']:
                create_and_send_notification(
                    user=passenger,
                    title="Demande acceptée par le conducteur",
                    message=f"Votre demande de réservation pour le trajet {dep_loc} -> {arr_loc} a été acceptée par le conducteur ! Vous pouvez maintenant procéder au paiement.",
                    data={'type': 'booking_accepted_passenger', 'booking_id': str(booking.id), 'screen': 'trips', 'ride_id': str(booking.ride.id)}
                )
            
            elif new_status == 'confirmed':
                create_and_send_notification(
                    user=passenger,
                    title="Réservation confirmée",
                    message=f"Votre réservation de {booking.seats_booked} place(s) pour le trajet {dep_loc} -> {arr_loc} est confirmée !",
                    data={'type': 'booking_accepted_passenger', 'booking_id': str(booking.id), 'screen': 'trips', 'ride_id': str(booking.ride.id)}
                )
                create_and_send_notification(
                    user=passenger,
                    title="Paiement confirmé",
                    message=f"Le paiement pour votre réservation sur le trajet {dep_loc} -> {arr_loc} a été validé avec succès.",
                    data={'type': 'payment_confirmed', 'booking_id': str(booking.id), 'ride_id': str(booking.ride.id), 'screen': 'trips'}
                )
            
            elif new_status == 'completed':
                create_and_send_notification(
                    user=driver,
                    title="Passager arrivé",
                    message=f"Le passager {passenger.full_name or passenger.phone} est bien arrivé à destination.",
                    data={'type': 'passenger_arrived', 'booking_id': str(booking.id), 'ride_id': str(booking.ride.id), 'screen': 'trips'}
                )
                create_and_send_notification(
                    user=passenger,
                    title="Trajet terminé",
                    message=f"Votre trajet {dep_loc} -> {arr_loc} est terminé. Merci d'avoir voyagé avec nous !",
                    data={'type': 'ride_completed', 'booking_id': str(booking.id), 'ride_id': str(booking.ride.id), 'screen': 'trips'}
                )

    @action(detail=True, methods=['post'], url_path='cancel')
    def cancel_booking(self, request, pk=None):
        booking = self.get_object()
        if booking.passenger != request.user and booking.ride.driver != request.user and not request.user.is_staff:
            return Response({"error": "Non autorisé."}, status=status.HTTP_403_FORBIDDEN)
            
        from api.services.booking_service import BookingService
        success, msg = BookingService.cancel_booking(booking, cancelled_by_user=request.user)
        _push_booking_update(booking)
        return Response({"status": msg})

    @action(detail=True, methods=['get'], url_path='state')
    def booking_state(self, request, pk=None):
        booking = self.get_object()
        if booking.passenger != request.user and booking.ride.driver != request.user and not request.user.is_staff:
            return Response({"error": "Non autorisé."}, status=status.HTTP_403_FORBIDDEN)

        ride = booking.ride
        driver = ride.driver

        from api.bookings.booking_state_service import BookingStateService
        expires_at = BookingStateService.calculate_expires_at(booking, ride)

        available_actions = []
        if booking.status in ['pending', 'pending_driver', 'pending_passenger', 'pending_payment']:
            available_actions.append('cancel')
        if booking.status == 'pending_payment' and booking.payment_status not in ['escrow', 'paid']:
            available_actions.append('pay')
        if booking.status == 'pending_passenger':
            available_actions.extend(['accept_offer', 'reject_offer'])
        if booking.status in ['confirmed', 'started']:
            available_actions.append('cancel')

        return Response({
            'booking_id': str(booking.id),
            'status': booking.status,
            'payment_status': booking.payment_status,
            'amount': booking.total_amount,
            'driver_payout': booking.amount_due_to_driver,
            'seats_booked': booking.seats_booked,
            'departure_location': booking.departure_location or ride.departure_location,
            'arrival_location': booking.arrival_location or ride.arrival_location,
            'departure_waypoint_order': booking.departure_waypoint_order,
            'arrival_waypoint_order': booking.arrival_waypoint_order,
            'driver': {
                'id': str(driver.id),
                'name': driver.full_name or driver.phone,
                'phone': driver.phone,
            },
            'ride_id': str(ride.id),
            'ride_status': ride.status,
            'available_actions': available_actions,
            'expires_at': expires_at,
            'created_at': booking.created_at.isoformat(),
            'passenger_proposed_price': booking.passenger_proposed_price,
            'driver_counter_price': booking.driver_counter_price,
            'custom_price': booking.custom_price,
        })

    @action(detail=True, methods=['post'], url_path='board')
    def board_booking(self, request, pk=None):
        booking = self.get_object()
        if booking.ride.driver != request.user and not request.user.is_staff:
            return Response({"error": "Seul le conducteur de ce trajet peut valider l'embarquement."}, status=status.HTTP_403_FORBIDDEN)
            
        if booking.status not in ['confirmed']:
            return Response({"error": f"Statut invalide pour l'embarquement: {booking.status}."}, status=status.HTTP_400_BAD_REQUEST)
            
        booking.status = 'started'
        booking.save()
        
        create_and_send_notification(
            user=booking.passenger,
            title="Vous avez embarqué !",
            message=f"Le conducteur a validé votre embarquement. Bon voyage !",
            data={'type': 'passenger_boarded', 'booking_id': str(booking.id), 'screen': 'trips'}
        )
        _push_booking_update(booking)
        return Response({"status": "Embarquement validé avec succès.", "booking_status": booking.status})

    @action(detail=True, methods=['post'], url_path='complete')
    def complete_booking(self, request, pk=None):
        booking = self.get_object()
        if booking.passenger != request.user and not request.user.is_staff:
            return Response({"error": "Non autorisé."}, status=status.HTTP_403_FORBIDDEN)
            
        if booking.status == 'completed':
            return Response({"status": "Réservation déjà terminée."})
            
        booking.status = 'completed'
        booking.save()
        
        ride = booking.ride
        passenger = booking.passenger
        driver = ride.driver
        
        dep_loc = booking.departure_location or ride.departure_location or ''
        arr_loc = booking.arrival_location or ride.arrival_location or ''
        create_and_send_notification(
            user=driver,
            title="Passager arrivé 🏁",
            message=f"Le passager {passenger.full_name or passenger.phone} est bien arrivé à destination.",
            data={'type': 'passenger_arrived', 'booking_id': str(booking.id), 'screen': 'trips'}
        )
        create_and_send_notification(
            user=passenger,
            title="Trajet terminé 🏁",
            message=f"Votre trajet {dep_loc} -> {arr_loc} est terminé. Merci d'avoir voyagé avec nous !",
            data={'type': 'ride_completed', 'booking_id': str(booking.id), 'screen': 'trips'}
        )
        
        return Response({"status": "Réservation terminée avec succès."})

    @action(detail=True, methods=['post'], url_path='pay')
    def pay_booking(self, request, pk=None):
        booking = self.get_object()
        if booking.passenger != request.user and not request.user.is_staff:
            return Response({"error": "Non autorisé."}, status=status.HTTP_403_FORBIDDEN)
            
        if booking.payment_status in ['escrow', 'paid']:
            return Response({"error": "Cette réservation est déjà payée."}, status=status.HTTP_400_BAD_REQUEST)

        if booking.status != 'pending_payment':
            return Response({"error": "Vous ne pouvez pas effectuer le paiement avant la validation du chauffeur."}, status=status.HTTP_400_BAD_REQUEST)

        if booking.ride and booking.ride.status in ['completed', 'cancelled']:
            return Response({"error": "Ce trajet est terminé. Le paiement n'est plus possible."}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            import urllib.parse
            amount_to_pay = max(100, int(booking.amount_paid_online))
            dep_loc = booking.departure_location or booking.ride.departure_location or ''
            arr_loc = booking.arrival_location or booking.ride.arrival_location or ''
            description = f"Commission Zemy - Trajet {dep_loc} -> {arr_loc}"
            
            import time
            path = (
                f"/api/payments/checkout/"
                f"?amount={amount_to_pay}"
                f"&custom_id={booking.id}"
                f"&fullname={urllib.parse.quote(booking.passenger.full_name or 'Client Zemy')}"
                f"&email={urllib.parse.quote(booking.passenger.email or 'client@zemy.bj')}"
                f"&phone={urllib.parse.quote(booking.passenger.phone or '')}"
                f"&description={urllib.parse.quote(description)}"
                f"&_t={int(time.time())}"
            )
            url = request.build_absolute_uri(path)
            
            return Response({
                "url": url, 
                "booking_id": str(booking.id),
                "amount": amount_to_pay
            })
            
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'], url_path='accept')
    def accept_booking(self, request, pk=None):
        booking = self.get_object()
        if booking.ride.driver != request.user and not request.user.is_staff:
            return Response({"error": "Seul le conducteur de ce trajet peut accepter cette réservation."}, status=status.HTTP_403_FORBIDDEN)
            
        if booking.status == 'pending_payment':
            return Response({"status": "Réservation acceptée.", "booking_status": booking.status})

        if booking.status not in ['pending', 'pending_driver']:
            return Response({"error": f"Impossible d'accepter une réservation au statut actuel: {booking.status}."}, status=status.HTTP_400_BAD_REQUEST)
            
        # Récupérer les nouveaux surcoûts modifiés par le conducteur
        new_pickup_surcharge = request.data.get('pickup_surcharge')
        new_dropoff_surcharge = request.data.get('dropoff_surcharge')
        
        has_changes = False
        if new_pickup_surcharge is not None:
            try:
                val = int(new_pickup_surcharge)
                if val != (booking.pickup_surcharge or 0):
                    booking.pickup_surcharge = val
                    has_changes = True
            except ValueError:
                return Response({"error": "Le surcoût de départ proposé est invalide."}, status=status.HTTP_400_BAD_REQUEST)
                
        if new_dropoff_surcharge is not None:
            try:
                val = int(new_dropoff_surcharge)
                if val != (booking.dropoff_surcharge or 0):
                    booking.dropoff_surcharge = val
                    has_changes = True
            except ValueError:
                return Response({"error": "Le surcoût d'arrivée proposé est invalide."}, status=status.HTTP_400_BAD_REQUEST)

        # Si le conducteur a également soumis un prix de base personnalisé unitaire (rare dans le nouveau flux, mais supporté)
        price_val = request.data.get('price') or request.data.get('custom_price') or request.data.get('driver_counter_price')
        if price_val is not None:
            try:
                booking.driver_counter_price = int(price_val)
                has_changes = True
            except ValueError:
                return Response({"error": "Le prix proposé est invalide."}, status=status.HTTP_400_BAD_REQUEST)
        else:
            if booking.passenger_proposed_price is not None:
                booking.custom_price = booking.passenger_proposed_price
                has_changes = True

        if has_changes:
            booking.status = 'pending_passenger'
            # On met à jour driver_counter_price pour mémoriser qu'il y a négociation
            booking.driver_counter_price = booking.driver_counter_price or booking.ride.driver_payout
            title = "Nouvelle offre tarifaire"
            message = f"Le chauffeur propose un nouveau tarif d'option. Total à payer : {booking.total_amount} FCFA."
        else:
            booking.status = 'pending_payment'
            title = "Demande acceptée par le conducteur"
            message = f"Votre demande de réservation a été acceptée par le conducteur ! Vous pouvez procéder au paiement."

        booking.save()
        
        create_and_send_notification(
            user=booking.passenger,
            title=title,
            message=message,
            data={'type': 'booking_accepted_passenger', 'booking_id': str(booking.id), 'screen': 'trips', 'amount': str(booking.total_amount), 'ride_id': str(booking.ride.id)}
        )
        _push_booking_update(booking)
        return Response({"status": "Réservation acceptée.", "booking_status": booking.status})

    @action(detail=True, methods=['post'], url_path='reject')
    def reject_booking(self, request, pk=None):
        booking = self.get_object()
        if booking.ride.driver != request.user and not request.user.is_staff:
            return Response({"error": "Seul le conducteur de ce trajet peut refuser cette réservation."}, status=status.HTTP_403_FORBIDDEN)
            
        if booking.status not in ['pending', 'pending_passenger', 'pending_payment']:
            return Response({"error": f"Impossible de refuser une réservation déjà traitée (statut actuel: {booking.status})."}, status=status.HTTP_400_BAD_REQUEST)
            
        booking.status = 'cancelled'
        booking.save()
        
        dep_loc = booking.departure_location or booking.ride.departure_location or ''
        arr_loc = booking.arrival_location or booking.ride.arrival_location or ''
        create_and_send_notification(
            user=booking.passenger,
            title="Demande de reservation declinee",
            message=f"Le conducteur a refuse votre demande de reservation pour le trajet {dep_loc} -> {arr_loc}.",
            data={'type': 'booking_rejected_passenger', 'booking_id': str(booking.id), 'ride_id': str(booking.ride.id), 'screen': 'trips'}
        )
        _push_booking_update(booking)
        return Response({"status": "Réservation déclinée avec succès."})

    @action(detail=True, methods=['post'], url_path='passenger_accept')
    def passenger_accept(self, request, pk=None):
        booking = self.get_object()
        if booking.passenger != request.user and not request.user.is_staff:
            return Response({"error": "Seul le passager de cette réservation peut l'accepter."}, status=status.HTTP_403_FORBIDDEN)
            
        if booking.ride.status in ['completed', 'cancelled']:
            return Response({"error": "Le trajet est déjà terminé ou annulé. Impossible d'accepter la proposition."}, status=status.HTTP_400_BAD_REQUEST)

        if booking.status != 'pending_passenger':
            return Response({"error": f"Statut invalide pour acceptation passager: {booking.status}."}, status=status.HTTP_400_BAD_REQUEST)
            
        if booking.driver_counter_price is not None:
            booking.custom_price = booking.driver_counter_price
        booking.status = 'pending_payment'
        booking.save()
        
        create_and_send_notification(
            user=booking.ride.driver,
            title="Offre validee par le passager",
            message=f"Le passager {booking.passenger.full_name or booking.passenger.phone} a accepte votre tarif de {booking.total_amount} FCFA et procede au paiement.",
            data={'type': 'passenger_accepted_offer', 'booking_id': str(booking.id), 'ride_id': str(booking.ride.id), 'screen': 'rides'}
        )
        _push_booking_update(booking)
        return Response({"status": "Proposition acceptée. En attente de paiement.", "booking_status": booking.status})

    @action(detail=True, methods=['post'], url_path='passenger_reject')
    def passenger_reject(self, request, pk=None):
        booking = self.get_object()
        if booking.passenger != request.user and not request.user.is_staff:
            return Response({"error": "Seul le passager de cette réservation peut la refuser."}, status=status.HTTP_403_FORBIDDEN)
            
        if booking.ride.status in ['completed', 'cancelled']:
            return Response({"error": "Le trajet est déjà terminé ou annulé. Impossible de refuser la proposition."}, status=status.HTTP_400_BAD_REQUEST)

        if booking.status not in ['pending', 'pending_passenger', 'pending_payment']:
            return Response({"error": f"Statut invalide pour refus passager: {booking.status}."}, status=status.HTTP_400_BAD_REQUEST)
            
        booking.status = 'cancelled'
        booking.save()
        
        create_and_send_notification(
            user=booking.ride.driver,
            title="Proposition refusee",
            message=f"{booking.passenger.full_name or booking.passenger.phone} a refuse votre proposition.",
            data={'type': 'passenger_refused_offer', 'booking_id': str(booking.id), 'ride_id': str(booking.ride.id), 'screen': 'rides'}
        )
        _push_booking_update(booking)
        return Response({"status": "Proposition refusée. Réservation annulée.", "booking_status": booking.status})

    @action(detail=True, methods=['get'], url_path='receipt')
    def download_receipt(self, request, pk=None):
        booking = self.get_object()
        
        # Le reçu de paiement n'est accessible qu'au passager (ou admin)
        if booking.passenger_id != request.user.id and not getattr(request.user, 'is_staff', False):
            return Response({"error": "Vous n'êtes pas le passager de cette réservation."}, status=status.HTTP_403_FORBIDDEN)
            
        # Le paiement doit avoir réussi ou le trajet doit être actif/confirmé/complété
        from api.models import Payment
        has_successful_payment = Payment.objects.filter(booking=booking, status='SUCCESS').exists()
        is_valid_status = booking.status in ['confirmed', 'active', 'started', 'completed']
        
        if not (has_successful_payment or is_valid_status):
            return Response({"error": "Aucun reçu disponible car aucun paiement réussi n'a été détecté pour cette réservation."}, status=status.HTTP_400_BAD_REQUEST)
            
        from django.http import HttpResponse
        from api.services.pdf_service import generate_passenger_receipt
        
        try:
            pdf_bytes = generate_passenger_receipt(booking)
            response = HttpResponse(pdf_bytes, content_type='application/pdf')
            response['Content-Disposition'] = f'attachment; filename="recu_paiement_{booking.id.hex[:8]}.pdf"'
            return response
        except Exception as e:
            return Response({"error": f"Erreur lors de la génération du PDF: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['get'], url_path='manifest')
    def download_manifest(self, request, pk=None):
        booking = self.get_object()
        
        # La confirmation de réservation n'est accessible qu'au conducteur du trajet (ou admin)
        if booking.ride.driver_id != request.user.id and not getattr(request.user, 'is_staff', False):
            return Response({"error": "Seul le conducteur de ce trajet peut télécharger ce document."}, status=status.HTTP_403_FORBIDDEN)
            
        # Il faut que la réservation soit confirmée, active ou complétée (pas annulée ou rejetée)
        if booking.status in ['cancelled', 'rejected', 'expired']:
            return Response({"error": "Cette réservation a été annulée ou rejetée."}, status=status.HTTP_400_BAD_REQUEST)
            
        from django.http import HttpResponse
        from api.services.pdf_service import generate_driver_confirmation
        
        try:
            pdf_bytes = generate_driver_confirmation(booking)
            response = HttpResponse(pdf_bytes, content_type='application/pdf')
            response['Content-Disposition'] = f'attachment; filename="reconnaissance_reservation_{booking.id.hex[:8]}.pdf"'
            return response
        except Exception as e:
            return Response({"error": f"Erreur lors de la génération du PDF: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

def _push_booking_update(booking):
    from api.websocket.handlers import push_booking_update
    push_booking_update(booking)
