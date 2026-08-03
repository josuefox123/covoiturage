# Zemy — rides.py (Legacy mapping)
# Ce fichier ré-exporte les nouvelles classes découpées pour compatibilité descendante.

from ..trajets.views.helpers import (
    check_availability,
    validate_driver_and_vehicle,
)
from ..trajets.views.rides import RideViewSet
from ..trajets.views.popular_places import PopularPlaceViewSet
from ..reservations.views.bookings import BookingViewSet

# Re-exports pour compatibilité avec views/__init__.py et urls.py
__all__ = [
    'check_availability',
    'validate_driver_and_vehicle',
    'RideViewSet',
    'PopularPlaceViewSet',
    'BookingViewSet',
]
