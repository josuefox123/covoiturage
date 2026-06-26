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
        if not user.is_staff:
            queryset = queryset.filter(Q(sender_user=user) | Q(ride__driver=user))
            
        ride_id = self.request.query_params.get('ride')
        if ride_id:
            queryset = queryset.filter(ride_id=ride_id)
        return queryset

    def perform_create(self, serializer):
        from rest_framework.exceptions import ValidationError
        from ..models import FinancialSettings
        import uuid
        
        if not self.request.user.is_verified:
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
        from ..services.fedapay_service import FedaPayService
        from ..models import Payment
        
        parcel = self.get_object()
        if parcel.sender_user != request.user and not request.user.is_staff:
            return Response({"error": "Non autorisé."}, status=status.HTTP_403_FORBIDDEN)
            
        if parcel.payment_status in ['escrow', 'paid']:
            return Response({"error": "Cette expédition est déjà payée."}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            import urllib.parse
            frontend_callback = request.data.get('callback_url') or 'zemy://payments'
            gateway_path = f'/api/payments/callback/?parcel_id={parcel.id}&redirect_to={urllib.parse.quote(frontend_callback)}'
            callback_url = get_valid_callback_url(request, gateway_path)

            amount_to_pay = max(100, int(parcel.zemy_commission))

            existing_payment = Payment.objects.filter(
                parcel=parcel, status='PENDING'
            ).order_by('-created_at').first()
            
            transaction_id = None
            if existing_payment and existing_payment.transaction_id:
                transaction_id = existing_payment.transaction_id
            
            if not transaction_id:
                customer_data = {
                    "firstname": parcel.sender_user.full_name or "Client",
                    "lastname": "Zemy",
                    "email": parcel.sender_user.email or "client@zemy.bj",
                    "phone_number": {
                        "number": parcel.sender_user.phone or "+22900000000",
                        "country": "bj"
                    }
                }
                description = f"Commission Zemy colis {parcel.ride.departure_location} -> {parcel.ride.arrival_location}"
                
                transaction_id = FedaPayService.create_transaction(
                    amount=amount_to_pay,
                    description=description,
                    customer_data=customer_data,
                    callback_url=callback_url,
                    metadata={"parcel_id": str(parcel.id)}
                )
                
            Payment.objects.update_or_create(
                transaction_id=str(transaction_id),
                defaults={
                    'amount': amount_to_pay,
                    'user': parcel.sender_user,
                    'parcel': parcel,
                    'status': 'PENDING',
                    'provider': 'fedapay'
                }
            )
                
            url = FedaPayService.generate_token(transaction_id)
            return Response({"url": url, "transaction_id": transaction_id})
            
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'], url_path='verify-payment')
    def verify_payment(self, request, pk=None):
        import requests
        from django.conf import settings
        from django.db import transaction
        from ..models import Payment
        
        parcel = self.get_object()
        payment = Payment.objects.filter(parcel=parcel).first()
        transaction_id = request.data.get('transaction_id') or (payment.transaction_id if payment else None)
        
        if not transaction_id:
            return Response({"error": "transaction_id requis."}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            payment = Payment.objects.filter(transaction_id=transaction_id).first()
            if payment and payment.status == 'SUCCESS':
                return Response({"already_processed": True, "status": "Paiement déjà validé avec succès."})
                
            from ..services.fedapay_service import FedaPayService
            try:
                transaction_data = FedaPayService.get_transaction_details(transaction_id)
            except Exception as e:
                return Response({"error": f"Impossible de récupérer la transaction: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)
                
            tx_status = transaction_data.get('status')
            
            if tx_status == 'approved':
                with transaction.atomic():
                    payment, created = Payment.objects.select_for_update().get_or_create(
                        transaction_id=transaction_id,
                        defaults={
                            'amount': int(transaction_data.get('amount', 0)),
                            'user': parcel.sender_user,
                            'parcel': parcel,
                            'status': 'PENDING',
                            'provider': 'fedapay'
                        }
                    )
                    
                    if payment.status == 'SUCCESS':
                        return Response({"already_processed": True, "status": "Paiement déjà validé avec succès."})
                        
                    from django.utils import timezone
                    payment.status = 'SUCCESS'
                    payment.last_verification_at = timezone.now()
                    payment.verification_attempts += 1
                    payment.save()
                    
                    if parcel.payment_status != 'escrow':
                        parcel.payment_status = 'escrow'
                        parcel.status = 'accepted'
                        parcel.save()
                        
                        amount_due = parcel.driver_payout
                        
                        from ..fcm import create_and_send_notification
                        create_and_send_notification(
                            user=parcel.ride.driver,
                            title="Nouveau Colis Confirmé 📦",
                            message=f"{parcel.sender_name} a confirmé l'envoi d'un colis. Vous recevrez {amount_due} FCFA en espèces.",
                            data={'type': 'parcel_confirmed', 'parcel_id': str(parcel.id), 'screen': 'rides'}
                        )
                        
                return Response({"status": "Paiement validé avec succès."})
            elif tx_status in ['pending', 'processing', 'started', 'waiting']:
                from django.utils import timezone
                from django.db import models
                Payment.objects.filter(transaction_id=transaction_id).update(
                    last_verification_at=timezone.now(),
                    verification_attempts=models.F('verification_attempts') + 1
                )
                
                tx_mode = transaction_data.get('mode')
                payment_not_started = (tx_status == 'pending' and not tx_mode)
                return Response({
                    "status": "pending",
                    "message": "Paiement en cours de validation." if not payment_not_started else "Le paiement n'a pas été complété sur FedaPay.",
                    "payment_not_started": payment_not_started,
                    "parcel_id": str(parcel.id)
                })
            else:
                new_status = 'PENDING'
                if tx_status in ['declined', 'failed']:
                    new_status = 'FAILED'
                elif tx_status == 'canceled':
                    new_status = 'CANCELLED'
                elif tx_status == 'refunded':
                    new_status = 'REFUNDED'
                
                from django.utils import timezone
                from django.db import models
                Payment.objects.filter(transaction_id=transaction_id).update(
                    status=new_status,
                    last_verification_at=timezone.now(),
                    verification_attempts=models.F('verification_attempts') + 1
                )
                return Response({"error": f"Le paiement a échoué (statut: {tx_status})."}, status=status.HTTP_400_BAD_REQUEST)
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

