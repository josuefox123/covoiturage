import json
import logging
from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from rest_framework.decorators import api_view, permission_classes
from rest_framework import permissions
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
