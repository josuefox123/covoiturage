/**
 * ==============================================================
 * bookingState.ts
 *
 * Machine à états canonique pour le système de réservation Zemy.
 *
 * RÈGLE FONDAMENTALE :
 * Le frontend ne fait AUCUNE logique métier. Il appelle getRideAction()
 * avec les données du serveur et affiche le bouton correspondant.
 * Une réservation sur un segment différent = aucune réservation.
 * ==============================================================
 */

export type BookingAction =
  | 'reserve'             // Aucune réservation → bouton Réserver
  | 'waiting_driver'      // pending / pending_driver → En attente du conducteur
  | 'offer_received'      // pending_passenger → Proposition de prix reçue
  | 'pay'                 // pending_payment → Payer X FCFA
  | 'payment_processing'  // payment_processing → Validation en cours
  | 'confirmed'           // confirmed / started → Réservé (peut annuler)
  | 'completed'           // completed → Trajet terminé
  | 'expired'             // expired → Expiré (peut réserver à nouveau)
  | 'cancelled'           // cancelled → Annulé (peut réserver à nouveau)
  | 'own_ride';           // isOwnRide → Votre propre trajet

export interface BookingActionResult {
  action: BookingAction;
  label: string;
  amount?: number;
  canCancel: boolean;
  canPay: boolean;
  bookingId?: string;
  isFull?: boolean;
}

/**
 * Mappe l'état retourné par le backend vers la structure d'affichage du frontend.
 */
export function getRideAction(backendState: {
  action: string;
  label: string;
  booking_id?: string;
  price?: number;
  can_cancel?: boolean;
  can_pay?: boolean;
  is_full?: boolean;
} | null): BookingActionResult {
  if (!backendState) {
    return { action: 'reserve', label: 'Réserver', canCancel: false, canPay: false };
  }

  return {
    action: (backendState.action || 'reserve') as BookingAction,
    label: backendState.label || 'Réserver',
    amount: backendState.price,
    canCancel: !!backendState.can_cancel,
    canPay: !!backendState.can_pay,
    bookingId: backendState.booking_id,
    isFull: !!backendState.is_full,
  };
}

