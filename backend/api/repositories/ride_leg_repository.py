from typing import Any
from django.db.models import QuerySet
from ..models.trajet import RideLeg

class RideLegRepository:
    """Repository pour l'accès aux données du modèle RideLeg (Tronçon)."""

    @staticmethod
    def filter_by_ride(ride_id: Any) -> QuerySet:
        """Récupère tous les tronçons associés à un trajet ordonnés."""
        return RideLeg.objects.filter(ride_id=ride_id).order_by('order')

    @staticmethod
    def bulk_create(legs: list) -> list:
        """Crée en masse des enregistrements RideLeg."""
        return RideLeg.objects.bulk_create(legs)

    @staticmethod
    def delete_for_ride(ride_id: Any) -> None:
        """Supprime tous les tronçons associés à un trajet."""
        RideLeg.objects.filter(ride_id=ride_id).delete()
