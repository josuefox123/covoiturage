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
        # Tenter de retrouver le paiement correspondant
        payment = Payment.objects.filter(transaction_id=transaction_id).first()
        if not payment:
            # Si non trouvé avec transaction_id direct, essayer avec custom_id
            custom_id = payload.get('custom_id')
            if custom_id:
                payment = Payment.objects.filter(booking_id=custom_id).first()
        
        if payment:
            # Si le statut envoyé est un succès, on valide via notre service
            if status_payment in ['SUCCESSFUL', 'SUCCESS', 'APPROVED']:
                PaymentService.verify_payment(payment.transaction_id)
                logger.info(f"Webhook verified and confirmed payment for transaction {transaction_id}")
            else:
                logger.info(f"Webhook received status {status_payment} for transaction {transaction_id}, no action taken.")
        else:
            logger.warning(f"No local payment record found matching transaction_id {transaction_id}")
            
    except Exception as e:
        logger.error(f"Error handling FeexPay Webhook: {e}")
        return HttpResponse(str(e), status=500)

    return HttpResponse("Webhook processed successfully", status=200)
