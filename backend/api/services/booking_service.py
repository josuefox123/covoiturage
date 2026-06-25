from datetime import date, datetime, timedelta
from django.db import transaction
from django.db.models import Q
from django.utils.timezone import make_aware, now
from rest_framework.exceptions import ValidationError
from ..models import Booking, Ride, Conversation, Message, RefundRequest
from ..fcm import create_and_send_notification
from .fedapay_service import FedaPayService

class BookingService:
    @staticmethod
    def create_booking(passenger, ride_id, seats_booked, payment_status='pending'):
        """
        Gère la création sécurisée d'une réservation avec gestion des race conditions,
        de la disponibilité des sièges et de la validation FedaPay.
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
                
            if ride.departure_date < date.today():
                raise ValidationError({"error": "Ce trajet est déjà passé (archivé)."})
                
            if ride.status in ['started', 'completed', 'cancelled']:
                raise ValidationError({"error": "Ce trajet n'est plus disponible pour la réservation."})
                
            # Vérifier les réservations existantes pour éviter les doublons
            existing_booking = Booking.objects.filter(ride=ride, passenger=passenger).exclude(status='cancelled').first()
            if existing_booking:
                if existing_booking.payment_status == 'pending':
                    # Vérifier si un paiement a déjà été effectué via FedaPay
                    if existing_booking.transaction_id:
                        try:
                            tx_data = FedaPayService.get_transaction_details(existing_booking.transaction_id)
                            if tx_data.get('status') == 'approved':
                                existing_booking.payment_status = 'escrow'
                                existing_booking.status = 'confirmed'
                                existing_booking.save()
                                
                                amount_due = int(existing_booking.amount_due_to_driver)
                                commission = int(existing_booking.amount_paid_online)
                                create_and_send_notification(
                                    user=existing_booking.passenger,
                                    title="Réservation confirmée ✅",
                                    message=f"Commission de {commission} FCFA payée. Prévoyez {amount_due} FCFA en espèces à remettre au conducteur.",
                                    data={'type': 'payment_confirmed', 'booking_id': str(existing_booking.id), 'screen': 'trips'}
                                )
                                if ride.driver:
                                    create_and_send_notification(
                                        user=ride.driver,
                                        title="Nouvelle réservation 🚗",
                                        message=f"{existing_booking.passenger.full_name or existing_booking.passenger.phone} vous paiera {amount_due} FCFA en espèces lors du trajet.",
                                        data={'type': 'new_booking', 'booking_id': str(existing_booking.id), 'screen': 'rides'}
                                    )
                                raise ValidationError({"error": "Vous avez déjà une réservation confirmée suite à votre paiement."})
                        except ValidationError:
                            raise
                        except Exception:
                            pass
                            
                    # S'assurer que la conversation existe
                    BookingService._ensure_conversation(ride, passenger, ride.driver)
                    return existing_booking, False  # booking existant, non créé à neuf
                else:
                    raise ValidationError({"error": "Vous avez déjà une réservation pour ce trajet."})
                
            if ride.seats_available < seats_booked:
                raise ValidationError({"error": "Pas assez de places disponibles pour cette réservation."})

            # Décrémenter les places
            ride.seats_available -= seats_booked
            ride.save()
            
            # Créer la réservation
            booking = Booking.objects.create(
                ride=ride,
                passenger=passenger,
                seats_booked=seats_booked,
                payment_status=payment_status,
                status='pending'
            )
            
            # Créer la conversation
            BookingService._ensure_conversation(ride, passenger, ride.driver)
            
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
        
        # Restituer les places si la réservation n'était pas déjà annulée
        if old_status != 'cancelled':
            with transaction.atomic():
                locked_ride = Ride.objects.select_for_update().get(id=booking.ride.id)
                locked_ride.seats_available += booking.seats_booked
                locked_ride.save()
                
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
                        title="Réservation annulée ❌",
                        message=f"Le conducteur a annulé votre réservation pour le trajet {ride.departure_location} -> {ride.arrival_location}. Remboursement intégral garanti.",
                        data={'type': 'booking_cancelled', 'booking_id': str(booking.id), 'screen': 'trips'}
                    )
                    
                    conversation, _ = Conversation.objects.get_or_create(
                        conversation_type='ride',
                        ride=ride,
                        participant_1=passenger if passenger.id < driver.id else driver,
                        participant_2=driver if passenger.id < driver.id else passenger
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
                        title="Réservation annulée ❌",
                        message=f"Le passager {passenger.full_name or passenger.phone} a annulé sa réservation sur votre trajet {ride.departure_location} -> {ride.arrival_location}.",
                        data={'type': 'booking_cancelled_driver', 'booking_id': str(booking.id), 'screen': 'trips'}
                    )
                    
                    conversation, _ = Conversation.objects.get_or_create(
                        conversation_type='ride',
                        ride=ride,
                        participant_1=passenger if passenger.id < driver.id else driver,
                        participant_2=driver if passenger.id < driver.id else passenger
                    )
                    Message.objects.create(
                        conversation=conversation,
                        sender=passenger,
                        content=f"Bonjour, j'ai annulé ma réservation pour le trajet {ride.departure_location} -> {ride.arrival_location}. Bonne route !",
                        message_type='text'
                    )
                    
        return True, "Réservation annulée avec succès."

    @staticmethod
    def _ensure_conversation(ride, participant_1, participant_2):
        """
        S'assure qu'une conversation de type 'ride' existe entre les deux participants pour ce trajet.
        """
        existing_conv = Conversation.objects.filter(
            ride=ride,
            conversation_type='ride'
        ).filter(
            Q(participant_1=participant_1, participant_2=participant_2) |
            Q(participant_1=participant_2, participant_2=participant_1)
        ).first()
        
        if not existing_conv:
            Conversation.objects.create(
                conversation_type='ride',
                ride=ride,
                participant_1=participant_1,
                participant_2=participant_2,
            )
