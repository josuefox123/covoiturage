from typing import Optional
from django.db.models import QuerySet
from ...models.trajet import Ride

class RideRepository:
    """Repository pour l'accès aux données du modèle Ride (Trajet)."""

    @staticmethod
    def get_by_id(ride_id: str) -> Optional[Ride]:
        """Récupère un trajet par son identifiant unique."""
        try:
            return Ride.objects.filter(pk=ride_id).first()
        except (ValueError, TypeError):
            return None

    @staticmethod
    def get_active_rides_for_driver(driver_id: str) -> QuerySet:
        """Récupère les trajets actifs d'un conducteur."""
        return Ride.objects.filter(driver_id=driver_id).exclude(status__in=['completed', 'cancelled'])

    @staticmethod
    def create_ride(**kwargs) -> Ride:
        """Crée un nouvel enregistrement de trajet."""
        return Ride.objects.create(**kwargs)

    @staticmethod
    def save(ride: Ride) -> Ride:
        """Sauvegarde les modifications apportées à un trajet."""
        ride.save()
        return ride
