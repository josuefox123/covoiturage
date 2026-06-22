/**
 * ==============================================================
 * Fichier :
 * useTrips.ts
 *
 * Description :
 * Composant ou logique de l'application Zemy.
 *
 * Projet :
 * Zemy
 * ==============================================================
 */
import { useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { Ride } from '../types/ride';
import { Booking } from '../types/booking';

/**
 * Hook useTrips.
 *
 * Gère la logique métier et l'état local.
 */
export function useTrips() {
  const { authFetch, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPassengerBookings = useCallback(async (): Promise<Booking[]> => {
    if (!user) return [];
    setLoading(true);
    setError(null);
    try {
      const data = await authFetch(`/bookings/?passenger=${user.id}`);
      return Array.isArray(data) ? data : (data.results || []);
    } catch (err: any) {
      setError(err.message || 'Erreur lors du chargement des réservations');
      return [];
    } finally {
      setLoading(false);
    }
  }, [authFetch, user]);

  const fetchDriverRides = useCallback(async (): Promise<Ride[]> => {
    if (!user) return [];
    setLoading(true);
    setError(null);
    try {
      const data = await authFetch(`/rides/?driver=${user.id}`);
      return Array.isArray(data) ? data : (data.results || []);
    } catch (err: any) {
      setError(err.message || 'Erreur lors du chargement de vos trajets publiés');
      return [];
    } finally {
      setLoading(false);
    }
  }, [authFetch, user]);

  const searchRides = useCallback(async (type?: string): Promise<Ride[]> => {
    setLoading(true);
    setError(null);
    try {
      const endpoint = type ? `/rides/?type=${type}` : '/rides/';
      const data = await authFetch(endpoint);
      return Array.isArray(data) ? data : (data.results || []);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la recherche des trajets');
      return [];
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  const createRide = useCallback(async (rideData: Partial<Ride>) => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch('/rides/', {
        method: 'POST',
        body: JSON.stringify(rideData),
      });
      return res;
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la publication du trajet');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  return {
    loading,
    error,
    fetchPassengerBookings,
    fetchDriverRides,
    searchRides,
    createRide,
  };
}
