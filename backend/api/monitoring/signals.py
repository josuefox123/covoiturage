"""
========================================================

Fichier :
signals.py

Description :

Branchement du monitoring sur les evenements Celery et sur les erreurs
d'infrastructure. Les taches de fond (expiration des reservations,
notifications, verification des paiements) echouent silencieusement par
nature : sans ce relais, un worker casse peut passer inapercu des jours.

Projet :
Zemy

========================================================
"""

import logging

from django.conf import settings

from . import config
from .client import capture_exception, capture_message, compute_fingerprint

logger = logging.getLogger('api.monitoring')

_installed = False


def _on_task_failure(sender=None, task_id=None, exception=None,
                     args=None, kwargs=None, einfo=None, **extra):
    """Une tache Celery s'est terminee en erreur."""
    if not config.is_enabled() or exception is None:
        return

    task_name = getattr(sender, 'name', None) or str(sender)
    capture_exception(
        exception,
        source='celery',
        level='CRITICAL',
        title='Tache Celery en echec : ' + task_name,
        context={},
        extra={
            'tache': task_name,
            'task_id': task_id,
            'arguments': list(args or [])[:10],
            'parametres': kwargs or {},
        },
    )


def _on_task_retry(sender=None, request=None, reason=None, einfo=None, **extra):
    """Nouvelle tentative d'une tache : signe avant-coureur d'un service degrade."""
    if not config.is_enabled():
        return

    task_name = getattr(sender, 'name', None) or str(sender)
    capture_message(
        title='Nouvelle tentative de la tache ' + task_name,
        message=str(reason or 'Motif non precise'),
        level='WARNING',
        source='celery',
        context={},
        extra={'tache': task_name, 'task_id': getattr(request, 'id', None)},
        fingerprint=compute_fingerprint(['celery-retry', task_name]),
    )


def _on_worker_shutdown(sender=None, **extra):
    """Arret d'un worker Celery : utile pour correler une panne de traitement."""
    if not config.is_enabled():
        return
    capture_message(
        title='Arret d un worker Celery',
        message='Le worker ' + str(getattr(sender, 'hostname', sender)) + ' s est arrete.',
        level='WARNING',
        source='celery',
        context={},
        fingerprint=compute_fingerprint(['celery-shutdown', str(sender)]),
    )


def install():
    """Connecte les signaux. Idempotent : appele depuis ApiConfig.ready()."""
    global _installed
    if _installed:
        return
    _installed = True

    try:
        from celery import signals as celery_signals
    except Exception:
        logger.debug('Celery indisponible : signaux de monitoring non branches.')
        return

    celery_signals.task_failure.connect(_on_task_failure, weak=False)

    # L'arret d'un worker est attendu a chaque deploiement : desactivable.
    if getattr(settings, 'MONITORING_NOTIFY_CELERY_SHUTDOWN', True):
        celery_signals.worker_shutdown.connect(_on_worker_shutdown, weak=False)

    # Les nouvelles tentatives sont bruyantes : desactivees par defaut.
    if getattr(settings, 'MONITORING_NOTIFY_CELERY_RETRY', False):
        celery_signals.task_retry.connect(_on_task_retry, weak=False)
