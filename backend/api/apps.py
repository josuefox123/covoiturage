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
        try:
            import api.tasks
        except Exception:
            pass

        # Prevent running twice when Django autoreloader restarts the thread
        if os.environ.get('RUN_MAIN') == 'true':
            from .departure_check import start_departure_check_thread
            
            start_departure_check_thread()

