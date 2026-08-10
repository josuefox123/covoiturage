/**
 * Couleurs et ombres partagées pour l'écran Détail Trajet Passager.
 * Importez ces constantes dans chaque composant de cette feature.
 */
export const C = {
  primary: '#2F80ED', primaryDark: '#1A65C8', primaryLight: '#EBF4FF',
  success: '#22C55E', successLight: '#F0FDF4',
  error: '#EF4444',
  warning: '#F59E0B', warningLight: '#FFFBEB',
  white: '#FFFFFF', bg: '#F8FAFC', card: '#FFFFFF',
  text: '#0F172A', textSec: '#64748B', textLight: '#94A3B8',
  border: '#F1F5F9', borderMid: '#E2E8F0', shadow: '#0F172A',
};

export const SHsm = {
  shadowColor: C.shadow, shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.06, shadowRadius: 8, elevation: 3
};
export const SHmd = {
  shadowColor: C.shadow, shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.1, shadowRadius: 16, elevation: 6
};
export const SHlg = {
  shadowColor: C.primary, shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.3, shadowRadius: 24, elevation: 12
};
