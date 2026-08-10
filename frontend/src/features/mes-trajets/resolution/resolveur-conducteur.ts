import { Ionicons } from '@expo/vector-icons';
import { Mission, DonneesMission, ActionMission } from '../types/types-mission';
import { theme } from '../../../styles/theme';

/**
 * Résolveur de missions pour le rôle CONDUCTEUR.
 * Prend directement un objet ride et retourne la Mission correspondante.
 */
export class ResolveurConducteur {
  public static resoudre(ride: any, data: DonneesMission): Mission {
    const rideStatus = String(ride.status || '').toLowerCase();

    // ─── Terminé ───────────────────────────────────────────────────────
    if (rideStatus === 'completed') {
      return this.creerMission({
        state: 'COMPLETED',
        title: 'Trajet accompli',
        description: 'Vous avez conduit vos passagers à destination avec succès.',
        iconName: 'checkmark-done-circle-outline',
        iconColor: theme.colors.primary,
        badgeText: 'Terminé',
        badgeBgColor: theme.colors.primaryLight,
        badgeTextColor: theme.colors.primary,
        actions: [{ type: 'view_details', label: 'Résumé du trajet' }],
        data,
        progress: 100,
        category: 'completed'
      });
    }

    // ─── En cours de conduite ──────────────────────────────────────────
    if (rideStatus === 'in_progress' || rideStatus === 'started') {
      return this.creerMission({
        state: 'LIVE',
        title: 'Trajet en cours de conduite',
        description: 'Vous conduisez actuellement. Respectez les consignes de sécurité.',
        iconName: 'speedometer-outline',
        iconColor: theme.colors.success,
        badgeText: 'En cours',
        badgeBgColor: theme.colors.successLight,
        badgeTextColor: theme.colors.success,
        actions: [
          { type: 'track_live', label: 'Navigation GPS', isPrimary: true },
          { type: 'finish_trip', label: 'Terminer le trajet' }
        ],
        data,
        progress: 80,
        category: 'live'
      });
    }

    // ─── Annulé ────────────────────────────────────────────────────────
    if (rideStatus === 'cancelled') {
      return this.creerMission({
        state: 'CANCELLED',
        title: 'Trajet annulé',
        description: 'Vous avez annulé ce trajet.',
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

    // ─── Prévu / par défaut ────────────────────────────────────────────
    return this.creerMission({
      state: 'BOOKED',
      title: 'Trajet prévu',
      description: `${ride.seats_available || 0} place(s) encore disponible(s) sur ${ride.total_seats || 4}.`,
      iconName: 'calendar-outline',
      iconColor: theme.colors.primary,
      badgeText: 'Prévu',
      badgeBgColor: theme.colors.primaryLight,
      badgeTextColor: theme.colors.primary,
      actions: [
        { type: 'view_details', label: 'Gérer les réservations', isPrimary: true }
      ],
      data,
      progress: 20,
      category: 'upcoming'
    });
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
}
