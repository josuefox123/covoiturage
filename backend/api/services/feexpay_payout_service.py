"""
feexpay_payout_service.py

Service de reversement Mobile Money via FeexPay.

MODES DE FONCTIONNEMENT :
  - automatic : Si FEEXPAY_PAYOUT_ENABLED=True et les credentials sont
                presents, le payout est declenche automatiquement.
  - manual    : Fallback -- l admin traite le virement manuellement.

VARIABLES D ENV NECESSAIRES (mode automatique) :
  FEEXPAY_PAYOUT_ENABLED=True
  FEEXPAY_PAYOUT_URL=https://api-v2.feexpay.me/api/...  (a confirmer)
  FEEXPAY_API_TOKEN=...  (deja present dans .env)
  FEEXPAY_MERCHANT_ID=... (deja present dans .env)

Projet : Zemy
"""
import logging
import uuid
import requests
from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)


from typing import Optional

class FeexPayPayoutResult:
    """Resultat structure d un appel Payout FeexPay."""
    def __init__(self, success: bool, reference: Optional[str] = None, error: Optional[str] = None,
                 error_code: Optional[str] = None, raw_response: Optional[dict] = None):
        self.success = success
        self.reference = reference
        self.error = error
        self.error_code = error_code
        self.raw_response = raw_response or {}


class FeexPayPayoutService:
    """
    Service de gestion des reversements conducteur via FeexPay Payout API.

    Architecture en deux modes :
      1. Automatique (FEEXPAY_PAYOUT_ENABLED=True) :
         -> Appel direct FeexPay Payout API
      2. Manuel (fallback) :
         -> Creation de la demande, traitement par l admin
    """

    @staticmethod
    def is_automatic_enabled() -> bool:
        """
        Verifie si le mode automatique FeexPay Payout est active.
        Retourne True uniquement si FEEXPAY_PAYOUT_ENABLED=True
        ET que FEEXPAY_PAYOUT_URL est configure.
        """
        enabled = getattr(settings, 'FEEXPAY_PAYOUT_ENABLED', False)
        payout_url = getattr(settings, 'FEEXPAY_PAYOUT_URL', '')
        return bool(enabled) and bool(payout_url)

    @staticmethod
    def _get_headers() -> dict:
        return {
            "Authorization": f"Bearer {settings.FEEXPAY_API_TOKEN}",
            "Content-Type": "application/json",
        }

    @staticmethod
    def create_payout(payout) -> 'FeexPayPayoutResult':
        """
        Initie un payout via FeexPay Payout API.

        Args:
            payout (DriverPayout): objet avec amount, phone_number, operator, payout_reference

        Returns:
            FeexPayPayoutResult
        """
        # Idempotence : si feexpay_reference existe deja, ne pas re-envoyer (PRIORITE ABSOLUE)
        if payout.feexpay_reference:
            logger.warning(
                f"[PAYOUT] {payout.payout_reference} a deja une ref FeexPay "
                f"({payout.feexpay_reference}) -- appel ignore (idempotence)."
            )
            return FeexPayPayoutResult(
                success=True,
                reference=payout.feexpay_reference,
                error_code="ALREADY_PROCESSED"
            )

        enabled = getattr(settings, 'FEEXPAY_PAYOUT_ENABLED', False)
        payout_url = getattr(settings, 'FEEXPAY_PAYOUT_URL', '')
        if enabled and not payout_url:
            return FeexPayPayoutResult(
                success=False,
                error="Payout automatique active dans settings mais FEEXPAY_PAYOUT_URL est vide ou manquante.",
                error_code="CONFIGURATION_ERROR"
            )

        if not FeexPayPayoutService.is_automatic_enabled():
            return FeexPayPayoutResult(
                success=False,
                error="Payout automatique non configure -- utiliser le mode manuel.",
                error_code="PAYOUT_NOT_CONFIGURED"
            )

        payout_url = settings.FEEXPAY_PAYOUT_URL

        operator_map = {
            'mtn': 'MTN',
            'moov': 'MOOV',
            'celtiis': 'CELTIIS',
            'other': 'MTN',
        }
        feexpay_operator = operator_map.get(payout.operator, 'MTN')

        payload = {
            "amount": payout.amount,
            "phone": payout.phone_number,
            "operator": feexpay_operator,
            "merchant_id": settings.FEEXPAY_MERCHANT_ID,
            "custom_id": payout.payout_reference,
            "description": f"Reversement conducteur Zemy -- {payout.payout_reference}",
        }

        try:
            response = requests.post(
                payout_url,
                json=payload,
                headers=FeexPayPayoutService._get_headers(),
                timeout=30
            )

            raw = {}
            try:
                raw = response.json()
            except Exception:
                raw = {"raw_text": response.text}

            logger.info(
                f"[PAYOUT] FeexPay response for {payout.payout_reference}: "
                f"HTTP {response.status_code} -- {raw}"
            )

            if response.status_code in [200, 201]:
                feexpay_ref = (
                    raw.get('reference') or
                    raw.get('transaction_id') or
                    raw.get('id') or
                    f"FXP-{uuid.uuid4().hex[:10].upper()}"
                )
                return FeexPayPayoutResult(
                    success=True,
                    reference=str(feexpay_ref),
                    raw_response=raw
                )
            else:
                error_msg = raw.get('message') or raw.get('error') or f"HTTP {response.status_code}"
                error_code = raw.get('code') or str(response.status_code)
                return FeexPayPayoutResult(
                    success=False,
                    error=error_msg,
                    error_code=str(error_code),
                    raw_response=raw
                )

        except requests.Timeout:
            logger.error(f"[PAYOUT] Timeout FeexPay pour {payout.payout_reference}")
            return FeexPayPayoutResult(
                success=False,
                error="Timeout lors de la connexion a FeexPay.",
                error_code="TIMEOUT"
            )
        except Exception as e:
            logger.error(f"[PAYOUT] Exception FeexPay pour {payout.payout_reference}: {e}")
            return FeexPayPayoutResult(
                success=False,
                error=str(e),
                error_code="NETWORK_ERROR"
            )

    @staticmethod
    def check_payout_status(feexpay_reference: str) -> 'FeexPayPayoutResult':
        """
        Verifie le statut d un payout FeexPay par sa reference.
        Utilise lors des webhooks ou verifications periodiques.
        """
        if not FeexPayPayoutService.is_automatic_enabled():
            return FeexPayPayoutResult(success=False, error_code="PAYOUT_NOT_CONFIGURED")

        check_url = getattr(settings, 'FEEXPAY_PAYOUT_STATUS_URL', None)
        if not check_url:
            check_url = f"https://api-v2.feexpay.me/api/transactions/public/single/status/{feexpay_reference}"

        try:
            response = requests.get(
                check_url,
                headers=FeexPayPayoutService._get_headers(),
                timeout=15
            )
            raw = response.json() if response.status_code == 200 else {}
            tx_status = raw.get('status', '').upper()

            if tx_status in ['SUCCESSFUL', 'SUCCESS', 'APPROVED', 'PAID', 'COMPLETED']:
                return FeexPayPayoutResult(success=True, reference=feexpay_reference, raw_response=raw)
            elif tx_status in ['FAILED', 'DECLINED', 'REJECTED', 'ERROR']:
                error_msg = raw.get('reason') or raw.get('message') or "Payout refuse par FeexPay"
                return FeexPayPayoutResult(
                    success=False, error=error_msg, error_code='FEEXPAY_DECLINED', raw_response=raw
                )
            else:
                return FeexPayPayoutResult(success=False, error_code='PENDING', raw_response=raw)
        except Exception as e:
            logger.error(f"[PAYOUT] check_status exception: {e}")
            return FeexPayPayoutResult(success=False, error=str(e), error_code="CHECK_ERROR")
