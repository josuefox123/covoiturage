from datetime import datetime, timedelta
from typing import Tuple, Any, List

class TimingCalculator:
    """Service d'estimation des temps de trajet, d'arrivée et d'approche."""

    @staticmethod
    def categorize_approach(distance_km: float) -> Tuple[float, str]:
        """Catégorise la distance d'approche avec une estimation textuelle de la durée."""
        dist_m = distance_km * 1000
        if distance_km <= 0.5:
            return 0.5, f"{max(1, int(dist_m / 83))} min à pied"
        elif distance_km <= 1.0:
            return 1.0, f"{max(1, int(dist_m / 416))} min en zem"
        elif distance_km <= 3.0:
            return 3.0, f"{max(1, int(dist_m / 416))} min en zem"
        elif distance_km <= 5.0:
            return 5.0, f"{max(1, int(dist_m / 500))} min en taxi"
        elif distance_km <= 10.0:
            return 10.0, f"{max(1, int(dist_m / 500))} min en taxi / zem"
        else:
            return 15.0, f"{max(1, int(dist_m / 500))} min en taxi"

    @staticmethod
    def estimate_passage_times(
        ride: Any,
        dep_wp: Any,
        arr_wp: Any,
        waypoints: List[Any]
    ) -> Tuple[Any, Any, int]:
        """Calcule les horaires estimés de passage et la durée en minutes pour un segment de trajet."""
        dep_time = ride.departure_time
        arr_time = ride.departure_time
        duration_segment_min = 0

        try:
            dep_sec = getattr(dep_wp, 'duration_from_start_sec', 0) if dep_wp else 0
            arr_sec = getattr(arr_wp, 'duration_from_start_sec', 0) if arr_wp else 0
            
            if dep_sec == 0 and arr_sec == 0:
                total_dist_m = ride.distance_km * 1000 if ride.distance_km else 0
                if total_dist_m <= 0 and waypoints:
                    total_dist_m = waypoints[-1].distance_from_start_m
                total_duration_min = ride.duration_min if ride.duration_min else 0
                if total_dist_m > 0 and total_duration_min > 0:
                    dep_fraction = dep_wp.distance_from_start_m / total_dist_m if dep_wp else 0.0
                    dep_min = total_duration_min * dep_fraction
                    arr_fraction = arr_wp.distance_from_start_m / total_dist_m if arr_wp else 1.0
                    arr_min = total_duration_min * arr_fraction
                    duration_segment_min = max(1, int(arr_min - dep_min))
                    
                    start_dt = datetime.combine(datetime.min, ride.departure_time)
                    dep_dt = start_dt + timedelta(minutes=dep_min)
                    arr_dt = start_dt + timedelta(minutes=arr_min)
                    dep_time = dep_dt.time()
                    arr_time = arr_dt.time()
            else:
                duration_segment_min = max(1, int(round((arr_sec - dep_sec) / 60.0)))
                start_dt = datetime.combine(datetime.min, ride.departure_time)
                dep_dt = start_dt + timedelta(seconds=dep_sec)
                arr_dt = start_dt + timedelta(seconds=arr_sec)
                dep_time = dep_dt.time()
                arr_time = arr_dt.time()
        except Exception:
            pass

        return dep_time, arr_time, duration_segment_min
