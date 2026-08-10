import { Ionicons } from '@expo/vector-icons';

// ─── États possibles d'une mission ─────────────────────────────────────────
export type EtatMission =
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

// Alias pour compatibilité avec l'ancien code
export type MissionState = EtatMission;

// ─── Types d'actions disponibles ────────────────────────────────────────────
export type TypeActionMission =
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

// Alias pour compatibilité
export type MissionActionType = TypeActionMission;

// ─── Interface d'une action de mission ──────────────────────────────────────
export interface ActionMission {
  type: TypeActionMission;
  label: string;
  isPrimary?: boolean;
  color?: string;
}

// Alias pour compatibilité
export type MissionAction = ActionMission;

// ─── Données d'une mission ───────────────────────────────────────────────────
export interface DonneesMission {
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

// Alias pour compatibilité
export type MissionData = DonneesMission;

// ─── Mission complète résolue ────────────────────────────────────────────────
export interface Mission {
  state: EtatMission;
  title: string;
  description: string;
  iconName: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  badgeText: string;
  badgeBgColor: string;
  badgeTextColor: string;
  actions: ActionMission[];
  data: DonneesMission;
  progress: number; // Pourcentage 0 - 100%
  category: 'upcoming' | 'live' | 'completed' | 'cancelled';
  role?: 'passenger' | 'driver';
}
