import requests
import logging
from django.conf import settings

logger = logging.getLogger(__name__)

class FedaPayService:
    @staticmethod
    def get_base_url():
        api_key = settings.FEDAPAY_SECRET_KEY
        is_sandbox = settings.FEDAPAY_ENVIRONMENT == 'sandbox'
        if api_key.startswith('sk_live_'):
            is_sandbox = False
        return "https://sandbox-api.fedapay.com/v1" if is_sandbox else "https://api.fedapay.com/v1"

    @staticmethod
    def get_headers():
        api_key = settings.FEDAPAY_SECRET_KEY
        return {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }

    @classmethod
    def get_transaction_details(cls, transaction_id):
        """
        Récupère les détails d'une transaction FedaPay par son identifiant.
        """
        base_url = cls.get_base_url()
        headers = cls.get_headers()
        res = requests.get(f"{base_url}/transactions/{transaction_id}", headers=headers, timeout=10)
        res.raise_for_status()
        return res.json().get('v1/transaction', {})
