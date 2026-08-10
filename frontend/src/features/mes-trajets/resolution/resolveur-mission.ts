import { Mission, DonneesMission } from '../types/types-mission';
import { ResolveurPassager } from './resolveur-passager';
import { ResolveurConducteur } from './resolveur-conducteur';
import { theme } from '../../../styles/theme';

/**
 * Orchestrateur principal de résolution de missions.
 * Délègue au ResolveurPassager ou ResolveurConducteur selon le rôle.
 *
 * Expose la même API que l'ancien MissionResolver pour compatibilité.
 */
export class ResolveurMission {
  public static resolveMission(item: any, role: 'passenger' | 'driver' = 'passenger'): Mission {
    const mission = this.resoudre(item, role);
    mission.role = role;
    return mission;
  }

  private static resoudre(item: any, role: 'passenger' | 'driver'): Mission {
    if (!item) {
      return this.creerMissionVide();
    }

    const isPassager = role === 'passenger';
    const ride = isPassager ? item.ride_details || item.ride || {} : item;
    const booking = isPassager ? item : null;

    // ─── Construction des données communes ───────────────────────────
    const bookingDep = booking?.departure_location || '';
    const bookingArr = booking?.arrival_location || '';
    const rideDep = ride?.departure_location || '';
    const rideArr = ride?.arrival_location || '';

    const isIntermediaire = bookingDep && bookingArr && (
      bookingDep.split(',')[0].trim().toLowerCase() !== rideDep.split(',')[0].trim().toLowerCase() ||
      bookingArr.split(',')[0].trim().toLowerCase() !== rideArr.split(',')[0].trim().toLowerCase()
    );

    const bookingStatus = String(booking?.status || '').toLowerCase();
    let montant: number | string = booking?.price || ride.price_per_seat || 0;
    if (isPassager && booking && isIntermediaire) {
      if (['pending', 'pending_driver', 'waiting_driver'].includes(bookingStatus)) {
        montant = 'À confirmer';
      }
    }

    const data: DonneesMission = {
      rideId: String(ride.id || item.id || ''),
      bookingId: booking?.id ? String(booking.id) : undefined,
      passengerId: booking?.passenger ? String(booking.passenger) : undefined,
      driverId: ride.driver ? String(ride.driver) : undefined,
      amount: montant,
      proposedPrice: booking?.passenger_proposed_price,
      counterPrice: booking?.driver_counter_price || booking?.custom_price,
      seatsBooked: booking?.seats_booked || 1,
      otpCode: (booking?.payment_status === 'paid' || booking?.payment_status === 'escrow')
        ? `T-${booking.id.substring(0, 8).toUpperCase()}`
        : undefined,
      departureLocation: booking?.departure_location || ride.departure_location || 'Départ',
      arrivalLocation: booking?.arrival_location || ride.arrival_location || 'Arrivée',
      departureTime: ride.departure_time || '00:00',
      departureDate: ride.departure_date || "Aujourd'hui",
      driverName: ride.driver_details?.full_name || 'Conducteur',
      passengerName: booking?.passenger_details?.full_name || 'Passager',
      vehicleModel: ride.vehicle_details?.model || 'Véhicule'
    };

    // ─── Calcul du temps avant le départ ─────────────────────────────
    let minutesAvantDepart = 60;
    if (ride.departure_date && ride.departure_time) {
      try {
        const [y, m, d] = ride.departure_date.split('-').map(Number);
        const [h, min] = ride.departure_time.split(':').map(Number);
        const dateDepart = new Date(y, m - 1, d, h, min);
        minutesAvantDepart = Math.round((dateDepart.getTime() - Date.now()) / (60 * 1000));
      } catch {
        // Valeur par défaut conservée
      }
    }
    data.minutesToDeparture = minutesAvantDepart;

    // ─── Délégation selon le rôle ─────────────────────────────────────
    if (isPassager) {
      return ResolveurPassager.resoudre(booking, data, minutesAvantDepart);
    }
    return ResolveurConducteur.resoudre(ride, data);
  }

  private static creerMissionVide(): Mission {
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
