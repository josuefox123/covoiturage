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

class NotificationViewSet(viewsets.ModelViewSet):
    """
    ViewSet pour l'historique des notifications de l'utilisateur.
    """
    queryset = Notification.objects.all()
    serializer_class = NotificationSerializer

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return Notification.objects.none()
        if user.is_staff:
            # Admins voient toutes les notifications
            return Notification.objects.all().order_by('-created_at')
        # Clients voient uniquement leurs propres notifications (pas les globales user=None)
        return Notification.objects.filter(user=user).order_by('-created_at')

    def perform_create(self, serializer):
        notif = serializer.save()
        title = notif.title or "Nouvelle notification"
        message = notif.message or ""
        
        if notif.user:
            # Envoi Push direct à l'utilisateur ciblé
            send_fcm_to_user(
                user=notif.user,
                title=title,
                body=message,
                data={'screen': 'notifications', 'notif_id': str(notif.id)}
            )
        else:
            # Envoi Push broadcast à tous les utilisateurs
            send_fcm_to_all_users(
                title=title,
                body=message,
                data={'screen': 'notifications', 'notif_id': str(notif.id)}
            )

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
