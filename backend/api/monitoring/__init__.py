"""
========================================================

Fichier :
__init__.py

Description :

Monitoring Zemy — remontee des exceptions, bugs, erreurs et
dysfonctionnements vers Slack.

Couverture automatique (aucune modification de code metier necessaire) :
  - exceptions non gerees dans les vues Django  -> ErrorMonitoringMiddleware
  - erreurs serveur de l'API DRF                -> zemy_exception_handler
  - appels a logger.error / logger.critical     -> SlackLogHandler
  - echecs de taches Celery                     -> signals.install()
  - reponses 5xx et requetes lentes             -> ErrorMonitoringMiddleware

Signalement manuel d'un dysfonctionnement metier :

    from api.monitoring import capture_exception, capture_message

    try:
        ...
    except Exception as exc:
        capture_exception(exc, source='manual', extra={'booking': booking.id})

    capture_message(
        'Solde conducteur negatif',
        'Le solde calcule est inferieur a zero apres reversement.',
        level='CRITICAL',
        extra={'driver': driver.id, 'solde': solde},
    )

Projet :
Zemy

========================================================
"""

from .client import capture_exception, capture_message, dispatch, flush

__all__ = ['capture_exception', 'capture_message', 'dispatch', 'flush']
