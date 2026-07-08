import { API_URL } from '../services/api';

const BASE_URL = API_URL.replace(/\/api$/, '');

export const getMediaUrl = (url: string | null | undefined): string | undefined => {
  if (!url) return undefined;
  
  // If it's already an absolute URL or local file path
  if (
    url.startsWith('http://') || 
    url.startsWith('https://') || 
    url.startsWith('file://') || 
    url.startsWith('data:')
  ) {
    return url;
  }
  
  // Otherwise, prepend the BASE_URL
  const path = url.startsWith('/') ? url : `/${url}`;
  return `${BASE_URL}${path}`;
};
