"""
earnings.py — Gestion des gains conducteur Zemy

Endpoints :
  GET  /api/driver/earnings/         → Solde + historique
  POST /api/driver/claim/            → Demande de retrait (partiel ou total)
  GET  /api/driver/payouts/          → Liste des payouts du conducteur
  GET  /api/driver/payouts/{id}/     → Détail d'un payout

ViewSet admin :
  /api/driver-payouts/               → Gestion admin (approve, mark_paid, reject)

Workflow :
  pending → processing → paid
  pending → failed (annulation)
  processing → failed (echec FeexPay)
"""
import logging
from django.db import transaction
from django.db.models import Sum, Q
from django.utils import timezone
from rest_framework import viewsets, permissions, status, filters
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination

from ...models.paiement import DriverPayout
from ...models.trajet import Ride
from ...serializers import DriverPayoutSerializer
from ...fcm import create_and_send_notification
from api.services.driver_earning_service import DriverEarningService
from api.services.feexpay_payout_service import FeexPayPayoutService

logger = logging.getLogger(__name__)


# ------------------------------------------------------------------ #
#  Pagination                                                          #
# ------------------------------------------------------------------ #
class PayoutPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


# ------------------------------------------------------------------ #
#  1. GET /api/driver/earnings/                                        #
# ------------------------------------------------------------------ #
class DriverEarningsView(APIView):
    """
    Retourne le solde disponible et l'historique des gains du conducteur.

    Réponse :
      {
        summary: { available_balance, in_processing, already_paid,
                   driver_amount, gross_amount, zemy_commission },
        history: [ { ride_id, departure_location, arrival_location,
                     departure_date, bookings_count, driver_amount,
                     payment_status, payouts: [...] }, ... ]
      }
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        driver = request.user
        snapshot = DriverEarningService.compute_balance(driver)
        history = DriverEarningService.get_earnings_history(driver)

        return Response({
            'summary': snapshot.to_dict(),
            'history': history,
            'payout_automatic_enabled': FeexPayPayoutService.is_automatic_enabled(),
        })


# ------------------------------------------------------------------ #
#  2. POST /api/driver/claim/                                          #
# ------------------------------------------------------------------ #
class DriverClaimPayoutView(APIView):
    """
    Crée une demande de retrait de gains.

    Corps :
      {
        "amount": 5000,           ← montant souhaité (XOF)
        "phone_number": "97XXXXXX",
        "operator": "mtn"         ← mtn | moov | celtiis | other
      }

    Sécurité :
      - Le montant est re-vérifié côté backend (le frontend n'est pas fiable)
      - Verrou atomique pour éviter les double-retraits concurrents
      - Idempotence sur payout_reference
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        driver = request.user
        requested_amount = request.data.get('amount')
        phone_number = request.data.get('phone_number', '').strip()
        operator = request.data.get('operator', 'mtn').strip().lower()

        # --- Validations basiques ---
        if not phone_number:
            return Response(
                {'error': 'Le numéro Mobile Money est requis.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        valid_operators = ['mtn', 'moov', 'celtiis', 'other']
        if operator not in valid_operators:
            return Response(
                {'error': f'Opérateur invalide. Valeurs acceptées : {", ".join(valid_operators)}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # --- Validation atomique du montant + création du payout ---
        with transaction.atomic():
            is_valid, error_msg, snapshot = DriverEarningService.validate_withdrawal(
                driver, requested_amount
            )

            if not is_valid:
                return Response({'error': error_msg}, status=status.HTTP_400_BAD_REQUEST)

            # Générer une référence unique
            payout_reference = DriverPayout.generate_reference()

            # Déterminer le mode de paiement
            payment_mode = 'automatic' if FeexPayPayoutService.is_automatic_enabled() else 'manual'

            # Créer le payout en base (statut initial: pending)
            payout = DriverPayout.objects.create(
                driver=driver,
                ride=None,       # Payout global, pas par trajet
                amount=int(requested_amount),
                phone_number=phone_number,
                operator=operator,
                status='pending',
                payment_mode=payment_mode,
                payout_reference=payout_reference,
            )

        logger.info(
            f"[PAYOUT] Nouvelle demande {payout_reference} — "
            f"Conducteur {driver.id} — {int(requested_amount)} XOF — mode: {payment_mode}"
        )

        # --- Notification de demande reçue ---
        create_and_send_notification(
            user=driver,
            title="Demande de retrait reçue",
            message=(
                f"Votre demande de retrait de {int(requested_amount):,} FCFA est en cours de traitement. "
                f"Référence : {payout_reference}"
            ).replace(',', ' '),
            data={'type': 'payout_pending', 'payout_id': str(payout.id)}
        )

        # --- Mode automatique : déclencher FeexPay immédiatement ---
        if payment_mode == 'automatic':
            self._process_automatic_payout(payout)

        return Response({
            'success': True,
            'payout_id': str(payout.id),
            'payout_reference': payout_reference,
            'amount': payout.amount,
            'phone_number': phone_number,
            'operator': operator,
            'payment_mode': payment_mode,
            'status': payout.status,
            'message': (
                f"Votre demande de retrait de {payout.amount:,} XOF a été soumise. "
                f"Référence : {payout_reference}"
            ).replace(',', ' '),
        }, status=status.HTTP_201_CREATED)

    def _process_automatic_payout(self, payout):
        """
        Déclenche le payout FeexPay en mode automatique.
        Appelé de façon synchrone — à passer en tâche asynchrone si Celery est disponible.
        """
        try:
            with transaction.atomic():
                payout_locked = DriverPayout.objects.select_for_update().get(id=payout.id)
                if payout_locked.status != 'pending':
                    return  # Déjà traité

                payout_locked.status = 'processing'
                payout_locked.processed_at = timezone.now()
                payout_locked.save()

            result = FeexPayPayoutService.create_payout(payout)

            with transaction.atomic():
                payout_locked = DriverPayout.objects.select_for_update().get(id=payout.id)

                if result.success and result.error_code != 'ALREADY_PROCESSED':
                    payout_locked.status = 'paid'
                    payout_locked.feexpay_reference = result.reference
                    payout_locked.paid_at = timezone.now()
                    payout_locked.save()

                    create_and_send_notification(
                        user=payout.driver,
                        title="Retrait effectué ✅",
                        message=(
                            f"Votre retrait de {payout.amount:,} FCFA a été effectué avec succès "
                            f"sur le {payout.phone_number}."
                        ).replace(',', ' '),
                        data={'type': 'payout_completed', 'payout_id': str(payout.id)}
                    )
                    logger.info(f"[PAYOUT] {payout.payout_reference} → paid (FeexPay: {result.reference})")

                elif result.error_code == 'ALREADY_PROCESSED':
                    # Idempotence — déjà traité, considérer comme paid
                    payout_locked.status = 'paid'
                    payout_locked.feexpay_reference = result.reference
                    payout_locked.paid_at = timezone.now()
                    payout_locked.save()

                else:
                    payout_locked.status = 'failed'
                    payout_locked.failure_reason = result.error
                    payout_locked.failure_code = result.error_code
                    payout_locked.failed_at = timezone.now()
                    payout_locked.save()

                    create_and_send_notification(
                        user=payout.driver,
                        title="Retrait échoué ❌",
                        message=(
                            f"Votre retrait de {payout.amount:,} FCFA n'a pas pu être effectué. "
                            f"Le montant reste disponible sur votre solde."
                        ).replace(',', ' '),
                        data={'type': 'payout_failed', 'payout_id': str(payout.id)}
                    )
                    logger.error(
                        f"[PAYOUT] {payout.payout_reference} → failed "
                        f"({result.error_code}: {result.error})"
                    )

        except Exception as e:
            logger.error(f"[PAYOUT] Exception processing automatic payout {payout.id}: {e}")
            try:
                DriverPayout.objects.filter(id=payout.id, status='processing').update(
                    status='failed',
                    failure_reason=str(e),
                    failure_code='INTERNAL_ERROR',
                    failed_at=timezone.now()
                )
            except Exception:
                pass


# ------------------------------------------------------------------ #
#  3. GET /api/driver/payouts/  &  GET /api/driver/payouts/{id}/      #
# ------------------------------------------------------------------ #
class DriverPayoutsListView(APIView):
    """
    Liste les payouts du conducteur connecté.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        payouts = DriverPayout.objects.filter(
            driver=request.user
        ).order_by('-requested_at')

        data = []
        for p in payouts:
            data.append({
                'id': str(p.id),
                'payout_reference': p.payout_reference,
                'amount': p.amount,
                'phone_number': p.phone_number,
                'operator': p.operator,
                'status': p.status,
                'payment_mode': p.payment_mode,
                'feexpay_reference': p.feexpay_reference,
                'failure_reason': p.failure_reason,
                'requested_at': p.requested_at.isoformat() if p.requested_at else None,
                'processed_at': p.processed_at.isoformat() if p.processed_at else None,
                'paid_at': p.paid_at.isoformat() if p.paid_at else None,
                'failed_at': p.failed_at.isoformat() if p.failed_at else None,
            })

        return Response({'payouts': data, 'count': len(data)})


class DriverPayoutDetailView(APIView):
    """
    Détail d'un payout du conducteur connecté.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        try:
            payout = DriverPayout.objects.get(id=pk, driver=request.user)
        except DriverPayout.DoesNotExist:
            return Response(
                {'error': 'Payout introuvable.'},
                status=status.HTTP_404_NOT_FOUND
            )

        return Response({
            'id': str(payout.id),
            'payout_reference': payout.payout_reference,
            'amount': payout.amount,
            'phone_number': payout.phone_number,
            'operator': payout.operator,
            'status': payout.status,
            'payment_mode': payout.payment_mode,
            'feexpay_reference': payout.feexpay_reference,
            'failure_reason': payout.failure_reason,
            'failure_code': payout.failure_code,
            'admin_note': payout.admin_note,
            'requested_at': payout.requested_at.isoformat() if payout.requested_at else None,
            'processed_at': payout.processed_at.isoformat() if payout.processed_at else None,
            'paid_at': payout.paid_at.isoformat() if payout.paid_at else None,
            'failed_at': payout.failed_at.isoformat() if payout.failed_at else None,
        })


# ------------------------------------------------------------------ #
#  4. ViewSet admin — DriverPayoutViewSet                              #
# ------------------------------------------------------------------ #
class DriverPayoutViewSet(viewsets.ModelViewSet):
    """
    ViewSet admin pour la gestion des demandes de virement conducteur.

    Workflow :
      approve    : pending → processing
      mark_paid  : processing → paid   (après paiement réel effectué)
      reject     : pending|processing → failed
      retry      : failed → pending → processing (re-déclenche FeexPay si auto)
    """
    queryset = DriverPayout.objects.all().order_by('-requested_at')
    serializer_class = DriverPayoutSerializer
    permission_classes = [permissions.IsAdminUser]
    pagination_class = PayoutPagination
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['driver__full_name', 'driver__phone', 'payout_reference', 'phone_number']
    ordering_fields = ['requested_at', 'amount', 'status']

    def get_queryset(self):
        qs = self.queryset.select_related('driver', 'ride')
        params = getattr(self.request, 'query_params', self.request.GET)
        status_filter = params.get('status')
        payment_mode_filter = params.get('payment_mode')
        operator_filter = params.get('operator')

        if status_filter:
            qs = qs.filter(status=status_filter)
        if payment_mode_filter:
            qs = qs.filter(payment_mode=payment_mode_filter)
        if operator_filter:
            qs = qs.filter(operator=operator_filter)
        return qs

    # ---- APPROVE : pending → processing ----
    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """
        Marque le payout comme 'en cours de traitement'.
        L'admin doit effectuer le virement manuellement AVANT d'appeler mark_paid.
        NE PAS utiliser pour confirmer le paiement réel.
        """
        payout = self.get_object()
        if payout.status != 'pending':
            return Response(
                {'error': f"Impossible : statut actuel = '{payout.status}'. Attendu : 'pending'."},
                status=status.HTTP_400_BAD_REQUEST
            )

        with transaction.atomic():
            payout = DriverPayout.objects.select_for_update().get(pk=payout.pk)
            if payout.status != 'pending':
                return Response({'error': 'Payout déjà modifié.'}, status=status.HTTP_409_CONFLICT)

            admin_note = request.data.get('admin_note', '')
            payout.status = 'processing'
            payout.processed_at = timezone.now()
            if admin_note:
                payout.admin_note = admin_note
            payout.save()

        logger.info(
            f"[PAYOUT ADMIN] APPROVE — {payout.payout_reference} — "
            f"Admin: {request.user.email} — pending → processing"
        )

        create_and_send_notification(
            user=payout.driver,
            title="Retrait en cours de traitement",
            message=(
                f"Votre demande de {payout.amount:,} FCFA est en cours de traitement "
                f"par notre équipe."
            ).replace(',', ' '),
            data={'type': 'payout_processing', 'payout_id': str(payout.id)}
        )

        return Response({'status': 'processing', 'message': 'Payout passé en processing.'})

    # ---- MARK PAID : processing → paid ----
    @action(detail=True, methods=['post'], url_path='mark-paid')
    def mark_paid(self, request, pk=None):
        """
        Confirme que le paiement réel a été effectué (virement Mobile Money validé).
        DOIT être appelé uniquement après confirmation réelle du paiement.
        """
        payout = self.get_object()
        if payout.status != 'processing':
            return Response(
                {'error': f"Impossible : statut actuel = '{payout.status}'. Attendu : 'processing'."},
                status=status.HTTP_400_BAD_REQUEST
            )

        with transaction.atomic():
            payout = DriverPayout.objects.select_for_update().get(pk=payout.pk)
            if payout.status != 'processing':
                return Response({'error': 'Payout déjà modifié.'}, status=status.HTTP_409_CONFLICT)

            admin_note = request.data.get('admin_note', '')
            feexpay_ref = request.data.get('feexpay_reference', '')

            payout.status = 'paid'
            payout.paid_at = timezone.now()
            if admin_note:
                payout.admin_note = admin_note
            if feexpay_ref:
                payout.feexpay_reference = feexpay_ref
            payout.save()

        logger.info(
            f"[PAYOUT ADMIN] MARK_PAID — {payout.payout_reference} — "
            f"Admin: {request.user.email} — processing → paid"
        )

        create_and_send_notification(
            user=payout.driver,
            title="Retrait effectué ✅",
            message=(
                f"Votre retrait de {payout.amount:,} FCFA a été effectué avec succès "
                f"sur le numéro {payout.phone_number}."
            ).replace(',', ' '),
            data={'type': 'payout_completed', 'payout_id': str(payout.id)}
        )

        return Response({'status': 'paid', 'message': 'Payout marqué comme payé.'})

    # ---- REJECT : pending|processing → failed ----
    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """
        Rejette ou annule un payout. Le montant redevient disponible.
        """
        payout = self.get_object()
        if payout.status not in ['pending', 'processing']:
            return Response(
                {'error': f"Impossible de rejeter un payout en statut '{payout.status}'."},
                status=status.HTTP_400_BAD_REQUEST
            )

        admin_note = request.data.get('admin_note', '')
        if not admin_note:
            return Response(
                {'error': "Un motif de rejet (admin_note) est requis."},
                status=status.HTTP_400_BAD_REQUEST
            )

        with transaction.atomic():
            payout = DriverPayout.objects.select_for_update().get(pk=payout.pk)
            payout.status = 'failed'
            payout.failure_reason = admin_note
            payout.failure_code = 'ADMIN_REJECTED'
            payout.failed_at = timezone.now()
            payout.admin_note = admin_note
            payout.save()

        logger.info(
            f"[PAYOUT ADMIN] REJECT — {payout.payout_reference} — "
            f"Admin: {request.user.email} — raison: {admin_note}"
        )

        create_and_send_notification(
            user=payout.driver,
            title="Retrait refusé ❌",
            message=(
                f"Votre demande de retrait de {payout.amount:,} FCFA a été refusée. "
                f"Motif : {admin_note}. Le montant reste disponible sur votre solde."
            ).replace(',', ' '),
            data={'type': 'payout_failed', 'payout_id': str(payout.id)}
        )

        return Response({'status': 'failed', 'message': 'Payout rejeté. Montant redevenu disponible.'})

    # ---- RETRY : failed → relance ----
    @action(detail=True, methods=['post'])
    def retry(self, request, pk=None):
        """
        Relance un payout échoué.
        - Si mode auto : relance FeexPay
        - Si mode manuel : repasse en pending pour traitement admin
        """
        payout = self.get_object()
        if payout.status != 'failed':
            return Response(
                {'error': f"Impossible de relancer un payout en statut '{payout.status}'."},
                status=status.HTTP_400_BAD_REQUEST
            )

        with transaction.atomic():
            payout = DriverPayout.objects.select_for_update().get(pk=payout.pk)

            # Recalcule le solde pour vérifier que le montant est toujours disponible
            snapshot = DriverEarningService.compute_balance(payout.driver, lock=True)
            if payout.amount > snapshot.available_balance:
                return Response(
                    {'error': f'Solde insuffisant pour relancer : disponible {snapshot.available_balance} XOF.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Reset des champs d'échec
            payout.status = 'pending'
            payout.failure_reason = None
            payout.failure_code = None
            payout.failed_at = None
            payout.feexpay_reference = None  # Réinitialiser pour permettre un nouvel appel
            payout.save()

        logger.info(f"[PAYOUT ADMIN] RETRY — {payout.payout_reference} — Admin: {request.user.email}")

        if payout.payment_mode == 'automatic':
            view = DriverClaimPayoutView()
            view._process_automatic_payout(payout)
            payout.refresh_from_db()

        return Response({
            'status': payout.status,
            'message': f'Payout relancé (mode: {payout.payment_mode}).'
        })

    # ---- STATS globales ----
    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Statistiques globales des payouts pour le dashboard admin."""
        from django.db.models import Count

        qs = DriverPayout.objects.all()
        total_pending = qs.filter(status='pending').aggregate(s=Sum('amount'))['s'] or 0
        total_processing = qs.filter(status='processing').aggregate(s=Sum('amount'))['s'] or 0
        total_paid = qs.filter(status='paid').aggregate(s=Sum('amount'))['s'] or 0
        total_failed = qs.filter(status='failed').aggregate(s=Sum('amount'))['s'] or 0

        counts = qs.values('status').annotate(count=Count('id'))

        return Response({
            'amounts': {
                'pending': total_pending,
                'processing': total_processing,
                'paid': total_paid,
                'failed': total_failed,
                'total_requested': total_pending + total_processing + total_paid + total_failed,
            },
            'counts': {item['status']: item['count'] for item in counts},
            'payout_automatic_enabled': FeexPayPayoutService.is_automatic_enabled(),
        })
