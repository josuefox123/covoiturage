import math

def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calcule la distance en kilomètres entre deux coordonnées GPS
    en utilisant la formule de Haversine.
    """
    if not all(x is not None for x in [lat1, lon1, lat2, lon2]):
        return 50.0
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c
