/**
 * ==============================================================
 * Fichier :
 * useProfile.ts
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

/**
 * Hook useProfile.
 *
 * Gère la logique métier et l'état local.
 */
export function useProfile() {
  const { authFetch, user, updateUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchVehicles = useCallback(async () => {
    if (!user) return [];
    setLoading(true);
    setError(null);
    try {
      const data = await authFetch(`/vehicles/?owner=${user.id}`);
      return Array.isArray(data) ? data : (data.results || []);
    } catch (err: any) {
      setError(err.message || 'Erreur lors du chargement des véhicules');
      return [];
    } finally {
      setLoading(false);
    }
  }, [authFetch, user]);

  const fetchPreferences = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await authFetch('/preferences/');
      return Array.isArray(data) ? data[0] : (data.results ? data.results[0] : data);
    } catch (err: any) {
      setError(err.message || 'Erreur lors du chargement des préférences');
      return null;
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  const updateProfileData = useCallback(async (formData: any) => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const isFormData = formData instanceof FormData;
      const res = await authFetch(`/users/${user.id}/`, {
        method: 'PATCH',
        body: isFormData ? formData : JSON.stringify(formData),
      });
      updateUser(res);
      return res;
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la mise à jour du profil');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [authFetch, user, updateUser]);

  return {
    loading,
    error,
    fetchVehicles,
    fetchPreferences,
    updateProfileData,
  };
}
