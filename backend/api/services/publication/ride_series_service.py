import logging
from datetime import datetime, date, time
from typing import List, Optional
from django.db import transaction

from ...models.trajet import Ride, RideSeries
from ...models.utilisateur import Vehicle
from ...repositories.ride_series_repository import RideSeriesRepository
from ...repositories.ride_repository import RideRepository
from ...domain.trajets.regles_publication import ReglesPublicationDomain
from ...domain.trajets.validation_trajet import TrajetDomainValidation
from ...trajets.views.helpers import validate_driver_and_vehicle
from .ride_publication_service import RidePublicationService

logger = logging.getLogger(__name__)

class RideSeriesService:
    """Service d'orchestration pour la création et le déploiement des trajets récurrents."""

    @staticmethod
    def create_recurrent_rides(
        driver,
        start_date: date,
        end_date: date,
        repeat_type: str,
        week_days: List[int],
        departure_time: str,
        departure_location: str,
        arrival_location: str,
        driver_payout: int,
        zemy_commission: int,
        price_per_seat: int,
        total_seats: int,
        vehicle_id: Optional[str],
        accepts_parcels: bool,
        max_parcels: int,
        max_weight_per_parcel: float,
        max_dimensions: str,
        price_per_parcel: int,
        allowed_parcel_types: List[str],
        music: bool,
        smoking: bool,
        chatty: bool,
        air_conditioner: bool,
        pets_allowed: bool,
        luggage_allowed: bool,
        stops_allowed: bool,
        description: str,
        distance_km: Optional[float],
        duration_min: Optional[int],
        dep_lat: Optional[float] = None,
        dep_lon: Optional[float] = None,
        arr_lat: Optional[float] = None,
        arr_lon: Optional[float] = None
    ) -> int:
        """
        Valide les récurrences et procède à la création de la série (RideSeries)
        ainsi que de chaque trajet individuel programmé (Ride) avec génération de segments.
        """
        # 1. Validation métier de la récurrence dans le Domain
        error_msg = ReglesPublicationDomain.valider_parametres_recurrence(
            start_date, end_date, repeat_type, week_days
        )
        if error_msg:
            from rest_framework.exceptions import ValidationError
            raise ValidationError({"error": error_msg})

        # 2. Parsing de l'heure
        departure_time_val = departure_time
        if isinstance(departure_time_val, str):
            parsed_time = None
            for fmt in ("%H:%M:%S", "%H:%M"):
                try:
                    parsed_time = datetime.strptime(departure_time_val.strip(), fmt).time()
                    break
                except ValueError:
                    continue
            if parsed_time is None:
                from rest_framework.exceptions import ValidationError
                raise ValidationError({"error": "Format d'heure de départ invalide (attendu HH:MM ou HH:MM:SS)."})
            departure_time_val = parsed_time

        # 3. Calcul des dates cibles via le Domain
        target_dates = ReglesPublicationDomain.determiner_jours_recurrence(
            start_date, end_date, repeat_type, week_days
        )

        # 4. Résoudre l'itinéraire Google Directions une seule fois pour toute la série (hors transaction)
        precalculated_route = None
        if target_dates:
            from ...cartographie.routes import RoutesOrchestrator
            try:
                precalculated_route = RoutesOrchestrator.get_route(
                    origin_lat=dep_lat or 0.0,
                    origin_lon=dep_lon or 0.0,
                    dest_lat=arr_lat or 0.0,
                    dest_lon=arr_lon or 0.0,
                    stopovers=None,
                    origin_place_id='',
                    dest_place_id='',
                    default_duration_min=duration_min or 120
                )
            except Exception as e:
                logger.warning(f"Erreur pré-calcul itinéraire récurrence : {e}")

        with transaction.atomic():
            # BUG-013 FIX : Verrouiller le conducteur pour sérialiser les publications
            # concurrentes. Avant ce fix, la validation (ci-dessous) pouvait être
            # exécutée par deux requêtes simultanées qui passaient toutes les deux
            # la vérification de conflit avant que l'une des deux ait créé les trajets.
            from ...models.utilisateur import User as UserModel
            UserModel.objects.select_for_update().get(id=driver.id)

            # Validation temporelle globale du chauffeur/véhicule
            validate_driver_and_vehicle(
                driver=driver,
                vehicle_id=vehicle_id,
                departure_date=start_date,
                departure_time=departure_time_val,
                duration_min=duration_min
            )

            vehicle_obj = None
            if vehicle_id:
                vehicle_obj = Vehicle.objects.filter(id=vehicle_id).first()

            # Création de la série via Repository
            series = RideSeriesRepository.create_series(
                driver=driver,
                start_date=start_date,
                end_date=end_date,
                repeat_type=repeat_type,
                week_days=week_days,
                departure_time=departure_time_val,
                departure_location=departure_location,
                arrival_location=arrival_location,
                price_per_seat=price_per_seat,
                driver_payout=driver_payout,
                zemy_commission=zemy_commission,
                total_seats=total_seats,
                vehicle=vehicle_obj,
                accepts_parcels=accepts_parcels,
                max_parcels=max_parcels,
                max_weight_per_parcel=max_weight_per_parcel,
                max_dimensions=max_dimensions,
                price_per_parcel=price_per_parcel,
                allowed_parcel_types=allowed_parcel_types,
                departure_latitude=dep_lat,
                departure_longitude=dep_lon,
                arrival_latitude=arr_lat,
                arrival_longitude=arr_lon
            )

            created_count = 0
            # Création de chaque trajet
            for current_date in target_dates:
                # Validation locale de conflit
                validate_driver_and_vehicle(
                    driver=driver,
                    vehicle_id=vehicle_id,
                    departure_date=current_date,
                    departure_time=departure_time_val,
                    duration_min=duration_min
                )

                ride_obj = RideRepository.create_ride(
                    series=series,
                    driver=driver,
                    vehicle=vehicle_obj,
                    departure_location=departure_location,
                    arrival_location=arrival_location,
                    departure_date=current_date,
                    departure_time=departure_time_val,
                    price_per_seat=price_per_seat,
                    driver_payout=driver_payout,
                    zemy_commission=zemy_commission,
                    total_seats=total_seats,
                    seats_available=total_seats,
                    accepts_parcels=accepts_parcels,
                    max_parcels=max_parcels,
                    parcels_available=max_parcels,
                    max_weight_per_parcel=max_weight_per_parcel,
                    max_dimensions=max_dimensions,
                    price_per_parcel=price_per_parcel,
                    allowed_parcel_types=allowed_parcel_types,
                    departure_latitude=dep_lat,
                    departure_longitude=dep_lon,
                    arrival_latitude=arr_lat,
                    arrival_longitude=arr_lon,
                    music=music,
                    smoking=smoking,
                    chatty=chatty,
                    air_conditioner=air_conditioner,
                    pets_allowed=pets_allowed,
                    luggage_allowed=luggage_allowed,
                    stops_allowed=stops_allowed,
                    description=description,
                    distance_km=float(distance_km) if distance_km else None,
                    duration_min=int(duration_min) if duration_min else None,
                )

                try:
                    RidePublicationService.generate_legs(ride_obj, precalculated_route=precalculated_route)
                except Exception as e:
                    logger.error(f"Erreur legs trajet récurrent {ride_obj.id}: {e}")

                created_count += 1

        return created_count
