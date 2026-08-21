/**
 * ==============================================================
 * Fichier :
 * ride.ts
 *
 * Description :
 * Composant ou logique de l'application Zemy.
 *
 * Projet :
 * Zemy
 * ==============================================================
 */
import { User } from './user';

export interface Ride {
  id: string;
  driver: string;
  driver_details: User;
  departure_location: string;
  arrival_location: string;
  departure_time: string;
  departure_date: string;
  price_per_seat: number;
  original_price_per_seat?: number;
  driver_payout?: number;
  zemy_commission?: number;
  seats_available: number;
  total_seats: number;
  status: string;
  description?: string;
  distance_km?: number;
  duration_min?: number;
  driver_latitude?: number | null;
  driver_longitude?: number | null;
  departure_latitude?: number | null;
  departure_longitude?: number | null;
  arrival_latitude?: number | null;
  arrival_longitude?: number | null;
  
  // Parcels
  accepts_parcels?: boolean;
  max_parcels?: number;
  parcels_available?: number;
  max_weight_per_parcel?: number;
  max_dimensions?: string;
  price_per_parcel?: number;
  allowed_parcel_types?: string[];
  stopovers?: {
    name: string;
    stopDurationMin?: number;
    stop_duration_min?: number;
    latitude?: number | null;
    longitude?: number | null;
    price?: number;
    arrival_price?: number;
  }[];
  vehicle_details?: any;
  bookings?: any[];
  waypoints?: any[];

  // Preferences
  music?: boolean;
  smoking?: boolean;
  chatty?: boolean;
  air_conditioner?: boolean;
  pets_allowed?: boolean;
  luggage_allowed?: boolean;
  stops_allowed?: boolean;
}
