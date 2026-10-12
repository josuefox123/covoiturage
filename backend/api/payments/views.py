import logging
from django.shortcuts import render
from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes
from .serializers import InitiatePaymentSerializer, VerifyPaymentSerializer, PaymentResponseSerializer
from .services import PaymentService

logger = logging.getLogger(__name__)

class InitiatePaymentView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = InitiatePaymentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        booking_id = serializer.validated_data['booking_id']
        
        try:
            payment, query_params = PaymentService.initiate_payment(booking_id, request.user)
            
            # Context pour le serializer afin de construire l'URL de paiement absolue
            context = {
                'request': request,
                'query_params': query_params
            }
            response_serializer = PaymentResponseSerializer(payment, context=context)
            return Response(response_serializer.data, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            logger.error(f"Error initiating payment: {e}")
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

class VerifyPaymentView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = VerifyPaymentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        transaction_reference = serializer.validated_data['transaction_reference']
        feexpay_transaction_id = request.data.get('transaction_id')
        
        try:
            # Si le frontend a capturé l'ID de FeexPay depuis la WebView, on le lie à notre paiement local
            from ..models import Payment
            from django.db.models import Q
            from .services import is_valid_uuid

            lookup_q = Q(transaction_id=transaction_reference)
            if is_valid_uuid(transaction_reference):
                lookup_q |= Q(booking_id=transaction_reference)

            if feexpay_transaction_id:
                lookup_q |= Q(transaction_id=feexpay_transaction_id)
                if is_valid_uuid(feexpay_transaction_id):
                    lookup_q |= Q(booking_id=feexpay_transaction_id)

            payment = Payment.objects.filter(lookup_q).first()

            if not payment and len(str(transaction_reference)) >= 8:
                clean_ref = str(transaction_reference).replace('-', '')
                partial_q = Q(transaction_id__icontains=clean_ref)
                if is_valid_uuid(clean_ref):
                    partial_q |= Q(booking__id=clean_ref)
                payment = Payment.objects.filter(partial_q).first()
            if not payment:
                return Response({"error": "Transaction locale introuvable."}, status=status.HTTP_404_NOT_FOUND)

            # Utiliser l'ID de FeexPay s'il est fourni, sinon notre référence (pour le mode sandbox par exemple)
            ref_to_verify = feexpay_transaction_id or transaction_reference
            
            # Enregistrer l'ID de FeexPay sur notre paiement pour les futures vérifications (cron, webhook)
            if feexpay_transaction_id and payment.transaction_id != feexpay_transaction_id:
                # Si un autre paiement existe déjà avec cet ID FeexPay, cela pourrait être un replay attack/fraude
                duplicate = Payment.objects.filter(transaction_id=feexpay_transaction_id).exclude(id=payment.id).exists()
                if duplicate:
                    return Response({"error": "Tentative de replay de transaction détectée."}, status=status.HTTP_400_BAD_REQUEST)
                
                # Mettre à jour la clé de transaction pour correspondre à celle de FeexPay
                payment.transaction_id = feexpay_transaction_id
                payment.save()
                
            payment, message = PaymentService.verify_payment(ref_to_verify)
            
            return Response({
                "status": payment.status,
                "message": message,
                "booking_id": str(payment.booking.id) if payment.booking else None,
                "booking_status": payment.booking.status if payment.booking else None
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Error verifying payment: {e}")
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def payment_checkout(request):
    """
    Rend la page HTML de checkout FeexPay qui charge le SDK React V2.
    """
    amount = request.GET.get('amount', '0')
    custom_id = request.GET.get('custom_id', '')
    description = request.GET.get('description', 'Paiement Zemy')
    fullname = request.GET.get('fullname', '')
    email = request.GET.get('email', '')
    phone = request.GET.get('phone', '')
    transaction_id = request.GET.get('transaction_id', '')
    sig = request.GET.get('sig', '')
    
    # SEV-030: Signature obligatoire pour charger la page de checkout
    if not sig:
        from django.http import HttpResponseForbidden
        return HttpResponseForbidden("Signature manquante.")

    from django.core.signing import Signer, BadSignature
    signer = Signer()
    try:
        # Valider que les paramètres critiques n'ont pas été altérés
        token_payload = f"{custom_id}:{transaction_id}:{amount}"
        unsigned_val = signer.unsign(sig)
        if unsigned_val != token_payload:
            from django.http import HttpResponseForbidden
            return HttpResponseForbidden("Paramètres altérés.")
    except BadSignature:
        from django.http import HttpResponseForbidden
        return HttpResponseForbidden("Signature invalide.")
        
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
        "transaction_id": transaction_id,
    }
    response = render(request, 'api/payment_checkout.html', context)
    response['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    response['Pragma'] = 'no-cache'
    response['Expires'] = '0'
    return response
