from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Q

from ...models.paiement import RefundRequest
from ...serializers import RefundRequestSerializer
from ...fcm import create_and_send_notification

class RefundRequestViewSet(viewsets.ModelViewSet):
    """
    ViewSet pour la gestion des litiges et demandes de remboursement.
    """
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
