import logging
from celery import shared_task
from ..models import Ride
from ..fcm import create_and_send_notification

logger = logging.getLogger(__name__)

@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def notify_compatible_passengers_task(self, ride_id, freed_from_leg_idx, freed_seats):
    """
    Tâche Celery exécutée après la libération de places sur un trajet.
    Recherche les SearchAlert actives compatibles et envoie une notification push
    aux passagers concernés.
    BUG10 FIX : idempotence garantie — l'alerte est désactivée AVANT l'envoi
    de la notification pour éviter les doublons en cas de retry Celery.
    """
    try:
        ride = Ride.objects.get(id=ride_id)
        
        from ..services.matching_service import MatchingService
        compatible = MatchingService.find_compatible_search_alerts(ride, freed_from_leg_idx, freed_seats)
        
        notified = 0
        for item in compatible:
            try:
                # BUG10 FIX : désactiver l'alerte AVANT d'envoyer la notification.
                # Si le task crashe après le save mais avant l'envoi → la notif est perdue (acceptable).
                # Si le task crashe avant le save → retry renverra la notif (acceptable, car alerte encore active).
                # L'inverse (envoyer puis save) risquait : notif envoyée + crash + retry = doublon.
                item['alert'].is_active = False
                item['alert'].save(update_fields=['is_active'])

                create_and_send_notification(
                    user=item['passenger'],
                    title="Place disponible sur votre trajet",
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
                notified += 1
            except Exception as e:
                logger.error(f"Erreur notification SearchAlert passager {item['passenger'].id}: {e}")
        
        logger.info(f"notify_compatible_passengers_task: {notified} passagers notifiés pour le trajet {ride_id}.")
    
    except Ride.DoesNotExist:
        logger.warning(f"notify_compatible_passengers_task: Trajet {ride_id} introuvable.")
    except Exception as e:
        logger.error(f"notify_compatible_passengers_task error pour trajet {ride_id}: {e}")
        raise self.retry(exc=e)
