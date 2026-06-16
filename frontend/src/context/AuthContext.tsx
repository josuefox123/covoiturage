import React, { createContext, useState, useContext, useEffect, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchApi } from '../services/api';

export interface User {
  id: string;
  phone: string;
  full_name: string;
  email?: string | null;
  avatar: string | null;
  rating?: number;
  is_verified?: boolean;
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

const STORAGE_TOKEN_KEY = '@zemy_access_token';
const STORAGE_USER_KEY = '@zemy_user';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true); // true = checking saved session

  // On mount: restore saved session
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const savedToken = await AsyncStorage.getItem(STORAGE_TOKEN_KEY);
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
            console.log('Failed to fetch fresh user data:', e);
          }
        }
      } catch (e) {
        console.log('Failed to restore session:', e);
      } finally {
        setIsLoading(false);
      }
    };
    restoreSession();
  }, []);

  const loginWithPassword = async (identifier: string, password: string) => {
    setIsLoading(true);
    try {
      const data = await fetchApi('/auth/login/', {
        method: 'POST',
        body: JSON.stringify({ identifier, password }),
      });
      setToken(data.access);
      setUser(data.user);
      try {
        await AsyncStorage.setItem(STORAGE_TOKEN_KEY, data.access);
        await AsyncStorage.setItem(STORAGE_USER_KEY, JSON.stringify(data.user));
      } catch (e) {}
    } catch (error) {
      throw error; // Propage l'erreur vers l'appelant (LoginScreen)
    } finally {
      setIsLoading(false);
    }
  };

  const registerWithPassword = async (userData: any) => {
    setIsLoading(true);
    try {
      const data = await fetchApi('/auth/register/', {
        method: 'POST',
        body: JSON.stringify(userData),
      });
      setToken(data.access);
      setUser(data.user);
      try {
        await AsyncStorage.setItem(STORAGE_TOKEN_KEY, data.access);
        await AsyncStorage.setItem(STORAGE_USER_KEY, JSON.stringify(data.user));
      } catch (e) {}
    } catch (error) {
      throw error; // Propage l'erreur vers l'appelant (RegisterScreen)
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setToken(null);
    setUser(null);
    try {
      await AsyncStorage.removeItem(STORAGE_TOKEN_KEY);
      await AsyncStorage.removeItem(STORAGE_USER_KEY);
    } catch (e) {
      console.log('Failed to remove session:', e);
    }
  };

  const authFetch = async (endpoint: string, options: RequestInit = {}) => {
    const headers: any = { ...(options.headers || {}) };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return fetchApi(endpoint, { ...options, headers });
  };

  const updateUser = (updates: Partial<User>) => {
    setUser(prev => {
      if (!prev) return prev;
      const newUser = { ...prev, ...updates };
      // Éviter de re-rendre toute l'application si aucune donnée n'a changé
      if (JSON.stringify(prev) === JSON.stringify(newUser)) return prev;
      
      AsyncStorage.setItem(STORAGE_USER_KEY, JSON.stringify(newUser)).catch(e => 
        console.log('Failed to save updated user:', e)
      );
      return newUser;
    });
  };

  const refreshUser = async () => {
    if (!user || !user.id || !token) return;
    try {
      const data = await authFetch(`/users/${user.id}/`);
      updateUser(data);
    } catch (e) {
      console.log('Failed to refresh user:', e);
    }
  };

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
  }), [user, token, isLoading]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
