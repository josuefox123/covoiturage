# Zemy — consumers.py (Global WebSocket Consumers Registry)
# Ce fichier re-exporte les classes de consommateurs modularisees sous le package websocket/.

from .websocket.consumers import ChatConsumer, BookingConsumer

__all__ = [
    'ChatConsumer',
    'BookingConsumer',
]
