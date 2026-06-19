"""
Utilitaire Firebase Cloud Messaging (FCM).
Utilise firebase_admin (déjà initialisé dans views.py).
"""
import logging
from firebase_admin import messaging

logger = logging.getLogger(__name__)


def send_fcm_notification(token: str, title: str, body: str, data: dict = None) -> bool:
    """
    Envoie une notification FCM à un seul device.

    Args:
        token: FCM device token
        title: Titre de la notification
        body: Corps de la notification
        data: Données supplémentaires (dict string→string)

    Returns:
        True si succès, False sinon
    """
    if not token:
        return False

    try:
        str_data = {str(k): str(v) for k, v in (data or {}).items()}
        message = messaging.Message(
            notification=messaging.Notification(
                title=title,
                body=body,
            ),
            data=str_data,
            token=token,
            android=messaging.AndroidConfig(
                priority='high',
                notification=messaging.AndroidNotification(
                    sound='default',
                    click_action='FLUTTER_NOTIFICATION_CLICK',
                ),
            ),
            apns=messaging.APNSConfig(
                payload=messaging.APNSPayload(
                    aps=messaging.Aps(
                        sound='default',
                        badge=1,
                    ),
                ),
            ),
        )
        response = messaging.send(message)
        logger.info(f"FCM envoyé avec succès: {response}")
        return True
    except messaging.UnregisteredError:
        logger.warning(f"FCM token invalide/expiré: {token[:20]}...")
        return False
    except Exception as e:
        logger.error(f"Erreur FCM: {e}")
        return False


def send_fcm_to_user(user, title: str, body: str, data: dict = None) -> bool:
    """
    Envoie une notification FCM à un utilisateur spécifique.

    Args:
        user: Instance User Django
        title: Titre de la notification
        body: Corps de la notification
        data: Données supplémentaires
    """
    token = getattr(user, 'fcm_token', None)
    if not token:
        logger.debug(f"Pas de FCM token pour l'utilisateur {user.id}")
        return False
    return send_fcm_notification(token, title, body, data)


def send_fcm_to_all_users(title: str, body: str, data: dict = None, exclude_ids: list = None):
    """
    Envoie une notification FCM à tous les utilisateurs actifs qui ont un token.

    Args:
        title: Titre de la notification
        body: Corps de la notification
        data: Données supplémentaires
        exclude_ids: Liste d'IDs d'utilisateurs à exclure
    """
    from .models import User

    queryset = User.objects.filter(
        is_active=True,
        fcm_token__isnull=False,
    ).exclude(fcm_token='')

    if exclude_ids:
        queryset = queryset.exclude(id__in=exclude_ids)

    tokens = list(queryset.values_list('fcm_token', flat=True))
    if not tokens:
        logger.info("Aucun token FCM disponible pour le broadcast.")
        return

    # FCM multicast (max 500 tokens par lot)
    str_data = {str(k): str(v) for k, v in (data or {}).items()}
    BATCH_SIZE = 500
    for i in range(0, len(tokens), BATCH_SIZE):
        batch = tokens[i:i + BATCH_SIZE]
        try:
            multicast_message = messaging.MulticastMessage(
                notification=messaging.Notification(title=title, body=body),
                data=str_data,
                tokens=batch,
                android=messaging.AndroidConfig(
                    priority='high',
                    notification=messaging.AndroidNotification(sound='default'),
                ),
                apns=messaging.APNSConfig(
                    payload=messaging.APNSPayload(
                        aps=messaging.Aps(sound='default', badge=1),
                    ),
                ),
            )
            response = messaging.send_each_for_multicast(multicast_message)
            logger.info(
                f"FCM broadcast lot {i // BATCH_SIZE + 1}: "
                f"{response.success_count} succès, {response.failure_count} échecs"
            )
        except Exception as e:
            logger.error(f"Erreur FCM broadcast lot {i}: {e}")
