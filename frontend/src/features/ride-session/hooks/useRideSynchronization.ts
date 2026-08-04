import { useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { rideSynchronizer } from '../manager/RideSynchronizer';
import { rideSessionManager } from '../manager/RideSessionManager';
import { SegmentIdentifier } from '../types/rideSession.types';
import { useAuth } from '../../../context/AuthContext';

export function useRideSynchronization(segment: SegmentIdentifier, bookingId?: string | null) {
  const { authFetch, user } = useAuth();

  // Start synchronizer lifecycle
  useEffect(() => {
    if (!segment.rideId) return;

    rideSynchronizer.start(authFetch, user, segment);

    return () => {
      rideSynchronizer.stop();
      rideSessionManager.dispose();
    };
  }, [segment.rideId, segment.departureWaypointOrder, segment.arrivalWaypointOrder, authFetch, user]);

  // Handle WebSockets
  useEffect(() => {
    if (bookingId) {
      rideSynchronizer.setupWebSocket(bookingId);
    } else {
      rideSynchronizer.setupWebSocket(null);
    }
  }, [bookingId]);

  // Handle Screen Focus re-fetch
  useFocusEffect(
    useCallback(() => {
      if (segment.rideId) {
        rideSynchronizer.triggerAtomicSync('FocusEffect');
      }
    }, [segment.rideId])
  );
}
