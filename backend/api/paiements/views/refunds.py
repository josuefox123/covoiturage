"""
refunds.py — Gestion des demandes et exécution des remboursements Zemy via FeexPay
"""
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Q
from django.utils import timezone

from ...models.paiement import RefundRequest
from ...models.reservation import Booking
from ...serializers import RefundRequestSerializer
from ...fcm import create_and_send_notification
from api.services.refund_service import RefundService
from api.services.feexpay_payout_service import FeexPayPayoutService


class RefundRequestViewSet(viewsets.ModelViewSet):
    """
    ViewSet pour la gestion et l'exécution automatisée des remboursements passagers.
    """
    queryset = RefundRequest.objects.all().order_by('-created_at')
    serializer_class = RefundRequestSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if getattr(user, 'is_staff', False):
            return self.queryset
        return self.queryset.filter(Q(passenger=user) | Q(driver=user))

    @action(detail=False, methods=['post'], url_path='initiate')
    def initiate(self, request):
        """
        Initie un remboursement autorisé pour une réservation.
        Exécute le virement automatique sans avis admin si le mode automatique est activé.
        """
        booking_id = request.data.get('booking_id')
        amount = request.data.get('amount')
        reason = request.data.get('reason', 'Demande de remboursement passager')
        phone_number = request.data.get('phone_number')
        operator = request.data.get('operator', 'mtn')

        if not booking_id:
            return Response({"error": "booking_id requis."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            booking = Booking.objects.get(id=booking_id)
        except Booking.DoesNotExist:
            return Response({"error": "Réservation introuvable."}, status=status.HTTP_404_NOT_FOUND)

        if not amount:
            amount = booking.amount_paid_online

        try:
            amount_int = int(amount)
        except (ValueError, TypeError):
            return Response({"error": "Montant invalide."}, status=status.HTTP_400_BAD_REQUEST)

        # Validation de sécurité financière
        is_valid, error_msg, _ = RefundService.validate_refund_eligibility(
            booking=booking,
            amount=amount_int,
            requested_by=request.user
        )
        if not is_valid:
            return Response({"error": error_msg}, status=status.HTTP_400_BAD_REQUEST)

        success, refund, msg = RefundService.create_and_process_refund(
            booking=booking,
            amount=amount_int,
            reason=reason,
            phone_number=phone_number,
            operator=operator,
            auto_disburse=True
        )

        if not success or not refund:
            return Response({"error": msg}, status=status.HTTP_400_BAD_REQUEST)

        return Response({
            "success": True,
            "refund_id": str(refund.id),
            "refund_reference": refund.refund_reference,
            "amount": refund.amount,
            "status": refund.status,
            "payment_mode": refund.payment_mode,
            "feexpay_reference": refund.feexpay_reference,
            "message": msg,
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """
        Action administrateur pour approuver ou relancer un remboursement.
        Déclenche immédiatement le virement FeexPay.
        """
        if not getattr(request.user, 'is_staff', False):
            return Response({"error": "Non autorisé."}, status=status.HTTP_403_FORBIDDEN)

        refund = self.get_object()
        if refund.status in ['refunded', 'approved']:
            return Response({"error": "Ce remboursement a déjà été effectué."}, status=status.HTTP_400_BAD_REQUEST)

        success, refund, msg = RefundService.execute_automatic_refund(refund)

        if not success:
            return Response({
                "status": "failed",
                "message": msg,
                "failure_reason": refund.failure_reason,
            }, status=status.HTTP_400_BAD_REQUEST)

        return Response({
            "status": refund.status,
            "message": msg,
            "refund_reference": refund.refund_reference,
            "feexpay_reference": refund.feexpay_reference,
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'], url_path='check-status')
    def check_status(self, request, pk=None):
        """
        Consulte le statut d'une opération de remboursement auprès de FeexPay.
        """
        refund = self.get_object()
        if not refund.feexpay_reference:
            return Response({
                "status": refund.status,
                "message": "Aucune référence FeexPay associée à ce remboursement."
            })

        result = FeexPayPayoutService.check_payout_status(refund.feexpay_reference)

        if result.status == 'SUCCESSFUL' and refund.status != 'refunded':
            refund.status = 'refunded'
            refund.refunded_at = timezone.now()
            refund.save()
            refund.booking.payment_status = 'refunded'
            refund.booking.save()
        elif result.status == 'FAILED' and refund.status != 'failed':
            refund.status = 'failed'
            refund.failure_reason = result.error
            refund.failed_at = timezone.now()
            refund.save()

        return Response({
            "refund_id": str(refund.id),
            "refund_reference": refund.refund_reference,
            "feexpay_reference": refund.feexpay_reference,
            "status": refund.status,
            "feexpay_status": result.status,
            "raw_response": result.raw_response
        })

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        if not getattr(request.user, 'is_staff', False):
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
