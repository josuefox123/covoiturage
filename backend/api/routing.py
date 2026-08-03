# Zemy — routing.py (Global ASGI WebSocket Routing)
# Ce fichier délègue la configuration de routage WebSocket au sous-paquet websocket/.

from .websocket.routing import websocket_urlpatterns

__all__ = [
    'websocket_urlpatterns',
]
