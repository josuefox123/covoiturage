"""
========================================================

Fichier :
client.py

Description :

Coeur du monitoring Zemy : normalisation, deduplication, limitation de
debit et envoi asynchrone des alertes vers le webhook Slack.

L'envoi HTTP se fait dans un thread demon dedie : une requete API ne doit
jamais etre ralentie ou mise en echec parce que Slack est lent ou injoignable.
La file est bornee — en cas de tempete d'erreurs on prefere perdre des
alertes plutot que de saturer la memoire du worker.

Projet :
Zemy

========================================================
"""

import atexit
import hashlib
import logging
import queue
import threading
import time
import traceback as traceback_module

from django.core.cache import cache

from . import config
from .context import build_request_context
from .formatters import build_payload

logger = logging.getLogger('api.monitoring')

# Paliers auxquels une erreur repetitive est renotifiee malgre la deduplication,
# afin de rendre visible une tempete d'erreurs sans inonder le canal.
BURST_THRESHOLDS = (10, 50, 200, 1000)

CACHE_PREFIX = 'zemy:monitoring:'

_queue = None
_worker = None
_lock = threading.Lock()
_dropped = 0


# ----------------------------------------------------------------------
# Transport
# ----------------------------------------------------------------------

def _post(payload):
    """Envoi effectif vers Slack. Ne leve jamais : le monitoring ne casse rien."""
    import requests

    url = config.webhook_url()
    if not url:
        return False
    try:
        response = requests.post(
            url,
            json=payload,
            timeout=config.timeout_seconds(),
            headers={'Content-Type': 'application/json'},
        )
        if response.status_code >= 400:
            logger.warning(
                'Slack a refuse l alerte (HTTP %s) : %s',
                response.status_code, response.text[:200],
            )
            return False
        return True
    except Exception as exc:
        logger.warning('Envoi de l alerte Slack impossible : %s', exc)
        return False


def _drain():
    """Boucle du thread demon d'expedition."""
    while True:
        payload = _queue.get()
        try:
            if payload is None:
                return
            _post(payload)
        except Exception:
            pass
        finally:
            _queue.task_done()


def _ensure_worker():
    global _queue, _worker
    if _worker is not None and _worker.is_alive():
        return
    with _lock:
        if _worker is not None and _worker.is_alive():
            return
        if _queue is None:
            _queue = queue.Queue(maxsize=config.queue_size())
        _worker = threading.Thread(target=_drain, name='zemy-monitoring', daemon=True)
        _worker.start()


def _enqueue(payload):
    global _dropped
    _ensure_worker()
    try:
        _queue.put_nowait(payload)
        return True
    except queue.Full:
        _dropped += 1
        return False


def flush(timeout=10):
    """Attend l'expedition des alertes en attente (commandes d'administration, tests)."""
    if _queue is None:
        return True
    done = threading.Event()

    def _wait():
        _queue.join()
        done.set()

    threading.Thread(target=_wait, daemon=True).start()
    return done.wait(timeout)


atexit.register(lambda: flush(3))


# ----------------------------------------------------------------------
# Deduplication et limitation de debit
# ----------------------------------------------------------------------

def _cache_get_or_start(key, timeout):
    """Retourne (est_premiere_occurrence, compteur). Tolerant aux pannes de cache."""
    try:
        if cache.add(key, 1, timeout):
            return True, 1
        try:
            return False, cache.incr(key)
        except ValueError:
            # La cle a expire entre le add et le incr : on repart a zero.
            cache.set(key, 1, timeout)
            return True, 1
    except Exception:
        # Cache indisponible (Redis coupe) : on laisse passer l'alerte.
        return True, 1


def _should_send(fingerprint):
    """Applique la deduplication par empreinte. Retourne (envoyer, compteur)."""
    key = CACHE_PREFIX + 'dedup:' + str(fingerprint)
    first, count = _cache_get_or_start(key, config.dedup_window())
    if first:
        return True, 1
    if count in BURST_THRESHOLDS:
        return True, count
    return False, count


def _within_rate_limit():
    """Plafonne le nombre total d'alertes par minute pour proteger le canal Slack."""
    limit = config.rate_limit_per_minute()
    if limit <= 0:
        return True

    bucket = int(time.time() // 60)
    key = CACHE_PREFIX + 'rate:' + str(bucket)
    _, count = _cache_get_or_start(key, 120)
    if count <= limit:
        return True
    if count == limit + 1:
        # Une seule notification de saturation par minute.
        _enqueue(build_payload({
            'level': 'WARNING',
            'source': 'manual',
            'title': 'Flux d alertes plafonne',
            'message': (
                'Plus de ' + str(limit) + ' alertes ont ete emises en une minute. '
                'Les alertes suivantes sont supprimees jusqu a la minute suivante. '
                'Consultez les journaux du serveur pour le detail.'
            ),
            'fingerprint': 'rate-limit',
        }))
    return False


_REPORTED_FLAG = '_zemy_monitoring_reported'


def mark_reported(exc):
    """Marque une exception comme deja signalee (evite les doublons entre couches)."""
    try:
        setattr(exc, _REPORTED_FLAG, True)
    except Exception:
        # Certaines exceptions natives refusent les attributs : sans gravite.
        pass


def is_reported(exc):
    return bool(getattr(exc, _REPORTED_FLAG, False))


def compute_fingerprint(parts):
    """Empreinte stable d'une erreur, utilisee pour regrouper les occurrences."""
    raw = '|'.join(str(p) for p in parts if p)
    return hashlib.sha1(raw.encode('utf-8', 'replace')).hexdigest()[:12]


def _origin_frame(exc):
    """Derniere frame appartenant au code Zemy — la plus utile au debug."""
    tb = getattr(exc, '__traceback__', None)
    location = None
    while tb is not None:
        frame = tb.tb_frame
        filename = frame.f_code.co_filename.replace('\\', '/')
        if '/site-packages/' not in filename and '/dist-packages/' not in filename:
            if '/api/' in filename:
                short = 'api/' + filename.split('/api/')[-1]
            else:
                short = filename.split('/')[-1]
            location = short + ':' + str(tb.tb_lineno) + ' (' + frame.f_code.co_name + ')'
        tb = tb.tb_next
    return location


# ----------------------------------------------------------------------
# API publique
# ----------------------------------------------------------------------

def dispatch(alert):
    """Point d'entree unique : normalise, filtre puis met en file une alerte."""
    if not config.is_enabled():
        return False

    try:
        alert.setdefault('level', 'ERROR')
        alert.setdefault('source', 'log')
        if 'context' not in alert:
            alert['context'] = build_request_context()

        if not alert.get('fingerprint'):
            alert['fingerprint'] = compute_fingerprint([
                alert.get('level'),
                alert.get('source'),
                alert.get('exception_type'),
                alert.get('location') or alert.get('logger'),
                (alert.get('title') or '')[:120],
            ])

        send, count = _should_send(alert['fingerprint'])
        if not send:
            return False
        if not _within_rate_limit():
            return False

        alert['count'] = count
        return _enqueue(build_payload(alert))
    except Exception as exc:
        # Le monitoring ne doit jamais provoquer d'erreur applicative.
        logger.warning('Alerte non expediee (erreur interne du monitoring) : %s', exc)
        return False


def capture_exception(exc, source='manual', level='ERROR', title=None,
                      context=None, extra=None, status_code=None):
    """Signale une exception Python vers Slack."""
    mark_reported(exc)
    exc_type = type(exc).__name__
    try:
        tb = ''.join(traceback_module.format_exception(type(exc), exc, exc.__traceback__))
    except Exception:
        tb = ''

    location = _origin_frame(exc)
    alert = {
        'level': level,
        'source': source,
        'title': exc_type + ': ' + str(exc) if title is None else title,
        'message': exc_type + ': ' + str(exc),
        'exception_type': exc_type,
        'traceback': tb,
        'location': location,
        'status_code': status_code,
        'extra': extra,
        'fingerprint': compute_fingerprint([exc_type, location, source]),
    }
    if context is not None:
        alert['context'] = context
    return dispatch(alert)


def capture_message(title, message='', level='ERROR', source='manual',
                    extra=None, context=None, fingerprint=None):
    """Signale un dysfonctionnement metier sans exception associee."""
    alert = {
        'level': level,
        'source': source,
        'title': title,
        'message': message,
        'extra': extra,
        'fingerprint': fingerprint,
    }
    if context is not None:
        alert['context'] = context
    return dispatch(alert)
