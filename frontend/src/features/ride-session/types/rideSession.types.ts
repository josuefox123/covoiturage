import { Ride, Booking, User, Vehicle } from '../../../types';

export interface SegmentIdentifier {
  rideId: string;
  departureWaypointOrder?: number;
  arrivalWaypointOrder?: number;
  date?: string;
}

export type PrimaryRideSessionState =
  | 'INITIAL'
  | 'LOADING'
  | 'READY'
  | 'BOOKING_PENDING'
  | 'BOOKING_ACCEPTED'
  | 'NEGOTIATION'
  | 'PAYMENT_PENDING'
  | 'PAYMENT_PROCESSING'
  | 'PAYMENT_SUCCESS'
  | 'BOOKED'
  | 'TRIP_STARTED'
  | 'TRIP_FINISHED'
  | 'COMPLETED';

export type SecondaryRideSessionState =
  | 'EXPIRED'
  | 'REJECTED'
  | 'FAILED'
  | 'CANCELLED'
  | 'RIDE_CANCELLED'
  | 'DRIVER_CANCELLED'
  | 'PASSENGER_CANCELLED'
  | 'NETWORK_ERROR';

export type PassengerRideAction =
  | 'RESERVE'
  | 'WAITING_DRIVER'
  | 'WAITING_PASSENGER'
  | 'PAY'
  | 'CONFIRMED'
  | 'EXPIRED'
  | 'CANCELLED';

export type SessionErrorCode =
  | 'NETWORK_ERROR'
  | 'SESSION_OUTDATED'
  | 'PAYMENT_FAILED'
  | 'BOOKING_NOT_FOUND'
  | 'RIDE_CANCELLED'
  | 'RIDE_COMPLETED'
  | 'USER_BLOCKED'
  | 'UNKNOWN_ERROR';

export interface SeatBreakdown {
  remainingSeats: number;
  occupiedSeats: number;
  reservedSeats: number;
  availableSeats: number;
  driverCapacity: number;
}

export interface SessionNegotiationData {
  hasNegotiation: boolean;
  passengerProposedPrice?: number;
  driverCounterPrice?: number;
  customPrice?: number;
  negotiationMessage?: string;
  driverNote?: string;
  pricePerSeat: number;
  totalToPay: number;
  commission: number;
}

export interface SessionPaymentData {
  bookingId: string | null;
  paymentStatus: string | null;
  amountPaidOnline?: number;
  checkoutUrl?: string | null;
  canProceedToPay: boolean;
}

export interface SessionUserPermissions {
  isDriver: boolean;
  isPassenger: boolean;
  canBook: boolean;
  canCancel: boolean;
  canNegotiate: boolean;
  canChat: boolean;
}

export interface RideSessionData {
  sessionKey: string;
  sessionVersion: number;
  segment: SegmentIdentifier;
  ride: Ride | null;
  booking: Booking | null;
  bookingStateRaw: any;
  primaryState: PrimaryRideSessionState;
  secondaryState: SecondaryRideSessionState | null;
  actionState: PassengerRideAction;
  negotiation: SessionNegotiationData;
  payment: SessionPaymentData;
  seats: SeatBreakdown;
  driver: User | null;
  vehicle: Vehicle | null;
  waypoints: any[];
  permissions: SessionUserPermissions;
  portionMetrics: { distanceKm: number; durationMin: number } | null;
  loading: boolean;
  synchronizing: boolean;
  errorCode: SessionErrorCode | null;
  errorMessage: string | null;
  lastUpdatedAt: string;
  refreshTimestamp: number;
}

export type RideEventType =
  | 'BookingCreated'
  | 'BookingAccepted'
  | 'BookingRejected'
  | 'NegotiationUpdated'
  | 'PaymentCompleted'
  | 'RideUpdated'
  | 'RideCancelled'
  | 'RideDeleted'
  | 'PassengerCancelled'
  | 'SeatsUpdated'
  | 'DriverLocationUpdated'
  | 'SessionReloadRequested';

export interface RideEventPayload {
  type: RideEventType;
  rideId: string;
  bookingId?: string;
  version?: number;
  data?: any;
  timestamp: number;
}
