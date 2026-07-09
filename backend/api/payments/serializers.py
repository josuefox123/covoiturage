from rest_framework import serializers
from ..models import Payment, Booking

class InitiatePaymentSerializer(serializers.Serializer):
    booking_id = serializers.UUIDField(required=True)

class VerifyPaymentSerializer(serializers.Serializer):
    transaction_reference = serializers.CharField(required=True)

class PaymentResponseSerializer(serializers.ModelSerializer):
    payment_url = serializers.SerializerMethodField()
    transaction_reference = serializers.CharField(source='transaction_id')

    class Meta:
        model = Payment
        fields = ['id', 'transaction_reference', 'amount', 'status', 'payment_url']

    def get_payment_url(self, obj):
        # Cette méthode sera mise à jour dynamiquement par la vue pour avoir le domaine absolu
        request = self.context.get('request')
        query_params = self.context.get('query_params', '')
        if request and query_params:
            return request.build_absolute_uri(f"/api/payments/checkout/{query_params}")
        return f"/api/payments/checkout/{query_params}"
