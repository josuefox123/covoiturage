import logging
from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from django.db import transaction, models
from api.models import Payment
from api.services.feexpay_service import FeexPayService
from api.fcm import create_and_send_notification

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Vérifie le statut des paiements PENDING non vérifiés depuis 5 minutes.'

    def handle(self, *args, **options):
        # Chercher les paiements PENDING qui n'ont pas été vérifiés depuis au moins 5 minutes, ou jamais vérifiés
        five_minutes_ago = timezone.now() - timedelta(minutes=5)
        
        pending_payments = Payment.objects.filter(
            status='PENDING'
        ).filter(
            models.Q(last_verification_at__isnull=True) | models.Q(last_verification_at__lt=five_minutes_ago)
        )
        
        count = pending_payments.count()
        if count == 0:
            self.stdout.write(self.style.SUCCESS("Aucun paiement PENDING nécessitant une vérification."))
            return
            
        self.stdout.write(self.style.NOTICE(f"[{timezone.now()}] Vérification de {count} paiements PENDING..."))
        
        for payment in pending_payments:
            transaction_id = payment.transaction_id
            if not transaction_id:
                continue
                
            try:
                transaction_data = FeexPayService.get_transaction_details(transaction_id)
                tx_status = transaction_data.get('status', '').upper()
                
                if tx_status in ['SUCCESSFUL', 'SUCCESS', 'APPROVED']:
                    with transaction.atomic():
                        payment_locked = Payment.objects.select_for_update().filter(id=payment.id).first()
                        if not payment_locked or payment_locked.status == 'SUCCESS':
                            continue
                            
                        payment_locked.status = 'SUCCESS'
                        payment_locked.last_verification_at = timezone.now()
                        payment_locked.verification_attempts += 1
                        payment_locked.save()
                        
                        # Valider Booking
                        if payment_locked.booking:
                            booking = payment_locked.booking
                            if booking.payment_status != 'escrow':
                                from api.bookings.services import BookingService
                                # Décrémenter les places sur le trajet de façon segmentée
                                BookingService.allocate_seats(booking)

                                booking.payment_status = 'escrow'
                                booking.status = 'confirmed'
                                booking.save()
                                
                                amount_due = int(booking.amount_due_to_driver)
                                create_and_send_notification(
                                    user=booking.passenger,
                                    title="Réservation confirmée",
                                    message=f"Paiement de {booking.total_amount} FCFA validé. Votre réservation est confirmée.",
                                    data={'type': 'payment_confirmed', 'booking_id': str(booking.id), 'screen': 'trips'}
                                )
                                
                                if booking.ride.driver:
                                    create_and_send_notification(
                                        user=booking.ride.driver,
                                        title="Nouvelle Réservation Payée",
                                        message=f"{booking.passenger.full_name or booking.passenger.phone} vient de payer sa réservation. Votre gain de {amount_due} FCFA est sécurisé.",
                                        data={'type': 'passenger_paid_driver', 'booking_id': str(booking.id), 'screen': 'rides'}
                                    )
                                    
                        # Valider Parcel
                        if payment_locked.parcel:
                            parcel = payment_locked.parcel
                            if parcel.payment_status != 'escrow':
                                parcel.payment_status = 'escrow'
                                parcel.status = 'accepted'
                                parcel.save()
                                
                                amount_due = parcel.driver_payout
                                create_and_send_notification(
                                    user=parcel.ride.driver,
                                    title="Nouveau Colis Confirmé",
                                    message=f"{parcel.sender_name} a confirmé l'envoi d'un colis.",
                                    data={'type': 'parcel_confirmed', 'parcel_id': str(parcel.id), 'screen': 'rides'}
                                )
                                
                    self.stdout.write(self.style.SUCCESS(f"Transaction {transaction_id} validée via tâche Cron."))
                    
                elif tx_status in ['declined', 'failed', 'canceled', 'refunded']:
                    new_status = 'FAILED'
                    if tx_status == 'canceled':
                        new_status = 'CANCELLED'
                    elif tx_status == 'refunded':
                        new_status = 'REFUNDED'
                        
                    payment.status = new_status
                    payment.last_verification_at = timezone.now()
                    payment.verification_attempts += 1
                    payment.save()
                    self.stdout.write(self.style.WARNING(f"Transaction {transaction_id} marquée {new_status}."))
                
                else:
                    payment.last_verification_at = timezone.now()
                    payment.verification_attempts += 1
                    payment.save()
                    self.stdout.write(self.style.NOTICE(f"Transaction {transaction_id} toujours en attente ({tx_status})."))

            except Exception as e:
                logger.error(f"[Payment Cron] Erreur sur la transaction {transaction_id}: {e}")
                self.stdout.write(self.style.ERROR(f"Erreur sur {transaction_id}: {str(e)}"))

        self.stdout.write(self.style.SUCCESS("Vérification terminée."))
