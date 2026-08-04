import { Router } from 'expo-router';
import { Mission, MissionActionType } from './MissionTypes';

export class MissionActionsHandler {
  public static handleAction(
    actionType: MissionActionType,
    mission: Mission,
    router: Router,
    callbacks?: {
      onCancelBooking?: (bookingId: string) => void;
      onAcceptOffer?: (bookingId: string) => void;
      onRejectOffer?: (bookingId: string) => void;
      onRateDriver?: (rideId: string) => void;
      onStartTrip?: (rideId: string) => void;
      onFinishTrip?: (rideId: string) => void;
    }
  ): void {
    const { data } = mission;

    switch (actionType) {
      case 'pay':
        if (data.bookingId) {
          router.push({
            pathname: '/payment',
            params: {
              booking_id: String(data.bookingId),
              amount: String(data.amount || 0)
            }
          });
        }
        break;

      case 'view_details':
      case 'view_ticket':
        if (data.rideId) {
          router.push(`/ride/${data.rideId}`);
        }
        break;

      case 'track_live':
      case 'view_position':
        if (data.rideId) {
          router.push(`/ride/${data.rideId}`);
        }
        break;

      case 'contact':
        if (data.rideId) {
          router.push(`/ride/${data.rideId}`);
        }
        break;

      case 'accept_negotiation':
        if (data.bookingId && callbacks?.onAcceptOffer) {
          callbacks.onAcceptOffer(data.bookingId);
        }
        break;

      case 'reject_negotiation':
        if (data.bookingId && callbacks?.onRejectOffer) {
          callbacks.onRejectOffer(data.bookingId);
        }
        break;

      case 'cancel_booking':
      case 'cancel_request':
        if (data.bookingId && callbacks?.onCancelBooking) {
          callbacks.onCancelBooking(data.bookingId);
        }
        break;

      case 'rate':
        if (data.rideId && callbacks?.onRateDriver) {
          callbacks.onRateDriver(data.rideId);
        }
        break;

      case 'start_trip':
        if (data.rideId && callbacks?.onStartTrip) {
          callbacks.onStartTrip(data.rideId);
        }
        break;

      case 'finish_trip':
        if (data.rideId && callbacks?.onFinishTrip) {
          callbacks.onFinishTrip(data.rideId);
        }
        break;
    }
  }
}
