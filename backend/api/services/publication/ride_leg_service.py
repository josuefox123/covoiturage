import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any
from ...models.trajet import Ride, RideLeg
from ...repositories.ride_leg_repository import RideLegRepository
from ...domain.trajets.gestion_segments import GestionSegmentsDomain

logger = logging.getLogger(__name__)

class RideLegService:
    """Service d'orchestration pour la création et la gestion des tronçons de trajet."""

    @staticmethod
    def generate_legs(
        ride: Ride,
        nodes: List[Dict[str, Any]],
        legs_data: List[Dict[str, Any]],
        base_datetime: datetime
    ) -> List[RideLeg]:
        """
        Génère et persiste en base les tronçons d'un trajet de manière séquentielle
        en calculant les heures de passage et les tarifs par prorata.
        """
        num_legs = len(nodes) - 1
        if num_legs <= 0:
            logger.warning(f"Aucun tronçon à générer pour le trajet {ride.id}.")
            return []

        # 1. Calcul des tarifs par tronçon via le Domain
        leg_prices = GestionSegmentsDomain.calculer_prix_prorata(ride.price_per_seat, legs_data)

        # 2. Suppression des anciens legs via Repository
        RideLegRepository.delete_for_ride(ride.id)

        # 3. Création séquentielle
        leg_instances = []
        current_time = base_datetime
        
        for i in range(num_legs):
            start_node = nodes[i]
            end_node = nodes[i + 1]
            leg_info = legs_data[i]
            leg_price = leg_prices[i]

            dep_time = current_time
            arr_time = current_time + timedelta(seconds=leg_info['duration_sec'])
            current_time = arr_time + timedelta(minutes=5) # 5 min d'arrêt par défaut

            leg_instances.append(RideLeg(
                ride=ride,
                start_location=start_node['name'],
                end_location=end_node['name'],
                start_latitude=start_node['latitude'] or 0.0,
                start_longitude=start_node['longitude'] or 0.0,
                end_latitude=end_node['latitude'] or 0.0,
                end_longitude=end_node['longitude'] or 0.0,
                start_place_id=start_node.get('place_id') or '',
                end_place_id=end_node.get('place_id') or '',
                departure_time=dep_time,
                arrival_time=arr_time,
                seats_available=ride.seats_available,
                price=leg_price,
                order=i,
                distance_m=leg_info['distance_m'],
                duration_sec=leg_info['duration_sec']
            ))

        # Persistance en masse
        RideLegRepository.bulk_create(leg_instances)
        logger.info(f"Création réussie de {len(leg_instances)} tronçons pour le trajet {ride.id}.")
        return leg_instances
