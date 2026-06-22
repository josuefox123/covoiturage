"""
========================================================

Fichier :
test_stats_json.py

Description :

Module de l'application Zemy.

Projet :
Zemy

========================================================
"""
import json
from api.views import dashboard_stats
from django.test import RequestFactory
from django.contrib.auth import get_user_model
User = get_user_model()
req = RequestFactory().get("/")
req.user = User.objects.filter(is_superuser=True).first() or User.objects.first()
try:
    res = dashboard_stats(req)
    with open("stats_out.json", "w") as f:
        json.dump(res.data, f)
except Exception as e:
    import traceback
    traceback.print_exc()
