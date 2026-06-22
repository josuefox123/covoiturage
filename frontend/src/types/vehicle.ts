/**
 * ==============================================================
 * Fichier :
 * vehicle.ts
 *
 * Description :
 * Composant ou logique de l'application Zemy.
 *
 * Projet :
 * Zemy
 * ==============================================================
 */
export interface Vehicle {
  id: string;
  owner: string;
  vehicle_type: string;
  brand_model: string;
  color: string;
  license_plate: string;
  driver_license_number?: string | null;
  license_expiration?: string | null;
}
