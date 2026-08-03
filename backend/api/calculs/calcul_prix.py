def arrondir_prix_50(price: float) -> int:
    """Arrondit un prix au multiple de 50 XOF le plus proche."""
    return int(round(price / 50.0) * 50)

def arrondir_prix_100(price: float) -> int:
    """Arrondit un prix au multiple de 100 XOF le plus proche."""
    return int(round(price / 100.0) * 100)

def calculer_prix_suggeres(distance_km: float, price_per_km: float, margin_percent: float) -> dict:
    """
    Calcule le prix suggéré, minimum et maximum en fonction de la distance,
    du tarif par km et de la marge autorisée.
    """
    raw_price = distance_km * price_per_km
    suggested_price = arrondir_prix_100(raw_price)
    min_price = int(round(suggested_price * (1 - margin_percent / 100.0) / 100.0) * 100)
    max_price = int(round(suggested_price * (1 + margin_percent / 100.0) / 100.0) * 100)
    
    return {
        'suggested_price': suggested_price,
        'min_price': min_price,
        'max_price': max_price
    }
