import logging
from ...services.publication.ride_publication_service import RidePublicationService

logger = logging.getLogger(__name__)

class RideService:
    """
    Façade de compatibilité historique pointant vers RidePublicationService
    conformément aux principes de Clean Architecture.
    """

    @staticmethod
    def generate_legs(ride) -> None:
        """Génère et sauvegarde les segments et les points de passage pour un trajet."""
        RidePublicationService.generate_legs(ride)
