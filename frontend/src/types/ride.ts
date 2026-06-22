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
  seats_available: number;
  total_seats: number;
  status: string;
  distance_km?: number;
  driver_latitude?: number | null;
  driver_longitude?: number | null;
  
  // Parcels
  accepts_parcels?: boolean;
  max_parcels?: number;
  parcels_available?: number;
  max_weight_per_parcel?: number;
  max_dimensions?: string;
  price_per_parcel?: number;
  allowed_parcel_types?: string[];
}
