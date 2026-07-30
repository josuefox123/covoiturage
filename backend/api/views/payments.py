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
    FinancialSettings, RefundRequest, Transaction, Parcel, Payment, PasswordResetOTP, PopularPlace,
    DriverPayout
)
from ..serializers import (
    UserSerializer, AdminUserSerializer, VehicleSerializer, UserPreferenceSerializer, 
    RideSerializer, BookingSerializer, ConversationSerializer, MessageSerializer, NotificationSerializer, AppBrandingSerializer,
    VerificationRequestSerializer, PromotionSerializer, MobileSettingsSerializer,
    FinancialSettingsSerializer, RefundRequestSerializer, TransactionSerializer, ParcelSerializer, PopularPlaceSerializer,
    DriverPayoutSerializer
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
def payment_checkout(request):
    """
    Rend la page HTML de checkout FeexPay qui charge le SDK React V2.
    """
    from django.shortcuts import render
    amount = request.GET.get('amount', '0')
    custom_id = request.GET.get('custom_id', '')
    description = request.GET.get('description', 'Paiement Zemy')
    fullname = request.GET.get('fullname', '')
    email = request.GET.get('email', '')
    phone = request.GET.get('phone', '')
    
    context = {
        "merchant_id": settings.FEEXPAY_MERCHANT_ID,
        "api_token": settings.FEEXPAY_API_TOKEN,
        "mode": settings.FEEXPAY_MODE,
        "amount": amount,
        "custom_id": custom_id,
        "description": description,
        "fullname": fullname,
        "email": email,
        "phone": phone,
    }
    response = render(request, 'api/payment_checkout.html', context)
    response['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    response['Pragma'] = 'no-cache'
    response['Expires'] = '0'
    return response


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def confirm_payment(request):
    """
    Endpoint de confirmation sécurisée appelé par le frontend après succès FeexPay.
    Vérifie la transaction auprès de FeexPay et confirme la réservation ou le colis.
    """
    from ..services.feexpay_service import FeexPayService
    from django.db import transaction
    
    reservation_id = request.data.get('reservation_id') or request.data.get('booking_id')
    parcel_id = request.data.get('parcel_id')
    transaction_id = request.data.get('transaction_id')
    montant = request.data.get('montant')
    payment_method = request.data.get('payment_method', 'local_money')
    
    if not transaction_id:
        return Response({"error": "transaction_id requis."}, status=status.HTTP_400_BAD_REQUEST)
        
    if not reservation_id and not parcel_id:
        return Response({"error": "reservation_id ou parcel_id requis."}, status=status.HTTP_400_BAD_REQUEST)
        
    try:
        # 1. Vérification auprès de FeexPay
        tx_data = FeexPayService.get_transaction_details(transaction_id)
        tx_status = tx_data.get('status', '').upper()
        
        if tx_status not in ['SUCCESSFUL', 'SUCCESS', 'APPROVED']:
            Payment.objects.filter(transaction_id=transaction_id).update(
                status='FAILED',
                last_verification_at=timezone.now()
            )
            if reservation_id:
                Booking.objects.filter(id=reservation_id).update(status='pending', payment_status='pending')
            elif parcel_id:
                Parcel.objects.filter(id=parcel_id).update(status='cancelled', payment_status='pending')
                
            return Response({"error": f"La transaction n'est pas approuvée sur FeexPay. Statut: {tx_status}"}, status=status.HTTP_400_BAD_REQUEST)
            
        # 2. Traitement atomique de confirmation de réservation
        with transaction.atomic():
            payment, created = Payment.objects.select_for_update().get_or_create(
                transaction_id=transaction_id,
                defaults={
                    'amount': int(tx_data.get('amount', montant or 0)),
                    'user': request.user,
                    'status': 'PENDING',
                    'provider': 'feexpay'
                }
            )
            
            if payment.status == 'SUCCESS':
                return Response({"already_processed": True, "message": "Paiement déjà validé avec succès."})
                
            payment.status = 'SUCCESS'
            payment.last_verification_at = timezone.now()
            payment.verification_attempts += 1
            
            if reservation_id:
                booking = Booking.objects.select_for_update().filter(id=reservation_id).first()
                if not booking:
                    return Response({"error": "Réservation introuvable."}, status=status.HTTP_404_NOT_FOUND)
                
                payment.booking = booking
                payment.save()
                
                if booking.payment_status != 'escrow':
                    from ..bookings.services import BookingService
                    # Décrémenter les places sur les segments concernés
                    allocated = BookingService.allocate_seats(booking)
                    if not allocated:
                        booking.status = 'cancelled'
                        booking.payment_status = 'pending'
                        booking.save()
                        return Response({"error": "Désolé, les places ne sont plus disponibles. Contactez le support pour remboursement."}, status=status.HTTP_400_BAD_REQUEST)
                    
                    booking.payment_status = 'escrow'
                    booking.status = 'confirmed'
                    booking.transaction_id = transaction_id
                    booking.save()
                    
                    # Créer l'écriture financière (Transaction historique)
                    amount_paid = int(booking.amount_paid_online)
                    amount_due = int(booking.amount_due_to_driver)
                    zemy_commission = int(booking.zemy_commission)
                    
                    Transaction.objects.create(
                        user=booking.passenger,
                        ride=booking.ride,
                        transaction_type='ride',
                        amount=amount_paid,
                        driver_payout=amount_due,
                        zemy_commission=zemy_commission,
                        total_price=booking.total_amount,
                        status='completed'
                    )
                    
                    # Envoyer les notifications
                    create_and_send_notification(
                        user=booking.passenger,
                        title="Réservation confirmée ✅",
                        message=f"Paiement de {booking.total_amount} FCFA validé. Votre réservation est confirmée pour le trajet {booking.ride.departure_location} -> {booking.ride.arrival_location}.",
                        data={'type': 'payment_confirmed', 'booking_id': str(booking.id), 'screen': 'trips'}
                    )
                    
                    if booking.ride.driver:
                        create_and_send_notification(
                            user=booking.ride.driver,
                            title="Nouvelle Réservation 🚗",
                            message=f"{booking.passenger.full_name} a réservé {booking.seats_booked} place(s). Votre gain de {amount_due} FCFA est crédité sur votre compte Zemy.",
                            data={'type': 'new_booking', 'booking_id': str(booking.id), 'screen': 'rides'}
                        )
                        
            elif parcel_id:
                parcel = Parcel.objects.select_for_update().filter(id=parcel_id).first()
                if not parcel:
                    return Response({"error": "Colis introuvable."}, status=status.HTTP_404_NOT_FOUND)
                
                payment.parcel = parcel
                payment.save()
                
                if parcel.payment_status != 'escrow':
                    parcel.payment_status = 'escrow'
                    parcel.status = 'accepted'
                    parcel.save()
                    
                    # Créer l'écriture financière (Transaction historique)
                    Transaction.objects.create(
                        user=parcel.sender_user,
                        ride=parcel.ride,
                        parcel=parcel,
                        transaction_type='parcel',
                        amount=parcel.zemy_commission,
                        driver_payout=parcel.driver_payout,
                        zemy_commission=parcel.zemy_commission,
                        total_price=parcel.price,
                        status='completed'
                    )
                    
                    # Notifications
                    amount_due = parcel.driver_payout
                    create_and_send_notification(
                        user=parcel.ride.driver,
                        title="Nouveau Colis Confirmé 📦",
                        message=f"{parcel.sender_name} a confirmé l'envoi d'un colis. Vous recevrez {amount_due} FCFA en espèces.",
                        data={'type': 'parcel_confirmed', 'parcel_id': str(parcel.id), 'screen': 'rides'}
                    )
                    
                    if parcel.sender_user:
                        create_and_send_notification(
                            user=parcel.sender_user,
                            title="Colis payé et validé 📦",
                            message=f"Le paiement de votre colis a été validé. Le conducteur transportera votre colis sur le trajet.",
                            data={'type': 'parcel_confirmed_sender', 'parcel_id': str(parcel.id), 'screen': 'trips'}
                        )
                        
            return Response({"status": "Paiement validé et réservation confirmée avec succès."})
            
    except Exception as e:
        logger.error(f"Error confirming payment {transaction_id}: {e}")
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def sync_payments(request):
    """
    Endpoint de synchronisation appelé par l'application mobile.
    Vérifie tous les paiements PENDING de l'utilisateur connecté via FeexPay.
    """
    from django.db import transaction
    from ..models import Payment
    from ..services.feexpay_service import FeexPayService
    
    user = request.user
    pending_payments = Payment.objects.filter(user=user, status='PENDING')
    updated_payments = []
    
    for payment in pending_payments:
        transaction_id = payment.transaction_id
        if not transaction_id:
            continue
            
        try:
            transaction_data = FeexPayService.get_transaction_details(transaction_id)
            tx_status = transaction_data.get('status', '').upper()
            
            if tx_status in ['SUCCESSFUL', 'SUCCESS', 'APPROVED']:
                with transaction.atomic():
                    payment_locked = Payment.objects.select_for_update().filter(id=payment.id).first()
                    if not payment_locked or payment_locked.status == 'SUCCESS':
                        continue
                        
                    payment_locked.status = 'SUCCESS'
                    payment_locked.last_verification_at = timezone.now()
                    payment_locked.save()
                    
                    # Valider Booking
                    if payment_locked.booking:
                        booking = payment_locked.booking
                        if booking.payment_status != 'escrow':
                            from api.models import Ride
                            ride = Ride.objects.select_for_update().get(id=booking.ride.id)
                            ride.seats_available -= booking.seats_booked
                            ride.save()

                            booking.payment_status = 'escrow'
                            booking.status = 'confirmed'
                            booking.save()
                            
                            amount_due = int(booking.amount_due_to_driver)
                            create_and_send_notification(
                                user=booking.passenger,
                                title="Réservation confirmée ✅",
                                message=f"Paiement de {booking.total_amount} FCFA validé. Votre réservation est confirmée.",
                                data={'type': 'payment_confirmed', 'booking_id': str(booking.id), 'screen': 'trips'}
                            )
                            
                            if booking.ride.driver:
                                create_and_send_notification(
                                    user=booking.ride.driver,
                                    title="Nouvelle Réservation 🚗",
                                    message=f"{booking.passenger.full_name} a réservé {booking.seats_booked} place(s). Votre gain de {amount_due} FCFA est crédité sur votre compte Zemy.",
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
                                message=f"{parcel.sender_name} a confirmé l'envoi d'un colis.",
                                data={'type': 'parcel_confirmed', 'parcel_id': str(parcel.id), 'screen': 'rides'}
                            )
                            
                    updated_payments.append({
                        "transaction_id": transaction_id,
                        "status": "SUCCESS",
                        "booking_id": str(payment_locked.booking.id) if payment_locked.booking else None,
                        "parcel_id": str(payment_locked.parcel.id) if payment_locked.parcel else None
                    })
                    
            elif tx_status in ['DECLINED', 'FAILED', 'CANCELED', 'CANCELLED', 'REFUNDED']:
                new_status = 'FAILED'
                if tx_status in ['CANCELED', 'CANCELLED']:
                    new_status = 'CANCELLED'
                elif tx_status == 'REFUNDED':
                    new_status = 'REFUNDED'
                    
                payment.status = new_status
                payment.last_verification_at = timezone.now()
                payment.save()
                
                # Mettre à jour la réservation
                if payment.booking:
                    payment.booking.status = 'cancelled'
                    payment.booking.save()
                elif payment.parcel:
                    payment.parcel.status = 'cancelled'
                    payment.parcel.save()

                updated_payments.append({
                    "transaction_id": transaction_id,
                    "status": new_status,
                })
        except Exception as e:
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


class PaymentViewSet(viewsets.ModelViewSet):
    """
    ViewSet pour la gestion et l'affichage des paiements dans le dashboard d'administration.
    Prend en charge le listing, le filtrage, la recherche et l'export Excel/PDF.
    """
    from ..models import Payment
    from ..serializers import PaymentSerializer
    queryset = Payment.objects.all().order_by('-created_at')
    serializer_class = PaymentSerializer
    permission_classes = [permissions.IsAdminUser]

    def get_queryset(self):
        queryset = self.queryset.select_related('user', 'booking', 'parcel')
        
        status_filter = self.request.query_params.get('status')
        provider_filter = self.request.query_params.get('provider')
        user_phone = self.request.query_params.get('user_phone')
        search = self.request.query_params.get('search')
        
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        if provider_filter:
            queryset = queryset.filter(provider=provider_filter)
        if user_phone:
            queryset = queryset.filter(user__phone__icontains=user_phone)
        if search:
            queryset = queryset.filter(
                Q(transaction_id__icontains=search) |
                Q(user__full_name__icontains=search) |
                Q(user__phone__icontains=search)
            )
            
        return queryset

    @action(detail=False, methods=['get'], url_path='export-excel')
    def export_excel(self, request):
        import openpyxl
        from django.http import HttpResponse
        
        payments = self.get_queryset()
        
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Paiements Zemy"
        
        headers = ["ID Transaction", "Date", "Utilisateur", "Téléphone", "Montant (FCFA)", "Service", "Statut", "Fournisseur"]
        ws.append(headers)
        
        for p in payments:
            service = "Trajet" if p.booking else ("Colis" if p.parcel else "Autre")
            ws.append([
                p.transaction_id,
                p.created_at.strftime("%d/%m/%Y %H:%M") if p.created_at else "",
                p.user.full_name if p.user else "",
                p.user.phone if p.user else "",
                p.amount,
                service,
                p.status,
                p.provider
            ])
            
        response = HttpResponse(content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        response['Content-Disposition'] = 'attachment; filename=paiements_zemy.xlsx'
        wb.save(response)
        return response

    @action(detail=False, methods=['get'], url_path='export-pdf')
    def export_pdf(self, request):
        from reportlab.lib.pagesizes import letter
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib import colors
        from django.http import HttpResponse
        
        payments = self.get_queryset()
        
        response = HttpResponse(content_type='application/pdf')
        response['Content-Disposition'] = 'attachment; filename=paiements_zemy.pdf'
        
        doc = SimpleDocTemplate(response, pagesize=letter, rightMargin=30, leftMargin=30, topMargin=30, bottomMargin=30)
        elements = []
        
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            'TitleStyle',
            parent=styles['Heading1'],
            fontSize=24,
            leading=28,
            textColor=colors.HexColor('#2F80ED'),
            alignment=1,
            spaceAfter=20
        )
        
        elements.append(Paragraph("Rapport des Paiements - ZEMY", title_style))
        elements.append(Spacer(1, 10))
        
        data = [["ID Trans.", "Date", "Utilisateur", "Montant", "Type", "Statut"]]
        for p in payments:
            service = "Trajet" if p.booking else ("Colis" if p.parcel else "Autre")
            name = (p.user.full_name or p.user.phone)[:15] if p.user else ""
            data.append([
                p.transaction_id[:12] + "..." if len(p.transaction_id) > 12 else p.transaction_id,
                p.created_at.strftime("%d/%m/%y") if p.created_at else "",
                name,
                f"{p.amount} XOF",
                service,
                p.status
            ])
            
        t = Table(data, colWidths=[100, 60, 110, 80, 70, 70])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#2F80ED')),
            ('TEXTCOLOR', (0,0), (-1,0), colors.white),
            ('ALIGN', (0,0), (-1,-1), 'CENTER'),
            ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
            ('FONTSIZE', (0,0), (-1,0), 10),
            ('BOTTOMPADDING', (0,0), (-1,0), 8),
            ('BACKGROUND', (0,1), (-1,-1), colors.HexColor('#F9FAFB')),
            ('GRID', (0,0), (-1,-1), 1, colors.HexColor('#E5E7EB')),
            ('FONTSIZE', (0,1), (-1,-1), 9),
        ]))
        
        elements.append(t)
        doc.build(elements)
        return response

    @action(detail=False, methods=['get'], url_path='my-history', permission_classes=[permissions.IsAuthenticated])
    def my_history(self, request):
        """
        Retourne l'historique des paiements réussis de l'utilisateur connecté.
        """
        from ..models import Payment
        from ..serializers import UserPaymentSerializer
        payments = Payment.objects.filter(
            user=request.user, status='SUCCESS'
        ).select_related('booking__ride', 'parcel').order_by('-created_at')
        serializer = UserPaymentSerializer(payments, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'], url_path='receipt', permission_classes=[permissions.IsAuthenticated])
    def receipt(self, request, pk=None):
        """
        Génère un reçu PDF au format Zemy pour un paiement réussi de l'utilisateur.
        """
        from ..models import Payment
        from reportlab.lib.pagesizes import A4
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib import colors
        from reportlab.lib.units import mm
        from django.http import HttpResponse
        import io

        try:
            payment = Payment.objects.select_related('user', 'booking__ride', 'parcel').get(pk=pk)
        except Payment.DoesNotExist:
            return Response({"error": "Paiement introuvable."}, status=status.HTTP_404_NOT_FOUND)

        if payment.user != request.user and not request.user.is_staff:
            return Response({"error": "Non autorisé."}, status=status.HTTP_403_FORBIDDEN)

        if payment.status != 'SUCCESS':
            return Response({"error": "Ce paiement n'a pas été complété."}, status=status.HTTP_400_BAD_REQUEST)

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer, pagesize=A4,
            rightMargin=20*mm, leftMargin=20*mm,
            topMargin=20*mm, bottomMargin=20*mm
        )
        elements = []
        styles = getSampleStyleSheet()

        # Color palette
        PRIMARY = colors.HexColor('#16A34A')  # Zemy green
        PRIMARY_DARK = colors.HexColor('#15803D')
        LIGHT_BG = colors.HexColor('#F0FDF4')
        MUTED = colors.HexColor('#6B7280')
        DARK = colors.HexColor('#111827')

        # --- HEADER ---
        header_style = ParagraphStyle('Header', fontSize=32, textColor=PRIMARY, fontName='Helvetica-Bold',
                                       alignment=1, spaceAfter=2)
        sub_style = ParagraphStyle('Sub', fontSize=10, textColor=MUTED, fontName='Helvetica',
                                    alignment=1, spaceAfter=14)
        elements.append(Paragraph("ZEMY", header_style))
        elements.append(Paragraph("Reçu de paiement officiel", sub_style))
        elements.append(HRFlowable(width="100%", thickness=2, color=PRIMARY, spaceAfter=14))

        # --- STATUS BADGE ---
        status_style = ParagraphStyle('Status', fontSize=14, textColor=PRIMARY_DARK,
                                       fontName='Helvetica-Bold', alignment=1, spaceAfter=12,
                                       backColor=LIGHT_BG, borderPadding=(8, 14, 8, 14))
        elements.append(Paragraph("✓ PAIEMENT CONFIRMÉ", status_style))
        elements.append(Spacer(1, 8*mm))

        # --- AMOUNT ---
        amount_style = ParagraphStyle('Amount', fontSize=28, textColor=DARK,
                                       fontName='Helvetica-Bold', alignment=1, spaceAfter=2)
        currency_style = ParagraphStyle('Currency', fontSize=12, textColor=MUTED,
                                         fontName='Helvetica', alignment=1, spaceAfter=16)
        elements.append(Paragraph(f"{payment.amount:,} XOF".replace(",", " "), amount_style))
        elements.append(Paragraph("Montant total payé", currency_style))
        elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#E5E7EB'), spaceAfter=12))

        # --- TRANSACTION DETAILS ---
        section_style = ParagraphStyle('Section', fontSize=11, textColor=PRIMARY_DARK,
                                        fontName='Helvetica-Bold', spaceAfter=8, spaceBefore=12)
        cell_style = ParagraphStyle('Cell', fontSize=10, textColor=DARK, fontName='Helvetica')
        cell_muted = ParagraphStyle('CellMuted', fontSize=10, textColor=MUTED, fontName='Helvetica')

        elements.append(Paragraph("Détails de la transaction", section_style))

        service = "Trajet" if payment.booking else ("Colis" if payment.parcel else "Service")
        if payment.booking and payment.booking.ride:
            ride = payment.booking.ride
            service_detail = f"Trajet — {ride.departure_location} → {ride.arrival_location}"
            date_trajet = ride.departure_date.strftime('%d/%m/%Y') if ride.departure_date else "—"
        elif payment.parcel:
            service_detail = f"Colis — {payment.parcel.id}"
            date_trajet = "—"
        else:
            service_detail = "Service Zemy"
            date_trajet = "—"

        details_data = [
            [Paragraph("Référence", cell_muted), Paragraph(payment.transaction_id, cell_style)],
            [Paragraph("Service", cell_muted), Paragraph(service_detail, cell_style)],
            [Paragraph("Date du trajet", cell_muted), Paragraph(date_trajet, cell_style)],
            [Paragraph("Date du paiement", cell_muted), Paragraph(
                payment.created_at.strftime('%d/%m/%Y à %H:%M') if payment.created_at else "—",
                cell_style
            )],
            [Paragraph("Moyen de paiement", cell_muted), Paragraph("Mobile Money (FeexPay)", cell_style)],
            [Paragraph("Statut", cell_muted), Paragraph("✓ Payé", ParagraphStyle(
                'Paid', fontSize=10, textColor=PRIMARY, fontName='Helvetica-Bold'
            ))],
        ]

        details_table = Table(details_data, colWidths=[55*mm, 110*mm])
        details_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#F9FAFB')),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E5E7EB')),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('LEFTPADDING', (0, 0), (-1, -1), 10),
            ('RIGHTPADDING', (0, 0), (-1, -1), 10),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        elements.append(details_table)
        elements.append(Spacer(1, 10*mm))

        # --- USER INFO ---
        user_obj = payment.user
        if user_obj:
            elements.append(Paragraph("Informations du payeur", section_style))
            user_data = [
                [Paragraph("Nom complet", cell_muted), Paragraph(user_obj.full_name or "—", cell_style)],
                [Paragraph("Téléphone", cell_muted), Paragraph(user_obj.phone or "—", cell_style)],
                [Paragraph("Email", cell_muted), Paragraph(user_obj.email or "—", cell_style)],
            ]
            user_table = Table(user_data, colWidths=[55*mm, 110*mm])
            user_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#F9FAFB')),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E5E7EB')),
                ('TOPPADDING', (0, 0), (-1, -1), 8),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
                ('LEFTPADDING', (0, 0), (-1, -1), 10),
                ('RIGHTPADDING', (0, 0), (-1, -1), 10),
            ]))
            elements.append(user_table)

        # --- FOOTER ---
        elements.append(Spacer(1, 12*mm))
        elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#E5E7EB'), spaceAfter=8))
        footer_style = ParagraphStyle('Footer', fontSize=8, textColor=MUTED,
                                       fontName='Helvetica', alignment=1)
        elements.append(Paragraph("Ce reçu est un document officiel généré automatiquement par Zemy.", footer_style))
        elements.append(Paragraph("Pour toute réclamation : zemy@sinustic.com | www.zemy.bj", footer_style))
        elements.append(Paragraph(
            f"Généré le {payment.created_at.strftime('%d/%m/%Y à %H:%M') if payment.created_at else ''}",
            footer_style
        ))

        doc.build(elements)
        buffer.seek(0)

        tx_short = payment.transaction_id[:12] if payment.transaction_id else "recu"
        http_response = HttpResponse(buffer.read(), content_type='application/pdf')
        http_response['Content-Disposition'] = f'attachment; filename=recu_zemy_{tx_short}.pdf'
        return http_response


class DriverEarningsView(APIView):
    """
    GET /api/driver/earnings/
    Retourne la liste des revenus du conducteur connecté :
    - Trajets terminés avec passagers confirmés (montant réclamable)
    - Trajets déjà réclamés (avec statut)
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user

        # Trajets terminés conduits par cet utilisateur
        completed_rides = Ride.objects.filter(
            driver=user,
            status='completed'
        ).prefetch_related('bookings', 'driver_payouts')

        earnings = []
        total_earned = 0
        total_claimable = 0
        total_paid_out = 0

        for ride in completed_rides:
            # Passagers confirmés et payés (en escrow)
            confirmed_bookings = ride.bookings.filter(
                status='completed',
                payment_status__in=['escrow', 'paid']
            )
            if not confirmed_bookings.exists():
                continue

            # Montant total dû au conducteur (somme de tous les bookings confirmés)
            amount_due = sum(b.amount_due_to_driver for b in confirmed_bookings)
            total_earned += amount_due

            # Vérifier s'il y a déjà un payout pour ce trajet
            existing_payout = ride.driver_payouts.filter(driver=user).first()

            ride_data = {
                'ride_id': str(ride.id),
                'departure_location': ride.departure_location,
                'arrival_location': ride.arrival_location,
                'departure_date': str(ride.departure_date),
                'confirmed_passengers': confirmed_bookings.count(),
                'amount_due': amount_due,
                'payout': None,
            }

            if existing_payout:
                ride_data['payout'] = {
                    'id': str(existing_payout.id),
                    'status': existing_payout.status,
                    'phone_number': existing_payout.phone_number,
                    'requested_at': existing_payout.requested_at.isoformat(),
                    'paid_at': existing_payout.paid_at.isoformat() if existing_payout.paid_at else None,
                }
                if existing_payout.status == 'paid':
                    total_paid_out += amount_due
                else:
                    total_claimable += amount_due
            else:
                total_claimable += amount_due

            earnings.append(ride_data)

        return Response({
            'earnings': earnings,
            'summary': {
                'total_earned': total_earned,
                'total_claimable': total_claimable,
                'total_paid_out': total_paid_out,
            }
        })


class DriverClaimPayoutView(APIView):
    """
    POST /api/driver/claim/
    Soumet une demande de virement pour un trajet terminé.
    Body: { ride_id, phone_number }
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        ride_id = request.data.get('ride_id')
        phone_number = request.data.get('phone_number', '').strip()

        if not ride_id:
            return Response({'error': 'ride_id est requis.'}, status=status.HTTP_400_BAD_REQUEST)

        if not phone_number:
            return Response({'error': 'Le numéro Mobile Money est requis.'}, status=status.HTTP_400_BAD_REQUEST)

        # Vérifier que le trajet appartient au conducteur et est terminé
        try:
            ride = Ride.objects.get(id=ride_id, driver=user, status='completed')
        except Ride.DoesNotExist:
            return Response(
                {'error': 'Trajet introuvable ou non terminé.'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Vérifier qu'il y a des passagers confirmés éligibles
        confirmed_bookings = ride.bookings.filter(
            status='completed',
            payment_status__in=['escrow', 'paid']
        )
        if not confirmed_bookings.exists():
            return Response(
                {'error': 'Aucun passager confirmé pour ce trajet. Le paiement ne peut pas être réclamé.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Vérifier qu'il n'existe pas déjà une demande en cours ou payée
        if DriverPayout.objects.filter(driver=user, ride=ride).exists():
            existing = DriverPayout.objects.get(driver=user, ride=ride)
            return Response(
                {
                    'error': f'Une demande de virement existe déjà pour ce trajet (statut: {existing.get_status_display()}).',
                    'payout_status': existing.status,
                },
                status=status.HTTP_409_CONFLICT
            )

        # Calculer le montant dû
        amount_due = sum(b.amount_due_to_driver for b in confirmed_bookings)

        # Créer la demande de payout
        payout = DriverPayout.objects.create(
            driver=user,
            ride=ride,
            amount=amount_due,
            phone_number=phone_number,
            status='pending',
        )

        logger.info(f"[PAYOUT] Conducteur {user.id} a réclamé {amount_due} XOF pour trajet {ride.id} → tel: {phone_number}")

        return Response({
            'success': True,
            'payout_id': str(payout.id),
            'amount': amount_due,
            'phone_number': phone_number,
            'status': payout.status,
            'message': f'Votre demande de virement de {amount_due} XOF a été soumise avec succès. Vous recevrez votre argent sous 24h sur le {phone_number}.'
        }, status=status.HTTP_201_CREATED)


class DriverPayoutViewSet(viewsets.ModelViewSet):
    """
    ViewSet pour la gestion des demandes de virement conducteur par l'administrateur.
    """
    queryset = DriverPayout.objects.all().order_by('-requested_at')
    serializer_class = DriverPayoutSerializer
    permission_classes = [permissions.IsAdminUser]

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        payout = self.get_object()
        if payout.status != 'pending':
            return Response({"error": "La demande n'est plus en attente."}, status=status.HTTP_400_BAD_REQUEST)
        
        payout.status = 'paid'
        payout.paid_at = timezone.now()
        admin_note = request.data.get('admin_note', '')
        if admin_note:
            payout.admin_note = admin_note
        payout.save()
        
        # Mettre à jour le statut des réservations du trajet pour ce conducteur en "paid"
        confirmed_bookings = payout.ride.bookings.filter(
            status='completed',
            payment_status='escrow'
        )
        for booking in confirmed_bookings:
            booking.payment_status = 'paid'
            booking.save()
            
        create_and_send_notification(
            user=payout.driver,
            title="Virement effectué 💰",
            message=f"Votre virement de {payout.amount} FCFA a été versé sur le numéro {payout.phone_number}.",
            data={'type': 'payout_completed', 'payout_id': str(payout.id)}
        )
        return Response({"status": "Demande de virement marquée comme payée."})

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        payout = self.get_object()
        if payout.status != 'pending':
            return Response({"error": "La demande n'est plus en attente."}, status=status.HTTP_400_BAD_REQUEST)
            
        payout.status = 'failed'
        admin_note = request.data.get('admin_note', '')
        if admin_note:
            payout.admin_note = admin_note
        payout.save()
        
        create_and_send_notification(
            user=payout.driver,
            title="Échec du virement ❌",
            message=f"Votre demande de virement de {payout.amount} FCFA a été rejetée. Note: {admin_note or 'Veuillez contacter le support.'}",
            data={'type': 'payout_failed', 'payout_id': str(payout.id)}
        )
        return Response({"status": "Demande de virement marquée comme échouée."})
