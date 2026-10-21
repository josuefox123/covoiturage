import json
import logging
import hmac
import hashlib
from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from rest_framework.decorators import api_view, permission_classes
from rest_framework import permissions
from django.conf import settings
from .services import PaymentService
from ..models import Payment

logger = logging.getLogger(__name__)

@csrf_exempt
@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def feexpay_webhook(request):
    """
    Webhook appelé de manière asynchrone par FeexPay lors de la complétion d'un paiement.
    """
    logger.info("FeexPay Webhook received notification.")
    
    # SEV-002: Validation de la signature ou du jeton de sécurité du Webhook
    webhook_secret = getattr(settings, 'FEEXPAY_WEBHOOK_SECRET', '')
    
    if not webhook_secret and not settings.DEBUG:
        logger.error("FEEXPAY_WEBHOOK_SECRET n'est pas configuré en production. Rejet du webhook.")
        return HttpResponse("Webhook secret configuration missing", status=403)

    if webhook_secret:
        # 1. Vérification par jeton custom
        token = request.headers.get('X-Zemy-Webhook-Token')
        # 2. Vérification par signature HMAC (si présente)
        signature = request.headers.get('X-FeexPay-Signature')
        
        is_valid = False
        if token and hmac.compare_digest(token, webhook_secret):
            is_valid = True
        elif signature:
            # Calcul HMAC-SHA256 sur le corps brut de la requête
            computed_sig = hmac.new(
                webhook_secret.encode('utf-8'),
                request.body,
                hashlib.sha256
            ).hexdigest()
            if hmac.compare_digest(signature, computed_sig):
                is_valid = True
                
        if not is_valid:
            logger.warning("Tentative d'accès non autorisé au Webhook FeexPay (Signature/Token invalide).")
            return HttpResponse("Unauthorized webhook access", status=403)
            
    try:
        payload = json.loads(request.body)
        logger.info(f"Webhook payload: {payload}")
    except Exception as e:
        logger.error(f"Failed to parse Webhook body: {e}")
        return HttpResponse(status=400)

    # Récupérer l'identifiant unique de la transaction
    transaction_id = payload.get('transaction_id') or payload.get('reference')
    status_payment = payload.get('status', '').upper()
    
    if not transaction_id:
        logger.error("No transaction_id or reference in webhook payload.")
        return HttpResponse("Missing transaction reference", status=400)

    try:
        from django.db.models import Q
        from .services import is_valid_uuid
        custom_id = payload.get('custom_id') or payload.get('reference')
        lookup_q = Q(transaction_id=transaction_id)
        if is_valid_uuid(transaction_id):
            lookup_q |= Q(booking_id=transaction_id)
        if custom_id:
            lookup_q |= Q(transaction_id=custom_id)
            if is_valid_uuid(custom_id):
                lookup_q |= Q(booking_id=custom_id)

        payment = Payment.objects.filter(lookup_q).first()
        
        if payment:
            # Si le statut envoyé est un succès, on valide via notre service
            if status_payment in ['SUCCESSFUL', 'SUCCESS', 'APPROVED']:
                PaymentService.verify_payment(payment.transaction_id)
                logger.info(f"Webhook verified and confirmed payment for transaction {transaction_id}")
            else:
                logger.info(f"Webhook received status {status_payment} for transaction {transaction_id}, no action taken.")
        else:
            # Vérifier si c'est un virement sortant (DriverPayout ou RefundRequest)
            from ..models.paiement import DriverPayout, RefundRequest
            from django.db import transaction as db_transaction
            from django.utils import timezone

            refs = [r for r in [transaction_id, custom_id] if r]
            payout = DriverPayout.objects.filter(
                Q(payout_reference__in=refs) | Q(feexpay_reference__in=refs)
            ).first()

            if payout:
                with db_transaction.atomic():
                    p_locked = DriverPayout.objects.select_for_update().get(id=payout.id)
                    if status_payment in ['SUCCESSFUL', 'SUCCESS', 'APPROVED', 'PAID', 'COMPLETED']:
                        if p_locked.status != 'paid':
                            p_locked.status = 'paid'
                            p_locked.paid_at = timezone.now()
                            p_locked.save()
                            logger.info(f"[WEBHOOK] DriverPayout {p_locked.payout_reference} confirmed PAID.")
                    elif status_payment in ['FAILED', 'DECLINED', 'REJECTED', 'ERROR']:
                        if p_locked.status != 'failed':
                            p_locked.status = 'failed'
                            p_locked.failure_reason = payload.get('reason') or 'Virement refusé par FeexPay'
                            p_locked.failed_at = timezone.now()
                            p_locked.save()
                            logger.info(f"[WEBHOOK] DriverPayout {p_locked.payout_reference} marked FAILED.")
                return HttpResponse("Webhook processed for DriverPayout", status=200)

            refund = RefundRequest.objects.filter(
                Q(refund_reference__in=refs) | Q(feexpay_reference__in=refs)
            ).first()

            if refund:
                with db_transaction.atomic():
                    r_locked = RefundRequest.objects.select_for_update().get(id=refund.id)
                    if status_payment in ['SUCCESSFUL', 'SUCCESS', 'APPROVED', 'PAID', 'COMPLETED']:
                        if r_locked.status != 'refunded':
                            r_locked.status = 'refunded'
                            r_locked.refunded_at = timezone.now()
                            r_locked.save()
                            r_locked.booking.payment_status = 'refunded'
                            r_locked.booking.save()
                            logger.info(f"[WEBHOOK] RefundRequest {r_locked.refund_reference} confirmed REFUNDED.")
                    elif status_payment in ['FAILED', 'DECLINED', 'REJECTED', 'ERROR']:
                        if r_locked.status != 'failed':
                            r_locked.status = 'failed'
                            r_locked.failure_reason = payload.get('reason') or 'Remboursement refusé par FeexPay'
                            r_locked.failed_at = timezone.now()
                            r_locked.save()
                            logger.info(f"[WEBHOOK] RefundRequest {r_locked.refund_reference} marked FAILED.")
                return HttpResponse("Webhook processed for RefundRequest", status=200)

            logger.warning(f"No local payment, payout, or refund record found matching transaction_id {transaction_id}")
            
    except Exception as e:
        logger.error(f"Error handling FeexPay Webhook: {e}")
        return HttpResponse(str(e), status=500)

    return HttpResponse("Webhook processed successfully", status=200)
