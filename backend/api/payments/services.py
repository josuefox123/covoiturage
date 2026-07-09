import logging
import uuid
import urllib.parse
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from django.conf import settings
from ..models import Booking, Payment, Ride
from ..fcm import create_and_send_notification
from .feexpay import FeexPayClient

logger = logging.getLogger(__name__)

class PaymentService:
    @staticmethod
    def initiate_payment(booking_id, user):
        """
        Initialise une transaction de paiement pour une réservation.
        Idempotence : si une transaction de paiement PENDING existe déjà pour cette réservation,
        on retourne celle-ci au lieu d'en recréer une nouvelle.
        """
        try:
            booking = Booking.objects.get(id=booking_id)
        except Booking.DoesNotExist:
            raise ValidationError({"error": "Réservation introuvable."})

        # Vérifier que la réservation appartient bien à l'utilisateur connecté
        if booking.passenger != user:
            raise ValidationError({"error": "Cette réservation ne vous appartient pas."})

        # Vérifier le statut de la réservation
        if booking.status not in ['pending_payment', 'pending']:
            raise ValidationError({"error": f"Cette réservation ne peut pas être payée. Statut actuel: {booking.status}"})

        with transaction.atomic():
            # Rechercher si une transaction PENDING existe déjà pour cette réservation
            existing_payment = Payment.objects.filter(booking=booking, status='PENDING').first()
            
            if existing_payment:
                # Si oui, on la renvoie pour éviter le double paiement
                transaction_reference = existing_payment.transaction_id
            else:
                # Sinon, on crée une nouvelle référence de transaction unique
                transaction_reference = f"ref_{booking.id.hex[:10]}_{uuid.uuid4().hex[:6]}"
                existing_payment = Payment.objects.create(
                    transaction_id=transaction_reference,
                    amount=max(100, int(booking.amount_paid_online)),
                    user=user,
                    booking=booking,
                    status='PENDING',
                    provider='feexpay'
                )

            # Construire les paramètres pour l'URL de checkout
            amount_to_pay = existing_payment.amount
            description = f"Commission Zemy - Trajet {booking.ride.departure_location} -> {booking.ride.arrival_location}"
            
            query_params = (
                f"?amount={amount_to_pay}"
                f"&custom_id={booking.id}"
                f"&transaction_id={transaction_reference}"
                f"&fullname={urllib.parse.quote(user.full_name or 'Client Zemy')}"
                f"&email={urllib.parse.quote(user.email or 'client@zemy.bj')}"
                f"&phone={urllib.parse.quote(user.phone or '')}"
                f"&description={urllib.parse.quote(description)}"
            )
            
            return existing_payment, query_params

    @staticmethod
    def verify_payment(transaction_reference):
        """
        Vérifie et valide une transaction auprès de FeexPay.
        Appelé après le retour de la WebView de paiement.
        """
        try:
            payment = Payment.objects.get(transaction_id=transaction_reference)
        except Payment.DoesNotExist:
            raise ValidationError({"error": "Transaction introuvable."})

        booking = payment.booking
        if not booking:
            raise ValidationError({"error": "Aucune réservation associée à cette transaction."})

        # Éviter de valider deux fois
        if payment.status == 'SUCCESS':
            return payment, "Paiement déjà validé."

        # Interroger FeexPay
        tx_data = FeexPayClient.get_transaction_details(transaction_reference)
        if not tx_data:
            raise ValidationError({"error": "Impossible de récupérer les détails de la transaction auprès de FeexPay."})

        tx_status = tx_data.get('status', '').upper()

        if tx_status in ['SUCCESSFUL', 'SUCCESS', 'APPROVED']:
            with transaction.atomic():
                # Re-verrouiller le trajet pour éviter le surbooking lors de la validation concurrente
                ride = Ride.objects.select_for_update().get(id=booking.ride_id)
                
                # Vérifier à nouveau les places (sécurité)
                if ride.seats_available < booking.seats_booked and booking.status != 'confirmed':
                    raise ValidationError({"error": "Le trajet est complet entre-temps. Paiement annulé."})

                # Mettre à jour le paiement
                payment.status = 'SUCCESS'
                payment.last_verification_at = timezone.now()
                payment.save()

                # Mettre à jour la réservation
                booking.status = 'confirmed'
                booking.payment_status = 'escrow' # Zemy retient les fonds
                booking.transaction_id = transaction_reference
                booking.save()

                # Décrémenter les places restantes
                ride.seats_available -= booking.seats_booked
                ride.save()

                # Créer le ticket
                ticket_number = f"T-{booking.id.hex[:8].upper()}"
                
                # Envoi de la notification
                amount_due = int(booking.amount_due_to_driver)
                commission = int(booking.amount_paid_online)
                create_and_send_notification(
                    user=booking.passenger,
                    title="Réservation confirmée ✅",
                    message=f"Ticket {ticket_number} généré. Prévoyez {amount_due} FCFA en espèces à remettre au conducteur.",
                    data={'type': 'payment_confirmed', 'booking_id': str(booking.id), 'screen': 'trips'}
                )
                
                return payment, "Paiement validé avec succès."
        
        elif tx_status in ['FAILED', 'DECLINED', 'REJECTED']:
            payment.status = 'FAILED'
            payment.last_verification_at = timezone.now()
            payment.save()

            booking.status = 'payment_failed'
            booking.save()
            return payment, "Paiement refusé."
            
        elif tx_status in ['CANCELLED', 'CANCELED']:
            payment.status = 'CANCELLED'
            payment.last_verification_at = timezone.now()
            payment.save()

            booking.status = 'cancelled'
            booking.save()
            return payment, "Paiement annulé."
            
        else:
            # En attente ou autre statut
            return payment, f"Transaction en attente (FeexPay: {tx_status})"
