"""
========================================================

Fichier :
routing.py

Description :

Module de l'application Zemy.

Projet :
Zemy

========================================================
"""
"""
WebSocket URL routing pour Django Channels.
"""
from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    re_path(r'^ws/chat/(?P<conversation_id>[0-9a-f-]+)/$', consumers.ChatConsumer.as_asgi()),  # type: ignore
    re_path(r'^ws/booking/(?P<booking_id>[0-9a-f-]+)/$', consumers.BookingConsumer.as_asgi()),  # type: ignore
]

