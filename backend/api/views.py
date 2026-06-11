from rest_framework import viewsets, status, permissions
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model
from django.db.models import Q
from django.db import models
import random

from .models import Vehicle, UserPreference, Ride, Booking, Conversation, Message, Notification, AppBranding
from .serializers import (
    UserSerializer, AdminUserSerializer, VehicleSerializer, UserPreferenceSerializer, 
    RideSerializer, BookingSerializer, ConversationSerializer, MessageSerializer, NotificationSerializer, AppBrandingSerializer
)

User = get_user_model()

import firebase_admin
from firebase_admin import credentials, auth as firebase_auth
from django.conf import settings
import os

# Initialize Firebase Admin
try:
    if not firebase_admin._apps:
        cred_path = os.path.join(settings.BASE_DIR, 'firebase-adminsdk.json')
        if os.path.exists(cred_path):
            cred = credentials.Certificate(cred_path)
            firebase_admin.initialize_app(cred)
        else:
            print("WARNING: firebase-adminsdk.json not found! Placer le fichier dans le dossier backend.")
except Exception as e:
    print(f"Error initializing Firebase Admin: {e}")

@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def verify_code(request):
    firebase_token = request.data.get('firebase_token')
    full_name = request.data.get('full_name', '') # For registration
    phone = request.data.get('phone', '') # Sent by frontend in dev mode
    
    if not firebase_token:
        return Response({'error': 'Jeton Firebase requis.'}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        # DEV MODE BYPASS
        if firebase_token == '123456':
            if not phone:
                return Response({'error': 'Numéro de téléphone requis pour le mode dev.'}, status=status.HTTP_400_BAD_REQUEST)
        else:
            if not firebase_admin._apps:
                return Response({'error': 'Firebase Admin non configuré sur le serveur.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
                
            # Verify the Firebase token normally
            decoded_token = firebase_auth.verify_id_token(firebase_token)
            phone = decoded_token.get('phone_number')
            
            if not phone:
                return Response({'error': 'Le jeton ne contient pas de numéro de téléphone vérifié.'}, status=status.HTTP_400_BAD_REQUEST)
        # Get or create user
        user, created = User.objects.get_or_create(phone=phone)
        if created and full_name:
            user.full_name = full_name
            user.save()
            
        refresh = RefreshToken.for_user(user)
        
        return Response({
            'refresh': str(refresh),
            'access': str(refresh.access_token),
            'user': UserSerializer(user).data,
            'is_new_user': created
        })
    except Exception as e:
        print(f"Erreur de vérification Firebase: {e}")
        return Response({'error': 'Code invalide ou expiré.'}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def register_user(request):
    from .serializers import RegisterSerializer
    serializer = RegisterSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()
        refresh = RefreshToken.for_user(user)
        return Response({
            'refresh': str(refresh),
            'access': str(refresh.access_token),
            'user': UserSerializer(user).data
        }, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def login_user(request):
    identifier = request.data.get('identifier')
    password = request.data.get('password')

    if not identifier or not password:
        return Response({'error': 'Veuillez fournir un identifiant et un mot de passe.'}, status=status.HTTP_400_BAD_REQUEST)

    user = User.objects.filter(phone=identifier).first()
    if not user and identifier.isdigit():
        user = User.objects.filter(phone=f'+229{identifier}').first()
    if not user:
        user = User.objects.filter(email=identifier).first()

    if user and user.check_password(password):
        refresh = RefreshToken.for_user(user)
        user_data = UserSerializer(user).data
        user_data['is_staff'] = user.is_staff
        user_data['is_superuser'] = user.is_superuser
        return Response({
            'refresh': str(refresh),
            'access': str(refresh.access_token),
            'user': user_data
        })
    return Response({'error': 'Identifiants invalides.'}, status=status.HTTP_401_UNAUTHORIZED)

@api_view(['GET'])
def dashboard_stats(request):
    total_users = User.objects.count()
    total_rides = Ride.objects.count()
    total_bookings = Booking.objects.count()
    
    # Just basic statistics for the dashboard
    return Response({
        'total_users': total_users,
        'active_rides': total_rides,
        'monthly_bookings': total_bookings,
        'estimated_revenue': total_bookings * 500  # just a placeholder metric
    })

class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all().order_by('-created_at')
    serializer_class = AdminUserSerializer
    permission_classes = [permissions.AllowAny]  # Dashboard admin access

class VehicleViewSet(viewsets.ModelViewSet):
    queryset = Vehicle.objects.all()
    serializer_class = VehicleSerializer

    def get_queryset(self):
        return Vehicle.objects.filter(owner=self.request.user)

class UserPreferenceViewSet(viewsets.ModelViewSet):
    queryset = UserPreference.objects.all()
    serializer_class = UserPreferenceSerializer

    def get_queryset(self):
        return UserPreference.objects.filter(user=self.request.user)

    def create(self, request, *args, **kwargs):
        user_id = request.data.get('user')
        if not user_id:
            return Response({'error': 'User ID is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        pref, created = UserPreference.objects.update_or_create(
            user_id=user_id,
            defaults={
                'music': request.data.get('music', True),
                'smoking': request.data.get('smoking', False),
                'chatty': request.data.get('chatty', True),
                'air_conditioner': request.data.get('air_conditioner', True),
            }
        )
        serializer = self.get_serializer(pref)
        return Response(serializer.data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

class RideViewSet(viewsets.ModelViewSet):
    queryset = Ride.objects.all().order_by('-created_at')
    serializer_class = RideSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        queryset = super().get_queryset()
        driver_id = self.request.query_params.get('driver')
        if driver_id:
            queryset = queryset.filter(driver_id=driver_id)
        elif getattr(self, 'action', '') == 'list' and not self.request.user.is_staff:
            from datetime import date
            queryset = queryset.filter(departure_date__gte=date.today())
        return queryset

    def perform_create(self, serializer):
        from rest_framework.exceptions import ValidationError
        if not self.request.user.is_verified:
            raise ValidationError({"error": "Votre compte doit être vérifié pour publier un trajet."})
        serializer.save(driver=self.request.user)

    @action(detail=True, methods=['post'], url_path='cancel')
    def cancel_ride(self, request, pk=None):
        ride = self.get_object()
        if ride.driver != request.user and not request.user.is_staff:
            return Response({"error": "Non autorisé."}, status=status.HTTP_403_FORBIDDEN)
        
        if ride.status == 'cancelled':
            return Response({"error": "Trajet déjà annulé."}, status=status.HTTP_400_BAD_REQUEST)
            
        ride.status = 'cancelled'
        ride.save()
        
        bookings = ride.bookings.filter(status__in=['pending', 'confirmed'])
        for booking in bookings:
            booking.status = 'cancelled'
            booking.save()
            ride.seats_available += booking.seats_booked
            
        ride.save()
        return Response({"status": "Trajet annulé avec succès."})

    @action(detail=True, methods=['post'], url_path='complete')
    def complete_ride(self, request, pk=None):
        ride = self.get_object()
        if ride.driver != request.user and not request.user.is_staff:
            return Response({"error": "Non autorisé."}, status=status.HTTP_403_FORBIDDEN)
        
        ride.status = 'completed'
        ride.save()
        return Response({"status": "Trajet terminé avec succès."})

class BookingViewSet(viewsets.ModelViewSet):
    queryset = Booking.objects.all()
    serializer_class = BookingSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        passenger_id = self.request.query_params.get('passenger')
        ride_driver_id = self.request.query_params.get('ride_driver')
        ride_id = self.request.query_params.get('ride')
        if passenger_id:
            queryset = queryset.filter(passenger_id=passenger_id)
        if ride_driver_id:
            queryset = queryset.filter(ride__driver_id=ride_driver_id)
        if ride_id:
            queryset = queryset.filter(ride_id=ride_id)
        return queryset

    def create(self, request, *args, **kwargs):
        from rest_framework.exceptions import ValidationError
        from datetime import date
        
        if not request.user.is_verified:
            raise ValidationError({"error": "Votre compte doit être vérifié pour réserver."})
        
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        ride = serializer.validated_data.get('ride')
        if ride.driver == request.user:
            raise ValidationError({"error": "Vous ne pouvez pas réserver votre propre trajet."})
            
        if ride.departure_date < date.today():
            raise ValidationError({"error": "Ce trajet est déjà passé (archivé)."})
            
        seats_to_book = serializer.validated_data.get('seats_booked', 1)
        if ride.seats_available < seats_to_book:
            raise ValidationError({"error": "Pas assez de places disponibles."})

        # Decrement seats
        ride.seats_available -= seats_to_book
        ride.save()
        
        booking = serializer.save(passenger=request.user)
        
        # Auto-create a conversation between the passenger and the driver for this ride
        passenger = request.user
        driver = ride.driver
        
        existing_conv = Conversation.objects.filter(
            ride=ride,
            conversation_type='ride'
        ).filter(
            Q(participant_1=passenger, participant_2=driver) |
            Q(participant_1=driver, participant_2=passenger)
        ).first()
        
        if not existing_conv:
            existing_conv = Conversation.objects.create(
                conversation_type='ride',
                ride=ride,
                participant_1=passenger,
                participant_2=driver,
            )
        
        response_data = BookingSerializer(booking).data
        response_data['conversation_id'] = str(existing_conv.id)
        
        return Response(response_data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='complete')
    def complete_booking(self, request, pk=None):
        """Permet au passager de marquer sa réservation comme terminée."""
        booking = self.get_object()
        if booking.passenger != request.user and not request.user.is_staff:
            return Response({"error": "Non autorisé."}, status=status.HTTP_403_FORBIDDEN)
        booking.status = 'completed'
        booking.save()
        return Response({"status": "Réservation terminée avec succès."})


class ConversationViewSet(viewsets.ModelViewSet):
    queryset = Conversation.objects.all()
    serializer_class = ConversationSerializer

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return Conversation.objects.none()
        # Admin sees all support conversations
        if user.is_staff and self.request.query_params.get('type') == 'support':
            return Conversation.objects.filter(conversation_type='support').order_by('-updated_at')
        return (Conversation.objects.filter(participant_1=user) |
                Conversation.objects.filter(participant_2=user)).order_by('-updated_at')

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context

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
        
        conversation = Conversation.objects.filter(
            participant_1=request.user,
            conversation_type='support'
        ).first()

        if not conversation:
            conversation = Conversation.objects.create(
                participant_1=request.user,
                conversation_type='support'
            )
            
        msg_content = f"🚨 PROBLÈME SIGNALÉ 🚨\nTrajet ID: {ride_id}\n\nDescription: {problem_desc}"
        
        Message.objects.create(
            conversation=conversation,
            sender=request.user,
            content=msg_content,
            message_type='text',
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
            system_message = (
                f"🤝 Bienvenue dans votre espace de discussion !\n\n"
                f"Trajet : {ride.departure_location} → {ride.arrival_location} "
                f"le {ride.departure_date} à {str(ride.departure_time)[:5]}.\n\n"
                f"📋 Rappel des règles :\n"
                f"• Ne partagez pas votre numéro de téléphone ici\n"
                f"• Soyez respectueux et ponctuel\n"
                f"• En cas de problème, contactez le support\n\n"
                f"Bonne route ! 🚗"
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
    queryset = Message.objects.all()
    serializer_class = MessageSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        queryset = super().get_queryset()
        conversation_id = self.request.query_params.get('conversation')
        if conversation_id:
            queryset = queryset.filter(conversation_id=conversation_id)
        return queryset

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context

    def perform_create(self, serializer):
        msg = serializer.save(sender=self.request.user)
        # Mark conversation as updated
        msg.conversation.save()  # triggers updated_at

    @action(detail=True, methods=['post'], url_path='mark-read')
    def mark_read(self, request, pk=None):
        """Mark all messages in a conversation as read for the current user."""
        try:
            conversation = Conversation.objects.get(pk=pk)
            conversation.messages.exclude(sender=request.user).update(is_read=True)
            return Response({'status': 'messages marked as read'})
        except Conversation.DoesNotExist:
            return Response({'error': 'Conversation not found'}, status=status.HTTP_404_NOT_FOUND)

class NotificationViewSet(viewsets.ModelViewSet):
    queryset = Notification.objects.all()
    serializer_class = NotificationSerializer

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return Notification.objects.none()
        if user.is_staff and getattr(self, 'action', '') == 'list':
            return Notification.objects.all().order_by('-created_at')
        # Return user specific notifications and global ones (user=None)
        return Notification.objects.filter(Q(user=user) | Q(user__isnull=True)).order_by('-created_at')

    @action(detail=False, methods=['post'], url_path='mark-read')
    def mark_all_read(self, request):
        if not request.user.is_authenticated:
            return Response({'error': 'Authentication required.'}, status=status.HTTP_401_UNAUTHORIZED)
        Notification.objects.filter(user=request.user, is_read=False).update(is_read=True)
        return Response({'status': 'All notifications marked as read'})

    @action(detail=True, methods=['post'], url_path='read')
    def mark_read(self, request, pk=None):
        try:
            notif = self.get_object()
            notif.is_read = True
            notif.save()
            return Response({'status': 'Notification marked as read'})
        except Notification.DoesNotExist:
            return Response({'error': 'Not found'}, status=404)

from rest_framework.views import APIView

class AppBrandingView(APIView):
    permission_classes = [permissions.AllowAny]
    parser_classes = (MultiPartParser, FormParser, JSONParser)

    def get(self, request):
        branding = AppBranding.objects.filter(is_active=True).first()
        if not branding:
            return Response({'logo': None, 'logo_scale': 1.0, 'logo_position_x': 0.0, 'logo_position_y': 0.0})
        serializer = AppBrandingSerializer(branding, context={'request': request})
        return Response(serializer.data)

    def put(self, request):
        if not request.user.is_authenticated or not getattr(request.user, 'is_staff', False):
            return Response({'error': 'Admin required'}, status=403)
        
        branding = AppBranding.objects.filter(is_active=True).first()
        
        # Determine if we are receiving multipart form data (with file) or JSON (just positions)
        if 'logo' in request.FILES:
            serializer = AppBrandingSerializer(branding, data=request.data, partial=True, context={'request': request})
        else:
            if not branding:
                branding = AppBranding.objects.create()
            serializer = AppBrandingSerializer(branding, data=request.data, partial=True, context={'request': request})
            
        if serializer.is_valid():
            serializer.save(is_active=True)
            return Response(serializer.data)
        return Response(serializer.errors, status=400)