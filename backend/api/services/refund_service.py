"""
refund_service.py

Service de remboursement Zemy via l'API officielle FeexPay.
Gère la validation financière, l'idempotence, le verrouillage atomique anti-double-remboursement,
et le virement automatique vers le portefeuille Mobile Money du passager.

Projet : Zemy
"""
import logging
from decimal import Decimal
from typing import Tuple, Optional
from django.db import transaction
from django.db.models import Sum, Q
from django.utils import timezone

from ..models.utilisateur import User
from ..models.reservation import Booking
from ..models.paiement import RefundRequest, Payment, Transaction
from ..fcm import create_and_send_notification
from .feexpay_payout_service import FeexPayPayoutService, FeexPayPayoutResult, normalize_phone_number

logger = logging.getLogger(__name__)


class RefundService:
    """
    Service centralisant les règles métier et la sécurité des remboursements passagers.
    """

    @classmethod
    def get_refundable_balance(cls, booking: Booking) -> int:
        """
        Calcule le montant encore remboursable pour une réservation donnée.
        Solde = Montant initial encaissé (Payment SUCCESS) - Somme des remboursements déjà traités ou en cours.
        """
        successful_payment = Payment.objects.filter(booking=booking, status='SUCCESS').first()
        initial_paid = successful_payment.amount if successful_payment else booking.amount_paid_online

        if not initial_paid or initial_paid <= 0:
            return 0

        # Somme déjà remboursée ou en cours de traitement
        already_refunded = RefundRequest.objects.filter(
            booking=booking,
            status__in=['processing', 'approved', 'refunded']
        ).aggregate(total=Sum('amount'))['total'] or 0

        return max(0, int(initial_paid) - int(already_refunded))

    @classmethod
    def validate_refund_eligibility(
        cls,
        booking: Booking,
        amount: int,
        requested_by: User
    ) -> Tuple[bool, Optional[str], Optional[Payment]]:
        """
        Vérifie de manière stricte si une demande de remboursement est valide :
        1. Droits de l'utilisateur (passager ou staff/admin)
        2. Réservation existante et payée
        3. Présence d'un paiement initial encaissé (SUCCESS)
        4. Montant demandé <= solde remboursable
        """
        is_staff = getattr(requested_by, 'is_staff', False)
        if not is_staff and booking.passenger_id != requested_by.id:
            return False, "Vous n'êtes pas autorisé à demander un remboursement pour cette réservation.", None

        if int(amount) <= 0:
            return False, "Le montant à rembourser doit être supérieur à zéro.", None

        successful_payment = Payment.objects.filter(booking=booking, status='SUCCESS').first()
        if not successful_payment and booking.amount_paid_online <= 0:
            return False, "Aucun paiement en ligne confirmé trouvé pour cette réservation.", None

        max_refundable = cls.get_refundable_balance(booking)
        if int(amount) > max_refundable:
            return (
                False,
                f"Montant demandé ({amount} FCFA) supérieur au solde remboursable disponible ({max_refundable} FCFA).",
                successful_payment
            )

        return True, None, successful_payment

    @classmethod
    def create_and_process_refund(
        cls,
        booking: Booking,
        amount: int,
        reason: str,
        phone_number: Optional[str] = None,
        operator: Optional[str] = 'mtn',
        auto_disburse: bool = True
    ) -> Tuple[bool, Optional[RefundRequest], str]:
        """
        Crée une demande de remboursement avec verrou atomique et déclenche
        immédiatement le virement automatique FeexPay si configuré.
        """
        with transaction.atomic():
            # Verrouiller la réservation pour éviter les doubles demandes concurrentes
            locked_booking = Booking.objects.select_for_update().get(id=booking.id)

            # Vérifier l'éligibilité et le solde restant
            max_refundable = cls.get_refundable_balance(locked_booking)
            if int(amount) > max_refundable:
                return False, None, f"Montant supérieur au solde remboursable ({max_refundable} FCFA)."

            # Coordonnées du passager
            passenger = locked_booking.passenger
            driver = locked_booking.ride.driver if locked_booking.ride else None
            if not driver:
                return False, None, "Conducteur introuvable pour ce trajet."

            # Téléphone et opérateur de destination
            dest_phone = (phone_number or getattr(passenger, 'phone', '') or '').strip()
            dest_operator = (operator or 'mtn').strip().lower()

            refund_ref = RefundRequest.generate_reference()
            payment_mode = 'automatic' if FeexPayPayoutService.is_automatic_enabled() and auto_disburse else 'manual'

            refund = RefundRequest.objects.create(
                booking=locked_booking,
                passenger=passenger,
                driver=driver,
                amount=int(amount),
                reason=reason,
                status='pending',
                payment_mode=payment_mode,
                phone_number=dest_phone,
                operator=dest_operator,
                refund_reference=refund_ref,
            )

        logger.info(
            f"[REFUND] Nouvelle demande {refund_ref} — Réservation {booking.id} — "
            f"Montant: {amount} XOF — Mode: {payment_mode}"
        )

        # Déclenchement automatique immédiat sans avis admin
        if payment_mode == 'automatic':
            return cls.execute_automatic_refund(refund)

        return True, refund, "Demande de remboursement enregistrée en attente de traitement manuel."

    @classmethod
    def execute_automatic_refund(cls, refund: RefundRequest) -> Tuple[bool, RefundRequest, str]:
        """
        Exécute le virement de remboursement via l'API Payout officielle FeexPay.
        Gère les transitions d'état atomiques : pending -> processing -> refunded / failed.
        """
        try:
            with transaction.atomic():
                refund_locked = RefundRequest.objects.select_for_update().get(id=refund.id)
                if refund_locked.status in ['refunded', 'approved']:
                    return True, refund_locked, "Remboursement déjà effectué."
                if refund_locked.feexpay_reference and refund_locked.status == 'processing':
                    return True, refund_locked, "Remboursement déjà en cours de traitement."

                refund_locked.status = 'processing'
                refund_locked.processed_at = timezone.now()
                refund_locked.save()

            # Appel API FeexPay Payout
            result = FeexPayPayoutService.create_refund(refund_locked)

            with transaction.atomic():
                refund_locked = RefundRequest.objects.select_for_update().get(id=refund.id)

                if result.success and result.status in ['SUCCESSFUL', 'PENDING']:
                    refund_locked.feexpay_reference = result.reference

                    if result.status == 'SUCCESSFUL' or result.error_code == 'ALREADY_PROCESSED':
                        refund_locked.status = 'refunded'
                        refund_locked.refunded_at = timezone.now()
                    else:
                        # PENDING : accepté par FeexPay, en cours de débouclage Mobile Money
                        refund_locked.status = 'processing'

                    refund_locked.save()

                    # Mettre à jour la réservation
                    booking = refund_locked.booking
                    booking.payment_status = 'refunded'
                    booking.save()

                    # Mettre à jour le paiement initial si présent
                    Payment.objects.filter(booking=booking, status='SUCCESS').update(status='REFUNDED')

                    # Enregistrer dans le grand livre des transactions
                    Transaction.objects.create(
                        user=refund_locked.passenger,
                        ride=booking.ride,
                        transaction_type='refund',
                        amount=refund_locked.amount,
                        driver_payout=0,
                        zemy_commission=0,
                        total_price=refund_locked.amount,
                        status='completed'
                    )

                    # Notification passager
                    create_and_send_notification(
                        user=refund_locked.passenger,
                        title="Remboursement envoyé 💸",
                        message=(
                            f"Votre remboursement de {refund_locked.amount:,} FCFA a été viré "
                            f"sur votre numéro {refund_locked.phone_number}."
                        ).replace(',', ' '),
                        data={'type': 'refund_completed', 'refund_id': str(refund_locked.id)}
                    )

                    logger.info(
                        f"[REFUND] {refund_locked.refund_reference} → {refund_locked.status} "
                        f"(FeexPay: {result.reference})"
                    )
                    return True, refund_locked, f"Remboursement de {refund_locked.amount} FCFA envoyé avec succès."

                else:
                    # Échec de l'appel
                    refund_locked.status = 'failed'
                    refund_locked.failure_reason = result.error
                    refund_locked.failure_code = result.error_code
                    refund_locked.failed_at = timezone.now()
                    refund_locked.save()

                    logger.error(
                        f"[REFUND] {refund_locked.refund_reference} → failed "
                        f"({result.error_code}: {result.error})"
                    )
                    return False, refund_locked, f"Échec du virement de remboursement: {result.error}"

        except Exception as e:
            logger.error(f"[REFUND] Erreur inattendue lors du remboursement {refund.id}: {e}")
            try:
                RefundRequest.objects.filter(id=refund.id, status='processing').update(
                    status='failed',
                    failure_reason=str(e),
                    failure_code='INTERNAL_ERROR',
                    failed_at=timezone.now()
                )
            except Exception:
                pass
            return False, refund, f"Erreur interne : {str(e)}"
