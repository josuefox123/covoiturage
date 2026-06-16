import { Platform } from 'react-native';

// ⚠️  Mettez ici l'IP de votre PC sur le réseau local (visible dans "npx expo start")
// Exemple : si Expo affiche exp://192.168.100.22:8081, l'IP est 192.168.100.22
const LOCAL_IP = '192.168.100.4';

const getBaseUrl = () => {
  // En dev sur Android physique/émulateur via Expo Go
  if (Platform.OS === 'android') {
    return `http://${LOCAL_IP}:8000/api`;
  }
  // Sur iOS physique via Expo Go
  if (Platform.OS === 'ios') {
    return `http://${LOCAL_IP}:8000/api`;
  }
  // Sur web (localhost)
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

  // Check if it's JSON
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
