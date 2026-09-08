"""
========================================================

Fichier :
middleware.py

Description :

Middleware de supervision des requetes HTTP :
  - memorise la requete courante pour enrichir toutes les alertes ;
  - capture les exceptions non gerees qui remontent jusqu'a Django ;
  - signale les reponses 5xx emises sans exception ;
  - signale les requetes anormalement lentes (seuil configurable).

Compatible WSGI (gunicorn) et ASGI (daphne / Channels).

Projet :
Zemy

========================================================
"""

import re
import time

from asgiref.sync import iscoroutinefunction, markcoroutinefunction

from . import config
from .client import capture_exception, capture_message, compute_fingerprint, is_reported
from .context import (
    build_request_context,
    mark_request_reported,
    request_already_reported,
    reset_current_request,
    set_current_request,
)


def _is_ignored_path(path):
    path = path or ''
    return any(path.startswith(prefix) for prefix in config.ignored_paths())


class ErrorMonitoringMiddleware:
    """Supervision des erreurs et de la latence au niveau requete."""

    async_capable = True
    sync_capable = True

    def __init__(self, get_response):
        self.get_response = get_response
        self.async_mode = iscoroutinefunction(get_response)
        if self.async_mode:
            markcoroutinefunction(self)

    # --- cycle de vie ---------------------------------------------------

    def __call__(self, request):
        if self.async_mode:
            return self.__acall__(request)

        token = set_current_request(request)
        started = time.monotonic()
        try:
            response = self.get_response(request)
            self._inspect(request, response, started)
            return response
        finally:
            reset_current_request(token)

    async def __acall__(self, request):
        token = set_current_request(request)
        started = time.monotonic()
        try:
            response = await self.get_response(request)
            self._inspect(request, response, started)
            return response
        finally:
            reset_current_request(token)

    # --- hooks Django ---------------------------------------------------

    def process_exception(self, request, exception):
        """Appele par Django pour toute exception non geree remontant d'une vue."""
        if not config.is_enabled() or is_reported(exception):
            return None
        if _is_ignored_path(getattr(request, 'path', '')):
            return None

        mark_request_reported(request)
        capture_exception(
            exception,
            source='http',
            level='CRITICAL',
            status_code=500,
            context=build_request_context(request),
        )
        # On ne fournit pas de reponse : Django conserve son traitement habituel.
        return None

    # --- analyses post-reponse ------------------------------------------

    def _inspect(self, request, response, started):
        if not config.is_enabled():
            return
        path = getattr(request, 'path', '')
        if _is_ignored_path(path):
            return

        try:
            self._check_server_error(request, response)
            self._check_latency(request, response, started)
        except Exception:
            # La supervision ne doit jamais alterer la reponse rendue a l'utilisateur.
            pass

    def _check_server_error(self, request, response):
        """Reponse 5xx renvoyee sans exception : bug applicatif silencieux."""
        status = getattr(response, 'status_code', 200)
        if status < 500:
            return
        # Une 500 issue d'une exception a deja ete signalee en amont
        # (process_exception ou handler DRF).
        if request_already_reported(request):
            return

        method = getattr(request, 'method', '?')
        capture_message(
            title='Reponse ' + str(status) + ' sur ' + method + ' ' + path_of(request),
            message=(
                'Le serveur a renvoye un statut ' + str(status) + ' sans exception Python. '
                'Verifier la logique de la vue concernee.'
            ),
            level='ERROR',
            source='http',
            context=build_request_context(request),
            extra={'status_code': status},
            fingerprint=compute_fingerprint(['http5xx', method, path_of(request), status]),
        )

    def _check_latency(self, request, response, started):
        threshold = config.slow_request_ms()
        if threshold <= 0:
            return
        elapsed_ms = int((time.monotonic() - started) * 1000)
        if elapsed_ms < threshold:
            return

        method = getattr(request, 'method', '?')
        capture_message(
            title='Requete lente : ' + method + ' ' + path_of(request),
            message=(
                'Traitee en ' + str(elapsed_ms) + ' ms (seuil : ' + str(threshold) + ' ms). '
                'Piste probable : requete SQL non optimisee ou appel externe bloquant.'
            ),
            level='SLOW',
            source='http',
            context=build_request_context(request),
            extra={
                'duree_ms': elapsed_ms,
                'seuil_ms': threshold,
                'status_code': getattr(response, 'status_code', None),
            },
            fingerprint=compute_fingerprint(['slow', method, path_of(request)]),
        )


def path_of(request):
    """Chemin normalise : les identifiants numeriques sont remplaces par {id}
    afin que toutes les occurrences d'un meme endpoint partagent une empreinte."""
    path = getattr(request, 'path', '') or '?'
    return re.sub(r'/\d+(?=/|$)', '/{id}', path)
