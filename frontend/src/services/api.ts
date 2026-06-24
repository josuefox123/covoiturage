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

const LOCAL_IP = '192.168.100.4';
const getBaseUrl = () => {
  if (Platform.OS === 'android') return `http://${LOCAL_IP}:8000/api`;
  if (Platform.OS === 'ios') return `http://${LOCAL_IP}:8000/api`;
  return 'http://localhost:8000/api';
};

export const API_URL = getBaseUrl();

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
      throw new Error(data.error || data.detail || (typeof data === 'object' ? JSON.stringify(data) : 'Une erreur est survenue'));
    }
    return data;
  }
  
  if (!response.ok) {
    throw new Error('Une erreur réseau est survenue');
  }
  return response.text();
};
