def secondes_en_minutes(secondes: float) -> int:
    """Convertit un nombre de secondes en minutes arrondies."""
    return int(round(secondes / 60.0))

def minutes_en_secondes(minutes: int) -> int:
    """Convertit un nombre de minutes en secondes."""
    return minutes * 60

def calculer_duree_totale(duree_trajet_min: int, duree_arrets_min: int) -> int:
    """Calcule la durée totale d'un trajet en incluant la durée des escales."""
    return (duree_trajet_min or 0) + (duree_arrets_min or 0)
