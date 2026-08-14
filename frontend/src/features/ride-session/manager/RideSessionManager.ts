import {
  RideSessionData,
  SegmentIdentifier,
  SeatBreakdown,
  SessionNegotiationData,
  SessionPaymentData,
  SessionUserPermissions
} from '../types/rideSession.types';
import { getSegmentKey, isSameSegment } from '../utils/segmentComparator';
import { resolveSessionPrimaryState, getPassengerRideAction } from '../utils/stateMachine';
import { RideSessionService } from '../services/rideSession.service';
import { ErrorManager } from './ErrorManager';
import { rideCache } from './RideCache';
import { rideEventBus } from './EventBus';

type SessionListener = (session: RideSessionData) => void;

export class RideSessionManager {
  private static instance: RideSessionManager;
  private currentSession: RideSessionData | null = null;
  private listeners: Set<SessionListener> = new Set();
  private isFetching = false;

  private constructor() {}

  public static getInstance(): RideSessionManager {
    if (!RideSessionManager.instance) {
      RideSessionManager.instance = new RideSessionManager();
    }
    return RideSessionManager.instance;
  }

  public subscribe(listener: SessionListener): () => void {
    this.listeners.add(listener);
    if (this.currentSession) {
      listener(this.currentSession);
    }
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getCurrentSession(): RideSessionData | null {
    return this.currentSession;
  }

  public dispose(): void {
    this.currentSession = null;
    rideCache.destroy();
    this.notify();
  }

  public async loadSession(
    authFetch: any,
    segment: SegmentIdentifier,
    user: any,
    options: { forceRefresh?: boolean; silent?: boolean } = {}
  ): Promise<RideSessionData | null> {
    if (!segment.rideId || !authFetch) {
      this.dispose();
      return null;
    }

    const key = getSegmentKey(segment);

    // Segment change -> Immediate reset
    if (this.currentSession && !isSameSegment(this.currentSession.segment, segment)) {
      this.dispose();
    }

    // Return cached session if valid and not forcing refresh
    if (!options.forceRefresh) {
      const cached = rideCache.get(key);
      if (cached) {
        this.currentSession = cached;
        this.notify();
        return cached;
      }
    }

    if (this.isFetching) {
      return this.currentSession;
    }

    this.isFetching = true;

    if (!options.silent) {
      if (!this.currentSession) {
        this.currentSession = this.createEmptySession(segment, key);
      } else {
        this.currentSession.synchronizing = true;
      }
      this.notify();
    }

    try {
      const { ride, bookingState } = await RideSessionService.fetchRideAndBookingState(
        authFetch,
        segment
      );

      const nextVersion = (this.currentSession?.sessionVersion || 0) + 1;
      const parsedSession = this.parseSessionData(segment, key, nextVersion, ride, bookingState, user);

      this.currentSession = parsedSession;
      rideCache.set(key, parsedSession);
      this.notify();
      return parsedSession;
    } catch (err: any) {
      const parsedErr = ErrorManager.parseError(err);
      if (this.currentSession) {
        this.currentSession = {
          ...this.currentSession,
          loading: false,
          synchronizing: false,
          errorCode: parsedErr.code,
          errorMessage: parsedErr.message
        };
        this.notify();
      }
      return null;
    } finally {
      this.isFetching = false;
    }
  }

  public async performBooking(
    authFetch: any,
    user: any,
    seatsToBook: number,
    customPrice?: number,
    message?: string,
    searchedDeparture?: string,
    searchedDestination?: string
  ): Promise<string | null> {
    if (!this.currentSession || !authFetch) return null;

    try {
      this.currentSession.loading = true;
      this.notify();

      const seg = this.currentSession.segment;
      // Priorité 1 : locations renvoyées par le backend dans bookingState (résolution via waypoints)
      // Priorité 2 : locations recherchées par le passager (passées depuis la page)
      // Priorité 3 : locations complètes du trajet (fallback)
      const sessionBookingState = this.currentSession.bookingStateRaw;
      const isIntermediateDep = seg.departureWaypointOrder !== undefined && seg.departureWaypointOrder > 0;
      const rideWaypoints = (this.currentSession.ride as any)?.waypoints;
      const isIntermediateArr = seg.arrivalWaypointOrder !== undefined &&
        rideWaypoints?.length &&
        seg.arrivalWaypointOrder < (rideWaypoints.length - 1);

      const departureLocation =
        searchedDeparture ||
        sessionBookingState?.departure_location ||
        (isIntermediateDep ? undefined : this.currentSession.ride?.departure_location);

      const arrivalLocation =
        searchedDestination ||
        sessionBookingState?.arrival_location ||
        (isIntermediateArr ? undefined : this.currentSession.ride?.arrival_location);

      const res = await RideSessionService.createBooking(authFetch, {
        rideId: seg.rideId,
        seatsBooked: seatsToBook,
        departureLocation,
        arrivalLocation,
        customPrice,
        message,
        departureWaypointOrder: seg.departureWaypointOrder,
        arrivalWaypointOrder: seg.arrivalWaypointOrder
      });

      if (res && res.id) {
        rideEventBus.emit({
          type: 'BookingCreated',
          rideId: seg.rideId,
          bookingId: res.id,
          timestamp: Date.now()
        });
        // Charger la session en arrière-plan sans bloquer la redirection immédiate vers le paiement
        this.loadSession(authFetch, seg, user, { forceRefresh: true });
        return String(res.id); // Retourne l'ID pour redirection paiement direct
      }
    } catch (err: any) {
      const parsedErr = ErrorManager.parseError(err);
      this.currentSession.errorCode = parsedErr.code;
      this.currentSession.errorMessage = parsedErr.message;
    } finally {
      if (this.currentSession) {
        this.currentSession.loading = false;
        this.notify();
      }
    }
    return null;
  }

  public async acceptOffer(authFetch: any, user: any, bookingId: string): Promise<boolean> {
    if (!this.currentSession || !authFetch) return false;
    try {
      this.currentSession.loading = true;
      this.notify();

      await RideSessionService.acceptOffer(authFetch, bookingId);
      rideEventBus.emit({
        type: 'BookingAccepted',
        rideId: this.currentSession.segment.rideId,
        bookingId,
        timestamp: Date.now()
      });
      await this.loadSession(authFetch, this.currentSession.segment, user, { forceRefresh: true });
      return true;
    } catch (err: any) {
      const parsedErr = ErrorManager.parseError(err);
      this.currentSession.errorCode = parsedErr.code;
      this.currentSession.errorMessage = parsedErr.message;
    } finally {
      if (this.currentSession) {
        this.currentSession.loading = false;
        this.notify();
      }
    }
    return false;
  }

  public async rejectOffer(authFetch: any, user: any, bookingId: string): Promise<boolean> {
    if (!this.currentSession || !authFetch) return false;
    try {
      this.currentSession.loading = true;
      this.notify();

      await RideSessionService.rejectOffer(authFetch, bookingId);
      rideEventBus.emit({
        type: 'BookingRejected',
        rideId: this.currentSession.segment.rideId,
        bookingId,
        timestamp: Date.now()
      });
      await this.loadSession(authFetch, this.currentSession.segment, user, { forceRefresh: true });
      return true;
    } catch (err: any) {
      const parsedErr = ErrorManager.parseError(err);
      this.currentSession.errorCode = parsedErr.code;
      this.currentSession.errorMessage = parsedErr.message;
    } finally {
      if (this.currentSession) {
        this.currentSession.loading = false;
        this.notify();
      }
    }
    return false;
  }

  public async cancelBooking(authFetch: any, user: any, bookingId: string): Promise<boolean> {
    if (!this.currentSession || !authFetch) return false;
    try {
      this.currentSession.loading = true;
      this.notify();

      await RideSessionService.cancelBooking(authFetch, bookingId);
      rideEventBus.emit({
        type: 'PassengerCancelled',
        rideId: this.currentSession.segment.rideId,
        bookingId,
        timestamp: Date.now()
      });
      await this.loadSession(authFetch, this.currentSession.segment, user, { forceRefresh: true });
      return true;
    } catch (err: any) {
      const parsedErr = ErrorManager.parseError(err);
      this.currentSession.errorCode = parsedErr.code;
      this.currentSession.errorMessage = parsedErr.message;
    } finally {
      if (this.currentSession) {
        this.currentSession.loading = false;
        this.notify();
      }
    }
    return false;
  }

  private createEmptySession(segment: SegmentIdentifier, sessionKey: string): RideSessionData {
    return {
      sessionKey,
      sessionVersion: 1,
      segment,
      ride: null,
      booking: null,
      bookingStateRaw: null,
      primaryState: 'INITIAL',
      secondaryState: null,
      actionState: 'RESERVE',
      negotiation: {
        hasNegotiation: false,
        pricePerSeat: 0,
        totalToPay: 0,
        commission: 0
      },
      payment: {
        bookingId: null,
        paymentStatus: null,
        canProceedToPay: false
      },
      seats: {
        remainingSeats: 0,
        occupiedSeats: 0,
        reservedSeats: 0,
        availableSeats: 0,
        driverCapacity: 0
      },
      driver: null,
      vehicle: null,
      waypoints: [],
      permissions: {
        isDriver: false,
        isPassenger: false,
        canBook: false,
        canCancel: false,
        canNegotiate: false,
        canChat: false
      },
      portionMetrics: null,
      loading: true,
      synchronizing: false,
      errorCode: null,
      errorMessage: null,
      lastUpdatedAt: new Date().toISOString(),
      refreshTimestamp: Date.now()
    };
  }

  private parseSessionData(
    segment: SegmentIdentifier,
    sessionKey: string,
    version: number,
    ride: any,
    bookingState: any,
    user: any
  ): RideSessionData {
    const { primaryState, secondaryState } = resolveSessionPrimaryState(bookingState, ride, false);

    const isDriver = user && ride && String(ride.driver_details?.id) === String(user.id);
    const isPassenger = user && !isDriver;

    // Seats breakdown
    const availableSeats = ride?.seats_available || 0;
    const totalSeats = ride?.total_seats || availableSeats;
    const reservedSeats = bookingState?.seats_booked || 0;
    const occupiedSeats = Math.max(0, totalSeats - availableSeats);

    const seats: SeatBreakdown = {
      remainingSeats: availableSeats,
      occupiedSeats,
      reservedSeats,
      availableSeats,
      driverCapacity: totalSeats
    };

    // Negotiation breakdown
    const pricePerSeat = ride?.driver_payout || 0;
    const hasNegotiation = Boolean(
      bookingState?.driver_counter_price ||
        bookingState?.passenger_proposed_price ||
        bookingState?.custom_price
    );

    const negotiation: SessionNegotiationData = {
      hasNegotiation,
      passengerProposedPrice: bookingState?.passenger_proposed_price,
      driverCounterPrice: bookingState?.driver_counter_price,
      customPrice: bookingState?.custom_price,
      negotiationMessage: bookingState?.negotiation_message,
      driverNote: bookingState?.driver_note,
      pricePerSeat,
      totalToPay: bookingState?.price || pricePerSeat,
      commission: bookingState?.pricing_breakdown?.commission || 0
    };

    // Payment breakdown
    const bookingId = bookingState?.booking_id || null;
    const canProceedToPay = primaryState === 'PAYMENT_PENDING' && Boolean(bookingId);

    const payment: SessionPaymentData = {
      bookingId,
      paymentStatus: bookingState?.payment_status || null,
      amountPaidOnline: bookingState?.price,
      checkoutUrl: bookingState?.checkout_url,
      canProceedToPay
    };

    const permissions: SessionUserPermissions = {
      isDriver: Boolean(isDriver),
      isPassenger: Boolean(isPassenger),
      canBook: isPassenger && availableSeats > 0 && primaryState === 'READY',
      canCancel: isPassenger && Boolean(bookingId) && primaryState !== 'COMPLETED',
      canNegotiate: isPassenger && primaryState === 'READY',
      canChat: Boolean(user && ride)
    };

    const mockSession: Partial<RideSessionData> = {
      primaryState,
      secondaryState
    };
    const actionState = getPassengerRideAction(mockSession);

    return {
      sessionKey,
      sessionVersion: version,
      segment,
      ride,
      booking: bookingId
        ? ({
            id: bookingId,
            status: bookingState?.status,
            payment_status: bookingState?.payment_status,
            amount_paid_online: bookingState?.price,
            departure_location: bookingState?.departure_location,
            arrival_location: bookingState?.arrival_location,
            seats_booked: bookingState?.seats_booked || 1,
            pricing_breakdown: bookingState?.pricing_breakdown
          } as any)
        : null,
      bookingStateRaw: bookingState,
      primaryState,
      secondaryState,
      actionState,
      negotiation,
      payment,
      seats,
      driver: ride?.driver_details || null,
      vehicle: ride?.vehicle_details || null,
      waypoints: ride?.waypoints || [],
      permissions,
      portionMetrics: null,
      loading: false,
      synchronizing: false,
      errorCode: null,
      errorMessage: null,
      lastUpdatedAt: ride?.updated_at || new Date().toISOString(),
      refreshTimestamp: Date.now()
    };
  }

  private notify(): void {
    if (!this.currentSession) return;
    this.listeners.forEach((listener) => listener(this.currentSession!));
  }
}

export const rideSessionManager = RideSessionManager.getInstance();
