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

@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def payment_callback(request):
    """
    Endpoint de redirection FedaPay.
    Reçoit la redirection après paiement et redirige le navigateur du mobile vers le schéma deep link 'zemy://'.
    """
    booking_id = request.GET.get('booking_id')
    parcel_id = request.GET.get('parcel_id')
    redirect_to = request.GET.get('redirect_to')
    
    if redirect_to:
        import urllib.parse
        parsed_redirect = urllib.parse.urlparse(redirect_to)
        query_params = urllib.parse.parse_qs(parsed_redirect.query)
        if booking_id and 'booking_id' not in query_params:
            query_params['booking_id'] = [booking_id]
        if parcel_id and 'parcel_id' not in query_params:
            query_params['parcel_id'] = [parcel_id]
        
        new_query = urllib.parse.urlencode(query_params, doseq=True)
        parsed_redirect = parsed_redirect._replace(query=new_query)
        redirect_url = urllib.parse.urlunparse(parsed_redirect)
    else:
        app_scheme = "zemy://payments"
        redirect_url = app_scheme
        if booking_id:
            redirect_url += f"?booking_id={booking_id}"
        elif parcel_id:
            redirect_url += f"?parcel_id={parcel_id}"
        
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>Redirection Zemy...</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
            body {{
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                height: 100vh;
                margin: 0;
                background-color: #F9FAFB;
                color: #1F2937;
                text-align: center;
                padding: 20px;
            }}
            .spinner {{
                border: 4px solid rgba(0, 0, 0, 0.1);
                width: 36px;
                height: 36px;
                border-radius: 50%;
                border-left-color: #2F80ED;
                animation: spin 1s linear infinite;
                margin-bottom: 20px;
            }}
            @keyframes spin {{
                0% {{ transform: rotate(0deg); }}
                100% {{ transform: rotate(360deg); }}
            }}
            h2 {{
                font-size: 20px;
                font-weight: 600;
                margin: 0 0 10px 0;
            }}
            p {{
                font-size: 14px;
                color: #6B7280;
                margin: 0 0 20px 0;
            }}
            a {{
                color: #2F80ED;
                text-decoration: none;
                font-weight: 500;
            }}
        </style>
        <script>
            window.onload = function() {{
                // Redirection vers le deep link
                window.location.href = "{redirect_url}";
                
                // Fallback de sécurité au bout de 2 secondes
                setTimeout(function() {{
                    document.getElementById('fallback').style.display = 'block';
                }}, 2000);
            }};
        </script>
    </head>
    <body>
        <div class="spinner"></div>
        <h2>Redirection vers l'application...</h2>
        <p>Votre paiement a été traité. Nous vous ramenons vers l'application Zemy.</p>
        <div id="fallback" style="display: none;">
            <p>Si la redirection ne fonctionne pas, <a href="{redirect_url}">cliquez ici pour revenir à l'application</a>.</p>
        </div>
    </body>
    </html>
    """
    from django.http import HttpResponse
    return HttpResponse(html_content, content_type="text/html; charset=utf-8")


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def sync_payments(request):
    """
    Endpoint de synchronisation appelé par l'application mobile.
    Vérifie tous les paiements PENDING de l'utilisateur connecté via FedaPay.
    """
    from django.db import transaction
    from ..models import Payment
    from ..services.fedapay_service import FedaPayService
    
    user = request.user
    pending_payments = Payment.objects.filter(user=user, status='PENDING')
    updated_payments = []
    
    for payment in pending_payments:
        transaction_id = payment.transaction_id
        if not transaction_id:
            continue
            
        try:
            transaction_data = FedaPayService.get_transaction_details(transaction_id)
            tx_status = transaction_data.get('status', '').lower()
            
            if tx_status == 'approved':
                with transaction.atomic():
                    payment_locked = Payment.objects.select_for_update().filter(id=payment.id).first()
                    if not payment_locked or payment_locked.status == 'SUCCESS':
                        continue
                        
                    payment_locked.status = 'SUCCESS'
                    from django.utils import timezone
                    payment_locked.last_verification_at = timezone.now()
                    payment_locked.save()
                    
                    # Valider Booking
                    if payment_locked.booking:
                        booking = payment_locked.booking
                        if booking.payment_status != 'escrow':
                            booking.payment_status = 'escrow'
                            booking.status = 'confirmed'
                            booking.save()
                            
                            amount_due = int(booking.amount_due_to_driver)
                            commission = int(booking.amount_paid_online)
                            
                            create_and_send_notification(
                                user=booking.passenger,
                                title="Réservation confirmée ✅",
                                message=f"Commission de {commission} FCFA payée. Prévoyez {amount_due} FCFA en espèces à remettre au conducteur pour le trajet {booking.ride.departure_location} -> {booking.ride.arrival_location}.",
                                data={'type': 'payment_confirmed', 'booking_id': str(booking.id), 'screen': 'trips'}
                            )
                            
                            if booking.ride.driver_details:
                                create_and_send_notification(
                                    user=booking.ride.driver_details,
                                    title="Nouvelle Réservation 🚗",
                                    message=f"{booking.passenger.full_name} a réservé {booking.seats_booked} place(s). Il/Elle vous paiera {amount_due} FCFA en espèces lors du trajet.",
                                    data={'type': 'new_booking', 'booking_id': str(booking.id), 'screen': 'rides'}
                                )
                                
                    # Valider Parcel
                    if payment_locked.parcel:
                        parcel = payment_locked.parcel
                        if parcel.payment_status != 'escrow':
                            parcel.payment_status = 'escrow'
                            parcel.status = 'accepted'
                            parcel.save()
                            
                            amount_due = parcel.driver_payout
                            create_and_send_notification(
                                user=parcel.ride.driver,
                                title="Nouveau Colis Confirmé 📦",
                                message=f"{parcel.sender_name} a confirmé l'envoi d'un colis. Vous recevrez {amount_due} FCFA en espèces.",
                                data={'type': 'parcel_confirmed', 'parcel_id': str(parcel.id), 'screen': 'rides'}
                            )
                            
                    updated_payments.append({
                        "transaction_id": transaction_id,
                        "status": "SUCCESS",
                        "booking_id": str(payment_locked.booking.id) if payment_locked.booking else None,
                        "parcel_id": str(payment_locked.parcel.id) if payment_locked.parcel else None
                    })
                    
            elif tx_status in ['declined', 'failed', 'canceled', 'refunded']:
                new_status = 'FAILED'
                if tx_status == 'canceled':
                    new_status = 'CANCELLED'
                elif tx_status == 'refunded':
                    new_status = 'REFUNDED'
                    
                payment.status = new_status
                from django.utils import timezone
                payment.last_verification_at = timezone.now()
                payment.save()
                updated_payments.append({
                    "transaction_id": transaction_id,
                    "status": new_status,
                })
        except Exception as e:
            # Ignore FedaPay errors during silent sync
            print(f"Error syncing transaction {transaction_id}: {e}")
            pass

    return Response({
        "synced_count": len(updated_payments),
        "updates": updated_payments
    })


@extend_schema(responses={200: dict}, tags=['Statistiques'])
@extend_schema(responses={200: dict}, tags=['Statistiques'])

class FinancialSettingsViewSet(viewsets.ModelViewSet):
    """
    ViewSet pour configurer les taux de commission globaux de Zemy.
    """
    from ..models import FinancialSettings
    queryset = FinancialSettings.objects.all()
    serializer_class = FinancialSettingsSerializer

    def get_permissions(self):
        if self.request.method in permissions.SAFE_METHODS:
            return [permissions.IsAuthenticated()]
        return [permissions.IsAdminUser()]

    def get_queryset(self):
        return self.queryset.filter(pk=1)

class RefundRequestViewSet(viewsets.ModelViewSet):
    """
    ViewSet pour la gestion des litiges et demandes de remboursement.
    """
    from ..models import RefundRequest
    queryset = RefundRequest.objects.all().order_by('-created_at')
    serializer_class = RefundRequestSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_staff:
            return self.queryset
        return self.queryset.filter(Q(passenger=user) | Q(driver=user))

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        if not request.user.is_staff:
            return Response({"error": "Non autorisé."}, status=status.HTTP_403_FORBIDDEN)
        
        refund = self.get_object()
        if refund.status != 'pending':
            return Response({"error": "La demande n'est plus en attente."}, status=status.HTTP_400_BAD_REQUEST)
        
        refund.status = 'approved'
        refund.booking.payment_status = 'refunded'
        refund.booking.save()
        refund.save()
        
        create_and_send_notification(
            user=refund.passenger,
            title="Remboursement approuvé 💸",
            message=f"Votre demande de remboursement de {refund.amount} FCFA a été approuvée.",
            data={'type': 'refund_approved', 'refund_id': str(refund.id)}
        )
        return Response({"status": "Remboursement approuvé."})

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        if not request.user.is_staff:
            return Response({"error": "Non autorisé."}, status=status.HTTP_403_FORBIDDEN)
        
        refund = self.get_object()
        if refund.status != 'pending':
            return Response({"error": "La demande n'est plus en attente."}, status=status.HTTP_400_BAD_REQUEST)
        
        refund.status = 'rejected'
        # The money will go to the driver
        refund.booking.payment_status = 'paid'
        refund.booking.save()
        refund.save()
        
        create_and_send_notification(
            user=refund.passenger,
            title="Remboursement refusé ❌",
            message=f"Votre demande de remboursement de {refund.amount} FCFA a été refusée par l'administration.",
            data={'type': 'refund_rejected', 'refund_id': str(refund.id)}
        )
        return Response({"status": "Remboursement refusé."})

class TransactionViewSet(viewsets.ModelViewSet):
    """
    ViewSet gérant l'historique financier des utilisateurs (Portefeuille).
    """
    from ..models import Transaction
    queryset = Transaction.objects.all().order_by('-created_at')
    serializer_class = TransactionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_staff:
            return self.queryset
        return self.queryset.filter(user=user)



