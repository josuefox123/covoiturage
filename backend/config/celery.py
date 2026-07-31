import os
from celery import Celery

# Définir les variables de configuration Django par défaut pour celery
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

app = Celery('zemy')

# Utiliser les chaînes de configuration Django (toutes les clés de configuration
# celery doivent avoir le préfixe 'CELERY_')
app.config_from_object('django.conf:settings', namespace='CELERY')

# Découvrir automatiquement les tâches partagées (shared_tasks) dans toutes les applications enregistrées
app.autodiscover_tasks()
