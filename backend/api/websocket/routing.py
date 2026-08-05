from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    re_path(r'^(?:api/)?ws/chat/(?P<conversation_id>[0-9a-f-]+)/?$', consumers.ChatConsumer.as_asgi()),  # type: ignore
    re_path(r'^(?:api/)?ws/booking/(?P<booking_id>[0-9a-f-]+)/?$', consumers.BookingConsumer.as_asgi()),  # type: ignore
    re_path(r'^(?:api/)?ws/notifications/?$', consumers.NotificationConsumer.as_asgi()),  # type: ignore
]
