# Zemy — tasks.py (Global Celery Registry)
# Ce fichier sert d'entrée d'autodiscover pour Celery et re-exporte les tâches modularisées.

from .tasks.expire_booking import expire_booking_task
from .tasks.notifications import notify_compatible_passengers_task

__all__ = [
    'expire_booking_task',
    'notify_compatible_passengers_task',
]
