"""
========================================================

Fichier :
handlers.py

Description :

Handler de journalisation qui relaie vers Slack tout enregistrement de
niveau ERROR ou superieur. C'est le filet le plus large du dispositif :
il capte sans modification de code les nombreux `logger.error(...)` deja
presents dans les services Zemy (FCM, cartographie, paiements, cleanup...).

Projet :
Zemy

========================================================
"""

import logging
import threading

from . import config
from .client import compute_fingerprint, dispatch, is_reported, mark_reported
from .context import build_request_context

# Garde anti-recursion : si l'expedition d'une alerte declenche elle-meme un log
# d'erreur, on ne doit surtout pas repartir dans un nouvel envoi.
_guard = threading.local()


class SlackLogHandler(logging.Handler):
    """Transforme un enregistrement de log en alerte Slack."""

    def __init__(self, level=logging.ERROR):
        super().__init__(level=level)

    # --- filtres -------------------------------------------------------

    def _is_ignored(self, record):
        name = record.name or ''
        for ignored in config.ignored_loggers():
            if name == ignored or name.startswith(ignored + '.'):
                return True
        # Un log emis depuis le thread d'expedition ne doit jamais reboucler.
        if getattr(record, 'threadName', '') == 'zemy-monitoring':
            return True
        return False

    # --- construction de l'alerte --------------------------------------

    def _exception_from(self, record):
        if not record.exc_info:
            return None, None, None
        exc_type, exc_value, _ = record.exc_info
        if exc_value is None:
            return None, None, None
        try:
            import traceback
            text = ''.join(traceback.format_exception(*record.exc_info))
        except Exception:
            text = ''
        return exc_type.__name__ if exc_type else None, exc_value, text

    def _context_for(self, record):
        # django.request attache la requete a l'enregistrement ; sinon on retombe
        # sur la requete courante memorisee par le middleware.
        request = getattr(record, 'request', None)
        return build_request_context(request)

    def _location(self, record):
        path = (record.pathname or '').replace('\\', '/')
        if '/api/' in path:
            path = 'api/' + path.split('/api/')[-1]
        else:
            path = path.split('/')[-1]
        return path + ':' + str(record.lineno) + ' (' + (record.funcName or '?') + ')'

    # --- emission ------------------------------------------------------

    def emit(self, record):
        if getattr(_guard, 'busy', False):
            return
        if not config.is_enabled() or self._is_ignored(record):
            return

        _guard.busy = True
        try:
            exc_type, exc_value, traceback_text = self._exception_from(record)

            # Deja signale par le middleware ou le handler DRF : on n'envoie pas deux fois.
            if exc_value is not None and is_reported(exc_value):
                return

            try:
                message = record.getMessage()
            except Exception:
                message = str(record.msg)

            location = self._location(record)
            alert = {
                'level': record.levelname,
                'source': 'log',
                'title': message[:150] if message else (exc_type or 'Erreur applicative'),
                'message': message,
                'logger': record.name,
                'exception_type': exc_type,
                'traceback': traceback_text,
                'location': location,
                'status_code': getattr(record, 'status_code', None),
                'context': self._context_for(record),
                'fingerprint': compute_fingerprint([
                    record.levelname, record.name, location, exc_type,
                ]),
            }

            if exc_value is not None:
                mark_reported(exc_value)

            dispatch(alert)
        except Exception:
            # Un handler de log ne doit jamais faire echouer l'appel a logger.error().
            pass
        finally:
            _guard.busy = False
