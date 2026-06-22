export type NotificationType = 
  | 'RIDE' 
  | 'BOOKING' 
  | 'PAYMENT' 
  | 'MESSAGE' 
  | 'SYSTEM' 
  | 'PROMOTION' 
  | 'SECURITY' 
  | 'ACCOUNT';

export interface Notification {
  id: number;
  title: string;
  message: string;
  type?: NotificationType; // Le backend peut envoyer ou non
  is_read: boolean;
  created_at: string;
  // Les détails spécifiques selon le type (pour l'historique ou le modal de détail)
  ride_id?: number | null;
  booking_id?: number | null;
  amount?: number | null;
  author_name?: string | null;
  // Fallback si le backend n'envoie pas de champs structurés
  [key: string]: any; 
}

export type NotificationFilterType = 'Toutes' | 'Non lues' | 'Trajets' | 'Paiements' | 'Messages' | 'Promotions';
