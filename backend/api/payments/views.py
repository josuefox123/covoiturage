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
            try:
                payment = Payment.objects.get(transaction_id=transaction_reference)
                if feexpay_transaction_id and payment.transaction_id != feexpay_transaction_id:
                    # Mettre à jour l'identifiant pour utiliser celui de FeexPay si nécessaire pour la vérification
                    # ou garder une trace des deux. Le plus simple est de mettre à jour le transaction_id pour la requête FeexPay.
                    # Pour conserver l'idempotence et la recherche, on peut mettre à jour ou requérir l'ID de FeexPay.
                    payment.feexpay_id = feexpay_transaction_id # On peut utiliser un champ temporaire ou remplacer transaction_id
                    # Si on remplace, attention à l'unicité. Le plus propre est d'utiliser le feexpay_transaction_id
                    # pour interroger FeexPay, tout en gardant notre référence en clé de recherche locale.
                    pass
            except Payment.DoesNotExist:
                return Response({"error": "Transaction locale introuvable."}, status=status.HTTP_404_NOT_FOUND)

            # Utiliser l'ID de FeexPay s'il est fourni, sinon notre référence (pour le mode sandbox par exemple)
            ref_to_verify = feexpay_transaction_id or transaction_reference
            
            # Enregistrer l'ID de FeexPay sur notre paiement pour les futures vérifications (cron, webhook)
            if feexpay_transaction_id:
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
    return render(request, 'api/payment_checkout.html', context)
