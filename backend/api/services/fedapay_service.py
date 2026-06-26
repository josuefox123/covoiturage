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
        try:
            res = requests.get(f"{base_url}/transactions/{transaction_id}", headers=headers, timeout=10)
            res.raise_for_status()
            return res.json().get('v1/transaction') or res.json().get('transaction') or {}
        except requests.exceptions.RequestException as e:
            logger.error(f"FedaPay get_transaction_details error: {e}")
            raise Exception("Impossible de contacter FedaPay pour vérifier la transaction.")

    @classmethod
    def create_transaction(cls, amount, description, customer_data, callback_url=None, metadata=None):
        """
        Crée une nouvelle transaction FedaPay.
        """
        base_url = cls.get_base_url()
        headers = cls.get_headers()
        
        payload = {
            "description": description,
            "amount": amount,
            "currency": {"iso": "XOF"},
            "customer": customer_data
        }
        
        if callback_url:
            payload["callback_url"] = callback_url
            
        if metadata:
            payload["custom_metadata"] = metadata
            
        try:
            res = requests.post(f"{base_url}/transactions", json=payload, headers=headers, timeout=10)
            if res.status_code not in [200, 201]:
                raise Exception(f"Erreur lors de la création de la transaction: {res.text}")
                
            tx_json = res.json()
            transaction_data = tx_json.get('v1/transaction') or tx_json.get('transaction') or {}
            transaction_id = transaction_data.get('id')
            
            if not transaction_id:
                raise Exception("ID de transaction non retourné par FedaPay.")
                
            return transaction_id
        except requests.exceptions.RequestException as e:
            logger.error(f"FedaPay create_transaction error: {e}")
            raise Exception("Impossible de contacter FedaPay pour créer la transaction.")

    @classmethod
    def generate_token(cls, transaction_id):
        """
        Génère un lien de paiement pour une transaction FedaPay existante.
        """
        base_url = cls.get_base_url()
        headers = cls.get_headers()
        is_sandbox = 'sandbox' in base_url
        
        try:
            res = requests.post(f"{base_url}/transactions/{transaction_id}/token", headers=headers, timeout=10)
            if res.status_code not in [200, 201]:
                raise Exception(f"Erreur lors de la génération du token FedaPay: {res.text}")
                
            token_json = res.json()
            url = token_json.get('url')
            
            if not url:
                node = token_json.get('v1/token') or token_json.get('token')
                if isinstance(node, dict):
                    url = node.get('url')
                elif isinstance(node, str) and node.startswith('tok_'):
                    checkout_base = "https://checkout.fedapay.com/pay/" if not is_sandbox else "https://sandbox-checkout.fedapay.com/pay/"
                    url = checkout_base + node
                    
            if not url:
                raise Exception("L'URL de paiement n'a pas pu être extraite de la réponse FedaPay.")
                
            return url
        except requests.exceptions.RequestException as e:
            logger.error(f"FedaPay generate_token error: {e}")
            raise Exception("Impossible de contacter FedaPay pour obtenir le lien de paiement.")
