import { useEffect, useState, useCallback } from 'react';
import { rideSessionManager } from '../manager/RideSessionManager';
import { RideSessionData, SegmentIdentifier } from '../types/rideSession.types';
import { useAuth } from '../../../context/AuthContext';

export function useRideSession(segment: SegmentIdentifier) {
  const { authFetch, user } = useAuth();
  const [session, setSession] = useState<RideSessionData | null>(() =>
    rideSessionManager.getCurrentSession()
  );

  useEffect(() => {
    // Initial load
    rideSessionManager.loadSession(authFetch, segment, user);

    // Subscribe to session changes
    const unsubscribe = rideSessionManager.subscribe((newSession) => {
      setSession(newSession);
    });

    return () => {
      unsubscribe();
    };
  }, [segment.rideId, segment.departureWaypointOrder, segment.arrivalWaypointOrder, authFetch, user]);

  const refreshSession = useCallback(() => {
    return rideSessionManager.loadSession(authFetch, segment, user, { forceRefresh: true });
  }, [authFetch, segment, user]);

  const performBooking = useCallback(
    async (seatsToBook: number, customPrice?: number, message?: string, searchedDeparture?: string, searchedDestination?: string) => {
      return rideSessionManager.performBooking(authFetch, user, seatsToBook, customPrice, message, searchedDeparture, searchedDestination);
    },
    [authFetch, user]
  );

  const acceptOffer = useCallback(
    async (bookingId: string) => {
      return rideSessionManager.acceptOffer(authFetch, user, bookingId);
    },
    [authFetch, user]
  );

  const rejectOffer = useCallback(
    async (bookingId: string) => {
      return rideSessionManager.rejectOffer(authFetch, user, bookingId);
    },
    [authFetch, user]
  );

  const cancelBooking = useCallback(
    async (bookingId: string) => {
      return rideSessionManager.cancelBooking(authFetch, user, bookingId);
    },
    [authFetch, user]
  );

  return {
    session,
    ride: session?.ride || null,
    booking: session?.booking || null,
    primaryState: session?.primaryState || 'INITIAL',
    secondaryState: session?.secondaryState || null,
    actionState: session?.actionState || 'RESERVE',
    seats: session?.seats || {
      remainingSeats: 0,
      occupiedSeats: 0,
      reservedSeats: 0,
      availableSeats: 0,
      driverCapacity: 0
    },
    negotiation: session?.negotiation || null,
    payment: session?.payment || null,
    permissions: session?.permissions || null,
    loading: session?.loading ?? true,
    synchronizing: session?.synchronizing ?? false,
    error: session?.errorMessage || null,
    refreshSession,
    performBooking,
    acceptOffer,
    rejectOffer,
    cancelBooking
  };
}
