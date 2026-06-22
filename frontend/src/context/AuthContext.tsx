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
  verification_status?: 'not_verified' | 'pending' | 'verified';
}

interface AuthContextData {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  loginWithPassword: (identifier: string, password: string) => Promise<void>;
  registerWithPassword: (data: any) => Promise<void>;
  logout: () => void;
  authFetch: (endpoint: string, options?: RequestInit) => Promise<any>;
  updateUser: (updates: Partial<User>) => void;
  refreshUser: () => Promise<void>;
}

const defaultContext: AuthContextData = {
  user: null,
  token: null,
  isLoading: true,
  loginWithPassword: async () => {},
  registerWithPassword: async () => {},
  logout: () => {},
  authFetch: async () => ({}),
  updateUser: () => {},
  refreshUser: async () => {},
};

const AuthContext = createContext<AuthContextData>(defaultContext);

const STORAGE_TOKEN_KEY = 'zemy_access_token';
const STORAGE_USER_KEY = '@zemy_user';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true); // true = checking saved session

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
          setUser(JSON.parse(savedUser));
          
          // Fetch fresh user data in background
          try {
            const parsedUser = JSON.parse(savedUser);
            if (parsedUser && parsedUser.id) {
              const freshUser = await fetchApi(`/users/${parsedUser.id}/`, {
                headers: { 'Authorization': `Bearer ${savedToken}` }
              });
              if (freshUser) {
                setUser(freshUser);
                await AsyncStorage.setItem(STORAGE_USER_KEY, JSON.stringify(freshUser));
              }
            }
          } catch (e) {
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
    try {
      await SecureStore.deleteItemAsync(STORAGE_TOKEN_KEY);
      await AsyncStorage.removeItem(STORAGE_USER_KEY);
    } catch (e) {
    }
  }, []);

  const authFetch = useCallback(async (endpoint: string, options: RequestInit = {}) => {
    const headers: any = { ...(options.headers || {}) };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
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
    loginWithPassword,
    registerWithPassword,
    logout,
    authFetch,
    updateUser,
    refreshUser
  }), [user, token, isLoading, loginWithPassword, registerWithPassword, logout, authFetch, updateUser, refreshUser]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
