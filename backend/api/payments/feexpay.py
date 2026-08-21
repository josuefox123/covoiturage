import logging
import requests
from django.conf import settings

logger = logging.getLogger(__name__)

class FeexPayClient:
    @staticmethod
    def get_transaction_details(transaction_id):
        """
        Récupère les détails d'une transaction FeexPay par son identifiant unique.
        """
        # Simulation en mode SANDBOX uniquement pour les identifiants de test préfixés
        if settings.FEEXPAY_MODE == 'SANDBOX' and (
            str(transaction_id).startswith('sandbox-') or 
            str(transaction_id).startswith('test_') or 
            str(transaction_id).startswith('booking_sandbox_') or
            str(transaction_id).startswith('sandbox_test_')
        ):
            return {
                "status": "SUCCESSFUL",
                "amount": 100,
                "reference": transaction_id,
                "payment_method": "MTN",
                "reason": None
            }

        url = f"https://api-v2.feexpay.me/api/transactions/public/single/status/{transaction_id}"
        
        try:
            headers = {
                "Authorization": f"Bearer {settings.FEEXPAY_API_TOKEN}",
                "Content-Type": "application/json"
            }
            response = requests.get(url, headers=headers, timeout=10)
            if response.status_code == 200:
                return response.json()
            else:
                logger.error(f"FeexPay status error code {response.status_code}: {response.text}")
                return None
        except Exception as e:
            logger.error(f"FeexPay get_transaction_details exception: {e}")
            return None
