"""
Throttle classes personnalisées pour les endpoints sensibles de Zemy.
SEV-003 : Rate limiting ciblé.
"""
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle


class LoginThrottle(AnonRateThrottle):
    """Limite les tentatives de connexion — protège contre le brute force."""
    scope = 'login'


class OTPThrottle(AnonRateThrottle):
    """Limite les vérifications OTP Firebase/téléphone."""
    scope = 'otp'


class ResetPasswordThrottle(AnonRateThrottle):
    """Limite les demandes de réinitialisation de mot de passe."""
    scope = 'reset'


class PaymentThrottle(UserRateThrottle):
    """Limite les tentatives de paiement par utilisateur authentifié."""
    scope = 'payment'
