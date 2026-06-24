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
}
