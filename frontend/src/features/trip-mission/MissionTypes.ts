import { Ionicons } from '@expo/vector-icons';
import { Ride, Booking, User } from '../../types';

export type MissionState =
  | 'SEARCHING'
  | 'REQUEST_SENT'
  | 'NEGOTIATION'
  | 'PAYMENT'
  | 'BOOKED'
  | 'DRIVER_APPROACHING'
  | 'BOARDING'
  | 'LIVE'
  | 'ARRIVED'
  | 'RATE'
  | 'COMPLETED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'REFUNDED';

export type MissionActionType =
  | 'pay'
  | 'accept_negotiation'
  | 'reject_negotiation'
  | 'cancel_request'
  | 'cancel_booking'
  | 'view_ticket'
  | 'view_position'
  | 'track_live'
  | 'rate'
  | 'contact'
  | 'view_details'
  | 'start_trip'
  | 'finish_trip';

export interface MissionAction {
  type: MissionActionType;
  label: string;
  isPrimary?: boolean;
  color?: string;
}

export interface MissionData {
  rideId: string;
  bookingId?: string;
  passengerId?: string;
  driverId?: string;
  amount?: number | string;
  proposedPrice?: number;
  counterPrice?: number;
  seatsBooked?: number;
  otpCode?: string;
  estimatedArrival?: string;
  minutesToDeparture?: number;
  departureLocation: string;
  arrivalLocation: string;
  departureTime: string;
  departureDate: string;
  driverName?: string;
  passengerName?: string;
  vehicleModel?: string;
}

export interface Mission {
  state: MissionState;
  title: string;
  description: string;
  iconName: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  badgeText: string;
  badgeBgColor: string;
  badgeTextColor: string;
  actions: MissionAction[];
  data: MissionData;
  progress: number; // Percentage 0 - 100%
  category: 'upcoming' | 'live' | 'completed' | 'cancelled';
  role?: 'passenger' | 'driver';
}
