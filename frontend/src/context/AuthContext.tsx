/**
 * ==============================================================
 * Fichier :
 * AuthContext.tsx
 *
 * Description :
 * Composant ou logique de l'application Zemy.
 * - Persistance de session via SecureStore (access + refresh token)
 * - Renouvellement silencieux du token expiré (transparent pour l'utilisateur)
 *
 * Projet :
 * Zemy
 * ==============================================================
 */
import React, { createContext, useState, useContext, useEffect, useMemo, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { fetchApi, apiEventEmitter, API_URL } from '../services/api';

export interface User {
  id: string;
  phone: string;
  full_name: string;
  email?: string | null;
  avatar: string | null;
  rating?: number;
  is_verified?: boolean;
  verification_status?: 'not_verified' | 'pending' | 'verified' | 'rejected';
  /** Date d'inscription ISO 8601 – ex: "2026-05-14T10:23:00Z" */
  created_at?: string | null;
  /** Nombre de trajets complétés en tant que conducteur */
  rides_count?: number;
  /** Nombre de réservations complétées en tant que passager (proxy avis) */
  reviews_count?: number;
  /** Total FCFA dépensé en covoiturage */
  total_spent?: number;
}

interface AuthContextData {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  hasStartedVerification: boolean;
  userLocation: { latitude: number; longitude: number } | null;
  loginWithPassword: (identifier: string, password: string) => Promise<User>;
  registerWithPassword: (data: any) => Promise<User>;
  logout: () => void;
  authFetch: (endpoint: string, options?: RequestInit) => Promise<any>;
  updateUser: (updates: Partial<User>) => void;
  refreshUser: () => Promise<void>;
  setHasStartedVerification: (val: boolean) => void;
}

const defaultContext: AuthContextData = {
  user: null,
  token: null,
  isLoading: true,
  hasStartedVerification: false,
  userLocation: null,
  loginWithPassword: async () => ({ id: '', phone: '', full_name: '', avatar: null }),
  registerWithPassword: async () => ({ id: '', phone: '', full_name: '', avatar: null }),
  logout: () => {},
  authFetch: async () => ({}),
  updateUser: () => {},
  refreshUser: async () => {},
  setHasStartedVerification: () => {},
};

const AuthContext = createContext<AuthContextData>(defaultContext);

const STORAGE_TOKEN_KEY = 'zemy_access_token';
const STORAGE_REFRESH_TOKEN_KEY = 'zemy_refresh_token';
const STORAGE_USER_KEY = '@zemy_user';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true); // true = checking saved session
  const [hasStartedVerification, setHasStartedVerificationState] = useState<boolean>(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  // Verrou pour éviter plusieurs refreshes simultanés
  const isRefreshingRef = useRef(false);
  const refreshPromiseRef = useRef<Promise<string | null> | null>(null);

  // Récupérer la position de l'utilisateur dès qu'il est connecté ou restauré
  useEffect(() => {
    if (!user) {
      setUserLocation(null);
      return;
    }

    const getUserLocation = async () => {
      try {
        const Location = require('expo-location');
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ 
            accuracy: Location.Accuracy.Balanced 
          });
          if (loc && loc.coords) {
            const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
            setUserLocation(coords);
          }
        }
      } catch (err) {
        console.warn('[Location] Échec de la récupération de la position de départ :', err);
      }
    };

    getUserLocation();
  }, [user]);

  useEffect(() => {
    AsyncStorage.getItem('@zemy_started_verification').then(val => {
      if (val === 'true') {
        setHasStartedVerificationState(true);
      }
    }).catch(() => {});
  }, []);

  // On mount: restore saved session
  useEffect(() => {
    let sessionRestored = false;

    // Écouter les erreurs 401 globales pour déconnecter l'utilisateur
    // Mais uniquement APRÈS que la session ait été restaurée (évite déco au démarrage)
    const handleUnauthorized = () => {
      if (sessionRestored) {
        logout();
      }
    };
    apiEventEmitter.on('unauthorized', handleUnauthorized);

    const restoreSession = async () => {
      try {
        const savedToken = await SecureStore.getItemAsync(STORAGE_TOKEN_KEY);
        const savedRefreshToken = await SecureStore.getItemAsync(STORAGE_REFRESH_TOKEN_KEY);
        const savedUser = await SecureStore.getItemAsync(STORAGE_USER_KEY);

        if (savedUser) {
          const parsedUser = JSON.parse(savedUser);
          setUser(parsedUser);

          let activeToken = savedToken;

          // Si on a un refresh token, on tente silencieusement de renouveler l'access token
          // Cela gère le cas où l'access token (24h) a expiré pendant l'absence
          if (savedRefreshToken) {
            try {
              const resp = await fetch(`${API_URL}/auth/token/refresh/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refresh: savedRefreshToken }),
              });
              if (resp.ok) {
                const data = await resp.json();
                if (data.access) {
                  activeToken = data.access;
                  await SecureStore.setItemAsync(STORAGE_TOKEN_KEY, data.access);
                  // Si le backend retourne aussi un nouveau refresh (rotation), on le met à jour
                  if (data.refresh) {
                    await SecureStore.setItemAsync(STORAGE_REFRESH_TOKEN_KEY, data.refresh);
                  }
                }
              } else {
                // Refresh token expiré (> 30 jours) → déconnexion
                await SecureStore.deleteItemAsync(STORAGE_TOKEN_KEY);
                await SecureStore.deleteItemAsync(STORAGE_REFRESH_TOKEN_KEY);
                await SecureStore.deleteItemAsync(STORAGE_USER_KEY);
                setUser(null);
                setToken(null);
                sessionRestored = true;
                setIsLoading(false);
                return;
              }
            } catch {
              // Erreur réseau → on utilise le token sauvegardé tel quel (mode hors-ligne)
              activeToken = savedToken;
            }
          }

          if (activeToken) {
            setToken(activeToken);

            // Rafraîchir les données user en arrière-plan
            if (parsedUser && parsedUser.id) {
              fetchApi(`/users/${parsedUser.id}/`, {
                headers: { 'Authorization': `Bearer ${activeToken}` },
                skipUnauthorizedEmit: true,
              })
                .then(async (freshUser) => {
                  if (freshUser && freshUser.id) {
                    setUser(freshUser);
                    await SecureStore.setItemAsync(STORAGE_USER_KEY, JSON.stringify(freshUser));
                  }
                })
                .catch(() => {
                  // En cas de problème réseau, la session locale persiste
                });
            }
          }
        }
      } catch (e) {
      } finally {
        sessionRestored = true;
        setIsLoading(false);
      }
    };
    restoreSession();

    return () => {
      apiEventEmitter.off('unauthorized', handleUnauthorized);
    };
  }, []);

  const loginWithPassword = useCallback(async (identifier: string, password: string): Promise<User> => {
    setIsLoading(true);
    try {
      const data = await fetchApi('/auth/login/', {
        method: 'POST',
        body: JSON.stringify({ identifier, password }),
      });
      setToken(data.access);
      setUser(data.user);
      try {
        await SecureStore.setItemAsync(STORAGE_TOKEN_KEY, data.access);
        // Sauvegarder le refresh token pour permettre la persistance de session longue (30 jours)
        if (data.refresh) {
          await SecureStore.setItemAsync(STORAGE_REFRESH_TOKEN_KEY, data.refresh);
        }
        await SecureStore.setItemAsync(STORAGE_USER_KEY, JSON.stringify(data.user));
      } catch (e) {}
      // Retourner l'user directement depuis la réponse (avant le re-render React)
      return data.user as User;
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const registerWithPassword = useCallback(async (userData: any): Promise<User> => {
    setIsLoading(true);
    try {
      const data = await fetchApi('/auth/register/', {
        method: 'POST',
        body: JSON.stringify(userData),
      });
      setToken(data.access);
      setUser(data.user);
      try {
        await SecureStore.setItemAsync(STORAGE_TOKEN_KEY, data.access);
        // Sauvegarder le refresh token pour permettre la persistance de session longue (30 jours)
        if (data.refresh) {
          await SecureStore.setItemAsync(STORAGE_REFRESH_TOKEN_KEY, data.refresh);
        }
        await SecureStore.setItemAsync(STORAGE_USER_KEY, JSON.stringify(data.user));
      } catch (e) {}
      // Retourner l'user directement depuis la réponse (avant le re-render React)
      return data.user as User;
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setToken(null);
    setUser(null);
    setHasStartedVerificationState(false);
    try {
      await SecureStore.deleteItemAsync(STORAGE_TOKEN_KEY);
      await SecureStore.deleteItemAsync(STORAGE_REFRESH_TOKEN_KEY);
      await SecureStore.deleteItemAsync(STORAGE_USER_KEY);
      await AsyncStorage.removeItem('@zemy_started_verification');
    } catch (e) {
    }
  }, []);

  const setHasStartedVerification = useCallback(async (val: boolean) => {
    setHasStartedVerificationState(val);
    try {
      if (val) {
        await AsyncStorage.setItem('@zemy_started_verification', 'true');
      } else {
        await AsyncStorage.removeItem('@zemy_started_verification');
      }
    } catch (_) {}
  }, []);

  /**
   * Renouvelle silencieusement l'access token via le refresh token.
   * Gère les appels concurrents : une seule requête refresh est faite à la fois.
   */
  const silentRefresh = useCallback(async (): Promise<string | null> => {
    // Si un refresh est déjà en cours, on attend le même Promise
    if (isRefreshingRef.current && refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }
    isRefreshingRef.current = true;
    refreshPromiseRef.current = (async () => {
      try {
        const savedRefresh = await SecureStore.getItemAsync(STORAGE_REFRESH_TOKEN_KEY);
        if (!savedRefresh) return null;
        const resp = await fetch(`${API_URL}/auth/token/refresh/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh: savedRefresh }),
        });
        if (!resp.ok) {
          // Refresh token invalide/expiré → déconnexion propre
          await logout();
          return null;
        }
        const data = await resp.json();
        if (data.access) {
          setToken(data.access);
          await SecureStore.setItemAsync(STORAGE_TOKEN_KEY, data.access);
          if (data.refresh) {
            await SecureStore.setItemAsync(STORAGE_REFRESH_TOKEN_KEY, data.refresh);
          }
          return data.access;
        }
        return null;
      } catch {
        return null;
      } finally {
        isRefreshingRef.current = false;
        refreshPromiseRef.current = null;
      }
    })();
    return refreshPromiseRef.current;
  }, [logout]);

  const authFetch = useCallback(async (endpoint: string, options: RequestInit = {}) => {
    let currentToken = token;

    // Si le token n'est pas encore dans l'état (ex: au démarrage), on vérifie le stockage
    if (!currentToken) {
      currentToken = await SecureStore.getItemAsync(STORAGE_TOKEN_KEY);
    }

    const headers: any = { ...(options.headers || {}) };
    if (currentToken) {
      headers['Authorization'] = `Bearer ${currentToken}`;
    }

    try {
      return await fetchApi(endpoint, { ...options, headers, skipUnauthorizedEmit: true });
    } catch (err: any) {
      // Si 401, on tente un refresh silencieux puis on rejette
      if (err?.status === 401) {
        const newToken = await silentRefresh();
        if (newToken) {
          // Réessayer la requête avec le nouveau token
          const retryHeaders = { ...headers, 'Authorization': `Bearer ${newToken}` };
          return fetchApi(endpoint, { ...options, headers: retryHeaders });
        }
        // Pas de nouveau token → déconnexion (déjà gérée dans silentRefresh)
      }
      throw err;
    }
  }, [token, silentRefresh]);

  const updateUser = useCallback((updates: Partial<User>) => {
    setUser(prev => {
      if (!prev) return prev;
      const newUser = { ...prev, ...updates };
      if (JSON.stringify(prev) === JSON.stringify(newUser)) return prev;
      
      SecureStore.setItemAsync(STORAGE_USER_KEY, JSON.stringify(newUser)).catch(() => {});
      return newUser;
    });
  }, []);

  const refreshUser = useCallback(async () => {
    if (!user || !user.id || !token) return;
    try {
      const data = await authFetch(`/users/${user.id}/`);
      updateUser(data);
    } catch (e) {
    }
  }, [user?.id, token, authFetch, updateUser]);

  const contextValue = useMemo(() => ({
    user,
    token,
    isLoading,
    hasStartedVerification,
    userLocation,
    loginWithPassword,
    registerWithPassword,
    logout,
    authFetch,
    updateUser,
    refreshUser,
    setHasStartedVerification
  }), [user, token, isLoading, hasStartedVerification, userLocation, loginWithPassword, registerWithPassword, logout, authFetch, updateUser, refreshUser, setHasStartedVerification]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
