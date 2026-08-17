import { API_URL } from '../services/api';

const BASE_URL = API_URL.replace(/\/api$/, '');

export const getMediaUrl = (url: string | null | undefined): string | undefined => {
  if (!url) return undefined;
  
  // Normaliser les chemins locaux file: pour toujours avoir 3 slashes
  if (url.startsWith('file:')) {
    const cleanedPath = url.replace(/^file:\/+/g, '');
    return `file:///${cleanedPath}`;
  }

  // If it's already an absolute URL or local file path
  if (
    url.startsWith('http://') || 
    url.startsWith('https://') || 
    url.startsWith('ph://') ||
    url.startsWith('assets-library://') ||
    url.startsWith('data:')
  ) {
    return url;
  }

  // If it's a local filesystem path under Android or iOS
  if (
    url.startsWith('/data/') || 
    url.startsWith('/storage/') || 
    url.startsWith('/var/')
  ) {
    return `file://${url}`;
  }
  
  // Otherwise, prepend the BASE_URL
  const path = url.startsWith('/') ? url : `/${url}`;
  return `${BASE_URL}${path}`;
};
