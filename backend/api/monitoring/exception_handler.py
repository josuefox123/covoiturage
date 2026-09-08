"""
========================================================

Fichier :
exception_handler.py

Description :

Handler d'exceptions Django REST Framework.

DRF intercepte les exceptions a l'interieur de la vue : elles n'atteignent
donc jamais le middleware Django. Ce handler comble ce trou et signale les
erreurs serveur (5xx) remontees par l'API, en laissant passer sans bruit les
erreurs client legitimes (validation, authentification, quota).

Projet :
Zemy

========================================================
"""

from rest_framework.views import exception_handler as drf_exception_handler

from . import config
from .client import capture_exception, is_reported
from .context import build_request_context, mark_request_reported

# Erreurs attendues cote client : elles font partie du fonctionnement normal
# de l'API et ne doivent pas polluer le canal d'alertes.
EXPECTED_STATUSES = (400, 401, 403, 404, 405, 406, 409, 415, 429)


def _view_label(context):
    view = (context or {}).get('view')
    if view is None:
        return None
    name = type(view).__name__
    action = getattr(view, 'action', None)
    return name + '.' + action if action else name


def zemy_exception_handler(exc, context):
    """Handler DRF par defaut, augmente d'une remontee Slack sur erreur serveur."""
    response = drf_exception_handler(exc, context)
    request = (context or {}).get('request')

    if not config.is_enabled() or is_reported(exc):
        return response

    # response is None : DRF ne sait pas traiter cette exception, elle va etre
    # relancee et sera capturee par ErrorMonitoringMiddleware. On ne double pas.
    if response is None:
        return response

    status = response.status_code
    if status in EXPECTED_STATUSES and not config.notify_client_errors():
        return response

    level = 'CRITICAL' if status >= 500 else 'WARNING'
    if request is not None:
        mark_request_reported(request)

    capture_exception(
        exc,
        source='drf',
        level=level,
        status_code=status,
        context=build_request_context(request),
        extra={'vue': _view_label(context)},
    )
    return response
