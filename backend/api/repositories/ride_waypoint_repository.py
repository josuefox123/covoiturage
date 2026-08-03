from django.db.models import QuerySet
from ...models.trajet import RideWaypoint

class RideWaypointRepository:
    """Repository pour l'accès aux données du modèle RideWaypoint (Point de passage)."""

    @staticmethod
    def filter_by_ride(ride_id: str) -> QuerySet:
        """Récupère tous les points de passage associés à un trajet."""
        return RideWaypoint.objects.filter(ride_id=ride_id).order_by('order')

    @staticmethod
    def bulk_create(waypoints: list) -> list:
        """Crée en masse des enregistrements RideWaypoint."""
        return RideWaypoint.objects.bulk_create(waypoints)

    @staticmethod
    def delete_for_ride(ride_id: str) -> None:
        """Supprime tous les points de passage associés à un trajet."""
        RideWaypoint.objects.filter(ride_id=ride_id).delete()
