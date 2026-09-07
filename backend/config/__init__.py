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

try:
    import pymysql  # type: ignore
    pymysql.install_as_MySQLdb()
except ImportError:
    pass

from .celery import app as celery_app

__all__ = ('celery_app',)
