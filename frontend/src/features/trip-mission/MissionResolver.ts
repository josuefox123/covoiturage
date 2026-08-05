import { Ionicons } from '@expo/vector-icons';
import { Mission, MissionState, MissionData, MissionAction } from './MissionTypes';
import { theme } from '../../styles/theme';

export class MissionResolver {
  public static resolveMission(item: any, role: 'passenger' | 'driver' = 'passenger'): Mission {
    const mission = this.doResolveMission(item, role);
    mission.role = role;
    return mission;
  }

  private static doResolveMission(item: any, role: 'passenger' | 'driver'): Mission {
    if (!item) {
      return this.createEmptyMission();
    }

    const isPassenger = role === 'passenger';
    const ride = isPassenger ? item.ride_details || item.ride || {} : item;
    const booking = isPassenger ? item : null;

    const rideStatus = String(ride.status || '').toLowerCase();
    const bookingStatus = String(booking?.status || '').toLowerCase();
    const paymentStatus = String(booking?.payment_status || '').toLowerCase();
    const action = String(booking?.action || '').toLowerCase();

    const data: MissionData = {
      rideId: String(ride.id || item.id || ''),
      bookingId: booking?.id ? String(booking.id) : undefined,
      passengerId: booking?.passenger ? String(booking.passenger) : undefined,
      driverId: ride.driver ? String(ride.driver) : undefined,
      amount: booking?.price || ride.price_per_seat || 0,
      proposedPrice: booking?.passenger_proposed_price,
      counterPrice: booking?.driver_counter_price || booking?.custom_price,
      seatsBooked: booking?.seats_booked || 1,
      otpCode: booking?.id ? `T-${booking.id.substring(0, 8).toUpperCase()}` : (booking?.otp_code || booking?.validation_code),
      departureLocation: ride.departure_location || booking?.departure_location || 'Départ',
      arrivalLocation: ride.arrival_location || booking?.arrival_location || 'Arrivée',
      departureTime: ride.departure_time || '00:00',
      departureDate: ride.departure_date || 'Aujourd\'hui',
      driverName: ride.driver_details?.full_name || 'Conducteur',
      passengerName: booking?.passenger_details?.full_name || 'Passager',
      vehicleModel: ride.vehicle_details?.model || 'Véhicule'
    };

    // Calculate departure timing
    let minutesToDeparture = 60;
    if (ride.departure_date && ride.departure_time) {
      try {
        const [y, m, d] = ride.departure_date.split('-').map(Number);
        const [h, min] = ride.departure_time.split(':').map(Number);
        const depDate = new Date(y, m - 1, d, h, min);
        minutesToDeparture = Math.round((depDate.getTime() - Date.now()) / (60 * 1000));
      } catch (e) {
        // Fallback
      }
    }
    data.minutesToDeparture = minutesToDeparture;

    // --- PASSENGER MISSION RESOLUTION ---
    if (isPassenger) {
      if (rideStatus === 'cancelled' || bookingStatus === 'driver_cancelled') {
        return this.createMission({
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
          category: 'completed'
        });
      }

      if (bookingStatus === 'cancelled' || bookingStatus === 'passenger_cancelled') {
        return this.createMission({
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
          category: 'completed'
        });
      }

      if (bookingStatus === 'expired') {
        return this.createMission({
          state: 'EXPIRED',
          title: 'Demande expirée',
          description: 'Le délai d\'attente de réponse ou de paiement a expiré.',
          iconName: 'time-outline',
          iconColor: theme.colors.warningDark,
          badgeText: 'Expiré',
          badgeBgColor: theme.colors.warningLight,
          badgeTextColor: theme.colors.warningDark,
          actions: [{ type: 'view_details', label: 'Rechercher un autre' }],
          data,
          progress: 0,
          category: 'completed'
        });
      }

      if (bookingStatus === 'rejected' || bookingStatus === 'refused') {
        return this.createMission({
          state: 'REJECTED',
          title: 'Demande refusée',
          description: 'Le conducteur n\'a pas pu accepter votre demande.',
          iconName: 'alert-circle-outline',
          iconColor: theme.colors.error,
          badgeText: 'Refusé',
          badgeBgColor: theme.colors.errorLight,
          badgeTextColor: theme.colors.error,
          actions: [{ type: 'view_details', label: 'Autres trajets' }],
          data,
          progress: 0,
          category: 'completed'
        });
      }

      if (rideStatus === 'completed' || bookingStatus === 'completed') {
        return this.createMission({
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

      if (rideStatus === 'in_progress' || rideStatus === 'started') {
        return this.createMission({
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

      if (action === 'pay_now' || bookingStatus === 'pending_payment') {
        return this.createMission({
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

      if (action === 'offer_received' || bookingStatus === 'pending_passenger') {
        return this.createMission({
          state: 'NEGOTIATION',
          title: 'Offre du conducteur',
          description: `Le conducteur propose ${data.counterPrice || data.amount} FCFA (vous proposiez ${data.proposedPrice || 0} FCFA).`,
          iconName: 'chatbubbles-outline',
          iconColor: '#D97706',
          badgeText: 'Offre reçue',
          badgeBgColor: '#FEF3C7',
          badgeTextColor: '#B45309',
          actions: [
            { type: 'accept_negotiation', label: 'Accepter l\'offre', isPrimary: true, color: '#16A34A' },
            { type: 'reject_negotiation', label: 'Refuser', color: '#DC2626' }
          ],
          data,
          progress: 25,
          category: 'upcoming'
        });
      }

      if (bookingStatus === 'pending' || bookingStatus === 'pending_driver' || action === 'waiting_driver') {
        return this.createMission({
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

      if (paymentStatus === 'paid' || bookingStatus === 'confirmed') {
        if (minutesToDeparture <= 30 && minutesToDeparture > 0) {
          return this.createMission({
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

        return this.createMission({
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
    }

    // --- DRIVER MISSION RESOLUTION ---
    if (rideStatus === 'completed') {
      return this.createMission({
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

    if (rideStatus === 'in_progress' || rideStatus === 'started') {
      return this.createMission({
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

    if (rideStatus === 'cancelled') {
      return this.createMission({
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
        category: 'completed'
      });
    }

    return this.createMission({
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

  private static createMission(params: {
    state: MissionState;
    title: string;
    description: string;
    iconName: keyof typeof Ionicons.glyphMap;
    iconColor: string;
    badgeText: string;
    badgeBgColor: string;
    badgeTextColor: string;
    actions: MissionAction[];
    data: MissionData;
    progress: number;
    category: 'upcoming' | 'live' | 'completed';
  }): Mission {
    return {
      state: params.state,
      title: params.title,
      description: params.description,
      iconName: params.iconName,
      iconColor: params.iconColor,
      badgeText: params.badgeText,
      badgeBgColor: params.badgeBgColor,
      badgeTextColor: params.badgeTextColor,
      actions: params.actions,
      data: params.data,
      progress: params.progress,
      category: params.category
    };
  }

  private static createEmptyMission(): Mission {
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
      data: {
        rideId: '',
        departureLocation: '',
        arrivalLocation: '',
        departureTime: '',
        departureDate: ''
      },
      progress: 0,
      category: 'completed'
    };
  }
}
