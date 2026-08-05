from rest_framework import permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django.conf import settings
from django.utils import timezone
import logging

logger = logging.getLogger(__name__)

from ...models.utilisateur import User
from ...models.trajet import Ride
from ...models.reservation import Booking
from ...models.colis import Parcel
from ...models.paiement import Payment, Transaction
from ...fcm import create_and_send_notification

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
    from ...services.feexpay_service import FeexPayService
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
                    from api.bookings.services import BookingService
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
                    
                    dep_loc = booking.departure_location or booking.ride.departure_location or ''
                    arr_loc = booking.arrival_location or booking.ride.arrival_location or ''
                    create_and_send_notification(
                        user=booking.passenger,
                        title="Réservation confirmée",
                        message=f"Paiement de {booking.total_amount} FCFA validé. Votre réservation est confirmée pour le trajet {dep_loc} -> {arr_loc}.",
                        data={'type': 'payment_confirmed', 'booking_id': str(booking.id), 'screen': 'trips'}
                    )
                    
                    if booking.ride.driver:
                        create_and_send_notification(
                            user=booking.ride.driver,
                            title="Nouvelle Réservation Payée",
                            message=f"{booking.passenger.full_name or booking.passenger.phone} vient de payer sa réservation. Votre gain de {amount_due} FCFA est sécurisé.",
                            data={'type': 'passenger_paid_driver', 'booking_id': str(booking.id), 'screen': 'rides'}
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
                    
                    amount_due = parcel.driver_payout
                    create_and_send_notification(
                        user=parcel.ride.driver,
                        title="Nouveau Colis Confirmé",
                        message=f"{parcel.sender_name} a confirmé l'envoi d'un colis. Vous recevrez {amount_due} FCFA en espèces.",
                        data={'type': 'parcel_confirmed', 'parcel_id': str(parcel.id), 'screen': 'rides'}
                    )
                    
                    if parcel.sender_user:
                        create_and_send_notification(
                            user=parcel.sender_user,
                            title="Colis payé et validé",
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
    from ...services.feexpay_service import FeexPayService
    
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
                    
                    if payment_locked.booking:
                        booking = payment_locked.booking
                        if booking.payment_status != 'escrow':
                            ride = Ride.objects.select_for_update().get(id=booking.ride.id)
                            ride.seats_available -= booking.seats_booked
                            ride.save()

                            booking.payment_status = 'escrow'
                            booking.status = 'confirmed'
                            booking.save()
                            
                            amount_due = int(booking.amount_due_to_driver)
                            create_and_send_notification(
                                user=booking.passenger,
                                title="Réservation confirmée",
                                message=f"Paiement de {booking.total_amount} FCFA validé. Votre réservation est confirmée.",
                                data={'type': 'payment_confirmed', 'booking_id': str(booking.id), 'screen': 'trips'}
                            )
                            
                            if booking.ride.driver:
                                create_and_send_notification(
                                    user=booking.ride.driver,
                                    title="Nouvelle Réservation",
                                    message=f"{booking.passenger.full_name} a réservé {booking.seats_booked} place(s). Votre gain de {amount_due} FCFA est crédité sur votre compte Zemy.",
                                    data={'type': 'new_booking', 'booking_id': str(booking.id), 'screen': 'rides'}
                                )
                                
                    if payment_locked.parcel:
                        parcel = payment_locked.parcel
                        if parcel.payment_status != 'escrow':
                            parcel.payment_status = 'escrow'
                            parcel.status = 'accepted'
                            parcel.save()
                            
                            amount_due = parcel.driver_payout
                            create_and_send_notification(
                                user=parcel.ride.driver,
                                title="Nouveau Colis Confirmé",
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
            logger.error(f"Error syncing transaction {transaction_id}: {e}")
            pass
            
    return Response({
        "synced_count": len(updated_payments),
        "updates": updated_payments
    })
