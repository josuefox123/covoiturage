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
    return render(request, 'api/payment_checkout.html', context)


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
                    # Vérifier s'il y a assez de places disponibles
                    ride = Ride.objects.select_for_update().get(id=booking.ride.id)
                    if ride.seats_available < booking.seats_booked:
                        booking.status = 'cancelled'
                        booking.payment_status = 'pending'
                        booking.save()
                        return Response({"error": "Désolé, les places ne sont plus disponibles. Contactez le support pour remboursement."}, status=status.HTTP_400_BAD_REQUEST)
                    
                    # Décrémenter définitivement les places
                    ride.seats_available -= booking.seats_booked
                    ride.save()
                    
                    booking.payment_status = 'escrow'
                    booking.status = 'confirmed'
                    booking.transaction_id = transaction_id
                    booking.save()
                    
                    # Créer l'écriture financière (Transaction historique)
                    amount_due = int(booking.amount_due_to_driver)
                    commission = int(booking.amount_paid_online)
                    
                    Transaction.objects.create(
                        user=booking.passenger,
                        ride=booking.ride,
                        transaction_type='ride',
                        amount=commission,
                        driver_payout=amount_due,
                        zemy_commission=commission,
                        total_price=booking.total_amount,
                        status='completed'
                    )
                    
                    # Envoyer les notifications
                    create_and_send_notification(
                        user=booking.passenger,
                        title="Réservation confirmée ✅",
                        message=f"Commission de {commission} FCFA payée. Prévoyez {amount_due} FCFA en espèces à remettre au conducteur pour le trajet {booking.ride.departure_location} -> {booking.ride.arrival_location}.",
                        data={'type': 'payment_confirmed', 'booking_id': str(booking.id), 'screen': 'trips'}
                    )
                    
                    if booking.ride.driver:
                        create_and_send_notification(
                            user=booking.ride.driver,
                            title="Nouvelle Réservation 🚗",
                            message=f"{booking.passenger.full_name} a réservé {booking.seats_booked} place(s). Il/Elle vous paiera {amount_due} FCFA en espèces lors du trajet.",
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
                            commission = int(booking.amount_paid_online)
                            
                            create_and_send_notification(
                                user=booking.passenger,
                                title="Réservation confirmée ✅",
                                message=f"Commission de {commission} FCFA payée. Prévoyez {amount_due} FCFA en espèces à remettre au conducteur.",
                                data={'type': 'payment_confirmed', 'booking_id': str(booking.id), 'screen': 'trips'}
                            )
                            
                            if booking.ride.driver:
                                create_and_send_notification(
                                    user=booking.ride.driver,
                                    title="Nouvelle Réservation 🚗",
                                    message=f"{booking.passenger.full_name} a réservé {booking.seats_booked} place(s).",
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



