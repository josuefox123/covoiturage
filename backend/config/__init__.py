"""
========================================================

Fichier :
__init__.py

Description :

Module de l'application Zemy.

Projet :
Zemy

========================================================
"""

from .celery import app as celery_app

__all__ = ('celery_app',)
