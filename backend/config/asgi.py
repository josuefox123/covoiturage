"""
========================================================

Fichier :
asgi.py

Description :

Module de l'application Zemy.

Projet :
Zemy

========================================================
"""
"""
ASGI config for config project — Django Channels WebSocket.

Routes:
  - ws://host/ws/chat/<conversation_id>/ → ChatConsumer (WebSocket)
  - http://host/...                       → Django standard (HTTP)
"""

import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import AllowedHostsOriginValidator
from api.routing import websocket_urlpatterns

application = ProtocolTypeRouter({
    # Requêtes HTTP classiques → Django
    'http': get_asgi_application(),

    # Connexions WebSocket → ChatConsumer
    # AllowedHostsOriginValidator utilise ALLOWED_HOSTS (= ['*'] en dev)
    'websocket': AllowedHostsOriginValidator(
        URLRouter(websocket_urlpatterns)
    ),
})
