import math
import re

BENIN_CITIES = [
    {"name": "Cotonou", "latitude": 6.3654, "longitude": 2.4183},
    {"name": "Godomey", "latitude": 6.4178, "longitude": 2.3389},
    {"name": "Abomey-Calavi", "latitude": 6.4486, "longitude": 2.3481},
    {"name": "Calavi", "latitude": 6.4486, "longitude": 2.3481},
    {"name": "Allada", "latitude": 6.6575, "longitude": 2.1514},
    {"name": "Bohicon", "latitude": 7.1786, "longitude": 2.0667},
    {"name": "Abomey", "latitude": 7.1808, "longitude": 1.9961},
    {"name": "Dassa-Zoumé", "latitude": 7.7472, "longitude": 2.1839},
    {"name": "Dassa", "latitude": 7.7472, "longitude": 2.1839},
    {"name": "Glazoué", "latitude": 7.9742, "longitude": 2.2403},
    {"name": "Savalou", "latitude": 7.9281, "longitude": 1.9756},
    {"name": "Bantè", "latitude": 8.4119, "longitude": 1.8683},
    {"name": "Bassila", "latitude": 9.0081, "longitude": 1.6656},
    {"name": "Djougou", "latitude": 9.7085, "longitude": 1.6659},
    {"name": "N'Dali", "latitude": 9.8617, "longitude": 2.6788},
    {"name": "Parakou", "latitude": 9.3372, "longitude": 2.6303},
    {"name": "Porto-Novo", "latitude": 6.4969, "longitude": 2.6289},
    {"name": "Ouidah", "latitude": 6.3631, "longitude": 2.0851},
    {"name": "Grand-Popo", "latitude": 6.2797, "longitude": 1.8341},
    {"name": "Comè", "latitude": 6.4069, "longitude": 1.8806},
    {"name": "Lokossa", "latitude": 6.6386, "longitude": 1.7167},
    {"name": "Dogbo", "latitude": 6.8122, "longitude": 1.7797},
    {"name": "Aplahoué", "latitude": 6.9333, "longitude": 1.6833},
    {"name": "Kandi", "latitude": 11.1342, "longitude": 2.9386},
    {"name": "Malanville", "latitude": 11.8675, "longitude": 3.3853},
    {"name": "Natitingou", "latitude": 10.3042, "longitude": 1.3794},
    {"name": "Tanguiéta", "latitude": 10.6214, "longitude": 1.2647},
    {"name": "Boukoumbé", "latitude": 10.1764, "longitude": 1.1072},
    {"name": "Kérou", "latitude": 10.7417, "longitude": 2.1092},
    {"name": "Kouandé", "latitude": 10.3319, "longitude": 1.6914},
    {"name": "Péhunco", "latitude": 10.2258, "longitude": 2.0089},
    {"name": "Bembéréké", "latitude": 10.2239, "longitude": 2.6681},
    {"name": "Gogounou", "latitude": 10.8378, "longitude": 2.8367},
    {"name": "Segbana", "latitude": 10.9275, "longitude": 3.6936},
    {"name": "Banikoara", "latitude": 11.2989, "longitude": 2.4386},
    {"name": "Nikki", "latitude": 9.9400, "longitude": 3.2108},
    {"name": "Kalalé", "latitude": 10.2978, "longitude": 3.4356},
    {"name": "Sinendé", "latitude": 9.9231, "longitude": 2.3789},
    {"name": "Tchaourou", "latitude": 9.1172, "longitude": 2.5975},
]

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
    """
    instruction = step.get('html_instructions', '')
    clean = re.sub(r'<[^>]+>', ' ', instruction).strip()
    return clean[:80] if clean else ''

def find_cities_along_route(polyline_points):
    """
    Identifie les grandes villes du Bénin traversées par le trajet.
    """
    traversed = []
    for city in BENIN_CITIES:
        min_dist = 999.0
        min_idx = -1
        for idx, pt in enumerate(polyline_points[::3]):
            d = haversine_km(city['latitude'], city['longitude'], pt[0], pt[1])
            if d < min_dist:
                min_dist = d
                min_idx = idx * 3

        if min_dist <= 3.5:
            traversed.append({
                'name': city['name'],
                'latitude': city['latitude'],
                'longitude': city['longitude'],
                'polyline_index': min_idx
            })

    traversed.sort(key=lambda x: x['polyline_index'])
    return traversed

def _extract_leg_distance(leg):
    if not isinstance(leg, dict):
        return 0
    dist = leg.get('distance')
    if isinstance(dist, dict):
        return dist.get('value', 0)
    elif isinstance(dist, (int, float)):
        return int(dist)
    return int(leg.get('distance_m', 0))

def _extract_leg_duration(leg):
    if not isinstance(leg, dict):
        return 0
    dur = leg.get('duration')
    if isinstance(dur, dict):
        return dur.get('value', 0)
    elif isinstance(dur, (int, float)):
        return int(dur)
    return int(leg.get('duration_sec', 0))
