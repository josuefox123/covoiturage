import {
  PrimaryRideSessionState,
  SecondaryRideSessionState,
  PassengerRideAction,
  RideSessionData
} from '../types/rideSession.types';

export function resolveSessionPrimaryState(
  bookingStateRaw: any,
  ride: any,
  loading: boolean
): { primaryState: PrimaryRideSessionState; secondaryState: SecondaryRideSessionState | null } {
  if (loading && !ride) {
    return { primaryState: 'LOADING', secondaryState: null };
  }

  if (ride && (ride.status === 'cancelled' || ride.status === 'CANCELLED')) {
    return { primaryState: 'INITIAL', secondaryState: 'RIDE_CANCELLED' };
  }

  if (!bookingStateRaw || !bookingStateRaw.booking_id) {
    if (ride && (ride.status === 'completed' || ride.status === 'COMPLETED')) {
      return { primaryState: 'COMPLETED', secondaryState: null };
    }
    if (ride && (ride.status === 'in_progress' || ride.status === 'IN_PROGRESS')) {
      return { primaryState: 'TRIP_STARTED', secondaryState: null };
    }
    return { primaryState: 'READY', secondaryState: null };
  }

  const status = String(bookingStateRaw.status || '').toLowerCase();
  const paymentStatus = String(bookingStateRaw.payment_status || '').toLowerCase();
  const action = String(bookingStateRaw.action || '').toLowerCase();

  if (status === 'cancelled' || status === 'passenger_cancelled') {
    return { primaryState: 'INITIAL', secondaryState: 'PASSENGER_CANCELLED' };
  }
  if (status === 'driver_cancelled') {
    return { primaryState: 'INITIAL', secondaryState: 'DRIVER_CANCELLED' };
  }
  if (status === 'rejected' || status === 'refused') {
    return { primaryState: 'INITIAL', secondaryState: 'REJECTED' };
  }
  if (status === 'expired') {
    return { primaryState: 'INITIAL', secondaryState: 'EXPIRED' };
  }

  if (paymentStatus === 'paid' || status === 'confirmed') {
    if (ride && (ride.status === 'completed' || ride.status === 'COMPLETED')) {
      return { primaryState: 'COMPLETED', secondaryState: null };
    }
    if (ride && (ride.status === 'in_progress' || ride.status === 'IN_PROGRESS')) {
      return { primaryState: 'TRIP_STARTED', secondaryState: null };
    }
    return { primaryState: 'BOOKED', secondaryState: null };
  }

  if (paymentStatus === 'processing') {
    return { primaryState: 'PAYMENT_PROCESSING', secondaryState: null };
  }
  if (paymentStatus === 'failed') {
    return { primaryState: 'PAYMENT_PENDING', secondaryState: 'FAILED' };
  }

  if (action === 'pay_now' || status === 'pending_payment') {
    return { primaryState: 'PAYMENT_PENDING', secondaryState: null };
  }

  if (action === 'offer_received' || status === 'pending_passenger') {
    return { primaryState: 'NEGOTIATION', secondaryState: null };
  }

  if (status === 'pending' || status === 'pending_driver' || action === 'waiting_driver') {
    return { primaryState: 'BOOKING_PENDING', secondaryState: null };
  }

  return { primaryState: 'READY', secondaryState: null };
}

export function getPassengerRideAction(session: Partial<RideSessionData>): PassengerRideAction {
  if (!session) return 'RESERVE';
  if (session.secondaryState === 'EXPIRED') return 'EXPIRED';
  if (
    session.secondaryState === 'CANCELLED' ||
    session.secondaryState === 'PASSENGER_CANCELLED' ||
    session.secondaryState === 'DRIVER_CANCELLED' ||
    session.secondaryState === 'RIDE_CANCELLED'
  ) {
    return 'CANCELLED';
  }

  switch (session.primaryState) {
    case 'BOOKING_PENDING':
      return 'WAITING_DRIVER';
    case 'NEGOTIATION':
      return 'WAITING_PASSENGER';
    case 'PAYMENT_PENDING':
    case 'PAYMENT_PROCESSING':
      return 'PAY';
    case 'BOOKED':
    case 'TRIP_STARTED':
    case 'TRIP_FINISHED':
    case 'COMPLETED':
      return 'CONFIRMED';
    case 'INITIAL':
    case 'LOADING':
    case 'READY':
    default:
      return 'RESERVE';
  }
}
