import logging
from celery import shared_task
from django.utils import timezone
from .models import Booking
from .fcm import create_and_send_notification

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

            # Calculer la limite d'expiration réelle pour afficher le bon message
            try:
                from django.utils import timezone
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
                title="Demande de réservation expirée ⏱️",
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
                title="Demande expirée ⏱️",
                message=driver_msg,
                data={'type': 'booking_expired_driver', 'booking_id': str(booking.id), 'screen': 'rides'}
            )
    except Booking.DoesNotExist:
        logger.warning(f"Impossible d'expirer la réservation {booking_id} : introuvable.")
    except Exception as e:
        logger.error(f"Erreur lors de l'expiration de la réservation {booking_id} : {e}")


@shared_task
def notify_compatible_passengers_task(ride_id, freed_from_leg_idx, freed_seats):
    """
    Tâche Celery exécutée après la libération de places sur un trajet.
    Recherche les SearchAlert actives compatibles et envoie une notification push
    aux passagers concernés.
    
    Args:
        ride_id (str) : UUID du trajet concerné
        freed_from_leg_idx (int) : Index du leg à partir duquel les places sont disponibles
        freed_seats (int) : Nombre de places libérées
    """
    try:
        from .models import Ride
        ride = Ride.objects.get(id=ride_id)
        
        from .services.matching_service import MatchingService
        compatible = MatchingService.find_compatible_search_alerts(ride, freed_from_leg_idx, freed_seats)
        
        notified = 0
        for item in compatible:
            try:
                create_and_send_notification(
                    user=item['passenger'],
                    title="Place disponible sur votre trajet 🎉",
                    message=(
                        f"Une place vient de se libérer sur le trajet "
                        f"{ride.departure_location} → {ride.arrival_location} "
                        f"le {ride.departure_date.strftime('%d/%m/%Y')} ! Réservez maintenant."
                    ),
                    data={
                        'type': 'seat_available',
                        'ride_id': str(ride.id),
                        'departure_location': ride.departure_location,
                        'arrival_location': ride.arrival_location,
                        'screen': 'search',
                    }
                )
                # Désactiver l'alerte pour éviter de re-notifier
                item['alert'].is_active = False
                item['alert'].save(update_fields=['is_active'])
                notified += 1
            except Exception as e:
                logger.error(f"Erreur notification SearchAlert passager {item['passenger'].id}: {e}")
        
        logger.info(f"notify_compatible_passengers_task: {notified} passagers notifiés pour le trajet {ride_id}.")
    
    except Ride.DoesNotExist:
        logger.warning(f"notify_compatible_passengers_task: Trajet {ride_id} introuvable.")
    except Exception as e:
        logger.error(f"notify_compatible_passengers_task error pour trajet {ride_id}: {e}")
