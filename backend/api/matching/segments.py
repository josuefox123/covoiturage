from typing import List, Optional, Any, Dict
from .waypoints import WaypointMatcher

class SegmentMatcher:
    """Service validant la disponibilité des places et les correspondances de segments de trajets."""

    @staticmethod
    def match_via_waypoints(
        ride: Any,
        waypoints: List[Any],
        dep_lat: Optional[float],
        dep_lon: Optional[float],
        arr_lat: Optional[float],
        arr_lon: Optional[float],
        seats_requested: int,
        max_radius_km: float,
        price_calculator,
        timing_calculator
    ) -> Optional[Dict[str, Any]]:
        """
        Vérifie si les points de passage correspondent aux points de recherche,
        vérifie les places disponibles sur le segment et calcule le prix et les temps estimés.
        """
        dep_wp, dep_dist = (
            WaypointMatcher.find_closest_waypoint(waypoints, dep_lat, dep_lon, max_radius_km)
            if dep_lat is not None and dep_lon is not None else (waypoints[0], 0.0)
        )
        arr_wp, arr_dist = (
            WaypointMatcher.find_closest_waypoint(waypoints, arr_lat, arr_lon, max_radius_km)
            if arr_lat is not None and arr_lon is not None else (waypoints[-1], 0.0)
        )

        if dep_lat is not None and dep_wp is None:
            return None
        if arr_lat is not None and arr_wp is None:
            return None

        dep_order = dep_wp.order if dep_wp else 0
        arr_order = arr_wp.order if arr_wp else len(waypoints) - 1

        if dep_order >= arr_order:
            return None

        dep_leg_idx = dep_wp.leg_index if dep_wp else 0
        arr_leg_idx = arr_wp.leg_index if arr_wp else max(0, ride.legs.count() - 1)

        segment_wps = [wp for wp in waypoints if dep_order <= wp.order < arr_order]
        if segment_wps:
            available_seats = min(wp.seats_available for wp in segment_wps)
        else:
            available_seats = ride.seats_available

        if available_seats < seats_requested:
            return None

        pricing = price_calculator.calculate_segment_price(ride, dep_leg_idx, arr_leg_idx, seats=1)
        price = pricing['total_price']

        if not price:
            price = ride.price_per_seat

        max_approach = max(dep_dist, arr_dist)
        radius_category, approach_text = timing_calculator.categorize_approach(max_approach)

        legs_list = list(ride.legs.order_by('order'))
        dep_leg = legs_list[dep_leg_idx] if dep_leg_idx < len(legs_list) else None
        arr_leg = legs_list[arr_leg_idx] if arr_leg_idx < len(legs_list) else None

        dep_time, arr_time, duration_segment_min = timing_calculator.estimate_passage_times(
            ride, dep_wp, arr_wp, waypoints
        )

        return {
            'type': 'direct',
            'ride': ride,
            'departure_leg': dep_leg,
            'arrival_leg': arr_leg,
            'dep_leg_idx': dep_leg_idx,
            'arr_leg_idx': arr_leg_idx,
            'dep_waypoint_order': dep_order,
            'arr_waypoint_order': arr_order,
            'price': price,
            'pricing_detail': pricing,
            'departure_time': dep_time,
            'arrival_time': arr_time,
            'duration_segment_min': duration_segment_min,
            'seats_available': available_seats,
            'walk_distance_origin_km': dep_dist,
            'walk_distance_dest_km': arr_dist,
            'radius_category': radius_category,
            'approach_duration_text': approach_text,
            'approach_duration_sec': int(dep_dist * 3600 / 5) if max_approach <= 0.5 else int(dep_dist * 3600 / 25),
            'approach_distance_m': int(dep_dist * 1000),
            'search_method': 'waypoints',
        }
