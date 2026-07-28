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
from .auth import get_valid_callback_url

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

class ParcelViewSet(viewsets.ModelViewSet):
    """
    ViewSet pour l'envoi et la gestion des colis.
    Gère la création, la tarification et le suivi (QR Code) des expéditions.
    """
    queryset = Parcel.objects.all().order_by('-created_at')
    serializer_class = ParcelSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        if not getattr(user, 'is_staff', False):
            queryset = queryset.filter(Q(sender_user=user) | Q(ride__driver=user))
            
        ride_id = self.request.GET.get('ride')
        if ride_id:
            queryset = queryset.filter(ride_id=ride_id)
        return queryset

    def perform_create(self, serializer):
        from rest_framework.exceptions import ValidationError
        from ..models import FinancialSettings
        import uuid
        
        if not getattr(self.request.user, 'is_verified', False):
            raise ValidationError({"error": "Votre compte doit être vérifié pour envoyer un colis."})
            
        ride = serializer.validated_data.get('ride')
        if not ride.accepts_parcels:
            raise ValidationError({"error": "Ce trajet n'accepte pas les colis."})
        if ride.parcels_available < 1:
            raise ValidationError({"error": "Il n'y a plus de place pour les colis dans ce trajet."})
            
        # Finance
        driver_payout = ride.price_per_parcel
        settings = FinancialSettings.load()
        if settings.is_parcel_commission_active:
            zemy_commission = int(driver_payout * (settings.parcel_commission_percentage / 100.0))
            if zemy_commission < settings.min_parcel_commission:
                zemy_commission = settings.min_parcel_commission
            if settings.max_parcel_commission and zemy_commission > settings.max_parcel_commission:
                zemy_commission = settings.max_parcel_commission
        else:
            zemy_commission = 0
            
        total_price = driver_payout + zemy_commission
        qr_data = str(uuid.uuid4())
        
        # Lock ride
        with transaction.atomic():
            locked_ride = Ride.objects.select_for_update().get(id=ride.id)
            if locked_ride.parcels_available < 1:
                raise ValidationError({"error": "Il n'y a plus de place pour les colis dans ce trajet."})
            locked_ride.parcels_available -= 1
            locked_ride.save()
            
            parcel = serializer.save(
                sender_user=self.request.user,
                price=total_price,
                zemy_commission=zemy_commission,
                driver_payout=driver_payout,
                qr_code_data=qr_data
            )
            
        # Notifications
        create_and_send_notification(
            user=ride.driver,
            title="Nouveau colis 📦",
            message=f"Une nouvelle demande de colis a été effectuée sur votre trajet.",
            data={'type': 'new_parcel', 'parcel_id': str(parcel.id), 'screen': 'trips'}
        )

    @action(detail=True, methods=['post'], url_path='pay')
    def pay_parcel(self, request, pk=None):
        """
        Génère l'URL de paiement WebView pour FeexPay.
        """
        parcel = self.get_object()
        if parcel.sender_user != request.user and not request.user.is_staff:
            return Response({"error": "Non autorisé."}, status=status.HTTP_403_FORBIDDEN)
            
        if parcel.payment_status in ['escrow', 'paid']:
            return Response({"error": "Cette expédition est déjà payée."}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            import urllib.parse
            amount_to_pay = max(100, int(parcel.zemy_commission))
            description = f"Commission Zemy colis {parcel.ride.departure_location} -> {parcel.ride.arrival_location}"
            
            import time
            # Construire l'URL absolue vers notre page de checkout de paiement
            path = (
                f"/payments/checkout/"
                f"?amount={amount_to_pay}"
                f"&custom_id={parcel.id}"
                f"&fullname={urllib.parse.quote(parcel.sender_user.full_name or 'Client Zemy')}"
                f"&email={urllib.parse.quote(parcel.sender_user.email or 'client@zemy.bj')}"
                f"&phone={urllib.parse.quote(parcel.sender_user.phone or '')}"
                f"&description={urllib.parse.quote(description)}"
                f"&_t={int(time.time())}"
            )
            url = request.build_absolute_uri(path)
            
            # Retourner l'URL de paiement
            return Response({
                "url": url, 
                "parcel_id": str(parcel.id),
                "amount": amount_to_pay
            })
            
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'], url_path='scan_qr')
    def scan_qr(self, request, pk=None):
        parcel = self.get_object()
        qr_data = request.data.get('qr_code_data')
        action_type = request.data.get('action') # 'pickup' or 'dropoff'
        
        if not qr_data or qr_data != parcel.qr_code_data:
            return Response({"error": "QR Code invalide."}, status=status.HTTP_400_BAD_REQUEST)
            
        if request.user != parcel.ride.driver and not request.user.is_staff:
            return Response({"error": "Non autorisé."}, status=status.HTTP_403_FORBIDDEN)
            
        if action_type == 'pickup':
            if parcel.status != 'accepted' and parcel.status != 'pending':
                return Response({"error": "Statut invalide pour la récupération."}, status=status.HTTP_400_BAD_REQUEST)
            parcel.status = 'picked_up'
            parcel.save()
            if parcel.sender_user:
                create_and_send_notification(
                    user=parcel.sender_user,
                    title="Colis récupéré 📦",
                    message=f"Le conducteur a récupéré votre colis.",
                    data={'type': 'parcel_picked_up', 'parcel_id': str(parcel.id), 'screen': 'trips'}
                )
            
        elif action_type == 'dropoff':
            if parcel.status not in ['picked_up', 'in_transit']:
                return Response({"error": "Statut invalide pour la livraison."}, status=status.HTTP_400_BAD_REQUEST)
            parcel.status = 'delivered'
            parcel.payment_status = 'paid'
            parcel.save()
            
            # Create Transaction for Wallet
            from ..models import Transaction
            Transaction.objects.create(
                user=parcel.ride.driver,
                parcel=parcel,
                transaction_type='parcel',
                amount=parcel.driver_payout,
                status='completed'
            )
            
            # Update user stats
            driver = parcel.ride.driver
            driver.parcels_completed += 1
            driver.save(update_fields=['parcels_completed'])
            
            if parcel.sender_user:
                create_and_send_notification(
                    user=parcel.sender_user,
                    title="Colis livré ✅",
                    message=f"Votre colis a été livré avec succès.",
                    data={'type': 'parcel_delivered', 'parcel_id': str(parcel.id), 'screen': 'trips'}
                )
            
        return Response({"status": f"Colis mis à jour : {parcel.status}"})

