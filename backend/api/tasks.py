import logging
from celery import shared_task
from django.utils import timezone
from .models import Booking
from .fcm import create_and_send_notification

logger = logging.getLogger(__name__)

@shared_task
def expire_booking_task(booking_id):
    """
    Tâche Celery exécutée 15 minutes après la création d'une réservation
    pour vérifier si elle est toujours en attente ('pending') et l'expirer si nécessaire.
    """
    try:
        booking = Booking.objects.get(id=booking_id)
        if booking.status == 'pending':
            booking.status = 'expired'
            booking.save()
            logger.info(f"Réservation {booking.id} expirée après 15 minutes d'inactivité.")
            
            # Notifier le passager
            create_and_send_notification(
                user=booking.passenger,
                title="Demande de réservation expirée ⏱️",
                message=f"Le conducteur n'a pas répondu à votre demande pour le trajet {booking.ride.departure_location} -> {booking.ride.arrival_location} dans la limite des 15 minutes.",
                data={'type': 'booking_expired', 'booking_id': str(booking.id), 'screen': 'trips'}
            )
            
            # Notifier le conducteur que la demande a expiré
            create_and_send_notification(
                user=booking.ride.driver,
                title="Demande expirée ⏱️",
                message=f"La demande de réservation de {booking.passenger.full_name or booking.passenger.phone} a expiré car vous n'avez pas répondu dans le délai de 15 minutes.",
                data={'type': 'booking_expired_driver', 'booking_id': str(booking.id), 'screen': 'rides'}
            )
    except Booking.DoesNotExist:
        logger.warning(f"Impossible d'expirer la réservation {booking_id} : introuvable.")
    except Exception as e:
        logger.error(f"Erreur lors de l'expiration de la réservation {booking_id} : {e}")
