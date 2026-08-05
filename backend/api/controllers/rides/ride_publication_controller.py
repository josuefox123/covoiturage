import logging
from datetime import datetime
from typing import Dict, Any

from ...calculs.calcul_commission import calculer_commission_zemy
from ...calculs.calcul_prix import calculer_prix_suggeres
from ...models.paiement import FinancialSettings
from ...services.publication.ride_publication_service import RidePublicationService
from ...services.publication.ride_series_service import RideSeriesService

logger = logging.getLogger(__name__)

class RidePublicationController:
    """Controller orchestrant la validation et la publication de trajets uniques ou récurrents."""

    @staticmethod
    def suggest_price(distance_km: float) -> Dict[str, Any]:
        """Gère la suggestion de prix basée sur la distance parcourue."""
        fin_settings = FinancialSettings.load()
        price_per_km = fin_settings.price_per_km
        margin = fin_settings.price_margin_percent

        return calculer_prix_suggeres(distance_km, price_per_km, margin)

    @staticmethod
    def calculate_commission(driver_payout: int) -> int:
        """Calcule la commission applicable sur le payout du conducteur."""
        settings = FinancialSettings.load()
        return calculer_commission_zemy(
            driver_payout=driver_payout,
            is_commission_active=settings.is_commission_active,
            commission_percentage=settings.commission_percentage,
            min_commission=settings.min_commission,
            max_commission=settings.max_commission
        )

    @classmethod
    def publish_ride(cls, user, data: Dict[str, Any], serializer_class) -> Dict[str, Any]:
        """Publie un trajet simple (non récurrent)."""
        driver_payout = int(data.get('driver_payout', 0))
        zemy_commission = cls.calculate_commission(driver_payout)
        price_per_seat = driver_payout + zemy_commission

        # Utilisation du serializer pour valider l'entrée et enregistrer le trajet
        serializer = serializer_class(data=data)
        serializer.is_valid(raise_exception=True)

        ride = serializer.save(
            driver=user,
            zemy_commission=zemy_commission,
            price_per_seat=price_per_seat,
            parcels_available=data.get('max_parcels', 0)
        )

        try:
            RidePublicationService.generate_legs(ride)
        except Exception as e:
            logger.error(f"Erreur lors de la génération automatique des tronçons : {e}")

        return serializer.data

    @classmethod
    def publish_recurrent_rides(cls, user, data: Dict[str, Any]) -> Dict[str, Any]:
        """Publie une série de trajets récurrents."""
        start_date = datetime.strptime(data['start_date'], "%Y-%m-%d").date()
        end_date = datetime.strptime(data['end_date'], "%Y-%m-%d").date()
        driver_payout = int(data.get('driver_payout', 0))
        
        zemy_commission = cls.calculate_commission(driver_payout)
        price_per_seat = driver_payout + zemy_commission

        created_count = RideSeriesService.create_recurrent_rides(
            driver=user,
            start_date=start_date,
            end_date=end_date,
            repeat_type=str(data.get('repeat_type', 'daily')),
            week_days=list(data.get('week_days', [])),
            departure_time=str(data.get('departure_time') or ''),
            departure_location=str(data.get('departure_location') or ''),
            arrival_location=str(data.get('arrival_location') or ''),
            driver_payout=driver_payout,
            zemy_commission=zemy_commission,
            price_per_seat=price_per_seat,
            total_seats=int(data.get('total_seats', 1)),
            vehicle_id=data.get('vehicle'),
            accepts_parcels=bool(data.get('accepts_parcels', False)),
            max_parcels=int(data.get('max_parcels', 0)) if data.get('max_parcels') else 0,
            max_weight_per_parcel=float(data.get('max_weight_per_parcel', 0.0)) if data.get('max_weight_per_parcel') else 0.0,
            max_dimensions=str(data.get('max_dimensions') or ''),
            price_per_parcel=int(data.get('price_per_parcel', 0)) if data.get('price_per_parcel') else 0,
            allowed_parcel_types=list(data.get('allowed_parcel_types', [])),
            music=bool(data.get('music', True)),
            smoking=bool(data.get('smoking', False)),
            chatty=bool(data.get('chatty', True)),
            air_conditioner=bool(data.get('air_conditioner', True)),
            pets_allowed=bool(data.get('pets_allowed', False)),
            luggage_allowed=bool(data.get('luggage_allowed', True)),
            stops_allowed=bool(data.get('stops_allowed', True)),
            description=str(data.get('description') or ''),
            distance_km=float(data.get('distance_km')) if data.get('distance_km') else None,
            duration_min=int(data.get('duration_min')) if data.get('duration_min') else None,
            dep_lat=float(data.get('departure_latitude')) if data.get('departure_latitude') else None,
            dep_lon=float(data.get('departure_longitude')) if data.get('departure_longitude') else None,
            arr_lat=float(data.get('arrival_latitude')) if data.get('arrival_latitude') else None,
            arr_lon=float(data.get('arrival_longitude')) if data.get('arrival_longitude') else None
        )

        return {"message": f"{created_count} trajets générés avec succès."}
