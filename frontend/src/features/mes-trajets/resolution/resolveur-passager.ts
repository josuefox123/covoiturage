import { Ionicons } from '@expo/vector-icons';
import { Mission, DonneesMission, ActionMission } from '../types/types-mission';
import { theme } from '../../../styles/theme';

/**
 * Résolveur de missions pour le rôle PASSAGER.
 * Prend un booking (avec ride_details imbriqué) et retourne la Mission correspondante.
 */
export class ResolveurPassager {
  public static resoudre(booking: any, data: DonneesMission, minutesToDeparture: number): Mission {

    const ride = booking?.ride_details || booking?.ride || {};
    const rideStatus = String(ride.status || '').toLowerCase();
    const bookingStatus = String(booking?.status || '').toLowerCase();
    const paymentStatus = String(booking?.payment_status || '').toLowerCase();
    const action = String(booking?.action || '').toLowerCase();

    // ─── Annulé par le conducteur ─────────────────────────────────────
    if (rideStatus === 'cancelled' || bookingStatus === 'driver_cancelled') {
      return this.creerMission({
        state: 'CANCELLED',
        title: 'Trajet annulé par le conducteur',
        description: 'Le conducteur a annulé ce trajet. Si vous avez payé, votre remboursement est automatique.',
        iconName: 'close-circle-outline',
        iconColor: theme.colors.error,
        badgeText: 'Annulé',
        badgeBgColor: theme.colors.errorLight,
        badgeTextColor: theme.colors.error,
        actions: [{ type: 'view_details', label: 'Voir le trajet' }],
        data,
        progress: 0,
        category: 'cancelled'
      });
    }

    // ─── Annulé par le passager ───────────────────────────────────────
    if (bookingStatus === 'cancelled' || bookingStatus === 'passenger_cancelled') {
      return this.creerMission({
        state: 'CANCELLED',
        title: 'Réservation annulée',
        description: 'Vous avez annulé votre réservation pour ce trajet.',
        iconName: 'close-circle-outline',
        iconColor: theme.colors.grayDark,
        badgeText: 'Annulé',
        badgeBgColor: theme.colors.grayLight,
        badgeTextColor: theme.colors.grayDark,
        actions: [{ type: 'view_details', label: 'Détails' }],
        data,
        progress: 0,
        category: 'cancelled'
      });
    }

    // ─── Expirée ──────────────────────────────────────────────────────
    if (bookingStatus === 'expired') {
      return this.creerMission({
        state: 'EXPIRED',
        title: 'Demande expirée',
        description: "Le délai d'attente de réponse ou de paiement a expiré.",
        iconName: 'time-outline',
        iconColor: theme.colors.warningDark,
        badgeText: 'Expiré',
        badgeBgColor: theme.colors.warningLight,
        badgeTextColor: theme.colors.warningDark,
        actions: [{ type: 'view_details', label: 'Rechercher un autre' }],
        data,
        progress: 0,
        category: 'cancelled'
      });
    }

    // ─── Refusée ──────────────────────────────────────────────────────
    if (bookingStatus === 'rejected' || bookingStatus === 'refused') {
      return this.creerMission({
        state: 'REJECTED',
        title: 'Demande refusée',
        description: "Le conducteur n'a pas pu accepter votre demande.",
        iconName: 'alert-circle-outline',
        iconColor: theme.colors.error,
        badgeText: 'Refusé',
        badgeBgColor: theme.colors.errorLight,
        badgeTextColor: theme.colors.error,
        actions: [{ type: 'view_details', label: 'Autres trajets' }],
        data,
        progress: 0,
        category: 'cancelled'
      });
    }

    // ─── Terminée ─────────────────────────────────────────────────────
    if (rideStatus === 'completed' || bookingStatus === 'completed') {
      return this.creerMission({
        state: 'COMPLETED',
        title: 'Trajet terminé',
        description: 'Votre voyage est arrivé à destination avec succès.',
        iconName: 'checkmark-done-circle-outline',
        iconColor: theme.colors.primary,
        badgeText: 'Terminé',
        badgeBgColor: theme.colors.primaryLight,
        badgeTextColor: theme.colors.primary,
        actions: [
          { type: 'rate', label: 'Donner un avis', isPrimary: true },
          { type: 'view_details', label: 'Billet' }
        ],
        data,
        progress: 100,
        category: 'completed'
      });
    }

    // ─── En cours ─────────────────────────────────────────────────────
    if (rideStatus === 'in_progress' || rideStatus === 'started') {
      return this.creerMission({
        state: 'LIVE',
        title: 'Trajet en cours',
        description: 'Vous êtes actuellement en route vers votre destination.',
        iconName: 'navigate-outline',
        iconColor: theme.colors.success,
        badgeText: 'En cours',
        badgeBgColor: theme.colors.successLight,
        badgeTextColor: theme.colors.success,
        actions: [
          { type: 'track_live', label: 'Suivre le trajet', isPrimary: true },
          { type: 'contact', label: 'Contacter' }
        ],
        data,
        progress: 75,
        category: 'live'
      });
    }

    // ─── Paiement requis ──────────────────────────────────────────────
    if (
      action === 'pay_now' ||
      bookingStatus === 'pending_payment' ||
      (bookingStatus === 'confirmed' && paymentStatus !== 'paid' && paymentStatus !== 'escrow')
    ) {
      return this.creerMission({
        state: 'PAYMENT',
        title: 'Paiement requis',
        description: `Réservation acceptée. Veuillez régler ${data.amount} FCFA pour confirmer.`,
        iconName: 'card-outline',
        iconColor: '#0EA5E9',
        badgeText: 'Paiement requis',
        badgeBgColor: '#E0F2FE',
        badgeTextColor: '#0284C7',
        actions: [
          { type: 'pay', label: 'Payer maintenant', isPrimary: true, color: '#0EA5E9' },
          { type: 'view_details', label: 'Détails' }
        ],
        data,
        progress: 35,
        category: 'upcoming'
      });
    }

    // ─── Offre de négociation reçue ───────────────────────────────────
    if (action === 'offer_received' || bookingStatus === 'pending_passenger') {
      return this.creerMission({
        state: 'NEGOTIATION',
        title: 'Offre du conducteur',
        description: `Le conducteur propose ${data.counterPrice || data.amount} FCFA (vous proposiez ${data.proposedPrice || 0} FCFA).`,
        iconName: 'chatbubbles-outline',
        iconColor: '#D97706',
        badgeText: 'Offre reçue',
        badgeBgColor: '#FEF3C7',
        badgeTextColor: '#B45309',
        actions: [
          { type: 'accept_negotiation', label: "Accepter l'offre", isPrimary: true, color: '#16A34A' },
          { type: 'reject_negotiation', label: 'Refuser', color: '#DC2626' }
        ],
        data,
        progress: 25,
        category: 'upcoming'
      });
    }

    // ─── En attente de réponse du conducteur ──────────────────────────
    if (bookingStatus === 'pending' || bookingStatus === 'pending_driver' || action === 'waiting_driver') {
      return this.creerMission({
        state: 'REQUEST_SENT',
        title: 'En attente de réponse',
        description: 'Votre demande a été envoyée au conducteur. Vous serez notifié dès sa réponse.',
        iconName: 'hourglass-outline',
        iconColor: theme.colors.warningDark,
        badgeText: 'En attente',
        badgeBgColor: theme.colors.warningLight,
        badgeTextColor: theme.colors.warningDark,
        actions: [
          { type: 'cancel_request', label: 'Annuler la demande' },
          { type: 'view_details', label: 'Détails' }
        ],
        data,
        progress: 15,
        category: 'upcoming'
      });
    }

    // ─── Payé — départ imminent (< 30 min) ───────────────────────────
    if (paymentStatus === 'paid' || paymentStatus === 'escrow') {
      if (minutesToDeparture <= 30 && minutesToDeparture > 0) {
        return this.creerMission({
          state: 'DRIVER_APPROACHING',
          title: 'Conducteur en approche',
          description: `Le départ est prévu dans environ ${minutesToDeparture} minutes. Préparez-vous !`,
          iconName: 'car-sport-outline',
          iconColor: theme.colors.success,
          badgeText: 'Départ imminent',
          badgeBgColor: theme.colors.successLight,
          badgeTextColor: theme.colors.success,
          actions: [
            { type: 'view_position', label: 'Voir la position', isPrimary: true },
            { type: 'contact', label: 'Appeler' }
          ],
          data,
          progress: 50,
          category: 'live'
        });
      }

      // ─── Payé — réservation confirmée ─────────────────────────────
      return this.creerMission({
        state: 'BOOKED',
        title: 'Réservation confirmée',
        description: 'Votre billet est validé. Présentez votre code OTP au conducteur lors de la montée.',
        iconName: 'checkmark-circle-outline',
        iconColor: theme.colors.success,
        badgeText: 'Confirmé',
        badgeBgColor: theme.colors.successLight,
        badgeTextColor: theme.colors.success,
        actions: [
          { type: 'view_ticket', label: 'Voir le billet', isPrimary: true },
          { type: 'contact', label: 'Contacter' }
        ],
        data,
        progress: 40,
        category: 'upcoming'
      });
    }

    // ─── État inconnu — fallback ───────────────────────────────────
    return this.creerMissionVide(data);
  }

  private static creerMission(params: {
    state: Mission['state'];
    title: string;
    description: string;
    iconName: keyof typeof Ionicons.glyphMap;
    iconColor: string;
    badgeText: string;
    badgeBgColor: string;
    badgeTextColor: string;
    actions: ActionMission[];
    data: DonneesMission;
    progress: number;
    category: Mission['category'];
  }): Mission {
    return { ...params };
  }

  private static creerMissionVide(data: DonneesMission): Mission {
    return {
      state: 'SEARCHING',
      title: 'Aucun trajet',
      description: 'Aucune information disponible',
      iconName: 'search-outline',
      iconColor: theme.colors.grayDark,
      badgeText: 'Inconnu',
      badgeBgColor: theme.colors.grayLight,
      badgeTextColor: theme.colors.grayDark,
      actions: [],
      data,
      progress: 0,
      category: 'completed'
    };
  }
}
