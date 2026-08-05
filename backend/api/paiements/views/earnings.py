from rest_framework import viewsets, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import action
from django.utils import timezone
import logging

logger = logging.getLogger(__name__)

from ...models.trajet import Ride
from ...models.paiement import DriverPayout
from ...serializers import DriverPayoutSerializer
from ...fcm import create_and_send_notification

class DriverEarningsView(APIView):
    """
    GET /api/driver/earnings/
    Retourne la liste des revenus du conducteur connecté.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user

        completed_rides = Ride.objects.filter(
            driver=user,
            status='completed'
        ).prefetch_related('bookings', 'driver_payouts')

        earnings = []
        total_earned = 0
        total_claimable = 0
        total_paid_out = 0

        for ride in completed_rides:
            confirmed_bookings = ride.bookings.filter(
                status='completed',
                payment_status__in=['escrow', 'paid']
            )
            if not confirmed_bookings.exists():
                continue

            amount_due = sum(b.amount_due_to_driver for b in confirmed_bookings)
            total_earned += amount_due

            existing_payout = ride.driver_payouts.filter(driver=user).first()

            ride_data = {
                'ride_id': str(ride.id),
                'departure_location': ride.departure_location,
                'arrival_location': ride.arrival_location,
                'departure_date': str(ride.departure_date),
                'confirmed_passengers': confirmed_bookings.count(),
                'amount_due': amount_due,
                'payout': None,
            }

            if existing_payout:
                ride_data['payout'] = {
                    'id': str(existing_payout.id),
                    'status': existing_payout.status,
                    'phone_number': existing_payout.phone_number,
                    'requested_at': existing_payout.requested_at.isoformat(),
                    'paid_at': existing_payout.paid_at.isoformat() if existing_payout.paid_at else None,
                }
                if existing_payout.status == 'paid':
                    total_paid_out += amount_due
                else:
                    total_claimable += amount_due
            else:
                total_claimable += amount_due

            earnings.append(ride_data)

        return Response({
            'earnings': earnings,
            'summary': {
                'total_earned': total_earned,
                'total_claimable': total_claimable,
                'total_paid_out': total_paid_out,
            }
        })


class DriverClaimPayoutView(APIView):
    """
    POST /api/driver/claim/
    Soumet une demande de virement pour un trajet terminé.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        ride_id = request.data.get('ride_id')
        phone_number = request.data.get('phone_number', '').strip()

        if not ride_id:
            return Response({'error': 'ride_id est requis.'}, status=status.HTTP_400_BAD_REQUEST)

        if not phone_number:
            return Response({'error': 'Le numéro Mobile Money est requis.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            ride = Ride.objects.get(id=ride_id, driver=user, status='completed')
        except Ride.DoesNotExist:
            return Response(
                {'error': 'Trajet introuvable ou non terminé.'},
                status=status.HTTP_404_NOT_FOUND
            )

        confirmed_bookings = ride.bookings.filter(
            status='completed',
            payment_status__in=['escrow', 'paid']
        )
        if not confirmed_bookings.exists():
            return Response(
                {'error': 'Aucun passager confirmé pour ce trajet. Le paiement ne peut pas être réclamé.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if DriverPayout.objects.filter(driver=user, ride=ride).exists():
            existing = DriverPayout.objects.get(driver=user, ride=ride)
            return Response(
                {
                    'error': f'Une demande de virement existe déjà pour ce trajet (statut: {existing.get_status_display()}).',
                    'payout_status': existing.status,
                },
                status=status.HTTP_409_CONFLICT
            )

        amount_due = sum(b.amount_due_to_driver for b in confirmed_bookings)

        payout = DriverPayout.objects.create(
            driver=user,
            ride=ride,
            amount=amount_due,
            phone_number=phone_number,
            status='pending',
        )

        logger.info(f"[PAYOUT] Conducteur {user.id} a réclamé {amount_due} XOF pour trajet {ride.id} → tel: {phone_number}")

        return Response({
            'success': True,
            'payout_id': str(payout.id),
            'amount': amount_due,
            'phone_number': phone_number,
            'status': payout.status,
            'message': f'Votre demande de virement de {amount_due} XOF a été soumise avec succès. Vous recevrez votre argent sous 24h sur le {phone_number}.'
        }, status=status.HTTP_201_CREATED)


class DriverPayoutViewSet(viewsets.ModelViewSet):
    """
    ViewSet pour la gestion des demandes de virement conducteur par l'administrateur.
    """
    queryset = DriverPayout.objects.all().order_by('-requested_at')
    serializer_class = DriverPayoutSerializer
    permission_classes = [permissions.IsAdminUser]

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        payout = self.get_object()
        if payout.status != 'pending':
            return Response({"error": "La demande n'est plus en attente."}, status=status.HTTP_400_BAD_REQUEST)
        
        payout.status = 'paid'
        payout.paid_at = timezone.now()
        admin_note = request.data.get('admin_note', '')
        if admin_note:
            payout.admin_note = admin_note
        payout.save()
        
        confirmed_bookings = payout.ride.bookings.filter(
            status='completed',
            payment_status='escrow'
        )
        for booking in confirmed_bookings:
            booking.payment_status = 'paid'
            booking.save()
            
        create_and_send_notification(
            user=payout.driver,
            title="Virement effectué",
            message=f"Votre virement de {payout.amount} FCFA a été versé sur le numéro {payout.phone_number}.",
            data={'type': 'payout_completed', 'payout_id': str(payout.id)}
        )
        return Response({"status": "Demande de virement marquée comme payée."})

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        payout = self.get_object()
        if payout.status != 'pending':
            return Response({"error": "La demande n'est plus en attente."}, status=status.HTTP_400_BAD_REQUEST)
            
        payout.status = 'failed'
        admin_note = request.data.get('admin_note', '')
        if admin_note:
            payout.admin_note = admin_note
        payout.save()
        
        create_and_send_notification(
            user=payout.driver,
            title="Échec du virement ❌",
            message=f"Votre demande de virement de {payout.amount} FCFA a été rejetée. Note: {admin_note or 'Veuillez contacter le support.'}",
            data={'type': 'payout_failed', 'payout_id': str(payout.id)}
        )
        return Response({"status": "Demande de virement marquée comme échouée."})
