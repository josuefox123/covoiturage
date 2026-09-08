"""
========================================================

Fichier :
config.py

Description :

Lecture centralisee de la configuration du monitoring Zemy.
Toutes les options sont pilotees par des variables d'environnement
(voir config/settings.py, section MONITORING) afin de pouvoir couper
ou ajuster les alertes en production sans redeploiement de code.

Projet :
Zemy

========================================================
"""

from django.conf import settings

# Loggers dont les enregistrements ne doivent JAMAIS declencher d'alerte Slack.
# Indispensable pour eviter une boucle infinie : l'envoi de l'alerte utilise
# requests/urllib3, qui loggent eux-memes en cas d'echec reseau.
DEFAULT_IGNORED_LOGGERS = (
    'api.monitoring',
    'urllib3',
    'requests',
    'charset_normalizer',
    'django.utils.autoreload',
    'daphne',
    'asyncio',
)

# Chemins pour lesquels on ne veut pas d'alerte (health checks, schema, statiques).
DEFAULT_IGNORED_PATHS = (
    '/static/',
    '/media/',
    '/favicon.ico',
    '/api/schema/',
)


def _flag(name, default=False):
    return bool(getattr(settings, name, default))


def _int(name, default):
    try:
        return int(getattr(settings, name, default))
    except (TypeError, ValueError):
        return default


def webhook_url():
    """URL du webhook Slack. Vide => monitoring inactif."""
    return (getattr(settings, 'SLACK_WEBHOOK_URL', '') or '').strip()


def is_enabled():
    """Le monitoring n'est actif que si explicitement active ET si l'URL existe."""
    return _flag('MONITORING_ENABLED', False) and bool(webhook_url())


def environment():
    return getattr(settings, 'MONITORING_ENVIRONMENT', 'development')


def service_name():
    return getattr(settings, 'MONITORING_SERVICE_NAME', 'zemy-backend')


def min_level():
    """Niveau de log minimal remonte vers Slack (nom Python : ERROR, WARNING...)."""
    return getattr(settings, 'MONITORING_MIN_LEVEL', 'ERROR')


def dedup_window():
    """Duree (s) pendant laquelle une meme erreur n'est pas renvoyee."""
    return _int('MONITORING_DEDUP_WINDOW', 300)


def rate_limit_per_minute():
    """Plafond global d'alertes par minute, protege le canal Slack du flood."""
    return _int('MONITORING_RATE_LIMIT', 30)


def slow_request_ms():
    """Seuil (ms) au-dela duquel une requete HTTP est signalee. 0 = desactive."""
    return _int('MONITORING_SLOW_REQUEST_MS', 0)


def timeout_seconds():
    return _int('MONITORING_HTTP_TIMEOUT', 5)


def queue_size():
    return _int('MONITORING_QUEUE_SIZE', 200)


def traceback_limit():
    """Nombre max de caracteres de traceback pousses dans Slack."""
    return _int('MONITORING_TRACEBACK_LIMIT', 2500)


def notify_client_errors():
    """Remonter aussi les erreurs 4xx inattendues (hors validation/auth)."""
    return _flag('MONITORING_NOTIFY_CLIENT_ERRORS', False)


def ignored_loggers():
    extra = tuple(getattr(settings, 'MONITORING_IGNORED_LOGGERS', ()) or ())
    return DEFAULT_IGNORED_LOGGERS + extra


def ignored_paths():
    extra = tuple(getattr(settings, 'MONITORING_IGNORED_PATHS', ()) or ())
    return DEFAULT_IGNORED_PATHS + extra
