from datetime import date, datetime, timedelta
from django.db import transaction
from django.db.models import Q
from django.utils.timezone import make_aware, now
from rest_framework.exceptions import ValidationError
from ..models import Booking, Ride, Conversation, Message, RefundRequest
from ..fcm import create_and_send_notification
from .feexpay_service import FeexPayService

class BookingService:
    @staticmethod
    def create_booking(passenger, ride_id, seats_booked, payment_status='pending', departure_location=None, arrival_location=None,
                       passenger_proposed_price=None, negotiation_message=None):
        """
        Gère la création sécurisée d'une réservation avec gestion des race conditions,
        de la disponibilité des sièges et de la validation FeexPay.
        """
        if not passenger.is_verified:
            raise ValidationError({"error": "Votre compte doit être vérifié pour réserver."})

        with transaction.atomic():
            # Verrouiller le trajet en base de données pour éviter le surbooking
            try:
                ride = Ride.objects.select_for_update().get(id=ride_id)
            except Ride.DoesNotExist:
                raise ValidationError({"error": "Trajet introuvable."})

            if ride.driver == passenger:
                raise ValidationError({"error": "Vous ne pouvez pas réserver votre propre trajet."})
                
            if ride.departure_date < date.today() and ride.status != 'started':
                raise ValidationError({"error": "Ce trajet est déjà passé (archivé)."})
                
            if ride.status in ['completed', 'cancelled']:
                raise ValidationError({"error": "Ce trajet est terminé ou annulé et n'est plus disponible pour la réservation."})
                
            # Vérifier les réservations existantes pour éviter les doublons
            existing_booking = Booking.objects.filter(ride=ride, passenger=passenger).exclude(status='cancelled').first()
            if existing_booking:
                if existing_booking.payment_status == 'pending':
                    # Vérifier si un paiement a déjà été effectué via FeexPay
                    if existing_booking.transaction_id:
                        try:
                            tx_data = FeexPayService.get_transaction_details(existing_booking.transaction_id)
                            if tx_data.get('status') in ['SUCCESSFUL', 'SUCCESS', 'approved']:
                                existing_booking.payment_status = 'escrow'
                                existing_booking.status = 'confirmed'
                                existing_booking.save()
                                
                                # Décrémenter les places lors de la confirmation
                                ride.seats_available -= existing_booking.seats_booked
                                ride.save()
                                
                                amount_due = int(existing_booking.amount_due_to_driver)
                                create_and_send_notification(
                                    user=existing_booking.passenger,
                                    title="Réservation confirmée",
                                    message=f"Paiement de {existing_booking.total_amount} FCFA validé. Votre réservation est confirmée.",
                                    data={'type': 'payment_confirmed', 'booking_id': str(existing_booking.id), 'screen': 'trips'}
                                )
                                if ride.driver:
                                    create_and_send_notification(
                                        user=ride.driver,
                                        title="Nouvelle réservation",
                                        message=f"{existing_booking.passenger.full_name or existing_booking.passenger.phone} a réservé {existing_booking.seats_booked} place(s). Votre gain de {amount_due} FCFA est crédité sur votre compte Zemy.",
                                        data={'type': 'new_booking', 'booking_id': str(existing_booking.id), 'screen': 'rides'}
                                    )
                                raise ValidationError({"error": "Vous avez déjà une réservation confirmée suite à votre paiement."})
                        except ValidationError:
                            raise
                        except Exception:
                            pass
                            
                    return existing_booking, False  # booking existant, non créé à neuf
                else:
                    raise ValidationError({"error": "Vous avez déjà une réservation pour ce trajet."})
                
            if ride.seats_available < seats_booked:
                raise ValidationError({"error": "Pas assez de places disponibles pour cette réservation."})

            # NE PAS décrémenter les places lors de la création de la réservation.
            # Elles seront décrémentées lors de la validation du paiement (confirm_payment).
            
            # Créer la réservation
            booking = Booking.objects.create(
                ride=ride,
                passenger=passenger,
                seats_booked=seats_booked,
                payment_status=payment_status,
                status='pending',
                departure_location=departure_location,
                arrival_location=arrival_location,
                passenger_proposed_price=passenger_proposed_price,
                negotiation_message=negotiation_message
            )
            
            # Planifier la tâche d'expiration automatique avec délai intelligent
            try:
                from django.utils import timezone
                import datetime
                now = timezone.now()
                ride_datetime = timezone.make_aware(
                    datetime.datetime.combine(ride.departure_date, ride.departure_time)
                )
                time_diff = ride_datetime - now
                diff_hours = time_diff.total_seconds() / 3600.0

                if diff_hours <= 0:
                    countdown_secs = 1800
                elif diff_hours <= 24:
                    countdown_secs = 1800
                elif diff_hours <= 48:
                    countdown_secs = 7200
                elif diff_hours <= 168:
                    countdown_secs = 43200
                else:
                    countdown_secs = 86400
            except Exception:
                countdown_secs = 86400

            try:
                from ..tasks.expire_booking import expire_booking_task as _expire_task
                if hasattr(_expire_task, 'apply_async'):
                    _expire_task.apply_async((str(booking.id),), countdown=countdown_secs)  # type: ignore[union-attr]
                elif callable(_expire_task):
                    pass
            except Exception:
                pass
            
            return booking, True

    @staticmethod
    def cancel_booking(booking, cancelled_by_user):
        """
        Gère l'annulation d'une réservation, la restitution des places, la logique financière de remboursement,
        et l'envoi de notifications.
        """
        if booking.status == 'cancelled':
            return False, "Réservation déjà annulée."
            
        old_status = booking.status
        booking.status = 'cancelled'
        booking.save()
        
        # Restituer les places si la réservation était confirmée et qu'on l'annule
        if old_status == 'confirmed':
            from ..bookings.services import BookingService as CoreBookingService
            CoreBookingService.deallocate_seats(booking)
                
            ride = booking.ride
            passenger = booking.passenger
            driver = ride.driver
            
            # Logique de remboursement
            price_paid = ride.price_per_seat * booking.seats_booked
            
            if cancelled_by_user == driver:
                # Conducteur annule -> Remboursement automatique approuvé
                booking.payment_status = 'refunded'
                booking.save()
                RefundRequest.objects.create(
                    booking=booking,
                    passenger=passenger,
                    driver=driver,
                    amount=price_paid,
                    reason="Annulation par le conducteur",
                    status='approved'
                )
            else:
                # Passager annule
                ride_dt = datetime.combine(ride.departure_date, ride.departure_time)
                if not ride_dt.tzinfo:
                    try:
                        ride_dt = make_aware(ride_dt)
                    except ValueError:
                        pass
                
                time_diff = ride_dt - now()
                
                if price_paid >= 1000 and time_diff > timedelta(hours=5):
                    # Éligible au remboursement -> en attente
                    RefundRequest.objects.create(
                        booking=booking,
                        passenger=passenger,
                        driver=driver,
                        amount=price_paid,
                        reason="Annulation par le passager à plus de 5h du départ",
                        status='pending'
                    )
            
            # Notifications si réservation confirmée
            if old_status == 'confirmed':
                if cancelled_by_user == driver:
                    create_and_send_notification(
                        user=passenger,
                        title="Réservation annulée",
                        message=f"Le conducteur a annulé votre réservation pour le trajet {ride.departure_location} -> {ride.arrival_location}. Remboursement intégral garanti.",
                        data={'type': 'booking_cancelled', 'booking_id': str(booking.id), 'screen': 'trips'}
                    )
                    
                    from django.db.models import Q
                    conversation = Conversation.objects.filter(
                        ride=ride,
                        conversation_type='ride'
                    ).filter(
                        Q(participant_1=passenger, participant_2=driver) |
                        Q(participant_1=driver, participant_2=passenger)
                    ).first()
                    
                    if not conversation:
                        conversation = Conversation.objects.create(
                            conversation_type='ride',
                            ride=ride,
                            participant_1=passenger,
                            participant_2=driver
                        )
                        
                    Message.objects.create(
                        conversation=conversation,
                        sender=driver,
                        content=f"Bonjour, j'ai malheureusement dû annuler votre réservation pour le trajet {ride.departure_location} -> {ride.arrival_location}.",
                        message_type='text'
                    )
                else:
                    create_and_send_notification(
                        user=driver,
                        title="Réservation annulée",
                        message=f"Le passager {passenger.full_name or passenger.phone} a annulé sa réservation sur votre trajet {ride.departure_location} -> {ride.arrival_location}.",
                        data={'type': 'booking_cancelled_driver', 'booking_id': str(booking.id), 'screen': 'trips'}
                    )
                    
                    from django.db.models import Q
                    conversation = Conversation.objects.filter(
                        ride=ride,
                        conversation_type='ride'
                    ).filter(
                        Q(participant_1=passenger, participant_2=driver) |
                        Q(participant_1=driver, participant_2=passenger)
                    ).first()
                    
                    if not conversation:
                        conversation = Conversation.objects.create(
                            conversation_type='ride',
                            ride=ride,
                            participant_1=passenger,
                            participant_2=driver
                        )
                        
                    Message.objects.create(
                        conversation=conversation,
                        sender=passenger,
                        content=f"Bonjour, j'ai annulé ma réservation pour le trajet {ride.departure_location} -> {ride.arrival_location}. Bonne route !",
                        message_type='text'
                    )
                    
        return True, "Réservation annulée avec succès."

    @staticmethod
    def allocate_seats(booking):
        from api.bookings.services import BookingService as CoreBookingService
        return CoreBookingService.allocate_seats(booking)

    @staticmethod
    def deallocate_seats(booking):
        from api.bookings.services import BookingService as CoreBookingService
        return CoreBookingService.deallocate_seats(booking)


