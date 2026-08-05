# pyrefly: ignore [missing-import]
from drf_spectacular.utils import extend_schema, extend_schema_view, OpenApiParameter, OpenApiTypes
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from django.contrib.auth import get_user_model
from django.db.models import Q
from django.db import models, transaction
from django.views.decorators.csrf import csrf_exempt
from django.utils import timezone
from datetime import timedelta
import random
import os
import logging
from django.conf import settings
from django.core.mail import EmailMultiAlternatives
import email
import email.policy

logger = logging.getLogger(__name__)

from ..models import (
    Vehicle, UserPreference, Ride, Booking, Conversation, Message, Notification, 
    AppBranding, VerificationRequest, Promotion, MobileSettings,
    FinancialSettings, RefundRequest, Transaction, Parcel, Payment, PasswordResetOTP, PopularPlace
)
from ..serializers import (
    UserSerializer, AdminUserSerializer, VehicleSerializer, UserPreferenceSerializer, 
    RideSerializer, BookingSerializer, ConversationSerializer, MessageSerializer, NotificationSerializer, AppBrandingSerializer,
    VerificationRequestSerializer, PromotionSerializer, MobileSettingsSerializer,
    FinancialSettingsSerializer, RefundRequestSerializer, TransactionSerializer, ParcelSerializer, PopularPlaceSerializer
)
from ..fcm import send_fcm_to_user, send_fcm_to_all_users, create_and_send_notification

User = get_user_model()

import firebase_admin
from firebase_admin import credentials, auth as firebase_auth

try:
    if not firebase_admin._apps:
        cred_path = os.path.join(settings.BASE_DIR, 'firebase-adminsdk.json')
        if os.path.exists(cred_path):
            cred = credentials.Certificate(cred_path)
            firebase_admin.initialize_app(cred)
except Exception:
    pass

class ConversationViewSet(viewsets.ModelViewSet):
    """
    ViewSet gérant les conversations (Messagerie).
    """
    queryset = Conversation.objects.all()
    serializer_class = ConversationSerializer

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return Conversation.objects.none()
        
        qs = Conversation.objects.select_related('participant_1', 'participant_2', 'ride', 'ride__driver', 'ride__vehicle').prefetch_related('messages')
        
        # Admin sees all support conversations
        query_type = getattr(self.request, 'query_params', self.request.GET).get('type')
        if getattr(user, 'is_staff', False) and query_type == 'support':
            return qs.filter(conversation_type='support').order_by('-updated_at')
        return (qs.filter(participant_1=user) | qs.filter(participant_2=user)).order_by('-updated_at')

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context

    def perform_create(self, serializer):
        conversation = serializer.save()
        
        # Si c'est une conversation de trajet, ajouter le message de bienvenue automatique
        if conversation.conversation_type == 'ride' and conversation.ride:
            driver = conversation.ride.driver
            passenger = conversation.participant_1 if conversation.participant_1 != driver else conversation.participant_2
            
            if passenger:
                # Éviter les doublons
                welcome_exists = Message.objects.filter(
                    conversation=conversation,
                    content__contains="Bienvenue dans votre espace de discussion"
                ).exists()
                
                if not welcome_exists:
                    booking = Booking.objects.filter(ride=conversation.ride, passenger=passenger).exclude(status='cancelled').first()
                    dep_loc = (booking.departure_location if booking and booking.departure_location else conversation.ride.departure_location) or ''
                    arr_loc = (booking.arrival_location if booking and booking.arrival_location else conversation.ride.arrival_location) or ''
                    system_message = (
                        f"Bienvenue dans votre espace de discussion !\n\n"
                        f"Trajet : {dep_loc} -> {arr_loc} "
                        f"le {conversation.ride.departure_date} à {str(conversation.ride.departure_time)[:5]}.\n\n"
                        f"Rappel des règles :\n"
                        f"• Ne partagez pas votre numéro de téléphone ici\n"
                        f"• Soyez respectueux et ponctuel\n"
                        f"• En cas de problème, contactez le support\n\n"
                        f"Bonne route !"
                    )
                    Message.objects.create(
                        conversation=conversation,
                        sender=driver,
                        content=system_message,
                        message_type='text',
                    )

    def create(self, request, *args, **kwargs):
        if not request.user.is_authenticated:
            return Response({'error': 'Authentication required.'}, status=status.HTTP_401_UNAUTHORIZED)
            
        conv_type = request.data.get('conversation_type', 'ride')
        if conv_type == 'support':
            return super().create(request, *args, **kwargs)
            
        ride_id = request.data.get('ride')
        if not ride_id:
            return Response({'error': 'ride is required for ride conversation.'}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            ride = Ride.objects.get(pk=ride_id)
        except Ride.DoesNotExist:
            return Response({'error': 'Trajet introuvable.'}, status=status.HTTP_404_NOT_FOUND)
            
        participant_1_id = request.data.get('participant_1')
        participant_2_id = request.data.get('participant_2')
        
        # Trouver qui est le passager (celui qui n'est pas le conducteur)
        passenger_id = None
        if participant_1_id and int(participant_1_id) != ride.driver.id:
            passenger_id = participant_1_id
        elif participant_2_id and int(participant_2_id) != ride.driver.id:
            passenger_id = participant_2_id
            
        if not passenger_id:
            return Response({'error': 'La conversation de trajet doit inclure le passager et le conducteur.'}, status=status.HTTP_400_BAD_REQUEST)
            
        # Vérifier que le passager a une réservation active ou en attente pour ce trajet
        has_valid_booking = Booking.objects.filter(ride=ride, passenger_id=passenger_id).exclude(status__in=['cancelled', 'rejected', 'expired']).exists()
        if not has_valid_booking:
            return Response({'error': "Vous devez avoir une réservation en cours ou validée pour démarrer une discussion."}, status=status.HTTP_403_FORBIDDEN)
            
        # Vérifier si l'utilisateur qui fait la requête est soit le passager, soit le conducteur
        if request.user.id not in [int(participant_1_id or 0), int(participant_2_id or 0)]:
            return Response({'error': "Vous n'êtes pas participant de cette discussion."}, status=status.HTTP_403_FORBIDDEN)
            
        return super().create(request, *args, **kwargs)

    @action(detail=False, methods=['get', 'post'], url_path='support-chat')
    def support_chat(self, request):
        """Get or create the support conversation for the current user."""
        if not request.user.is_authenticated:
            return Response({'error': 'Authentication required.'}, status=status.HTTP_401_UNAUTHORIZED)

        # Find an existing support conversation for this user
        conversation = Conversation.objects.filter(
            participant_1=request.user,
            conversation_type='support'
        ).first()

        if not conversation:
            # Create a new support conversation (participant_2 = None = admin will respond)
            conversation = Conversation.objects.create(
                participant_1=request.user,
                conversation_type='support'
            )

        serializer = ConversationSerializer(conversation, context={'request': request})
        return Response(serializer.data)

    @action(detail=False, methods=['post'], url_path='report-problem')
    def report_problem(self, request):
        if not request.user.is_authenticated:
            return Response({'error': 'Authentication required.'}, status=status.HTTP_401_UNAUTHORIZED)
            
        ride_id = request.data.get('ride_id')
        problem_desc = request.data.get('problem', 'Problème signalé.')
        latitude = request.data.get('latitude')
        longitude = request.data.get('longitude')
        
        role = "Utilisateur"
        if ride_id:
            try:
                ride = Ride.objects.get(pk=ride_id)
                if ride.driver == request.user:
                    role = "Conducteur"
                else:
                    role = "Passager"
            except Exception:
                pass
        
        conversation = Conversation.objects.filter(
            participant_1=request.user,
            conversation_type='support'
        ).first()

        if not conversation:
            conversation = Conversation.objects.create(
                participant_1=request.user,
                conversation_type='support'
            )
            
        msg_content = f"🚨 PROBLÈME SIGNALÉ 🚨\nTrajet ID: {ride_id}\nRôle: {role}\n\nDescription: {problem_desc}"
        
        Message.objects.create(
            conversation=conversation,
            sender=request.user,
            content=msg_content,
            message_type='text',
            is_urgent=True,
        )
        
        if latitude is not None and longitude is not None:
            Message.objects.create(
                conversation=conversation,
                sender=request.user,
                content="📍 Position du signalement",
                message_type='location',
                location_lat=latitude,
                location_lng=longitude,
                is_urgent=True,
            )
        
        return Response({"status": "Problème signalé à l'administration avec succès."})

    @action(detail=False, methods=['post'], url_path='ride-chat')
    def ride_chat(self, request):
        """Get or create a ride conversation between the current user and the driver."""
        if not request.user.is_authenticated:
            return Response({'error': 'Authentication required.'}, status=status.HTTP_401_UNAUTHORIZED)

        ride_id = request.data.get('ride_id')
        if not ride_id:
            return Response({'error': 'ride_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            ride = Ride.objects.get(pk=ride_id)
        except Ride.DoesNotExist:
            return Response({'error': 'Trajet introuvable.'}, status=status.HTTP_404_NOT_FOUND)

        passenger = request.user
        driver = ride.driver

        # If current user is the driver, they can also open the chat
        if passenger == driver:
            return Response({'error': 'Vous ne pouvez pas discuter avec vous-même.'}, status=status.HTTP_400_BAD_REQUEST)
        # Vérifier que le passager a une réservation active ou en attente pour ce trajet
        has_valid_booking = Booking.objects.filter(ride=ride, passenger=passenger).exclude(status__in=['cancelled', 'rejected', 'expired']).exists()
        if not has_valid_booking:
            return Response({'error': "Vous devez avoir une réservation en cours ou validée pour ce trajet pour démarrer une discussion."}, status=status.HTTP_403_FORBIDDEN)

        # Find or create the conversation
        conversation = Conversation.objects.filter(
            ride=ride,
            conversation_type='ride'
        ).filter(
            Q(participant_1=passenger, participant_2=driver) |
            Q(participant_1=driver, participant_2=passenger)
        ).first()

        created = False
        if not conversation:
            conversation = Conversation.objects.create(
                conversation_type='ride',
                ride=ride,
                participant_1=passenger,
                participant_2=driver,
            )
            created = True

        # If newly created, add a system welcome message
        if created:
            booking = Booking.objects.filter(ride=ride, passenger=passenger).exclude(status='cancelled').first()
            dep_loc = (booking.departure_location if booking and booking.departure_location else ride.departure_location) or ''
            arr_loc = (booking.arrival_location if booking and booking.arrival_location else ride.arrival_location) or ''
            system_message = (
                f"Bienvenue dans votre espace de discussion !\n\n"
                f"Trajet : {dep_loc} -> {arr_loc} "
                f"le {ride.departure_date} à {str(ride.departure_time)[:5]}.\n\n"
                f"Rappel des règles :\n"
                f"• Ne partagez pas votre numéro de téléphone ici\n"
                f"• Soyez respectueux et ponctuel\n"
                f"• En cas de problème, contactez le support\n\n"
                f"Bonne route !"
            )
            Message.objects.create(
                conversation=conversation,
                sender=driver,  # Sent as driver (system-like)
                content=system_message,
                message_type='text',
            )

        serializer = ConversationSerializer(conversation, context={'request': request})
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='unread_count')
    def unread_count(self, request):
        if not request.user.is_authenticated:
            return Response({'count': 0})
            
        # Get conversations where the current user is a participant
        conversations = self.get_queryset()
        
        # Count messages that are not read and not sent by the current user
        from django.db.models import Count, Q
        unread_count = Message.objects.filter(
            conversation__in=conversations,
            is_read=False
        ).exclude(sender=request.user).count()
        
        return Response({'count': unread_count})

class MessageViewSet(viewsets.ModelViewSet):
    """
    ViewSet gérant les messages envoyés dans une conversation.
    Gère également l'upload de médias (audio, images).
    """
    queryset = Message.objects.all()
    serializer_class = MessageSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        user = self.request.user
        queryset = super().get_queryset().select_related('sender', 'conversation')
        
        if not getattr(user, 'is_staff', False):
            from django.db.models import Q
            queryset = queryset.filter(Q(conversation__participant_1=user) | Q(conversation__participant_2=user))
            
        conversation_id = getattr(self.request, 'query_params', self.request.GET).get('conversation')
        if conversation_id:
            try:
                conversation = Conversation.objects.get(pk=conversation_id)
                if conversation.conversation_type == 'ride' and conversation.ride:
                    welcome_exists = Message.objects.filter(
                        conversation=conversation,
                        content__contains="Bienvenue dans votre espace de discussion"
                    ).exists()
                    if not welcome_exists:
                        driver = conversation.ride.driver
                        passenger = conversation.participant_1 if conversation.participant_1 != driver else conversation.participant_2
                        if passenger:
                            booking = Booking.objects.filter(ride=conversation.ride, passenger=passenger).exclude(status='cancelled').first()
                            dep_loc = (booking.departure_location if booking and booking.departure_location else conversation.ride.departure_location) or ''
                            arr_loc = (booking.arrival_location if booking and booking.arrival_location else conversation.ride.arrival_location) or ''
                            system_message = (
                                f"Bienvenue dans votre espace de discussion !\n\n"
                                f"Trajet : {dep_loc} -> {arr_loc} "
                                f"le {conversation.ride.departure_date} à {str(conversation.ride.departure_time)[:5]}.\n\n"
                                f"Rappel des règles :\n"
                                f"• Ne partagez pas votre numéro de téléphone ici\n"
                                f"• Soyez respectueux et ponctuel\n"
                                f"• En cas de problème, contactez le support\n\n"
                                f"Bonne route !"
                            )
                            Message.objects.create(
                                conversation=conversation,
                                sender=driver,
                                content=system_message,
                                message_type='text',
                            )
            except Exception:
                pass
            queryset = queryset.filter(conversation_id=conversation_id)
        return queryset

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context

    def perform_create(self, serializer):
        msg = serializer.save(sender=self.request.user)
        # Mark conversation as updated
        conv = msg.conversation
        conv.save()  # triggers updated_at

        # Envoyer une notification push au destinataire
        recipient = conv.participant_2 if conv.participant_1 == self.request.user else conv.participant_1
        if recipient and recipient != self.request.user:
            sender_name = getattr(self.request.user, 'full_name', None) or getattr(self.request.user, 'phone', 'Un utilisateur')
            content_preview = msg.content if msg.message_type == 'text' else f"[{msg.message_type.capitalize()}]"
            create_and_send_notification(
                user=recipient,
                title=f"Nouveau message de {sender_name}",
                message=content_preview,
                data={
                    'type': 'new_message',
                    'conversation_id': str(conv.id),
                    'screen': 'chat'
                }
            )

    @action(detail=True, methods=['post'], url_path='mark-read')
    def mark_read(self, request, pk=None):
        """Mark all messages in a conversation as read for the current user."""
        try:
            conversation = Conversation.objects.get(pk=pk)
            conversation.messages.exclude(sender=request.user).update(is_read=True)
            return Response({'status': 'messages marked as read'})
        except Conversation.DoesNotExist:
            return Response({'error': 'Conversation not found'}, status=status.HTTP_404_NOT_FOUND)


