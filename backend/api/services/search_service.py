# Zemy — search_service.py (Legacy mapping)
# Ce fichier ré-exporte les nouvelles classes de recherche découpées.

from ..recherche.services.moteur_recherche import SearchService

# Re-exports pour compatibilité avec le reste de l'application
__all__ = [
    'SearchService',
]
