/**
 * ==============================================================
 * Fichier :
 * AuthContext.tsx
 *
 * Description :
 * Composant ou logique de l'application Zemy.
 *
 * Projet :
 * Zemy
 * ==============================================================
 */
import React, { createContext, useState, useContext, useEffect, useMemo, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { fetchApi, apiEventEmitter } from '../services/api';

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
  loginWithPassword: (identifier: string, password: string) => Promise<void>;
  registerWithPassword: (data: any) => Promise<void>;
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
  loginWithPassword: async () => {},
  registerWithPassword: async () => {},
  logout: () => {},
  authFetch: async () => ({}),
  updateUser: () => {},
  refreshUser: async () => {},
  setHasStartedVerification: () => {},
};

const AuthContext = createContext<AuthContextData>(defaultContext);

const STORAGE_TOKEN_KEY = 'zemy_access_token';
const STORAGE_USER_KEY = '@zemy_user';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true); // true = checking saved session
  const [hasStartedVerification, setHasStartedVerificationState] = useState<boolean>(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);

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
            console.log('[Location] Position utilisateur récupérée :', coords);
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
    // Écouter les erreurs 401 globales pour déconnecter l'utilisateur
    const handleUnauthorized = () => {
      logout();
    };
    apiEventEmitter.on('unauthorized', handleUnauthorized);

    const restoreSession = async () => {
      try {
        const savedToken = await SecureStore.getItemAsync(STORAGE_TOKEN_KEY);
        const savedUser = await AsyncStorage.getItem(STORAGE_USER_KEY);
        if (savedToken && savedUser) {
          setToken(savedToken);
          const parsedUser = JSON.parse(savedUser);
          setUser(parsedUser);
          
          // Fetch fresh user data in background without blocking startup
          if (parsedUser && parsedUser.id) {
            fetchApi(`/users/${parsedUser.id}/`, {
              headers: { 'Authorization': `Bearer ${savedToken}` }
            })
              .then(async (freshUser) => {
                if (freshUser) {
                  setUser(freshUser);
                  await AsyncStorage.setItem(STORAGE_USER_KEY, JSON.stringify(freshUser));
                }
              })
              .catch(() => {});
          }
        }
      } catch (e) {
      } finally {
        setIsLoading(false);
      }
    };
    restoreSession();

    return () => {
      apiEventEmitter.off('unauthorized', handleUnauthorized);
    };
  }, []);

  const loginWithPassword = useCallback(async (identifier: string, password: string) => {
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
        await AsyncStorage.setItem(STORAGE_USER_KEY, JSON.stringify(data.user));
      } catch (e) {}
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const registerWithPassword = useCallback(async (userData: any) => {
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
        await AsyncStorage.setItem(STORAGE_USER_KEY, JSON.stringify(data.user));
      } catch (e) {}
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
      await AsyncStorage.removeItem(STORAGE_USER_KEY);
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
    return fetchApi(endpoint, { ...options, headers });
  }, [token]);

  const updateUser = useCallback((updates: Partial<User>) => {
    setUser(prev => {
      if (!prev) return prev;
      const newUser = { ...prev, ...updates };
      if (JSON.stringify(prev) === JSON.stringify(newUser)) return prev;
      
      AsyncStorage.setItem(STORAGE_USER_KEY, JSON.stringify(newUser)).catch(() => {});
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
