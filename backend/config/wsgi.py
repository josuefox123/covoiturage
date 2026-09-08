"""
========================================================

Fichier :
wsgi.py

Description :

Module de l'application Zemy.

Projet :
Zemy

========================================================
"""
"""
WSGI config for config project.

It exposes the WSGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/6.0/howto/deployment/wsgi/
"""

try:
    import pymysql  # type: ignore
    pymysql.install_as_MySQLdb()
except ImportError:
    pass

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

application = get_wsgi_application()
