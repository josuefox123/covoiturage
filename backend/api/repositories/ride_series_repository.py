from typing import Optional
from ..models.trajet import RideSeries

class RideSeriesRepository:
    """Repository pour l'accès aux données du modèle RideSeries (Récurrence)."""

    @staticmethod
    def get_by_id(series_id: str) -> Optional[RideSeries]:
        """Récupère une série récurrente de trajets par son identifiant unique."""
        try:
            return RideSeries.objects.filter(pk=series_id).first()
        except (ValueError, TypeError):
            return None

    @staticmethod
    def create_series(**kwargs) -> RideSeries:
        """Crée un nouvel enregistrement de série récurrente."""
        return RideSeries.objects.create(**kwargs)
