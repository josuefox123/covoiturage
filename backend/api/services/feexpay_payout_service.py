"""
feexpay_payout_service.py

Service de reversement Mobile Money via l'API officielle FeexPay V2.
Gère à la fois :
  1. Les reversements de gains aux conducteurs (Driver Payout)
  2. Les remboursements de passagers (Passenger Refund / Disbursement)

MODES DE FONCTIONNEMENT :
  - automatic : Si FEEXPAY_PAYOUT_ENABLED=True et credentials configurés,
                l'opération est exécutée automatiquement via l'API FeexPay.
  - manual    : Fallback sécurisé — l'administrateur valide et traite manuellement.

SPÉCIFICATIONS FEEXPAY V2 :
  - Base URL : https://api-v2.feexpay.me
  - Endpoint Payout : POST /api/payouts/public/transfer/global
  - Endpoint Status : GET /api/payouts/status/public/{reference}
  - Headers : Authorization: Bearer <FEEXPAY_API_TOKEN>
  - Body :
    {
      "shop": "<merchant_id>",
      "amount": <montant_entier_xof>,
      "phoneNumber": "<phone_normalisé_229...>",
      "network": "MTN" | "MOOV" | "CELTIIS",
      "motif": "<motif_operation>"
    }

Projet : Zemy
"""
import re
import uuid
import logging
import requests
from typing import Optional
from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)


def normalize_phone_number(phone: str) -> str:
    """
    Normalise le numéro pour l'API FeexPay (ex: 22997000000).
    Supprime espaces, tirets et le préfixe '+'.
    Si le numéro béninois est sur 8 ou 10 chiffres (sans indicatif),
    ajoute le préfixe 229 requis par FeexPay.
    """
    if not phone:
        return ""
    digits = re.sub(r'\D', '', str(phone))
    if len(digits) in (8, 10):
        # 8 chiffres = ancien format Bénin (ex: 97000000)
        # 10 chiffres = nouveau plan de numérotation Bénin (ex: 0197000000)
        return f"229{digits}"
    return digits


def normalize_network(operator: str) -> str:
    """Normalise le réseau Mobile Money pour FeexPay (MTN, MOOV, CELTIIS)."""
    op = (operator or '').strip().lower()
    mapping = {
        'mtn': 'MTN',
        'moov': 'MOOV',
        'celtiis': 'CELTIIS',
    }
    return mapping.get(op, 'MTN')


class FeexPayPayoutResult:
    """Résultat structuré d'un appel Payout / Refund FeexPay."""
    def __init__(
        self,
        success: bool,
        reference: Optional[str] = None,
        status: str = 'PENDING',
        error: Optional[str] = None,
        error_code: Optional[str] = None,
        raw_response: Optional[dict] = None
    ):
        self.success = success
        self.reference = reference
        self.status = status  # 'SUCCESSFUL', 'PENDING', 'FAILED', 'PROCESSING'
        self.error = error
        self.error_code = error_code
        self.raw_response = raw_response or {}

    def to_dict(self) -> dict:
        return {
            'success': self.success,
            'reference': self.reference,
            'status': self.status,
            'error': self.error,
            'error_code': self.error_code,
        }


class FeexPayPayoutService:
    """
    Service de gestion des reversements (payouts et refunds) via l'API officielle FeexPay V2.
    """

    DEFAULT_PAYOUT_URL = "https://api-v2.feexpay.me/api/payouts/public/transfer/global"
    DEFAULT_STATUS_URL = "https://api-v2.feexpay.me/api/payouts/status/public/"

    @classmethod
    def is_automatic_enabled(cls) -> bool:
        """
        Vérifie si le mode automatique FeexPay Payout est actif et configuré.
        """
        enabled = getattr(settings, 'FEEXPAY_PAYOUT_ENABLED', False)
        token = getattr(settings, 'FEEXPAY_API_TOKEN', '')
        shop = getattr(settings, 'FEEXPAY_MERCHANT_ID', '')
        return bool(enabled) and bool(token) and bool(shop)

    @classmethod
    def _get_headers(cls) -> dict:
        token = getattr(settings, 'FEEXPAY_API_TOKEN', '')
        return {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }

    @classmethod
    def send_disbursement(
        cls,
        amount: int,
        phone_number: str,
        operator: str,
        reference: str,
        motif: str
    ) -> FeexPayPayoutResult:
        """
        Envoie une requête de virement Mobile Money à FeexPay V2.
        Utilisé pour les reversements conducteurs et remboursements passagers.
        """
        if not cls.is_automatic_enabled():
            return FeexPayPayoutResult(
                success=False,
                status='FAILED',
                error="Virement automatique désactivé ou non configuré — passer par le mode manuel.",
                error_code="PAYOUT_NOT_CONFIGURED"
            )

        if not amount or int(amount) <= 0:
            return FeexPayPayoutResult(
                success=False,
                status='FAILED',
                error="Le montant du virement doit être strictement supérieur à 0.",
                error_code="INVALID_AMOUNT"
            )

        clean_phone = normalize_phone_number(phone_number)
        if not clean_phone or len(clean_phone) < 8:
            return FeexPayPayoutResult(
                success=False,
                status='FAILED',
                error=f"Numéro de téléphone Mobile Money invalide: {phone_number}",
                error_code="INVALID_PHONE"
            )

        network = normalize_network(operator)
        shop = getattr(settings, 'FEEXPAY_MERCHANT_ID', '')
        payout_url = getattr(settings, 'FEEXPAY_PAYOUT_URL', cls.DEFAULT_PAYOUT_URL) or cls.DEFAULT_PAYOUT_URL

        payload = {
            "shop": str(shop),
            "amount": int(amount),
            "phoneNumber": clean_phone,
            "network": network,
            "motif": str(motif)[:100],
        }

        # Masquer les données sensibles dans les logs
        masked_phone = f"{clean_phone[:4]}****{clean_phone[-2:]}" if len(clean_phone) >= 6 else clean_phone
        logger.info(
            f"[FEEXPAY-PAYOUT] Envoi virement {reference} — Montant: {amount} XOF — "
            f"Réseau: {network} — Bénéficiaire: {masked_phone}"
        )

        try:
            response = requests.post(
                payout_url,
                json=payload,
                headers=cls._get_headers(),
                timeout=30
            )

            raw = {}
            try:
                raw = response.json()
            except Exception:
                raw = {"raw_text": response.text}

            logger.info(
                f"[FEEXPAY-PAYOUT] Réponse FeexPay pour {reference}: "
                f"HTTP {response.status_code} — {raw}"
            )

            if response.status_code in [200, 201]:
                feexpay_ref = (
                    raw.get('reference') or
                    raw.get('id') or
                    raw.get('transaction_id') or
                    f"FXP-{uuid.uuid4().hex[:10].upper()}"
                )
                raw_status = str(raw.get('status', 'PENDING')).upper()

                # Statut immédiat retourné par FeexPay
                if raw_status in ['SUCCESSFUL', 'SUCCESS', 'APPROVED', 'PAID', 'COMPLETED']:
                    p_status = 'SUCCESSFUL'
                elif raw_status in ['FAILED', 'DECLINED', 'REJECTED', 'ERROR']:
                    p_status = 'FAILED'
                else:
                    p_status = 'PENDING'

                return FeexPayPayoutResult(
                    success=True,
                    reference=str(feexpay_ref),
                    status=p_status,
                    raw_response=raw
                )
            else:
                error_msg = raw.get('message') or raw.get('error') or f"HTTP {response.status_code}"
                error_code = str(raw.get('code') or response.status_code)
                return FeexPayPayoutResult(
                    success=False,
                    status='FAILED',
                    error=error_msg,
                    error_code=error_code,
                    raw_response=raw
                )

        except requests.Timeout:
            logger.error(f"[FEEXPAY-PAYOUT] Timeout lors du virement pour {reference}")
            # En cas de timeout, l'opération peut être passée côté FeexPay :
            # Ne PAS marquer comme FAILED immédiatement, marquer PROCESSING pour vérification statut.
            return FeexPayPayoutResult(
                success=False,
                status='PROCESSING',
                error="Timeout lors de la connexion à FeexPay. L'état doit être vérifié ultérieurement.",
                error_code="TIMEOUT"
            )
        except requests.RequestException as e:
            logger.error(f"[FEEXPAY-PAYOUT] Erreur réseau FeexPay pour {reference}: {e}")
            return FeexPayPayoutResult(
                success=False,
                status='FAILED',
                error=f"Erreur de communication avec FeexPay: {str(e)}",
                error_code="NETWORK_ERROR"
            )
        except Exception as e:
            logger.error(f"[FEEXPAY-PAYOUT] Exception inattendue pour {reference}: {e}")
            return FeexPayPayoutResult(
                success=False,
                status='FAILED',
                error=str(e),
                error_code="UNEXPECTED_ERROR"
            )

    @classmethod
    def create_payout(cls, payout) -> FeexPayPayoutResult:
        """
        Initie un payout conducteur via FeexPay Payout API.
        Idempotent : vérifie si une référence FeexPay est déjà enregistrée.
        """
        if payout.feexpay_reference:
            logger.warning(
                f"[PAYOUT] {payout.payout_reference} a déjà une ref FeexPay "
                f"({payout.feexpay_reference}) — appel ignoré (idempotence)."
            )
            return FeexPayPayoutResult(
                success=True,
                reference=payout.feexpay_reference,
                status='SUCCESSFUL',
                error_code="ALREADY_PROCESSED"
            )

        ref = payout.payout_reference or f"ZMY-PAYOUT-{payout.id}"
        motif = f"Reversement conducteur Zemy {ref}"

        return cls.send_disbursement(
            amount=payout.amount,
            phone_number=payout.phone_number,
            operator=payout.operator,
            reference=ref,
            motif=motif
        )

    @classmethod
    def create_refund(cls, refund) -> FeexPayPayoutResult:
        """
        Initie un remboursement passager via FeexPay Payout (disbursement) API.
        Idempotent : vérifie si une référence FeexPay est déjà enregistrée.
        """
        if refund.feexpay_reference:
            logger.warning(
                f"[REFUND] {refund.refund_reference} a déjà une ref FeexPay "
                f"({refund.feexpay_reference}) — appel ignoré (idempotence)."
            )
            return FeexPayPayoutResult(
                success=True,
                reference=refund.feexpay_reference,
                status='SUCCESSFUL',
                error_code="ALREADY_PROCESSED"
            )

        ref = refund.refund_reference or f"ZMY-REFUND-{refund.id}"
        motif = f"Remboursement passager Zemy {ref}"

        # Utiliser le numéro renseigné sur la demande ou celui du compte passager
        phone = refund.phone_number or getattr(refund.passenger, 'phone', '')
        operator = refund.operator or 'mtn'

        return cls.send_disbursement(
            amount=refund.amount,
            phone_number=phone,
            operator=operator,
            reference=ref,
            motif=motif
        )

    @classmethod
    def check_payout_status(cls, feexpay_reference: str) -> FeexPayPayoutResult:
        """
        Vérifie le statut d'une opération Payout / Refund auprès de FeexPay.
        Endpoint officiel : GET /api/payouts/status/public/{reference}
        """
        if not cls.is_automatic_enabled():
            return FeexPayPayoutResult(
                success=False,
                status='FAILED',
                error_code="PAYOUT_NOT_CONFIGURED"
            )

        base_status_url = getattr(settings, 'FEEXPAY_PAYOUT_STATUS_URL', cls.DEFAULT_STATUS_URL) or cls.DEFAULT_STATUS_URL
        if not base_status_url.endswith('/'):
            base_status_url += '/'
        check_url = f"{base_status_url}{feexpay_reference}"

        try:
            response = requests.get(
                check_url,
                headers=cls._get_headers(),
                timeout=15
            )
            raw = response.json() if response.status_code == 200 else {}
            tx_status = str(raw.get('status', '')).upper()

            if tx_status in ['SUCCESSFUL', 'SUCCESS', 'APPROVED', 'PAID', 'COMPLETED']:
                return FeexPayPayoutResult(
                    success=True,
                    reference=feexpay_reference,
                    status='SUCCESSFUL',
                    raw_response=raw
                )
            elif tx_status in ['FAILED', 'DECLINED', 'REJECTED', 'ERROR']:
                error_msg = raw.get('reason') or raw.get('message') or "Virement refusé par FeexPay"
                return FeexPayPayoutResult(
                    success=False,
                    reference=feexpay_reference,
                    status='FAILED',
                    error=error_msg,
                    error_code='FEEXPAY_DECLINED',
                    raw_response=raw
                )
            else:
                return FeexPayPayoutResult(
                    success=False,
                    reference=feexpay_reference,
                    status='PENDING',
                    error_code='PENDING',
                    raw_response=raw
                )
        except Exception as e:
            logger.error(f"[FEEXPAY-PAYOUT] check_status exception pour {feexpay_reference}: {e}")
            return FeexPayPayoutResult(
                success=False,
                reference=feexpay_reference,
                status='PROCESSING',
                error=str(e),
                error_code="CHECK_ERROR"
            )
