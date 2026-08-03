# Zemy — ride_service.py (Legacy mapping)
# Ce fichier ré-exporte les nouvelles classes d'itinéraires et de trajets découpées.

from ..itineraire.services.calcul_itineraire import haversine_km
from ..itineraire.services.ride_service import RideService

# Re-exports pour compatibilité avec le reste de l'application
__all__ = [
    'haversine_km',
    'RideService',
]
