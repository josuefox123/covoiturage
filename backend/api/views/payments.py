# Zemy — payments.py (Legacy mapping)
# Ce fichier ré-exporte les nouvelles classes financières et de paiement découpées.

from ..paiements.views.checkout import (
    payment_checkout,
    confirm_payment,
    sync_payments,
)
from ..paiements.views.settings import FinancialSettingsViewSet
from ..paiements.views.refunds import RefundRequestViewSet
from ..paiements.views.transactions import (
    TransactionViewSet,
    PaymentViewSet,
)
from ..paiements.views.earnings import (
    DriverEarningsView,
    DriverClaimPayoutView,
    DriverPayoutViewSet,
    DriverPayoutsListView,
    DriverPayoutDetailView,
)

# Re-exports pour compatibilité avec views/__init__.py et urls.py
__all__ = [
    'payment_checkout',
    'confirm_payment',
    'sync_payments',
    'FinancialSettingsViewSet',
    'RefundRequestViewSet',
    'TransactionViewSet',
    'PaymentViewSet',
    'DriverEarningsView',
    'DriverClaimPayoutView',
    'DriverPayoutViewSet',
    'DriverPayoutsListView',
    'DriverPayoutDetailView',
]

