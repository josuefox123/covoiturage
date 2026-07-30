import hashlib
import requests
import logging
from datetime import datetime, timedelta
from django.conf import settings
from django.utils import timezone
from django.db import transaction
from ..models import Ride, RideLeg, DirectionsCache

logger = logging.getLogger(__name__)

class RideService:
    @staticmethod
    def generate_legs(ride: Ride):
        """
        Génère et sauvegarde les tronçons individuels (RideLeg) pour un trajet donné.
        Utilise l'API Google Directions (avec cache) si possible, sinon applique un calcul estimatif fallback.
        """
        stopovers = ride.stopovers or []
        
        # 1. Reconstruire la séquence des points d'arrêt
        nodes = []
        # Origin
        nodes.append({
            'name': ride.departure_location,
            'latitude': ride.departure_latitude,
            'longitude': ride.departure_longitude
        })
        # Stopovers
        for s in stopovers:
            nodes.append({
                'name': s.get('name', ''),
                'latitude': s.get('latitude'),
                'longitude': s.get('longitude')
            })
        # Destination
        nodes.append({
            'name': ride.arrival_location,
            'latitude': ride.arrival_latitude,
            'longitude': ride.arrival_longitude
        })

        num_legs = len(nodes) - 1
        if num_legs <= 0:
            logger.warning(f"Trajet {ride.id} sans segments valides.")
            return

        # 2. Déterminer les prix de chaque tronçon
        leg_prices = []
        if len(stopovers) == 0:
            # Trajet direct
            leg_prices.append(ride.price_per_seat)
        else:
            # Tronçon 0: Origin -> Stopover 0
            leg_prices.append(stopovers[0].get('price', 0))
            # Tronçons intermédiaires: Stopover i-1 -> Stopover i
            for i in range(1, len(stopovers)):
                leg_prices.append(stopovers[i].get('price', 0))
            # Dernier tronçon: Stopover final -> Destination
            leg_prices.append(stopovers[-1].get('arrival_price', 0))

        # 3. Récupérer ou calculer la distance/durée de chaque tronçon
        legs_data = []
        google_success = False
        
        api_key = getattr(settings, 'GOOGLE_MAPS_API_KEY', '')
        if api_key and ride.departure_latitude and ride.arrival_latitude:
            # Calculer le hash pour le cache d'itinéraire
            # On inclut les place_id dans le hash si disponibles, sinon les coordonnées
            dep_key = ride.departure_place_id or f"{ride.departure_latitude},{ride.departure_longitude}"
            arr_key = ride.arrival_place_id or f"{ride.arrival_latitude},{ride.arrival_longitude}"
            waypoints_str = "|".join(
                s.get('place_id') or f"{s.get('latitude')},{s.get('longitude')}"
                for s in stopovers
            )
            hash_input = f"{dep_key}|{waypoints_str}|{arr_key}"
            waypoints_hash = hashlib.sha256(hash_input.encode('utf-8')).hexdigest()
            
            # Recherche dans le cache local
            cache_entry = DirectionsCache.objects.filter(
                waypoints_hash=waypoints_hash
            ).first()
            
            route_data = None
            if cache_entry:
                route_data = cache_entry.route_data
                logger.info(f"Itinéraire trouvé dans le cache local pour le trajet {ride.id}.")
            else:
                # Appeler l'API Google Directions
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
                            # Enregistrer dans le cache, avec les place_id si disponibles
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
                google_legs = route_data['routes'][0].get('legs', [])
                if len(google_legs) == num_legs:
                    google_success = True
                    for gl in google_legs:
                        legs_data.append({
                            'duration_sec': gl.get('duration', {}).get('value', 3600),
                            'distance_m': gl.get('distance', {}).get('value', 50000)
                        })

        if not google_success:
            # Fallback estimation proportionnelle basé sur la distance à vol d'oiseau
            import math
            def get_haversine_distance(lat1, lon1, lat2, lon2):
                if not all([lat1, lon1, lat2, lon2]):
                    return 50.0  # 50km par défaut
                R = 6371.0 # Rayon terrestre en km
                dlat = math.radians(lat2 - lat1)
                dlon = math.radians(lon2 - lon1)
                a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
                c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
                return R * c

            total_distance_km = 0
            leg_distances = []
            for i in range(num_legs):
                start = nodes[i]
                end = nodes[i+1]
                dist = get_haversine_distance(start['latitude'], start['longitude'], end['latitude'], end['longitude'])
                leg_distances.append(dist)
                total_distance_km += dist
            
            total_duration_sec = (ride.duration_min or 120) * 60
            for i in range(num_legs):
                dist = leg_distances[i]
                pct = (dist / total_distance_km) if total_distance_km > 0 else (1.0 / num_legs)
                legs_data.append({
                    'duration_sec': int(total_duration_sec * pct),
                    'distance_m': int(dist * 1000)
                })

        # 4. Construire et sauvegarder les RideLeg en BDD
        # Combiner date et heure de départ
        base_datetime = datetime.combine(ride.departure_date, ride.departure_time)
        if timezone.is_naive(base_datetime):
            base_datetime = timezone.make_aware(base_datetime)
            
        current_time = base_datetime
        
        with transaction.atomic():
            # Supprimer les anciens tronçons du trajet
            ride.legs.all().delete()
            
            for i in range(num_legs):
                start_node = nodes[i]
                end_node = nodes[i+1]
                leg_info = legs_data[i]
                
                leg_price = leg_prices[i] if i < len(leg_prices) else 0
                
                dep_time = current_time
                arr_time = current_time + timedelta(seconds=leg_info['duration_sec'])
                
                # Prochain départ = arrivée actuelle + 5 minutes de pause
                current_time = arr_time + timedelta(minutes=5)
                
                RideLeg.objects.create(
                    ride=ride,
                    start_location=start_node['name'],
                    end_location=end_node['name'],
                    start_latitude=start_node['latitude'] or 0.0,
                    start_longitude=start_node['longitude'] or 0.0,
                    end_latitude=end_node['latitude'] or 0.0,
                    end_longitude=end_node['longitude'] or 0.0,
                    # Propager les place_id sur le tronçon
                    start_place_id=start_node.get('place_id') or '',
                    end_place_id=end_node.get('place_id') or '',
                    departure_time=dep_time,
                    arrival_time=arr_time,
                    seats_available=ride.seats_available,
                    price=leg_price,
                    order=i
                )
                
        logger.info(f"Tronçons ({num_legs}) générés avec succès pour le trajet {ride.id}.")
