import { Platform } from 'react-native';

// Use the computer's local IP on the network so physical devices via Expo Go can connect.
const getBaseUrl = () => {
  return 'http://192.168.100.4:8000/api';
};

export const API_URL = getBaseUrl();

// A simple fetch wrapper to handle token injection
export const fetchApi = async (endpoint: string, options: RequestInit = {}) => {
  const token = undefined; // We will handle this in AuthContext or AsyncStorage later. But for simplicity, we pass token from context.
  
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  
  if (options.headers && (options.headers as any).Authorization) {
    // Token is already set in options
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
      throw new Error(data.error || 'Une erreur est survenue');
    }
    return data;
  }
  
  if (!response.ok) {
    throw new Error('Une erreur réseau est survenue');
  }
  return response.text();
};
