# Zemy — auth.py (Legacy mapping)
# Ce fichier ré-exporte les nouvelles classes d'authentification et d'utilisateurs découpées.

from ..utilisateurs.views.helpers import (
    get_valid_callback_url,
    send_zemy_reset_email,
)
from ..utilisateurs.views.authentification import (
    verify_code,
    register_user,
    login_user,
    send_reset_code,
    verify_reset_code,
    reset_password,
    change_password,
)
from ..utilisateurs.views.profil import (
    UserViewSet,
    UserPreferenceViewSet,
    save_fcm_token,
    update_profile,
)
from ..utilisateurs.views.vehicule import VehicleViewSet
from ..utilisateurs.views.verification import (
    VerificationRequestViewSet,
    request_verification,
    verification_status,
)

# Re-exports pour compatibilité avec views/__init__.py et urls.py
__all__ = [
    'get_valid_callback_url',
    'send_zemy_reset_email',
    'verify_code',
    'register_user',
    'login_user',
    'send_reset_code',
    'verify_reset_code',
    'reset_password',
    'change_password',
    'UserViewSet',
    'UserPreferenceViewSet',
    'save_fcm_token',
    'update_profile',
    'VehicleViewSet',
    'VerificationRequestViewSet',
    'request_verification',
    'verification_status',
]
