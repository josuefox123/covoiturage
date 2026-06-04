from rest_framework import viewsets, status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model
import random

from .models import Vehicle, UserPreference, Ride, Booking, Conversation, Message
from .serializers import (
    UserSerializer, VehicleSerializer, UserPreferenceSerializer, 
    RideSerializer, BookingSerializer, ConversationSerializer, MessageSerializer
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
    if not user:
        user = User.objects.filter(email=identifier).first()

    if user and user.check_password(password):
        refresh = RefreshToken.for_user(user)
        return Response({
            'refresh': str(refresh),
            'access': str(refresh.access_token),
            'user': UserSerializer(user).data
        })
    return Response({'error': 'Identifiants invalides.'}, status=status.HTTP_401_UNAUTHORIZED)

class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer

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

    def perform_create(self, serializer):
        serializer.save(driver=self.request.user)

class BookingViewSet(viewsets.ModelViewSet):
    queryset = Booking.objects.all()
    serializer_class = BookingSerializer

    def perform_create(self, serializer):
        serializer.save(passenger=self.request.user)

class ConversationViewSet(viewsets.ModelViewSet):
    queryset = Conversation.objects.all()
    serializer_class = ConversationSerializer

    def get_queryset(self):
        user = self.request.user
        return Conversation.objects.filter(participant_1=user) | Conversation.objects.filter(participant_2=user)

class MessageViewSet(viewsets.ModelViewSet):
    queryset = Message.objects.all()
    serializer_class = MessageSerializer

    def perform_create(self, serializer):
        serializer.save(sender=self.request.user)