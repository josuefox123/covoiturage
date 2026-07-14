/**
 * ==============================================================
 * Fichier :
 * api.ts
 *
 * Description :
 * Composant ou logique de l'application Zemy.
 *
 * Projet :
 * Zemy
 * ==============================================================
 */
import { Platform } from 'react-native';

// Simple event emitter to handle global events like 401 Unauthorized
export const apiEventEmitter = {
  events: {} as Record<string, Function[]>,
  on(event: string, callback: Function) {
    if (!this.events[event]) this.events[event] = [];
    this.events[event].push(callback);
  },
  emit(event: string, data?: any) {
    if (this.events[event]) {
      this.events[event].forEach(cb => cb(data));
    }
  },
  off(event: string, callback: Function) {
    if (this.events[event]) {
      this.events[event] = this.events[event].filter(cb => cb !== callback);
    }
  }
};

const getBaseUrl = () => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  
  // Fallback to production by default if no env var is found
  return 'https://zemy.erika-app.com/api';
};

export const API_URL = getBaseUrl();

export class ApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export const fetchApi = async (endpoint: string, options: RequestInit = {}) => {
  const isFormData = options.body && (options.body instanceof FormData || (options.body as any).append !== undefined);
  
  const headers: any = { ...options.headers };
  
  if (!headers['Content-Type'] && !headers['content-type'] && !isFormData) {
    headers['Content-Type'] = 'application/json';
  }
  
  if (isFormData) {
    delete headers['Content-Type'];
    delete headers['content-type'];
  }

  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      // Émettre un événement pour déconnecter l'utilisateur via le contexte Auth
      apiEventEmitter.emit('unauthorized');
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.indexOf('application/json') !== -1) {
      const data = await response.json();
      if (!response.ok) {
        throw new ApiError(
          data.error || data.detail || (typeof data === 'object' ? JSON.stringify(data) : 'Une erreur est survenue'),
          response.status
        );
      }
      return data;
    }
    
    if (!response.ok) {
      if (response.status >= 500) {
        throw new ApiError(
          `Le serveur rencontre des difficultés (Erreur ${response.status}). Veuillez réessayer plus tard.`,
          response.status
        );
      }
      if (response.status === 404) {
        throw new ApiError(
          `La ressource demandée est introuvable (Erreur 404).`,
          response.status
        );
      }
      if (response.status === 403) {
        throw new ApiError(
          `Accès refusé (Erreur 403). Vous n'avez pas l'autorisation d'accéder à ce service.`,
          response.status
        );
      }
      throw new ApiError(
        `La requête a échoué (Erreur ${response.status}).`,
        response.status
      );
    }
    return response.text();
  } catch (error: any) {
    if (error instanceof ApiError) {
      throw error;
    }
    
    // Si c'est une erreur de connexion réseau (ex: pas d'internet ou DNS invalide)
    if (error.message && error.message.toLowerCase().includes('network request failed')) {
      throw new Error("Connexion impossible. Veuillez vérifier votre connexion Internet et réessayer.");
    }
    
    throw new Error(error.message || "Une erreur inattendue est survenue. Veuillez réessayer.");
  }
};
