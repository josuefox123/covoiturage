import { Platform } from 'react-native';
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

/**
 * Helper to robustly append local file/image URIs to FormData across React Native (Android/iOS) and Web.
 * Fixes "unsupported formDataPart implementation" by using standard Blob/File on Web
 * and properly formatted { uri, name, type } on Mobile (Android/iOS).
 */
export const appendFileToFormData = async (
  formData: FormData,
  fieldName: string,
  uri: string,
  defaultName = 'image.jpg'
): Promise<void> => {
  if (!uri) return;

  // Clean filename and strip query parameters
  let rawFilename = uri.split('/').pop()?.split('?')[0] || defaultName;
  if (!rawFilename.includes('.')) {
    rawFilename = `${rawFilename}.jpg`;
  }

  // Determine correct standard MIME type (avoid 'image/jpg')
  const ext = rawFilename.split('.').pop()?.toLowerCase() || 'jpg';
  let mimeType = 'image/jpeg';
  if (ext === 'png') {
    mimeType = 'image/png';
  } else if (ext === 'gif') {
    mimeType = 'image/gif';
  } else if (ext === 'webp') {
    mimeType = 'image/webp';
  } else if (ext === 'pdf') {
    mimeType = 'application/pdf';
  } else {
    mimeType = 'image/jpeg';
  }

  const filename = rawFilename;

  // WEB PLATFORM: Requires Blob or File object
  if (Platform.OS === 'web') {
    try {
      const res = await fetch(uri);
      const blob = await res.blob();
      if (typeof File !== 'undefined') {
        const file = new File([blob], filename, { type: mimeType });
        formData.append(fieldName, file);
      } else {
        formData.append(fieldName, blob, filename);
      }
      return;
    } catch (err) {
      console.warn('[FormData Web] Failed to create blob:', err);
      return;
    }
  }

  // MOBILE PLATFORM (Android / iOS):
  // React Native native networking stack REQUIRES an object with { uri, name, type }
  let cleanUri = typeof uri === 'string' ? uri : (uri as any)?.uri || '';
  if (!cleanUri) return;

  // Décoder les caractères encodés (ex: %2540 -> @ dans Expo Go sur Android)
  try {
    cleanUri = decodeURIComponent(cleanUri);
  } catch (_) {}

  if (cleanUri.startsWith('file:')) {
    // Normaliser pour toujours avoir 3 slashes: file:///path/to/file
    cleanUri = 'file:///' + cleanUri.replace(/^file:\/*/, '');
  } else if (cleanUri.startsWith('/')) {
    cleanUri = `file://${cleanUri}`;
  }

  formData.append(fieldName, {
    uri: cleanUri,
    name: filename,
    type: mimeType,
  } as any);
};

