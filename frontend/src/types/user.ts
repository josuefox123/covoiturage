/**
 * ==============================================================
 * Fichier :
 * user.ts
 *
 * Description :
 * Composant ou logique de l'application Zemy.
 *
 * Projet :
 * Zemy
 * ==============================================================
 */
import { Vehicle } from './vehicle';

export interface UserPreferences {
  music?: boolean;
  smoking?: boolean;
  chatty?: boolean;
  air_conditioner?: boolean;
  pets_allowed?: boolean;
  luggage_allowed?: boolean;
  stops_allowed?: boolean;
  notes?: string;
}

export interface User {
  id?: string;
  full_name: string;
  avatar: string | null;
  rating: number;
  phone?: string;
  is_verified?: boolean;
  vehicles?: Vehicle[];
  rides_count?: number;
  preference?: UserPreferences;
}
