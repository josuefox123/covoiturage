"""
========================================================

Fichier :
apps.py

Description :

Module de l'application Zemy.

Projet :
Zemy

========================================================
"""
from django.apps import AppConfig


class ApiConfig(AppConfig):
    name = 'api'

    def ready(self):
        import os

        # Supervision : branchement des signaux Celery (echec de tache, arret worker).
        try:
            from .monitoring import signals as monitoring_signals
            monitoring_signals.install()
        except Exception:
            pass

        try:
            import api.tasks
        except Exception:
            pass

        # Initialisation automatique de Firebase Admin SDK
        try:
            from django.conf import settings
            import firebase_admin
            from firebase_admin import credentials
            if not firebase_admin._apps:
                cred_path = os.path.join(settings.BASE_DIR, 'firebase-adminsdk.json')
                if os.path.exists(cred_path):
                    cred = credentials.Certificate(cred_path)
                    firebase_admin.initialize_app(cred)
        except Exception:
            pass

        # Prevent running twice when Django autoreloader restarts the thread
        if os.environ.get('RUN_MAIN') == 'true':
            from .departure_check import start_departure_check_thread
            
            start_departure_check_thread()

