"""
========================================================

Fichier :
fcm.py

Description :

Module de l'application Zemy.

Projet :
Zemy

========================================================
"""
"""
Utilitaire Firebase Cloud Messaging (FCM).
Utilise firebase_admin (déjà initialisé dans views.py).
"""
import logging
import threading
import requests
from firebase_admin import messaging

logger = logging.getLogger(__name__)


def send_fcm_notification(token: str, title: str, body: str, data: dict | None = None) -> bool:
    """
    Envoie une notification Push (Expo Push API ou FCM direct) à un seul device.

    Args:
        token: FCM device token ou Expo Push Token (ExponentPushToken[...])
        title: Titre de la notification
        body: Corps de la notification
        data: Données supplémentaires (dict string→string)

    Returns:
        True si succès, False sinon
    """
    if not token:
        return False

    str_data = {str(k): str(v) for k, v in (data or {}).items()}

    # Si le token est un token Expo Push (ex: ExponentPushToken[...])
    if token.startswith('ExponentPushToken') or token.startswith('ExpoPushToken'):
        try:
            payload = {
                'to': token,
                'title': title,
                'body': body,
                'data': str_data,
                'sound': 'default',
                'badge': 1,
                'priority': 'high',
                'channelId': 'default',
                '_displayInForeground': True,
            }
            res = requests.post(
                'https://exp.host/--/api/v2/push/send',
                json=payload,
                headers={
                    'Accept': 'application/json',
                    'Accept-Encoding': 'gzip, deflate',
                    'Content-Type': 'application/json',
                },
                timeout=5
            )
            if res.status_code == 200:
                logger.info(f"Expo Push envoyé avec succès: {res.text}")
                return True
            else:
                logger.error(f"Erreur Expo Push HTTP {res.status_code}: {res.text}")
                return False
        except Exception as e:
            logger.error(f"Exception lors de l'envoi Expo Push: {e}")
            return False

    # Sinon, utiliser Firebase Cloud Messaging (FCM) direct pour les tokens natifs
    try:
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
                    channel_id='default',
                    priority='max',
                    visibility='public',
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


def send_fcm_to_user(user, title: str, body: str, data: dict | None = None) -> bool:
    """
    Envoie une notification FCM / Expo Push à un utilisateur spécifique.

    Args:
        user: Instance User Django
        title: Titre de la notification
        body: Corps de la notification
        data: Données supplémentaires
    """
    token = getattr(user, 'fcm_token', None)
    if not token:
        logger.debug(f"Pas de token de notification pour l'utilisateur {user.id}")
        return False
    return send_fcm_notification(token, title, body, data)


def send_fcm_to_all_users(title: str, body: str, data: dict | None = None, exclude_ids: list | None = None):
    """
    Envoie une notification Push à tous les utilisateurs actifs qui ont un token.

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
        logger.info("Aucun token de notification disponible pour le broadcast.")
        return

    str_data = {str(k): str(v) for k, v in (data or {}).items()}
    expo_tokens = [t for t in tokens if t.startswith('ExponentPushToken') or t.startswith('ExpoPushToken')]
    native_tokens = [t for t in tokens if not (t.startswith('ExponentPushToken') or t.startswith('ExpoPushToken'))]

    # Traitement des tokens Expo Push (pour Expo Go et Dev Builds)
    if expo_tokens:
        try:
            payloads = [
                {
                    'to': t,
                    'title': title,
                    'body': body,
                    'data': str_data,
                    'sound': 'default',
                    'badge': 1,
                    'priority': 'high',
                    'channelId': 'default',
                    '_displayInForeground': True,
                }
                for t in expo_tokens
            ]
            for i in range(0, len(payloads), 100):
                batch = payloads[i:i + 100]
                requests.post(
                    'https://exp.host/--/api/v2/push/send',
                    json=batch,
                    headers={
                        'Accept': 'application/json',
                        'Content-Type': 'application/json',
                    },
                    timeout=10
                )
            logger.info(f"Broadcast Expo Push envoyé à {len(expo_tokens)} utilisateurs.")
        except Exception as e:
            logger.error(f"Erreur broadcast Expo Push: {e}")

    # Traitement des tokens Native FCM
    if native_tokens:
        BATCH_SIZE = 500
        for i in range(0, len(native_tokens), BATCH_SIZE):
            batch = native_tokens[i:i + BATCH_SIZE]
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


def create_and_send_notification(user, title: str, message: str, data: dict | None = None):
    """
    Enregistre une notification en base de données et l'envoie sur le mobile de l'utilisateur via FCM.
    L'envoi sur les serveurs de push (Expo / Firebase) est exécuté en arrière-plan (non-bloquant).
    """
    try:
        from .models import Notification
        Notification.objects.create(
            user=user,
            title=title,
            message=message,
            is_read=False
        )
    except Exception as e:
        logger.error(f"Erreur création Notification en BD: {e}")
        
    # Diffuser en temps réel via WebSocket au groupe user_<user_id>
    try:
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync
        channel_layer = get_channel_layer()
        if channel_layer:
            async_to_sync(channel_layer.group_send)(
                f"user_{user.id}",
                {
                    "type": "send_realtime_notification",
                    "notification": {
                        "title": title,
                        "message": message,
                        "data": data or {'screen': 'notifications'}
                    }
                }
            )
    except Exception as e:
        logger.debug(f"WS notification send error: {e}")

    def _send_push_async():
        try:
            send_fcm_to_user(
                user=user,
                title=title,
                body=message,
                data=data or {'screen': 'notifications'}
            )
        except Exception as e:
            logger.error(f"Erreur envoi notification FCM async: {e}")

    threading.Thread(target=_send_push_async, daemon=True).start()

