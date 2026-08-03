import logging
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

logger = logging.getLogger(__name__)

def push_booking_update(booking):
    """
    Diffuse la mise à jour du statut d'une réservation (Booking) en temps réel 
    aux clients connectés via le groupe WebSocket correspond-t-il.
    """
    try:
        channel_layer = get_channel_layer()
        if channel_layer:
            async_to_sync(channel_layer.group_send)(
                f"booking_{booking.id}",
                {
                    "type": "booking_update",
                    "booking_id": str(booking.id),
                    "status": booking.status,
                    "amount": booking.total_amount,
                    "payment_status": booking.payment_status,
                }
            )
            logger.info(f"WS booking update pushed: booking={booking.id} status={booking.status}")
    except Exception as e:
        logger.error(f"Failed to push booking update via WS: {e}")
