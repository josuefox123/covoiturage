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
import { wsService } from '../services/websocket/WebSocketService';

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
const STORAGE_USER_KEY = 'zemy_user'; // ancien: '@zemy_user' (@ interdit sur Android SecureStore)
// Clés AsyncStorage (fallback si SecureStore échoue sur Android)
const AS_TOKEN_KEY = 'zemy_as_access_token';
const AS_REFRESH_KEY = 'zemy_as_refresh_token';
const AS_USER_KEY = 'zemy_as_user';

/** Décodage base64 multi-plateforme sans dépendance externe */
function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  if (typeof atob === 'function') {
    return atob(base64);
  }
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let output = '';
  for (let bc = 0, bs = 0, buffer, idx = 0; (buffer = base64.charAt(idx++)); ) {
    const charIndex = chars.indexOf(buffer);
    if (~charIndex) {
      bs = bc % 4 ? bs * 64 + charIndex : charIndex;
      if (bc++ % 4) {
        output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6)));
      }
    }
  }
  return output;
}

/** Vérifie si un token JWT est expiré ou sur le point de l'être */
export function isJwtExpired(token: string | null | undefined, skewSeconds = 60): boolean {
  if (!token) return true;
  try {
    const parts = token.split('.');
    if (parts.length < 2) return true;
    const payloadStr = base64UrlDecode(parts[1]);
    const payload = JSON.parse(payloadStr);
    if (!payload.exp) return false;
    const nowSec = Math.floor(Date.now() / 1000);
    return payload.exp <= nowSec + skewSeconds;
  } catch {
    return true;
  }
}

/** Lecture robuste : SecureStore en priorité, AsyncStorage en fallback, + migration ancienne clé */
async function secureGet(secureKey: string, fallbackKey: string): Promise<string | null> {
  try {
    const val = await SecureStore.getItemAsync(secureKey);
    if (val !== null) return val;
  } catch (_) {}
  // Migration : si c'est la clé user, essayer l'ancienne clé avec @ (invalide sur Android, mais valide en Expo Go web)
  if (secureKey === STORAGE_USER_KEY) {
    try {
      const legacy = await SecureStore.getItemAsync('@zemy_user');
      if (legacy !== null) {
        // Migrer vers la nouvelle clé propre
        await Promise.allSettled([
          SecureStore.setItemAsync(secureKey, legacy),
          AsyncStorage.setItem(fallbackKey, legacy),
          SecureStore.deleteItemAsync('@zemy_user'),
        ]);
        return legacy;
      }
    } catch (_) {}
  }
  try {
    return await AsyncStorage.getItem(fallbackKey);
  } catch (_) {}
  return null;
}

/** Helper global exporté pour les services nécessitant le token d'accès sans le contexte React */
export async function getStoredAccessToken(): Promise<string | null> {
  return secureGet(STORAGE_TOKEN_KEY, AS_TOKEN_KEY);
}

/** Écriture robuste : SecureStore + AsyncStorage (les deux) */
async function secureSet(secureKey: string, fallbackKey: string, value: string): Promise<void> {
  await Promise.allSettled([
    SecureStore.setItemAsync(secureKey, value),
    AsyncStorage.setItem(fallbackKey, value),
  ]);
}

/** Suppression robuste des deux stores */
async function secureDelete(secureKey: string, fallbackKey: string): Promise<void> {
  await Promise.allSettled([
    SecureStore.deleteItemAsync(secureKey),
    AsyncStorage.removeItem(fallbackKey),
  ]);
}


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

  const logout = useCallback(async () => {
    try {
      const savedRefresh = await secureGet(STORAGE_REFRESH_TOKEN_KEY, AS_REFRESH_KEY);
      const currentToken = token || (await secureGet(STORAGE_TOKEN_KEY, AS_TOKEN_KEY));
      if (savedRefresh) {
        // Révocation serveur (blacklist du refresh token)
        fetch(`${API_URL}/auth/logout/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(currentToken ? { Authorization: `Bearer ${currentToken}` } : {}),
          },
          body: JSON.stringify({ refresh: savedRefresh }),
        }).catch(() => {});
      }
    } catch (_) {}

    try {
      wsService.disconnect();
    } catch (_) {}

    setToken(null);
    setUser(null);
    setHasStartedVerificationState(false);

    try {
      await Promise.all([
        secureDelete(STORAGE_TOKEN_KEY, AS_TOKEN_KEY),
        secureDelete(STORAGE_REFRESH_TOKEN_KEY, AS_REFRESH_KEY),
        secureDelete(STORAGE_USER_KEY, AS_USER_KEY),
      ]);
      await AsyncStorage.removeItem('@zemy_started_verification');
    } catch (e) {
      console.warn('[AuthContext] Erreur nettoyage local logout:', e);
    }
  }, [token]);

  /**
   * Renouvelle silencieusement l'access token via le refresh token.
   * Sérialise les requêtes concurrentes : une seule requête HTTP à la fois.
   */
  const silentRefresh = useCallback(async (): Promise<string | null> => {
    if (isRefreshingRef.current && refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }
    isRefreshingRef.current = true;
    refreshPromiseRef.current = (async () => {
      try {
        const savedRefresh = await secureGet(STORAGE_REFRESH_TOKEN_KEY, AS_REFRESH_KEY);
        if (!savedRefresh) return null;

        let resp: Response;
        try {
          resp = await fetch(`${API_URL}/auth/token/refresh/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh: savedRefresh }),
          });
        } catch (netErr) {
          // Erreur réseau (perte de connexion, timeout) : NE PAS déconnecter l'utilisateur !
          console.warn('[AuthContext] Échec réseau lors du rafraîchissement token:', netErr);
          return null;
        }

        if (resp.status === 401 || resp.status === 400) {
          // Refresh token réellement invalide, révoqué ou expiré (> 30 jours) côté serveur
          console.warn('[AuthContext] Refresh token rejeté par le serveur. Déconnexion explicite.');
          await logout();
          return null;
        }

        if (!resp.ok) {
          // Erreur serveur temporaire 5xx : conserver la session
          console.warn(`[AuthContext] Erreur serveur (${resp.status}) lors du refresh, session locale préservée.`);
          return null;
        }

        const data = await resp.json();
        if (data.access) {
          setToken(data.access);
          await secureSet(STORAGE_TOKEN_KEY, AS_TOKEN_KEY, data.access);
          // Rotation des refresh tokens (SIMPLE_JWT ROTATE_REFRESH_TOKENS = True)
          if (data.refresh) {
            await secureSet(STORAGE_REFRESH_TOKEN_KEY, AS_REFRESH_KEY, data.refresh);
          }
          return data.access;
        }
        return null;
      } catch (err) {
        console.warn('[AuthContext] Erreur inattendue dans silentRefresh:', err);
        return null;
      } finally {
        isRefreshingRef.current = false;
        refreshPromiseRef.current = null;
      }
    })();
    return refreshPromiseRef.current;
  }, [logout]);

  // On mount: restaurer la session sauvegardée
  useEffect(() => {
    let sessionRestored = false;

    const handleUnauthorized = () => {
      if (sessionRestored) {
        logout();
      }
    };
    apiEventEmitter.on('unauthorized', handleUnauthorized);

    const restoreSession = async () => {
      try {
        const [savedToken, savedRefreshToken, savedUser] = await Promise.all([
          secureGet(STORAGE_TOKEN_KEY, AS_TOKEN_KEY),
          secureGet(STORAGE_REFRESH_TOKEN_KEY, AS_REFRESH_KEY),
          secureGet(STORAGE_USER_KEY, AS_USER_KEY),
        ]);

        if (savedUser && savedToken) {
          const parsedUser = JSON.parse(savedUser);

          // 1. Si l'access token n'a pas encore expiré (durée 24h) :
          // Restauration IMMÉDIATE (zéro flash, fonctionne hors ligne)
          if (!isJwtExpired(savedToken, 60)) {
            setUser(parsedUser);
            setToken(savedToken);
            setIsLoading(false);
            sessionRestored = true;

            // Rafraîchir le profil en tâche de fond (silencieux)
            fetchApi('/auth/me/', {
              headers: { Authorization: `Bearer ${savedToken}` },
              skipUnauthorizedEmit: true,
            })
              .then(async (freshUser) => {
                if (freshUser && freshUser.id) {
                  setUser(freshUser);
                  await secureSet(STORAGE_USER_KEY, AS_USER_KEY, JSON.stringify(freshUser));
                }
              })
              .catch(() => {});
            return;
          }

          // 2. Si l'access token a expiré mais qu'on a un refresh token
          if (savedRefreshToken) {
            const newAccessToken = await silentRefresh();
            if (newAccessToken) {
              setUser(parsedUser);
              setToken(newAccessToken);
              setIsLoading(false);
              sessionRestored = true;

              fetchApi('/auth/me/', {
                headers: { Authorization: `Bearer ${newAccessToken}` },
                skipUnauthorizedEmit: true,
              })
                .then(async (freshUser) => {
                  if (freshUser && freshUser.id) {
                    setUser(freshUser);
                    await secureSet(STORAGE_USER_KEY, AS_USER_KEY, JSON.stringify(freshUser));
                  }
                })
                .catch(() => {});
              return;
            } else {
              // Si silentRefresh a échoué en raison d'une panne réseau, on conserve la session locale
              const stillHasRefresh = await secureGet(STORAGE_REFRESH_TOKEN_KEY, AS_REFRESH_KEY);
              if (stillHasRefresh) {
                setUser(parsedUser);
                setToken(savedToken);
                setIsLoading(false);
                sessionRestored = true;
                return;
              }
            }
          }
        }
      } catch (e) {
        console.warn('[AuthContext] Erreur restoreSession:', e);
      } finally {
        sessionRestored = true;
        setIsLoading(false);
      }
    };
    restoreSession();

    return () => {
      apiEventEmitter.off('unauthorized', handleUnauthorized);
    };
  }, [logout, silentRefresh]);

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
        await secureSet(STORAGE_TOKEN_KEY, AS_TOKEN_KEY, data.access);
        if (data.refresh) {
          await secureSet(STORAGE_REFRESH_TOKEN_KEY, AS_REFRESH_KEY, data.refresh);
        }
        await secureSet(STORAGE_USER_KEY, AS_USER_KEY, JSON.stringify(data.user));
      } catch (e) {}
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
        await secureSet(STORAGE_TOKEN_KEY, AS_TOKEN_KEY, data.access);
        if (data.refresh) {
          await secureSet(STORAGE_REFRESH_TOKEN_KEY, AS_REFRESH_KEY, data.refresh);
        }
        await secureSet(STORAGE_USER_KEY, AS_USER_KEY, JSON.stringify(data.user));
      } catch (e) {}
      return data.user as User;
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
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

  const authFetch = useCallback(async (endpoint: string, options: RequestInit = {}) => {
    let currentToken = token;

    if (!currentToken) {
      currentToken = await secureGet(STORAGE_TOKEN_KEY, AS_TOKEN_KEY);
    }

    // Proactivement renouveler si l'access token est expiré avant même d'envoyer la requête
    if (currentToken && isJwtExpired(currentToken, 30)) {
      const refreshedToken = await silentRefresh();
      if (refreshedToken) {
        currentToken = refreshedToken;
      }
    }

    const headers: any = { ...(options.headers || {}) };
    if (currentToken) {
      headers['Authorization'] = `Bearer ${currentToken}`;
    }

    try {
      return await fetchApi(endpoint, { ...options, headers, skipUnauthorizedEmit: true });
    } catch (err: any) {
      // Si 401 reçu du serveur, tenter un refresh silencieux puis rejouer UNE seule fois
      if (err?.status === 401) {
        const newToken = await silentRefresh();
        if (newToken) {
          const retryHeaders = { ...headers, 'Authorization': `Bearer ${newToken}` };
          return fetchApi(endpoint, { ...options, headers: retryHeaders, skipUnauthorizedEmit: true });
        }
      }
      throw err;
    }
  }, [token, silentRefresh]);


  const updateUser = useCallback((updates: Partial<User>) => {
    setUser(prev => {
      if (!prev) return prev;
      const newUser = { ...prev, ...updates };
      if (JSON.stringify(prev) === JSON.stringify(newUser)) return prev;
      
      secureSet(STORAGE_USER_KEY, AS_USER_KEY, JSON.stringify(newUser)).catch(() => {});
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
