import logging
from celery import shared_task
from django.utils import timezone
from ..models import Booking
from ..fcm import create_and_send_notification

logger = logging.getLogger(__name__)

@shared_task
def expire_booking_task(booking_id):
    """
    Tâche Celery exécutée après expiration d'une réservation
    pour vérifier si elle est toujours en attente et l'expirer si nécessaire.
    """
    try:
        booking = Booking.objects.get(id=booking_id)
        if booking.status in ['pending', 'pending_driver', 'pending_passenger', 'pending_payment']:
            old_status = booking.status
            booking.status = 'expired'
            booking.save()

            from api.websocket.handlers import push_booking_update
            push_booking_update(booking)

            # Calculer la limite d'expiration réelle pour afficher le bon message
            try:
                import datetime
                ride = booking.ride
                ride_datetime = timezone.make_aware(
                    datetime.datetime.combine(ride.departure_date, ride.departure_time)
                )
                time_diff = ride_datetime - booking.created_at
                diff_hours = time_diff.total_seconds() / 3600.0

                if diff_hours <= 0:
                    limit_text = "30 minutes"
                elif diff_hours <= 24:
                    limit_text = "30 minutes"
                elif diff_hours <= 48:
                    limit_text = "2 heures"
                elif diff_hours <= 168:
                    limit_text = "12 heures"
                else:
                    limit_text = "24 heures"
            except Exception:
                limit_text = "24 heures"

            logger.info(f"Réservation {booking.id} expirée après {limit_text} d'inactivité.")

            # Message passager adapté
            if old_status in ['pending', 'pending_driver']:
                passenger_msg = f"Le conducteur n'a pas répondu à votre demande pour le trajet {booking.departure_location or booking.ride.departure_location} -> {booking.arrival_location or booking.ride.arrival_location} dans la limite des {limit_text}."
            else:
                passenger_msg = f"Votre réservation pour le trajet {booking.departure_location or booking.ride.departure_location} -> {booking.arrival_location or booking.ride.arrival_location} a expiré car vous n'avez pas finalisé la confirmation ou le paiement dans la limite des {limit_text}."

            # Notifier le passager
            create_and_send_notification(
                user=booking.passenger,
                title="Demande de réservation expirée",
                message=passenger_msg,
                data={'type': 'booking_expired', 'booking_id': str(booking.id), 'screen': 'trips'}
            )

            # Message conducteur adapté
            if old_status in ['pending', 'pending_driver']:
                driver_msg = f"La demande de réservation de {booking.passenger.full_name or booking.passenger.phone} a expiré car vous n'avez pas répondu dans le délai de {limit_text}."
            else:
                driver_msg = f"La demande de réservation de {booking.passenger.full_name or booking.passenger.phone} a expiré car le passager n'a pas validé ou payé dans le délai de {limit_text}."

            # Notifier le conducteur que la demande a expiré
            create_and_send_notification(
                user=booking.ride.driver,
                title="Demande expirée",
                message=driver_msg,
                data={'type': 'booking_expired_driver', 'booking_id': str(booking.id), 'screen': 'rides'}
            )
    except Booking.DoesNotExist:
        logger.warning(f"Impossible d'expirer la réservation {booking_id} : introuvable.")
    except Exception as e:
        logger.error(f"Erreur lors de l'expiration de la réservation {booking_id} : {e}")
