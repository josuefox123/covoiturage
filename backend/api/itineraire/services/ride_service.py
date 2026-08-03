import hashlib
import requests
import logging
from datetime import datetime, timedelta
from django.conf import settings
from django.utils import timezone
from django.db import transaction

logger = logging.getLogger(__name__)

from ...models.trajet import Ride, RideLeg, DirectionsCache, RideWaypoint
from .calcul_itineraire import (
    haversine_km,
    decode_polyline,
    extract_locality_from_step,
    find_cities_along_route,
    _extract_leg_distance,
    _extract_leg_duration,
)

class RideService:
    @staticmethod
    def generate_legs(ride: Ride):
        """
        Génère et sauvegarde les segments (RideLeg) et les points de passage (RideWaypoint)
        pour un trajet. Comportement type BlaBlaCar de haute performance.
        """
        stopovers = ride.stopovers or []
        polyline = []
        google_legs_raw = []
        google_success = False
        overview_polyline_str = ''
        api_key = getattr(settings, 'GOOGLE_MAPS_API_KEY', '')

        if api_key and ride.departure_latitude and ride.arrival_latitude:
            dep_key = ride.departure_place_id or f"{ride.departure_latitude},{ride.departure_longitude}"
            arr_key = ride.arrival_place_id or f"{ride.arrival_latitude},{ride.arrival_longitude}"
            waypoints_str = "|".join(
                s.get('place_id') or f"{s.get('latitude')},{s.get('longitude')}"
                for s in stopovers
            )
            hash_input = f"{dep_key}|{waypoints_str}|{arr_key}"
            waypoints_hash = hashlib.sha256(hash_input.encode('utf-8')).hexdigest()

            cache_entry = DirectionsCache.objects.filter(waypoints_hash=waypoints_hash).first()
            route_data = None
            if cache_entry:
                route_data = cache_entry.route_data
                logger.info(f"Itinéraire chargé du cache local pour trajet {ride.id}.")
            else:
                try:
                    origin = f"{ride.departure_latitude},{ride.departure_longitude}"
                    destination = f"{ride.arrival_latitude},{ride.arrival_longitude}"
                    params = {
                        'origin': origin,
                        'destination': destination,
                        'key': api_key
                    }
                    if stopovers:
                        params['waypoints'] = "|".join(f"{s.get('latitude')},{s.get('longitude')}" for s in stopovers)

                    url = "https://maps.googleapis.com/maps/api/directions/json"
                    response = requests.get(url, params=params, timeout=10)
                    if response.status_code == 200:
                        res_json = response.json()
                        if res_json.get('status') == 'OK':
                            route_data = res_json
                            DirectionsCache.objects.create(
                                waypoints_hash=waypoints_hash,
                                origin_place_id=ride.departure_place_id or '',
                                destination_place_id=ride.arrival_place_id or '',
                                route_data=route_data
                            )
                            logger.info(f"Nouvel itinéraire Google Directions mis en cache pour trajet {ride.id}.")
                except Exception as e:
                    logger.error(f"Échec appel Google Directions trajet {ride.id}: {e}")

            if route_data and 'routes' in route_data and len(route_data['routes']) > 0:
                route = route_data['routes'][0]
                overview_polyline_str = route.get('overview_polyline', {}).get('points', '')
                google_legs_raw = route.get('legs', [])
                if overview_polyline_str:
                    polyline = decode_polyline(overview_polyline_str)
                    google_success = True

        if not google_success:
            try:
                coords = [f"{ride.departure_longitude},{ride.departure_latitude}"]
                for s in stopovers:
                    coords.append(f"{s.get('longitude')},{s.get('latitude')}")
                coords.append(f"{ride.arrival_longitude},{ride.arrival_latitude}")
                coords_str = ";".join(coords)
                url = f"https://router.project-osrm.org/route/v1/driving/{coords_str}?overview=full&geometries=geojson&steps=true"
                response = requests.get(url, timeout=10)
                if response.status_code == 200:
                    res_json = response.json()
                    if res_json.get('code') == 'Ok' and 'routes' in res_json and len(res_json['routes']) > 0:
                        route = res_json['routes'][0]
                        google_legs_raw = route.get('legs', [])
                        coords = route.get('geometry', {}).get('coordinates', [])
                        polyline = [(pt[1], pt[0]) for pt in coords]
                        google_success = True
                        logger.info(f"Itinéraire résolu avec succès via OSRM pour trajet {ride.id}.")
            except Exception as e:
                logger.error(f"Échec appel OSRM trajet {ride.id}: {e}")

        if not google_success or not polyline:
            polyline = [
                (ride.departure_latitude, ride.departure_longitude),
                (ride.arrival_latitude, ride.arrival_longitude)
            ]
            total_duration_sec = (ride.duration_min or 120) * 60
            dist_m = int(haversine_km(ride.departure_latitude, ride.departure_longitude, ride.arrival_latitude, ride.arrival_longitude) * 1000)
            google_legs_raw = [{
                'duration': {'value': total_duration_sec},
                'distance': {'value': dist_m},
                'steps': []
            }]

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

        auto_stopovers = []
        if polyline:
            detected_cities = find_cities_along_route(polyline)
            for city in detected_cities:
                d_start = haversine_km(ride.departure_latitude, ride.departure_longitude, city['latitude'], city['longitude'])
                d_end = haversine_km(ride.arrival_latitude, ride.arrival_longitude, city['latitude'], city['longitude'])
                if d_start > 8.0 and d_end > 8.0:
                    auto_stopovers.append({
                        'name': city['name'],
                        'latitude': city['latitude'],
                        'longitude': city['longitude'],
                        'stop_duration_min': 10
                    })

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

        ride.stopovers = [{
            'name': fs['name'],
            'latitude': fs['latitude'],
            'longitude': fs['longitude']
        } for fs in final_stopovers]
        ride.save(update_fields=['stopovers'])

        nodes = []
        nodes.append({
            'name': ride.departure_location,
            'latitude': ride.departure_latitude,
            'longitude': ride.departure_longitude,
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
            'latitude': ride.arrival_latitude,
            'longitude': ride.arrival_longitude,
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
            last_dist, last_dur = 0, 0
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

        leg_prices = []
        total_legs_distance_m = sum(leg['distance_m'] for leg in legs_data)
        if total_legs_distance_m > 0:
            for leg_info in legs_data:
                pct = leg_info['distance_m'] / total_legs_distance_m
                price_prorated = int(round((ride.price_per_seat * pct) / 50.0) * 50)
                leg_prices.append(max(100, price_prorated))
        else:
            for _ in range(num_legs):
                leg_prices.append(max(100, int(round((ride.price_per_seat / num_legs) / 50.0) * 50)))

        candidates = []

        d_dist, d_dur = get_polyline_match(ride.departure_latitude, ride.departure_longitude)
        candidates.append({
            'name': ride.departure_location,
            'latitude': ride.departure_latitude,
            'longitude': ride.departure_longitude,
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

        a_dist, a_dur = get_polyline_match(ride.arrival_latitude, ride.arrival_longitude)
        candidates.append({
            'name': ride.arrival_location,
            'latitude': ride.arrival_latitude,
            'longitude': ride.arrival_longitude,
            'waypoint_type': 'arrival',
            'is_stopover': True,
            'distance': a_dist,
            'duration': a_dur
        })

        candidates.sort(key=lambda x: x['distance'])
        
        merged_waypoints = []
        priority_map = {'departure': 4, 'arrival': 4, 'stopover': 3, 'city': 2, 'gps': 1}

        for c in candidates:
            if not merged_waypoints:
                merged_waypoints.append(c)
                continue

            last = merged_waypoints[-1]
            dist_to_last = haversine_km(last['latitude'], last['longitude'], c['latitude'], c['longitude']) * 1000

            if dist_to_last < 2000:
                p_last = priority_map.get(last['waypoint_type'], 1)
                p_curr = priority_map.get(c['waypoint_type'], 1)
                if p_curr > p_last:
                    merged_waypoints[-1] = c
                elif p_curr == p_last:
                    if not last['name'] and c['name']:
                        last['name'] = c['name']
            else:
                if c['name'] and last['name'] and c['name'].lower().strip() == last['name'].lower().strip():
                    continue
                merged_waypoints.append(c)

        base_datetime = datetime.combine(ride.departure_date, ride.departure_time)
        if timezone.is_naive(base_datetime):
            base_datetime = timezone.make_aware(base_datetime)

        with transaction.atomic():
            ride.legs.all().delete()
            ride.waypoints.all().delete()

            current_time = base_datetime
            for i in range(num_legs):
                start_node = nodes[i]
                end_node = nodes[i + 1]
                leg_info = legs_data[i]
                leg_price = leg_prices[i]

                dep_time = current_time
                arr_time = current_time + timedelta(seconds=leg_info['duration_sec'])
                current_time = arr_time + timedelta(minutes=5)

                RideLeg.objects.create(
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
                    duration_sec=leg_info['duration_sec'],
                )

            final_waypoint_instances = []
            legs_list = list(ride.legs.all().order_by('order'))
            leg_limits = []
            cum = 0
            for lg in legs_list:
                cum += lg.distance_m
                leg_limits.append(cum)

            def find_leg_index(dist_m):
                if not leg_limits:
                    return 0
                for idx, limit in enumerate(leg_limits):
                    if dist_m <= limit:
                        return idx
                return max(0, len(leg_limits) - 1)

            for idx, w in enumerate(merged_waypoints):
                leg_idx = find_leg_index(w['distance'])
                is_stop = w['waypoint_type'] in ['departure', 'stopover', 'arrival']
                
                final_waypoint_instances.append(RideWaypoint(
                    ride=ride,
                    name=w['name'][:255],
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

            RideWaypoint.objects.bulk_create(final_waypoint_instances)

        logger.info(f"Création réussie de {num_legs} RideLegs et {len(merged_waypoints)} RideWaypoints pour le trajet {ride.id}.")
