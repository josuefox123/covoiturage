import math
import logging
import hashlib
from datetime import datetime, timedelta
from django.utils import timezone
from django.conf import settings
from django.core.cache import cache
from ..models import Ride, RideLeg, DirectionsCache

logger = logging.getLogger(__name__)


def get_haversine_distance(lat1, lon1, lat2, lon2):
    if not all([lat1, lon1, lat2, lon2]):
        return 9999.0
    R = 6371.0  # Rayon de la Terre en km
    try:
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
        return R * c
    except Exception:
        return 9999.0


def decode_polyline(polyline_str):
    """Décode une chaîne de caractères polyline de Google Maps en liste de coordonnées GPS (lat, lon)."""
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


def get_ride_polyline_points(ride):
    """
    Calcule le hash des waypoints du trajet pour récupérer les données d'itinéraire
    depuis le DirectionsCache et retourne la liste des coordonnées (lat, lon) décodées.
    """
    try:
        dep_key = ride.departure_place_id or f"{ride.departure_latitude},{ride.departure_longitude}"
        arr_key = ride.arrival_place_id or f"{ride.arrival_latitude},{ride.arrival_longitude}"
        
        stopovers = ride.stopovers or []
        waypoints_str = "|".join(
            s.get('place_id') or f"{s.get('latitude')},{s.get('longitude')}"
            for s in stopovers
        )
        hash_input = f"{dep_key}|{waypoints_str}|{arr_key}"
        waypoints_hash = hashlib.sha256(hash_input.encode('utf-8')).hexdigest()
        
        cache_obj = DirectionsCache.objects.filter(waypoints_hash=waypoints_hash).first()
        if cache_obj and cache_obj.route_data:
            routes = cache_obj.route_data.get('routes', [])
            if routes:
                points_str = routes[0].get('overview_polyline', {}).get('points', '')
                if points_str:
                    return decode_polyline(points_str)
    except Exception as e:
        logger.warning(f"Error retrieving polyline for ride {ride.id}: {e}")
    return []


class SearchService:
    @staticmethod
    def find_rides(departure_lat, departure_lon, arrival_lat, arrival_lon, target_date, seats_requested=1,
                   departure_place_id=None, arrival_place_id=None, time_filter=None):
        """
        Recherche de trajets BlaBlaCar-like avec détection de proximité le long de la POLYLINE du trajet.
        
        Vérifie si le passager peut monter et descendre en cours de route sur le tracé du chauffeur
        en respectant l'ordre chronologique des points GPS.
        
        ZÉRO coût d'API Google Maps lors de la recherche.
        """
        if isinstance(target_date, str):
            target_date = datetime.strptime(target_date, "%Y-%m-%d").date()

        # 1. Gestion du Cache des Recherches
        lat_d_r = round(departure_lat, 3) if departure_lat is not None else 0.0
        lon_d_r = round(departure_lon, 3) if departure_lon is not None else 0.0
        lat_a_r = round(arrival_lat, 3) if arrival_lat is not None else 0.0
        lon_a_r = round(arrival_lon, 3) if arrival_lon is not None else 0.0
        
        cache_key = f"search_{lat_d_r}_{lon_d_r}_{lat_a_r}_{lon_a_r}_{target_date}_{seats_requested}"
        if departure_place_id:
            cache_key += f"_{departure_place_id}"
        if arrival_place_id:
            cache_key += f"_{arrival_place_id}"
        if time_filter:
            cache_key += f"_{time_filter}"
            
        cached_res = cache.get(cache_key)
        if cached_res:
            logger.info(f"Serve search results from cache: {cache_key}")
            return cached_res

        # Rayon de recherche maximal (tolérance maximale de 5.0 km)
        MAX_RADIUS_KM = 5.0

        base_filters = {
            'departure_date': target_date,
            'status__in': ['active', 'started'],
        }

        # 2. Présélectionner les trajets du jour
        candidate_rides = Ride.objects.filter(**base_filters).select_related('driver', 'vehicle').prefetch_related('legs')

        # Filtre optionnel par heure (±1h)
        if time_filter:
            try:
                wanted_time = datetime.strptime(time_filter, "%H:%M").time()
                dt_ref = datetime.combine(target_date, wanted_time)
                from django.utils import timezone as tz
                dt_min = tz.make_aware(dt_ref - timedelta(hours=1))
                dt_max = tz.make_aware(dt_ref + timedelta(hours=1))
                candidate_rides = candidate_rides.filter(departure_time__gte=dt_min.time(), departure_time__lte=dt_max.time())
            except Exception:
                pass

        direct_matches = []

        # 3. Vérification de compatibilité sur la Polyline (Cas A : Directs)
        for ride in candidate_rides:
            polyline = get_ride_polyline_points(ride)
            
            # Fallback : reconstituer la polyline avec les coordonnées des jambes si non trouvée
            if not polyline:
                legs = list(ride.legs.all().order_by('order'))
                for leg in legs:
                    polyline.append((leg.start_latitude, leg.start_longitude))
                if legs:
                    polyline.append((legs[-1].end_latitude, legs[-1].end_longitude))
            
            if not polyline:
                continue

            # Trouver le point de la polyline le plus proche du départ du passager (si fourni)
            min_dep_dist = 9999.0
            idx_dep = -1
            if departure_lat is not None and departure_lon is not None:
                for idx, pt in enumerate(polyline):
                    d = get_haversine_distance(departure_lat, departure_lon, pt[0], pt[1])
                    if d < min_dep_dist:
                        min_dep_dist = d
                        idx_dep = idx
            else:
                min_dep_dist = 0.0
                idx_dep = 0

            # Trouver le point de la polyline le plus proche de l'arrivée du passager (si fourni)
            min_arr_dist = 9999.0
            idx_arr = -1
            if arrival_lat is not None and arrival_lon is not None:
                for idx, pt in enumerate(polyline):
                    d = get_haversine_distance(arrival_lat, arrival_lon, pt[0], pt[1])
                    if d < min_arr_dist:
                        min_arr_dist = d
                        idx_arr = idx
            else:
                min_arr_dist = 0.0
                idx_arr = len(polyline) - 1

            # Vérifier si les points respectent le rayon maximal de 5.0 km
            dep_ok = (departure_lat is None or min_dep_dist <= MAX_RADIUS_KM)
            arr_ok = (arrival_lat is None or min_arr_dist <= MAX_RADIUS_KM)

            if dep_ok and arr_ok:
                # Si les deux sont fournis, vérifier l'ordre chronologique
                if idx_dep <= idx_arr:
                    max_approach = max(min_dep_dist, min_arr_dist)
                    
                    # Déterminer la catégorie de rayon de recherche
                    if max_approach <= 0.5:
                        radius_category = 0.5
                        approach_duration_text = f"{max(1, int(min_dep_dist * 1000 / 83))} min à pied" if departure_lat is not None else ""
                    elif max_approach <= 1.0:
                        radius_category = 1.0
                        approach_duration_text = f"{max(1, int(min_dep_dist * 1000 / 416))} min en moto" if departure_lat is not None else ""
                    elif max_approach <= 2.0:
                        radius_category = 2.0
                        approach_duration_text = f"{max(1, int(min_dep_dist * 1000 / 416))} min en moto" if departure_lat is not None else ""
                    else:
                        radius_category = 5.0
                        approach_duration_text = f"{max(1, int(min_dep_dist * 1000 / 416))} min en moto" if departure_lat is not None else ""

                    # Vérifier les places disponibles et calculer le prix réel basé sur les jambes parcourues
                    ride_legs = list(ride.legs.all().order_by('order'))
                    dep_leg_idx = -1
                    arr_leg_idx = -1
                    
                    for idx_leg, leg in enumerate(ride_legs):
                        if dep_leg_idx == -1:
                            d_start = get_haversine_distance(polyline[idx_dep][0], polyline[idx_dep][1], leg.start_latitude, leg.start_longitude)
                            if d_start <= 6.0:
                                dep_leg_idx = idx_leg
                        d_end = get_haversine_distance(polyline[idx_arr][0], polyline[idx_arr][1], leg.end_latitude, leg.end_longitude)
                        if d_end <= 6.0:
                            arr_leg_idx = idx_leg
                            
                    if dep_leg_idx == -1:
                        dep_leg_idx = 0
                    if arr_leg_idx == -1 or arr_leg_idx < dep_leg_idx:
                        arr_leg_idx = len(ride_legs) - 1

                    seats_ok = True
                    min_seats = ride.seats_available
                    calculated_price = 0
                    
                    # Cumuler les prix des jambes réelles
                    for idx_leg in range(dep_leg_idx, arr_leg_idx + 1):
                        if idx_leg < len(ride_legs):
                            leg = ride_legs[idx_leg]
                            if leg.seats_available < seats_requested:
                                seats_ok = False
                                break
                            if leg.seats_available < min_seats:
                                min_seats = leg.seats_available
                            calculated_price += leg.price

                    if not calculated_price:
                        calculated_price = ride.price_per_seat

                    if seats_ok:
                        direct_matches.append({
                            'type': 'direct',
                            'ride': ride,
                            'departure_leg': ride_legs[dep_leg_idx] if ride_legs else None,
                            'arrival_leg': ride_legs[arr_leg_idx] if ride_legs else None,
                            'price': calculated_price,
                            'departure_time': ride.departure_time,
                            'arrival_time': ride.departure_time,
                            'seats_available': min_seats,
                            'walk_distance_origin_km': min_dep_dist,
                            'walk_distance_dest_km': min_arr_dist,
                            'radius_category': radius_category,
                            'approach_duration_text': approach_duration_text,
                            'approach_duration_sec': int(min_dep_dist * 3600 / 5) if max_approach <= 0.5 else int(min_dep_dist * 3600 / 25),
                            'approach_distance_m': int(min_dep_dist * 1000)
                        })

        # 4. Tri des résultats par catégorie de rayon croissante, puis par prix, puis par départ
        direct_matches = sorted(direct_matches, key=lambda x: (x['radius_category'], x['price'], x['departure_time']))

        results = {
            'directs': direct_matches,
            'connections': []
        }
        
        # Mettre en cache les résultats pour 2 minutes (120 secondes)
        cache.set(cache_key, results, 120)
        return results
