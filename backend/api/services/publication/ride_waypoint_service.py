import logging
from typing import List, Dict, Any
from ...models.trajet import Ride, RideWaypoint
from ...repositories.ride_waypoint_repository import RideWaypointRepository
from ...domain.trajets.gestion_waypoints import GestionWaypointsDomain
from ...calculs.calcul_distance import haversine_km

logger = logging.getLogger(__name__)

class RideWaypointService:
    """Service d'orchestration pour la création et la gestion des points de passage."""

    @staticmethod
    def generate_waypoints(
        ride: Ride,
        candidates: List[Dict[str, Any]],
        legs_list: List[Any]
    ) -> List[RideWaypoint]:
        """
        Orchestre le filtrage des waypoints par priorité,
        le calcul de leur index de tronçon, et leur persistance en base.
        """
        # 1. Utilisation du domaine pour trier et fusionner
        merged = GestionWaypointsDomain.filtrer_et_trier(candidates, haversine_km)
        
        # 2. Calcul des limites de distance des segments
        leg_limits = []
        cum = 0
        for lg in legs_list:
            cum += lg.distance_m
            leg_limits.append(cum)

        # 3. Création des instances
        waypoint_instances = []
        for idx, w in enumerate(merged):
            leg_idx = GestionWaypointsDomain.localiser_leg_index(w['distance'], leg_limits)
            is_stop = w['waypoint_type'] in ['departure', 'stopover', 'arrival']
            
            waypoint_instances.append(RideWaypoint(
                ride=ride,
                name=(w.get('name') or '')[:255],
                latitude=w['latitude'],
                longitude=w['longitude'],
                order=idx,
                distance_from_start_m=w['distance'],
                duration_from_start_sec=w['duration'],
                waypoint_type=w['waypoint_type'],
                leg_index=leg_idx,
                is_stopover=is_stop,
                seats_available=ride.seats_available
            ))

        # 4. Suppression des anciens et insertion en masse via Repository
        RideWaypointRepository.delete_for_ride(ride.id)
        RideWaypointRepository.bulk_create(waypoint_instances)
        
        logger.info(f"Création réussie de {len(waypoint_instances)} waypoints pour le trajet {ride.id}.")
        return waypoint_instances
