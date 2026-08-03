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
            repeat_type=data.get('repeat_type', 'daily'),
            week_days=data.get('week_days', []),
            departure_time=data.get('departure_time'),
            departure_location=data.get('departure_location'),
            arrival_location=data.get('arrival_location'),
            driver_payout=driver_payout,
            zemy_commission=zemy_commission,
            price_per_seat=price_per_seat,
            total_seats=int(data.get('total_seats', 1)),
            vehicle_id=data.get('vehicle'),
            accepts_parcels=data.get('accepts_parcels', False),
            max_parcels=data.get('max_parcels', 0),
            max_weight_per_parcel=data.get('max_weight_per_parcel', 0.0),
            max_dimensions=data.get('max_dimensions', ''),
            price_per_parcel=data.get('price_per_parcel', 0),
            allowed_parcel_types=data.get('allowed_parcel_types', []),
            music=data.get('music', True),
            smoking=data.get('smoking', False),
            chatty=data.get('chatty', True),
            air_conditioner=data.get('air_conditioner', True),
            pets_allowed=data.get('pets_allowed', False),
            luggage_allowed=data.get('luggage_allowed', True),
            stops_allowed=data.get('stops_allowed', True),
            description=data.get('description', ''),
            distance_km=data.get('distance_km'),
            duration_min=data.get('duration_min'),
            dep_lat=data.get('departure_latitude'),
            dep_lon=data.get('departure_longitude'),
            arr_lat=data.get('arrival_latitude'),
            arr_lon=data.get('arrival_longitude')
        )

        return {"message": f"{created_count} trajets générés avec succès."}
