/**
 * ==============================================================
 * Fichier :
 * booking.ts
 *
 * Description :
 * Composant ou logique de l'application Zemy.
 *
 * Projet :
 * Zemy
 * ==============================================================
 */
import { Ride } from './ride';

export interface BookingPassenger {
  id?: string;
  full_name: string;
  avatar: string | null;
  phone?: string;
}

export interface Booking {
  id: string;
  ride: string | Ride;
  passenger: string;
  passenger_details: BookingPassenger;
  seats_booked: number;
  status: string;
  payment_status?: string;
  transaction_id?: string | null;
  amount_paid_online?: number;
  departure_location?: string;
  arrival_location?: string;
  departure_latitude?: number | string | null;
  departure_longitude?: number | string | null;
  arrival_latitude?: number | string | null;
  arrival_longitude?: number | string | null;
  portion_price?: number;
  passenger_proposed_price?: number;
  driver_counter_price?: number;
  negotiation_message?: string;
  custom_price?: number;
  departure_waypoint_order?: number | null;
  arrival_waypoint_order?: number | null;
}
