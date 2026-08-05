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

@extend_schema(responses={200: dict}, tags=['Administration'])
class AppBrandingView(APIView):
    """
    Vue permettant de récupérer ou de modifier l'apparence (Branding) de l'application.
    """
    permission_classes = [permissions.AllowAny]
    parser_classes = (MultiPartParser, FormParser, JSONParser)

    @extend_schema(responses={200: dict})
    @extend_schema(responses={200: dict})
    def get(self, request):
        branding = AppBranding.objects.filter(is_active=True).first()
        if not branding:
            return Response({'logo': None, 'logo_scale': 1.0, 'logo_position_x': 0.0, 'logo_position_y': 0.0})
        serializer = AppBrandingSerializer(branding, context={'request': request})
        return Response(serializer.data)

    @extend_schema(request=dict, responses={200: dict})
    @extend_schema(request=dict, responses={200: dict})
    @extend_schema(request=dict, responses={200: dict})
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


class PromotionViewSet(viewsets.ModelViewSet):
    """
    ViewSet gérant les bannières promotionnelles sur l'accueil mobile.
    """
    queryset = Promotion.objects.all()
    serializer_class = PromotionSerializer
    
    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [permissions.AllowAny()]
        return [permissions.IsAdminUser()]

    def get_queryset(self):
        user = self.request.user
        if user.is_authenticated and getattr(user, 'is_staff', False):
            return Promotion.objects.all()
        return Promotion.objects.filter(is_active=True)

    def perform_create(self, serializer):
        promotion = serializer.save()
        # Notifier tous les utilisateurs de la nouvelle promotion
        send_fcm_to_all_users(
            title="Nouvelle promotion disponible !",
            body=promotion.title,
            data={'type': 'new_promotion', 'screen': 'home'},
        )

    def perform_update(self, serializer):
        promotion = serializer.save()
        if promotion.is_active:
            send_fcm_to_all_users(
                title="🔄 Promotion mise à jour",
                body=promotion.title,
                data={'type': 'promotion_updated', 'screen': 'home'},
            )

@extend_schema(responses={200: dict}, tags=['Administration'])

class MobileSettingsView(APIView):
    """
    Vue gérant les paramètres d'affichage de l'application mobile.
    """
    permission_classes = [permissions.AllowAny]

    @extend_schema(responses={200: dict})
    def get(self, request):
        settings = MobileSettings.load()
        serializer = MobileSettingsSerializer(settings)
        return Response(serializer.data)

    @extend_schema(request=dict, responses={200: dict})
    @extend_schema(request=dict, responses={200: dict})
    @extend_schema(request=dict, responses={200: dict})
    def put(self, request):
        if not request.user.is_authenticated or not getattr(request.user, 'is_staff', False):
            return Response({'error': 'Admin required'}, status=403)
        
        settings = MobileSettings.load()
        serializer = MobileSettingsSerializer(settings, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=400)
    
    def patch(self, request):
        return self.put(request)


