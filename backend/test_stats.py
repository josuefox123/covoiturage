"""
========================================================

Fichier :
test_stats.py

Description :

Module de l'application Zemy.

Projet :
Zemy

========================================================
"""
from api.views import dashboard_stats
from django.test import RequestFactory
req = RequestFactory().get("/")
try:
    res = dashboard_stats(req)
except Exception as e:
    import traceback
    traceback.print_exc()
