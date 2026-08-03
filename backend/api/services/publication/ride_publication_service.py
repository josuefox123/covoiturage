import logging
from datetime import datetime, timedelta
from django.utils import timezone
from django.db import transaction

from ...models.trajet import Ride
from ...repositories.ride_repository import RideRepository
from ...cartographie.routes import RoutesOrchestrator
from ...calculs.calcul_distance import haversine_km
from ...itineraire.services.calcul_itineraire import (
    extract_locality_from_step,
    find_cities_along_route,
    _extract_leg_distance,
    _extract_leg_duration,
)
from .ride_leg_service import RideLegService
from .ride_waypoint_service import RideWaypointService

logger = logging.getLogger(__name__)

class RidePublicationService:
    """Service d'orchestration pour la publication d'un trajet et l'enrichissement de son itinéraire."""

    @staticmethod
    def generate_legs(ride: Ride) -> None:
        """
        Génère et sauvegarde les segments (RideLeg) et les points de passage (RideWaypoint)
        pour un trajet.
        """
        stopovers = ride.stopovers or []
        polyline = []
        google_legs_raw = []
        route_resolved = False
        overview_polyline_str = ''

        dep_lat = ride.departure_latitude or 0.0
        dep_lon = ride.departure_longitude or 0.0
        arr_lat = ride.arrival_latitude or 0.0
        arr_lon = ride.arrival_longitude or 0.0

        # 1. Résolution de l'itinéraire via l'Orchestrateur (Google -> OSRM -> Haversine)
        polyline, google_legs_raw, route_resolved = RoutesOrchestrator.get_route(
            origin_lat=dep_lat,
            origin_lon=dep_lon,
            dest_lat=arr_lat,
            dest_lon=arr_lon,
            stopovers=stopovers,
            origin_place_id=ride.departure_place_id or '',
            dest_place_id=ride.arrival_place_id or '',
            default_duration_min=ride.duration_min or 120
        )

        # 4. Calcul de l'avancement cumulé sur la polyline
        polyline_stats = []
        current_cum_m = 0
        if polyline:
            polyline_stats.append({
                'lat': polyline[0][0],
                'lng': polyline[0][1],
                'dist_m': 0,
                'pct': 0.0
            })
            prev_lat, prev_lng = polyline[0]
            for pt in polyline[1:]:
                d = haversine_km(prev_lat, prev_lng, pt[0], pt[1]) * 1000
                current_cum_m += d
                polyline_stats.append({
                    'lat': pt[0],
                    'lng': pt[1],
                    'dist_m': current_cum_m,
                    'pct': 0.0
                })
                prev_lat, prev_lng = pt[0], pt[1]

            if current_cum_m > 0:
                for ps in polyline_stats:
                    ps['pct'] = ps['dist_m'] / current_cum_m

        total_actual_dist_m = sum(_extract_leg_distance(lg) for lg in google_legs_raw)
        total_actual_duration_sec = sum(_extract_leg_duration(lg) for lg in google_legs_raw)

        if total_actual_dist_m <= 0:
            total_actual_dist_m = current_cum_m or 1000
        if total_actual_duration_sec <= 0:
            total_actual_duration_sec = (ride.duration_min or 120) * 60

        scale_factor = total_actual_dist_m / current_cum_m if current_cum_m > 0 else 1.0
        for ps in polyline_stats:
            ps['dist_m'] = int(ps['dist_m'] * scale_factor)

        # Helper d'interpolation locale
        def get_polyline_match(lat, lng):
            if not polyline_stats:
                return 0, 0
            best_idx = 0
            best_d = 9999.0
            for idx, ps in enumerate(polyline_stats):
                d = haversine_km(lat, lng, ps['lat'], ps['lng'])
                if d < best_d:
                    best_d = d
                    best_idx = idx
            matched = polyline_stats[best_idx]
            est_duration = int(total_actual_duration_sec * matched['pct'])
            return matched['dist_m'], est_duration

        # 5. Détection automatique des villes étapes intermédiaires
        auto_stopovers = []
        if polyline:
            detected_cities = find_cities_along_route(polyline)
            for city in detected_cities:
                d_start = haversine_km(dep_lat, dep_lon, city['latitude'], city['longitude'])
                d_end = haversine_km(arr_lat, arr_lon, city['latitude'], city['longitude'])
                if d_start > 8.0 and d_end > 8.0:
                    auto_stopovers.append({
                        'name': city['name'],
                        'latitude': city['latitude'],
                        'longitude': city['longitude'],
                        'stop_duration_min': 10
                    })

        # 6. Tri et fusion des points d'arrêt
        final_stopovers = []
        if stopovers:
            for s in stopovers:
                final_stopovers.append({
                    'name': s.get('name', ''),
                    'latitude': float(s.get('latitude')),
                    'longitude': float(s.get('longitude')),
                    'is_driver': True
                })
        else:
            for ac in auto_stopovers:
                final_stopovers.append({
                    'name': ac['name'],
                    'latitude': ac['latitude'],
                    'longitude': ac['longitude'],
                    'is_driver': False
                })

        def get_node_polyline_index(node):
            if not polyline:
                return 0
            best_idx = 0
            best_d = 9999.0
            for idx, pt in enumerate(polyline):
                d = haversine_km(node['latitude'], node['longitude'], pt[0], pt[1])
                if d < best_d:
                    best_d = d
                    best_idx = idx
            return best_idx

        final_stopovers.sort(key=get_node_polyline_index)

        # Sauvegarde des escales validées
        ride.stopovers = [{
            'name': fs['name'],
            'latitude': fs['latitude'],
            'longitude': fs['longitude']
        } for fs in final_stopovers]
        ride.save(update_fields=['stopovers'])

        # 7. Préparation des nœuds et tronçons (legs)
        nodes = []
        nodes.append({
            'name': ride.departure_location,
            'latitude': dep_lat,
            'longitude': dep_lon,
            'place_id': ride.departure_place_id or '',
            'waypoint_type': 'departure'
        })
        for fs in final_stopovers:
            nodes.append({
                'name': fs['name'],
                'latitude': fs['latitude'],
                'longitude': fs['longitude'],
                'place_id': '',
                'waypoint_type': 'stopover' if fs.get('is_driver') else 'city'
            })
        nodes.append({
            'name': ride.arrival_location,
            'latitude': arr_lat,
            'longitude': arr_lon,
            'place_id': ride.arrival_place_id or '',
            'waypoint_type': 'arrival'
        })

        num_legs = len(nodes) - 1
        if num_legs <= 0:
            logger.warning(f"Trajet {ride.id} sans tronçon valide.")
            return

        legs_data = []
        if len(google_legs_raw) == num_legs:
            for gl in google_legs_raw:
                legs_data.append({
                    'duration_sec': _extract_leg_duration(gl) or 3600,
                    'distance_m': _extract_leg_distance(gl) or 50000,
                    'steps': gl.get('steps', [])
                })
        else:
            for idx in range(num_legs):
                start_n = nodes[idx]
                end_n = nodes[idx + 1]
                s_dist, s_dur = get_polyline_match(start_n['latitude'], start_n['longitude'])
                e_dist, e_dur = get_polyline_match(end_n['latitude'], end_n['longitude'])
                
                leg_dist = max(1000, e_dist - s_dist)
                leg_dur = max(60, e_dur - s_dur)
                
                legs_data.append({
                    'duration_sec': leg_dur,
                    'distance_m': leg_dist,
                    'steps': []
                })

        # 8. Préparation des points de passage candidats
        candidates = []
        d_dist, d_dur = get_polyline_match(dep_lat, dep_lon)
        candidates.append({
            'name': ride.departure_location,
            'latitude': dep_lat,
            'longitude': dep_lon,
            'waypoint_type': 'departure',
            'is_stopover': True,
            'distance': d_dist,
            'duration': d_dur
        })

        for leg_info in legs_data:
            for step in leg_info.get('steps', []):
                end_loc = step.get('end_location', {})
                slat, slng = end_loc.get('lat'), end_loc.get('lng')
                if slat is not None and slng is not None:
                    step_name = extract_locality_from_step(step)
                    st_dist, st_dur = get_polyline_match(slat, slng)
                    candidates.append({
                        'name': step_name,
                        'latitude': slat,
                        'longitude': slng,
                        'waypoint_type': 'city' if step_name else 'gps',
                        'is_stopover': False,
                        'distance': st_dist,
                        'duration': st_dur
                    })

        if polyline:
            detected_cities = find_cities_along_route(polyline)
            for city in detected_cities:
                c_dist, c_dur = get_polyline_match(city['latitude'], city['longitude'])
                candidates.append({
                    'name': city['name'],
                    'latitude': city['latitude'],
                    'longitude': city['longitude'],
                    'waypoint_type': 'city',
                    'is_stopover': False,
                    'distance': c_dist,
                    'duration': c_dur
                })

        if polyline_stats:
            last_sampled_dist = 0
            for ps in polyline_stats:
                if ps['dist_m'] - last_sampled_dist >= 500:
                    candidates.append({
                        'name': '',
                        'latitude': ps['lat'],
                        'longitude': ps['lng'],
                        'waypoint_type': 'gps',
                        'is_stopover': False,
                        'distance': ps['dist_m'],
                        'duration': int(total_actual_duration_sec * ps['pct'])
                    })
                    last_sampled_dist = ps['dist_m']

        a_dist, a_dur = get_polyline_match(arr_lat, arr_lon)
        candidates.append({
            'name': ride.arrival_location,
            'latitude': arr_lat,
            'longitude': arr_lon,
            'waypoint_type': 'arrival',
            'is_stopover': True,
            'distance': a_dist,
            'duration': a_dur
        })

        base_datetime = datetime.combine(ride.departure_date, ride.departure_time)
        if timezone.is_naive(base_datetime):
            base_datetime = timezone.make_aware(base_datetime)

        # 9. Transaction atomique pour l'insertion via les services de niveau inférieur
        with transaction.atomic():
            legs_list = RideLegService.generate_legs(ride, nodes, legs_data, base_datetime)
            RideWaypointService.generate_waypoints(ride, candidates, legs_list)
