"""
========================================================
Fichier :
matching_service.py

Description :
Service de matching BlaBlaCar-like.
Calcule les places disponibles sur un segment de trajet
et trouve les passagers compatibles lors de la libération
de places.

Projet :
Zemy
========================================================
"""
import logging
import math
from ..models import Ride, RideLeg, RideWaypoint, Booking, SearchAlert

logger = logging.getLogger(__name__)


def haversine_km(lat1, lon1, lat2, lon2):
    """Calcule la distance en km entre deux points GPS."""
    if not all([lat1, lon1, lat2, lon2]):
        return 9999.0
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


class MatchingService:
    """
    Gère la compatibilité des places disponibles entre les passagers et les tronçons du trajet.
    
    Fonctionnalités :
    - Calcul du minimum de places disponibles sur un segment de legs
    - Recherche des passagers compatibles après libération d'une place
    - Vérification des SearchAlert compatibles avec un trajet
    """

    @staticmethod
    def get_available_seats_for_segment(ride: Ride, dep_leg_idx: int, arr_leg_idx: int) -> int:
        """
        Retourne le nombre minimum de places disponibles sur tous les legs
        couverts entre dep_leg_idx et arr_leg_idx (inclusive).
        
        Exemple :
            Leg 0 (Calavi→Allada) : 3 places
            Leg 1 (Allada→Bohicon) : 2 places
            Leg 2 (Bohicon→Parakou) : 4 places
            
            Passager Calavi→Bohicon (legs 0 à 1) → min(3, 2) = 2 places disponibles
        """
        try:
            legs = list(ride.legs.filter(
                order__gte=dep_leg_idx,
                order__lte=arr_leg_idx
            ).order_by('order'))

            if not legs:
                return ride.seats_available

            return min(leg.seats_available for leg in legs)

        except Exception as e:
            logger.error(f"MatchingService.get_available_seats_for_segment error: {e}")
            return ride.seats_available

    @staticmethod
    def allocate_seats_for_segment(ride: Ride, dep_leg_idx: int, arr_leg_idx: int, seats: int) -> bool:
        """
        Décrémente les places disponibles sur tous les legs d'un segment.
        Retourne True si la réservation est possible, False sinon.
        """
        try:
            from django.db import transaction
            with transaction.atomic():
                legs = list(ride.legs.select_for_update().filter(
                    order__gte=dep_leg_idx,
                    order__lte=arr_leg_idx
                ).order_by('order'))

                # Vérifier la disponibilité
                if not legs or any(leg.seats_available < seats for leg in legs):
                    return False

                # Décrémenter
                for leg in legs:
                    leg.seats_available -= seats
                    leg.save(update_fields=['seats_available'])

                # Mettre à jour seats_available global du trajet
                # (minimum des legs individuels pour l'affichage)
                all_legs = list(ride.legs.all())
                if all_legs:
                    ride.seats_available = min(leg.seats_available for leg in all_legs)
                    ride.save(update_fields=['seats_available'])

                return True

        except Exception as e:
            logger.error(f"MatchingService.allocate_seats_for_segment error: {e}")
            return False

    @staticmethod
    def deallocate_seats_for_segment(ride: Ride, dep_leg_idx: int, arr_leg_idx: int, seats: int):
        """
        Restitue les places disponibles sur les legs d'un segment lors d'une annulation.
        """
        try:
            from django.db import transaction
            with transaction.atomic():
                legs = list(ride.legs.select_for_update().filter(
                    order__gte=dep_leg_idx,
                    order__lte=arr_leg_idx
                ).order_by('order'))

                for leg in legs:
                    leg.seats_available = min(leg.seats_available + seats, ride.total_seats)
                    leg.save(update_fields=['seats_available'])

                # Mettre à jour seats_available global
                all_legs = list(ride.legs.all())
                if all_legs:
                    ride.seats_available = min(leg.seats_available for leg in all_legs)
                    ride.save(update_fields=['seats_available'])

        except Exception as e:
            logger.error(f"MatchingService.deallocate_seats_for_segment error: {e}")

    @staticmethod
    def find_compatible_search_alerts(ride: Ride, freed_from_leg_idx: int, freed_seats: int) -> list:
        """
        Trouve les SearchAlert actives dont le trajet est compatible avec les places
        libérées à partir du leg freed_from_leg_idx.
        
        Retourne la liste des passagers à notifier avec leurs données.
        """
        from django.utils import timezone
        from datetime import date

        try:
            # Alertes actives pour la date du trajet
            active_alerts = SearchAlert.objects.filter(
                desired_date=ride.departure_date,
                is_active=True,
                seats_needed__lte=freed_seats,
                expires_at__gt=timezone.now()
            ).select_related('passenger')

            compatible = []
            # Legs disponibles à partir de freed_from_leg_idx
            available_legs = list(ride.legs.filter(order__gte=freed_from_leg_idx).order_by('order'))

            if not available_legs:
                return []

            # Zone géographique couverte par les legs disponibles
            dep_leg = available_legs[0]
            arr_leg = available_legs[-1]

            for alert in active_alerts:
                # Vérifier si le départ de l'alerte est sur le trajet (rayon 5km)
                dep_compatible = False
                arr_compatible = False

                if alert.departure_latitude and alert.departure_longitude:
                    dist_dep = haversine_km(
                        alert.departure_latitude, alert.departure_longitude,
                        dep_leg.start_latitude, dep_leg.start_longitude
                    )
                    dep_compatible = dist_dep <= 5.0
                    
                    # Vérifier aussi sur tous les waypoints du segment disponible
                    if not dep_compatible:
                        waypoints_in_range = ride.waypoints.filter(
                            order__gte=freed_from_leg_idx
                        )
                        for wp in waypoints_in_range:
                            if haversine_km(
                                alert.departure_latitude, alert.departure_longitude,
                                wp.latitude, wp.longitude
                            ) <= 5.0:
                                dep_compatible = True
                                break
                else:
                    dep_compatible = True

                if alert.arrival_latitude and alert.arrival_longitude:
                    dist_arr = haversine_km(
                        alert.arrival_latitude, alert.arrival_longitude,
                        arr_leg.end_latitude, arr_leg.end_longitude
                    )
                    arr_compatible = dist_arr <= 5.0
                else:
                    arr_compatible = True

                if dep_compatible and arr_compatible:
                    compatible.append({
                        'passenger': alert.passenger,
                        'alert': alert,
                        'departure_location': alert.departure_location,
                        'arrival_location': alert.arrival_location,
                    })

            return compatible

        except Exception as e:
            logger.error(f"MatchingService.find_compatible_search_alerts error: {e}")
            return []

    @staticmethod
    def get_leg_indices_for_booking(ride: Ride, departure_location: str, arrival_location: str) -> tuple:
        """
        Retourne (dep_leg_idx, arr_leg_idx) en cherchant les legs correspondant
        aux noms de localités du passager.
        """
        legs = list(ride.legs.order_by('order'))
        if not legs:
            return 0, len(legs) - 1 if legs else 0

        def clean_loc(l):
            if not l:
                return ""
            return "".join(c for c in l.split(',')[0].strip().lower() if c.isalnum())

        dep_clean = clean_loc(departure_location)
        arr_clean = clean_loc(arrival_location)

        dep_idx = 0
        arr_idx = len(legs) - 1

        if dep_clean:
            for i, leg in enumerate(legs):
                leg_start = clean_loc(leg.start_location)
                if dep_clean in leg_start or leg_start in dep_clean:
                    dep_idx = i
                    break

        if arr_clean:
            for i, leg in enumerate(legs):
                leg_end = clean_loc(leg.end_location)
                if arr_clean in leg_end or leg_end in arr_clean:
                    arr_idx = i
                    break

        if arr_idx < dep_idx:
            arr_idx = len(legs) - 1

        return dep_idx, arr_idx
