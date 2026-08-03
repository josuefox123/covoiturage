from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional

class TrajetDomainValidation:
    """Règles de validation métier du domaine des trajets sans accès SQL."""

    @staticmethod
    def combiner_date_heure(date_obj, time_obj) -> datetime:
        """Combine une date et une heure en un objet datetime."""
        return datetime.combine(date_obj, time_obj)

    @staticmethod
    def calculer_plage_horaire(start_dt: datetime, duration_min: Optional[int]) -> tuple:
        """Calcule le début et la fin de la plage horaire d'un trajet."""
        duration = duration_min if duration_min else 120
        end_dt = start_dt + timedelta(minutes=duration)
        return start_dt, end_dt

    @staticmethod
    def verifier_chevauchement(
        start_dt: datetime,
        end_dt: datetime,
        existing_rides: List[Dict[str, Any]],
        driver_id: Any,
        vehicle_id: Optional[Any]
    ) -> Optional[str]:
        """
        Vérifie s'il y a un chevauchement avec un trajet existant pour le chauffeur ou le véhicule.
        Retourne un message d'erreur si un conflit est détecté, sinon None.
        """
        for ride in existing_rides:
            r_start = datetime.combine(ride['departure_date'], ride['departure_time'])
            r_duration = ride.get('duration_min') or 120
            r_end = r_start + timedelta(minutes=r_duration)

            is_overlapping = (start_dt < r_end) and (end_dt > r_start)
            if is_overlapping:
                if str(ride['driver_id']) == str(driver_id):
                    return (
                        f"Vous avez déjà un trajet prévu ({ride['departure_location']} -> {ride['arrival_location']}) "
                        f"sur cette plage horaire ({r_start.strftime('%H:%M')} - {r_end.strftime('%H:%M')})."
                    )
                if vehicle_id and ride.get('vehicle_id') and str(ride['vehicle_id']) == str(vehicle_id):
                    return (
                        f"Le véhicule sélectionné est déjà programmé sur un autre trajet en cours "
                        f"de {r_start.strftime('%H:%M')} à {r_end.strftime('%H:%M')}."
                    )
        return None
