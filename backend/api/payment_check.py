import threading
import time
import requests
import logging
from django.conf import settings
from django.utils import timezone
from datetime import timedelta
from django.db import transaction

logger = logging.getLogger(__name__)

def check_pending_payments():
    """
    Tâche de fond s'exécutant toutes les 5 secondes pour vérifier
    les transactions FedaPay en attente (PENDING) créées depuis plus de 15 minutes.
    """
    # Attendre que Django soit complètement démarré
    time.sleep(5)
    
    while True:
        try:
            from .models import Payment, Booking, Parcel
            from .fcm import create_and_send_notification
            
            # Temps limite : 15 minutes dans le passé
            cutoff_time = timezone.now() - timedelta(minutes=15)
            
            # Récupérer tous les paiements PENDING créés avant cutoff_time
            pending_payments = Payment.objects.filter(status='PENDING', created_at__lt=cutoff_time)
            
            if pending_payments.exists():
                api_key = settings.FEDAPAY_SECRET_KEY
                is_sandbox = settings.FEDAPAY_ENVIRONMENT == 'sandbox'
                if api_key.startswith('sk_live_'):
                    is_sandbox = False
                    
                base_url = "https://sandbox-api.fedapay.com/v1" if is_sandbox else "https://api.fedapay.com/v1"
                headers = {
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                }
                
                for payment in pending_payments:
                    transaction_id = payment.transaction_id
                    try:
                        res = requests.get(f"{base_url}/transactions/{transaction_id}", headers=headers, timeout=5)
                        if res.status_code == 200:
                            transaction_data = res.json().get('v1/transaction', {})
                            tx_status = transaction_data.get('status', '').lower()
                            
                            if tx_status == 'approved':
                                with transaction.atomic():
                                    payment_locked = Payment.objects.select_for_update().filter(id=payment.id).first()
                                    if not payment_locked or payment_locked.status == 'SUCCESS':
                                        continue
                                        
                                    payment_locked.status = 'SUCCESS'
                                    payment_locked.save()
                                    
                                    # Valider Booking
                                    if payment_locked.booking:
                                        booking = payment_locked.booking
                                        if booking.payment_status != 'escrow':
                                            booking.payment_status = 'escrow'
                                            booking.status = 'confirmed'
                                            booking.save()
                                            
                                            amount_due = int(booking.amount_due_to_driver)
                                            commission = int(booking.amount_paid_online)
                                            
                                            create_and_send_notification(
                                                user=booking.passenger,
                                                title="Réservation confirmée ✅",
                                                message=f"Commission de {commission} FCFA payée. Prévoyez {amount_due} FCFA en espèces à remettre au conducteur pour le trajet {booking.ride.departure_location} -> {booking.ride.arrival_location}.",
                                                data={'type': 'payment_confirmed', 'booking_id': str(booking.id), 'screen': 'trips'}
                                            )
                                            
                                            if booking.ride.driver_details:
                                                create_and_send_notification(
                                                    user=booking.ride.driver_details,
                                                    title="Nouvelle Réservation 🚗",
                                                    message=f"{booking.passenger.full_name} a réservé {booking.seats_booked} place(s). Il/Elle vous paiera {amount_due} FCFA en espèces lors du trajet.",
                                                    data={'type': 'new_booking', 'booking_id': str(booking.id), 'screen': 'rides'}
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
                                                title="Nouveau Colis Confirmé 📦",
                                                message=f"{parcel.sender_name} a confirmé l'envoi d'un colis. Vous recevrez {amount_due} FCFA en espèces.",
                                                data={'type': 'parcel_confirmed', 'parcel_id': str(parcel.id), 'screen': 'rides'}
                                            )
                                            
                                logger.info(f"[Payment Check] Transaction {transaction_id} validée avec succès via vérification automatique.")
                                
                            elif tx_status in ['declined', 'failed', 'canceled', 'refunded']:
                                new_status = 'FAILED'
                                if tx_status == 'canceled':
                                    new_status = 'CANCELLED'
                                elif tx_status == 'refunded':
                                    new_status = 'REFUNDED'
                                    
                                payment.status = new_status
                                payment.save()
                                logger.info(f"[Payment Check] Transaction {transaction_id} mise à jour au statut {new_status}.")
                                
                    except Exception as ex:
                        logger.error(f"[Payment Check] Erreur lors de la vérification de la transaction {transaction_id} : {ex}")
                        
        except Exception as e:
            logger.error(f"[Payment Check] Erreur générale dans la boucle de vérification : {e}")
            
        time.sleep(5)

def start_payment_check_thread():
    thread = threading.Thread(target=check_pending_payments, daemon=True)
    thread.start()
