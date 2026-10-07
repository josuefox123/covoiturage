/**
 * ==============================================================
 * Fichier :
 * authNavigation.ts
 *
 * Description :
 * Détermine la route de redirection après authentification
 * (connexion ou inscription).
 * La vérification d'identité est gérée via la VerificationModal
 * dans home.tsx — pas de redirect forcé vers /verify-identity.
 *
 * Projet :
 * Zemy
 * ==============================================================
 */
import { User } from '../context/AuthContext';

/**
 * Retourne la route vers laquelle rediriger l'utilisateur
 * après une connexion ou inscription réussie.
 * Toujours /(tabs)/home — la VerificationModal s'y affiche
 * automatiquement si l'utilisateur n'est pas encore vérifié.
 *
 * @param user - L'objet utilisateur retourné par le backend
 * @returns Le chemin de navigation Expo Router
 */
export function getPostAuthRoute(user: User | null): string {
  if (!user) return '/';
  return '/(tabs)/home';
}

/**
 * Vérifie si l'utilisateur doit voir la VerificationModal.
 * Utilisé dans home.tsx et le layout des tabs.
 */
export function needsVerification(user: User | null): boolean {
  if (!user) return false;
  const status = user.verification_status;
  return status === 'not_verified' || status === 'rejected' || !status;
}
