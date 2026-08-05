import json
import logging
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model

logger = logging.getLogger(__name__)
User = get_user_model()

class ChatConsumer(AsyncWebsocketConsumer):
    """
    Consumer WebSocket pour une conversation de chat.
    Un groupe Channels par conversation : "chat_<conversation_id>"
    """

    async def connect(self):
        self.conversation_id = self.scope['url_route']['kwargs']['conversation_id']
        self.group_name = f"chat_{self.conversation_id}"
        self.user = None

        # Authentification par JWT (query string)
        user = await self._authenticate()
        if user is None:
            logger.warning(f"WS connexion refusée — token invalide pour conversation {self.conversation_id}")
            await self.close(code=4001)
            return

        # Vérifier que l'utilisateur fait bien partie de cette conversation
        is_participant = await self._is_participant(user, self.conversation_id)
        if not is_participant:
            logger.warning(f"WS connexion refusée — {user.id} non participant de {self.conversation_id}")
            await self.close(code=4003)
            return

        self.user = user

        # Rejoindre le groupe Channels de la conversation
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        logger.info(f"WS connecté: user={user.id} conversation={self.conversation_id}")

    async def disconnect(self, code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)
        logger.info(f"WS déconnecté: code={code} conversation={self.conversation_id}")

    async def receive(self, text_data=None, bytes_data=None):
        """Reçoit un message du client WebSocket et le diffuse au groupe."""
        if not self.user or not text_data:
            return

        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            await self.send(text_data=json.dumps({'error': 'JSON invalide'}))
            return

        message_type = data.get('type', 'message')

        if message_type == 'message':
            content = data.get('content', '').strip()
            if not content:
                return

            # Sauvegarder le message en base de données
            message = await self._save_message(content)
            if not message:
                return

            # Broadcaster le message à tous les participants du groupe
            await self.channel_layer.group_send(
                self.group_name,
                {
                    'type': 'chat_message',
                    'message': {
                        'id': str(message['id']),
                        'content': message['content'],
                        'sender': str(message['sender_id']),
                        'sender_details': message['sender_details'],
                        'created_at': message['created_at'],
                        'message_type': 'text',
                        'is_read': False,
                    }
                }
            )

            # Envoyer notification FCM au destinataire (hors ligne)
            await self._notify_recipient(content)

        elif message_type == 'typing':
            # Diffuser l'indicateur "en train d'écrire"
            await self.channel_layer.group_send(
                self.group_name,
                {
                    'type': 'typing_indicator',
                    'user_id': str(self.user.id),
                    'is_typing': data.get('is_typing', False),
                }
            )

        elif message_type == 'read':
            # Marquer les messages comme lus
            await self._mark_messages_read()
            await self.channel_layer.group_send(
                self.group_name,
                {
                    'type': 'read_receipt',
                    'user_id': str(self.user.id),
                }
            )

    # ── Handlers des événements de groupe ─────────────────────────────────

    async def chat_message(self, event):
        """Reçoit un message broadcasted et l'envoie au client WebSocket."""
        await self.send(text_data=json.dumps({
            'type': 'message',
            'message': event['message'],
        }))

    async def typing_indicator(self, event):
        """Envoie l'indicateur de frappe au client."""
        # Ne pas renvoyer à l'émetteur lui-même
        if self.user and event.get('user_id') != str(self.user.id):
            await self.send(text_data=json.dumps({
                'type': 'typing',
                'user_id': event['user_id'],
                'is_typing': event['is_typing'],
            }))

    async def read_receipt(self, event):
        """Notifie que les messages ont été lus."""
        if self.user and event.get('user_id') != str(self.user.id):
            await self.send(text_data=json.dumps({
                'type': 'read',
                'user_id': event['user_id'],
            }))

    # ── Méthodes DB (sync → async) ────────────────────────────────────────

    @database_sync_to_async
    def _authenticate(self):
        """Extrait et vérifie le JWT depuis la query string."""
        from rest_framework_simplejwt.tokens import AccessToken
        from rest_framework_simplejwt.exceptions import TokenError

        query_string = self.scope.get('query_string', b'').decode()
        token_str = None

        for part in query_string.split('&'):
            if part.startswith('token='):
                token_str = part[6:]
                break

        if not token_str:
            return None

        try:
            access_token = AccessToken(token_str)  # type: ignore
            user_id = access_token.get('user_id')
            return User.objects.get(id=user_id, is_active=True)
        except (TokenError, User.DoesNotExist, Exception) as e:
            logger.debug(f"Auth WS échouée: {e}")
            return None

    @database_sync_to_async
    def _is_participant(self, user, conversation_id):
        """Vérifie que l'utilisateur est participant de la conversation."""
        from ..models import Conversation
        try:
            conv = Conversation.objects.get(id=conversation_id)
            return conv.participant_1 == user or conv.participant_2 == user
        except Conversation.DoesNotExist:
            return False

    @database_sync_to_async
    def _save_message(self, content):
        """Sauvegarde le message en base et retourne ses données sérialisées."""
        if not self.user:
            return None
        from ..models import Conversation, Message

        try:
            conversation = Conversation.objects.get(id=self.conversation_id)
            message = Message.objects.create(
                conversation=conversation,
                sender=self.user,
                content=content,
                message_type='text',
            )
            # Mettre à jour le updated_at de la conversation
            conversation.save()

            return {
                'id': str(message.id),
                'content': message.content,
                'sender_id': str(self.user.id),
                'sender_details': {
                    'id': str(self.user.id),
                    'full_name': self.user.full_name or '',
                    'avatar': None,
                },
                'created_at': message.created_at.isoformat(),
            }
        except Exception as e:
            logger.error(f"Erreur sauvegarde message WS: {e}")
            return None

    @database_sync_to_async
    def _mark_messages_read(self):
        """Marque tous les messages non lus (envoyés par l'autre) comme lus."""
        if not self.user:
            return
        from ..models import Message
        Message.objects.filter(
            conversation_id=self.conversation_id,
            is_read=False,
        ).exclude(sender=self.user).update(is_read=True)

    @database_sync_to_async
    def _notify_recipient(self, content):
        """Envoie une notification FCM au destinataire de la conversation."""
        if not self.user:
            return
        from ..models import Conversation
        from ..fcm import send_fcm_to_user

        try:
            conversation = Conversation.objects.select_related(
                'participant_1', 'participant_2'
            ).get(id=self.conversation_id)

            # Déterminer le destinataire (l'autre participant)
            if conversation.participant_1 == self.user:
                recipient = conversation.participant_2
            else:
                recipient = conversation.participant_1

            if recipient is None:
                return  # Conversation support sans admin connecté

            sender_name = self.user.full_name or self.user.phone or 'Utilisateur'

            send_fcm_to_user(
                recipient,
                title=f"💬 {sender_name}",
                body=content[:100] + ('...' if len(content) > 100 else ''),
                data={
                    'type': 'new_message',
                    'conversation_id': str(self.conversation_id),
                    'screen': 'chat',
                }
            )
        except Exception as e:
            logger.error(f"Erreur notification FCM WS: {e}")


class BookingConsumer(AsyncWebsocketConsumer):
    """
    Consumer WebSocket pour les mises à jour de statut de réservation en temps réel.
    """

    async def connect(self):
        self.booking_id = self.scope['url_route']['kwargs']['booking_id']
        self.group_name = f"booking_{self.booking_id}"
        self.user = None

        # Authentification JWT
        user = await self._authenticate()
        if user is None:
            await self.close(code=4001)
            return

        # Vérifier que l'utilisateur est bien passager ou conducteur de cette réservation
        is_authorized = await self._is_authorized(user, self.booking_id)
        if not is_authorized:
            await self.close(code=4003)
            return

        self.user = user
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        logger.info(f"BookingWS connecté: user={user.id} booking={self.booking_id}")

    async def disconnect(self, code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data=None, bytes_data=None):
        pass

    async def booking_update(self, event):
        """Reçoit un update de statut du serveur et l'envoie au client WebSocket."""
        await self.send(text_data=json.dumps({
            'type': 'booking_status_update',
            'booking_id': event['booking_id'],
            'status': event['status'],
            'amount': event.get('amount'),
            'payment_status': event.get('payment_status'),
        }))

    @database_sync_to_async
    def _authenticate(self):
        """Extrait et vérifie le JWT depuis la query string."""
        from rest_framework_simplejwt.tokens import AccessToken
        from rest_framework_simplejwt.exceptions import TokenError

        query_string = self.scope.get('query_string', b'').decode()
        token_str = None
        for part in query_string.split('&'):
            if part.startswith('token='):
                token_str = part[6:]
                break

        if not token_str:
            return None

        try:
            access_token = AccessToken(token_str)  # type: ignore
            user_id = access_token.get('user_id')
            return User.objects.get(id=user_id, is_active=True)
        except (TokenError, User.DoesNotExist, Exception) as e:
            logger.debug(f"Auth BookingWS échouée: {e}")
            return None

    @database_sync_to_async
    def _is_authorized(self, user, booking_id):
        """Vérifie que l'utilisateur est passager ou conducteur de cette réservation."""
        from ..models import Booking
        try:
            booking = Booking.objects.select_related('passenger', 'ride__driver').get(id=booking_id)
            return booking.passenger == user or booking.ride.driver == user or bool(getattr(user, 'is_staff', False))
        except (Booking.DoesNotExist, Exception):
            return False


class NotificationConsumer(AsyncWebsocketConsumer):
    """
    Consumer WebSocket pour la diffusion des notifications personnelles en temps réel.
    Rejoint le groupe Channels : "user_<user_id>"
    """
    async def connect(self):
        self.user = await self._authenticate()
        if self.user is None:
            await self.close(code=4001)
            return

        self.group_name = f"user_{self.user.id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        logger.info(f"NotificationWS connecté: user={self.user.id}")

    async def disconnect(self, code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def send_realtime_notification(self, event):
        """Envoie la notification en JSON au client mobile via WebSocket."""
        await self.send(text_data=json.dumps({
            'type': 'notification',
            'title': event['notification']['title'],
            'message': event['notification']['message'],
            'data': event['notification']['data']
        }))

    @database_sync_to_async
    def _authenticate(self):
        from rest_framework_simplejwt.tokens import AccessToken
        from rest_framework_simplejwt.exceptions import TokenError

        query_string = self.scope.get('query_string', b'').decode()
        token_str = None
        for part in query_string.split('&'):
            if part.startswith('token='):
                token_str = part[6:]
                break

        if not token_str:
            return None

        try:
            access_token = AccessToken(token_str)
            user_id = access_token.get('user_id')
            return User.objects.get(id=user_id, is_active=True)
        except (TokenError, User.DoesNotExist, Exception) as e:
            logger.debug(f"Auth NotificationWS échouée: {e}")
            return None

