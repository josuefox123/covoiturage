import logging
import requests
from django.conf import settings

logger = logging.getLogger(__name__)

class FeexPayService:
    @staticmethod
    def get_transaction_details(transaction_id):
        """
        Récupère les détails d'une transaction FeexPay par son identifiant unique.
        """
        # Si c'est en mode SANDBOX et que la transaction commence par "sandbox-", on simule le succès
        if settings.FEEXPAY_MODE == 'SANDBOX' and (str(transaction_id).startswith('sandbox-') or str(transaction_id).startswith('ref_') or str(transaction_id).startswith('test_') or str(transaction_id).startswith('booking_')):
            return {
                "status": "SUCCESSFUL",
                "amount": 100,
                "reference": transaction_id,
                "payment_method": "MTN",
                "reason": None
            }

        url = f"https://api.feexpay.me/api/transactions/getrequesttopay/integration/{transaction_id}"
        
        try:
            # L'appel public ne nécessite pas forcément de Bearer Token, 
            # mais nous le passons au cas où pour être autorisés sur les transactions privées.
            headers = {
                "Authorization": f"Bearer {settings.FEEXPAY_API_TOKEN}",
                "Content-Type": "application/json"
            }
            response = requests.get(url, headers=headers, timeout=10)
            if response.status_code == 200:
                return response.json()
            else:
                logger.error(f"FeexPay status error code {response.status_code}: {response.text}")
                raise Exception(f"Erreur API FeexPay (Code {response.status_code}): {response.text}")
        except Exception as e:
            logger.error(f"FeexPay get_transaction_details exception: {e}")
            raise Exception("Impossible de contacter FeexPay pour vérifier la transaction.")
