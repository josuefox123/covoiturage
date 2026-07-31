import hashlib
import requests
import logging
import math
from datetime import datetime, timedelta
from django.conf import settings
from django.utils import timezone
from django.db import transaction
from ..models import Ride, RideLeg, DirectionsCache, RideWaypoint

logger = logging.getLogger(__name__)


def haversine_km(lat1, lon1, lat2, lon2):
    """Calcule la distance en km entre deux points GPS."""
    if not all([lat1, lon1, lat2, lon2]):
        return 50.0
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    return R * c


def decode_polyline(polyline_str):
    """Décode une polyline Google Maps encodée en liste de (lat, lon)."""
    if not polyline_str:
        return []
    index, lat, lng = 0, 0, 0
    coordinates = []
    while index < len(polyline_str):
        b, shift, result = 0, 0, 0
        while True:
            b = ord(polyline_str[index]) - 63
            index += 1
            result |= (b & 0x1f) << shift
            shift += 5
            if b < 0x20:
                break
        dlat = ~(result >> 1) if (result & 1) else (result >> 1)
        lat += dlat
        shift, result = 0, 0
        while True:
            b = ord(polyline_str[index]) - 63
            index += 1
            result |= (b & 0x1f) << shift
            shift += 5
            if b < 0x20:
                break
        dlng = ~(result >> 1) if (result & 1) else (result >> 1)
        lng += dlng
        coordinates.append((lat / 1e5, lng / 1e5))
    return coordinates


def extract_locality_from_step(step):
    """
    Extrait le nom de la localité depuis un step Google Directions.
    Utilise html_instructions en supprimant les balises HTML.
    """
    import re
    instruction = step.get('html_instructions', '')
    # Supprimer les balises HTML
    clean = re.sub(r'<[^>]+>', ' ', instruction).strip()
    # Tronquer à 80 chars
    return clean[:80] if clean else ''


class RideService:
    @staticmethod
    def generate_legs(ride: Ride):
        """
        Génère et sauvegarde les tronçons individuels (RideLeg) pour un trajet donné.
        
        Améliorations BlaBlaCar-like :
        - Stocke distance_m et duration_sec réels depuis Google Directions
        - Extrait et enregistre les RideWaypoint (points GPS auto-extraits) depuis les steps
        - Permet la recherche par trajectoire sans appel Google Maps supplémentaire
        """
        stopovers = ride.stopovers or []

        # 1. Reconstruire la séquence des points d'arrêt
        nodes = []
        nodes.append({
            'name': ride.departure_location,
            'latitude': ride.departure_latitude,
            'longitude': ride.departure_longitude,
            'place_id': ride.departure_place_id or '',
            'is_stopover': True
        })
        for s in stopovers:
            nodes.append({
                'name': s.get('name', ''),
                'latitude': s.get('latitude'),
                'longitude': s.get('longitude'),
                'place_id': s.get('place_id', ''),
                'is_stopover': True
            })
        nodes.append({
            'name': ride.arrival_location,
            'latitude': ride.arrival_latitude,
            'longitude': ride.arrival_longitude,
            'place_id': ride.arrival_place_id or '',
            'is_stopover': True
        })

        num_legs = len(nodes) - 1
        if num_legs <= 0:
            logger.warning(f"Trajet {ride.id} sans segments valides.")
            return

        # 2. Récupérer ou calculer la distance/durée de chaque tronçon
        legs_data = []
        google_legs_raw = []  # Données brutes Google pour extraction des waypoints
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
                logger.info(f"Itinéraire trouvé dans le cache local pour le trajet {ride.id}.")
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
                            logger.info(f"Nouvel itinéraire mis en cache Google Directions pour le trajet {ride.id}.")
                except Exception as e:
                    logger.error(f"Échec de l'appel Google Directions pour le trajet {ride.id}: {e}")

            if route_data and 'routes' in route_data and len(route_data['routes']) > 0:
                route = route_data['routes'][0]
                overview_polyline_str = route.get('overview_polyline', {}).get('points', '')
                google_legs_raw = route.get('legs', [])
                if len(google_legs_raw) == num_legs:
                    google_success = True
                    for gl in google_legs_raw:
                        legs_data.append({
                            'duration_sec': gl.get('duration', {}).get('value', 3600),
                            'distance_m': gl.get('distance', {}).get('value', 50000),
                            'steps': gl.get('steps', []),
                        })

        if not google_success:
            # Fallback Haversine
            total_distance_km = 0
            leg_distances = []
            for i in range(num_legs):
                start = nodes[i]
                end = nodes[i + 1]
                dist = haversine_km(start['latitude'], start['longitude'], end['latitude'], end['longitude'])
                leg_distances.append(dist)
                total_distance_km += dist

            total_duration_sec = (ride.duration_min or 120) * 60
            for i in range(num_legs):
                dist = leg_distances[i]
                pct = (dist / total_distance_km) if total_distance_km > 0 else (1.0 / num_legs)
                legs_data.append({
                    'duration_sec': int(total_duration_sec * pct),
                    'distance_m': int(dist * 1000),
                    'steps': [],
                })

        # 3. Calcul intelligent du prix de chaque segment au prorata de sa distance
        leg_prices = []
        total_distance_m = sum(leg['distance_m'] for leg in legs_data)
        if total_distance_m > 0:
            for leg_info in legs_data:
                pct = leg_info['distance_m'] / total_distance_m
                price_prorated = int(round((ride.price_per_seat * pct) / 50.0) * 50)
                leg_prices.append(max(100, price_prorated))
        else:
            for _ in range(num_legs):
                leg_prices.append(max(100, int(ride.price_per_seat / num_legs)))

        # 4. Construire et sauvegarder les RideLeg + RideWaypoint en BDD
        base_datetime = datetime.combine(ride.departure_date, ride.departure_time)
        if timezone.is_naive(base_datetime):
            base_datetime = timezone.make_aware(base_datetime)

        current_time = base_datetime

        with transaction.atomic():
            # Supprimer les anciens tronçons et waypoints du trajet
            ride.legs.all().delete()
            ride.waypoints.all().delete()

            all_waypoints = []  # Accumulation pour insertion en batch
            waypoint_order_counter = 0
            cumulative_distance_m = 0

            for i in range(num_legs):
                start_node = nodes[i]
                end_node = nodes[i + 1]
                leg_info = legs_data[i]
                leg_price = leg_prices[i] if i < len(leg_prices) else 0

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

                # --- Extraction des RideWaypoint depuis les steps Google ---
                # Toujours ajouter le point de départ du leg comme waypoint
                all_waypoints.append(RideWaypoint(
                    ride=ride,
                    name=start_node['name'],
                    latitude=start_node['latitude'] or 0.0,
                    longitude=start_node['longitude'] or 0.0,
                    order=waypoint_order_counter,
                    distance_from_start_m=cumulative_distance_m,
                    leg_index=i,
                    is_stopover=start_node.get('is_stopover', False)
                ))
                waypoint_order_counter += 1

                # Extraire les points intermédiaires depuis les steps Google
                steps = leg_info.get('steps', [])
                leg_cumulative_m = 0
                for step in steps:
                    step_dist = step.get('distance', {}).get('value', 0)
                    leg_cumulative_m += step_dist

                    # Point GPS de fin du step (start_location du step suivant)
                    end_loc = step.get('end_location', {})
                    step_lat = end_loc.get('lat')
                    step_lng = end_loc.get('lng')

                    if step_lat is None or step_lng is None:
                        continue

                    # Éviter les doublons trop proches (< 200m du dernier waypoint)
                    if all_waypoints:
                        last_wp = all_waypoints[-1]
                        dist_to_last = haversine_km(
                            last_wp.latitude, last_wp.longitude, step_lat, step_lng
                        ) * 1000  # en mètres
                        if dist_to_last < 200:
                            continue

                    # Extraire le nom depuis html_instructions
                    step_name = extract_locality_from_step(step)

                    all_waypoints.append(RideWaypoint(
                        ride=ride,
                        name=step_name[:255],
                        latitude=step_lat,
                        longitude=step_lng,
                        order=waypoint_order_counter,
                        distance_from_start_m=cumulative_distance_m + leg_cumulative_m,
                        leg_index=i,
                        is_stopover=False
                    ))
                    waypoint_order_counter += 1

                cumulative_distance_m += leg_info['distance_m']

            # Ajouter la destination finale comme waypoint
            last_node = nodes[-1]
            all_waypoints.append(RideWaypoint(
                ride=ride,
                name=last_node['name'],
                latitude=last_node['latitude'] or 0.0,
                longitude=last_node['longitude'] or 0.0,
                order=waypoint_order_counter,
                distance_from_start_m=cumulative_distance_m,
                leg_index=num_legs - 1,
                is_stopover=True
            ))

            # Si aucun waypoint extrait des steps (fallback sans Google), construire depuis la polyline
            if len(all_waypoints) <= num_legs + 1 and overview_polyline_str:
                polyline_points = decode_polyline(overview_polyline_str)
                RideService._add_waypoints_from_polyline(
                    ride, polyline_points, all_waypoints, num_legs, cumulative_distance_m
                )

            # Insertion en batch
            RideWaypoint.objects.bulk_create(all_waypoints, ignore_conflicts=True)

        logger.info(f"Tronçons ({num_legs}) générés avec succès pour le trajet {ride.id}. "
                    f"{len(all_waypoints)} waypoints extraits.")

    @staticmethod
    def _add_waypoints_from_polyline(ride, polyline_points, existing_waypoints, num_legs, total_dist_m):
        """
        Complète les waypoints depuis la polyline brute si les steps ne sont pas disponibles.
        Ajoute uniquement les points qui ne sont pas déjà couverts.
        """
        if not polyline_points:
            return

        # Sous-échantillonner la polyline : 1 point tous les 500m environ
        sampled = []
        cumulative = 0
        last_lat, last_lon = polyline_points[0]
        sampled.append((last_lat, last_lon, 0))

        for lat, lon in polyline_points[1:]:
            d = haversine_km(last_lat, last_lon, lat, lon) * 1000
            cumulative += d
            if d >= 300:  # Point tous les 300m minimum
                sampled.append((lat, lon, int(cumulative)))
                last_lat, last_lon = lat, lon

        # Vérifier quels points ne sont pas déjà dans existing_waypoints
        existing_positions = {(round(wp.latitude, 4), round(wp.longitude, 4)) for wp in existing_waypoints}
        order_start = max(wp.order for wp in existing_waypoints) + 1 if existing_waypoints else 0

        for idx, (lat, lon, dist) in enumerate(sampled):
            if (round(lat, 4), round(lon, 4)) not in existing_positions:
                existing_waypoints.append(RideWaypoint(
                    ride=ride,
                    name='',
                    latitude=lat,
                    longitude=lon,
                    order=order_start + idx,
                    distance_from_start_m=dist,
                    leg_index=0,
                    is_stopover=False
                ))
