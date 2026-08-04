import { SessionErrorCode } from '../types/rideSession.types';

export class ErrorManager {
  public static parseError(error: any): { code: SessionErrorCode; message: string } {
    if (!error) {
      return { code: 'UNKNOWN_ERROR', message: 'Une erreur inconnue est survenue.' };
    }

    const msg = typeof error === 'string' ? error : error.message || String(error);
    const lower = msg.toLowerCase();

    if (lower.includes('network') || lower.includes('failed to fetch') || lower.includes('connexion')) {
      return {
        code: 'NETWORK_ERROR',
        message: 'Connexion réseau interrompue. Veuillez vérifier votre connexion internet.'
      };
    }

    if (lower.includes('outdated') || lower.includes('obsolète')) {
      return {
        code: 'SESSION_OUTDATED',
        message: 'Les données du trajet ont évolué. Session mise à jour.'
      };
    }

    if (lower.includes('payment') || lower.includes('paiement')) {
      return {
        code: 'PAYMENT_FAILED',
        message: 'Échec de la transaction de paiement. Veuillez réessayer.'
      };
    }

    if (lower.includes('booking') && (lower.includes('not found') || lower.includes('introuvable'))) {
      return {
        code: 'BOOKING_NOT_FOUND',
        message: 'Réservation introuvable.'
      };
    }

    if (lower.includes('cancelled') || lower.includes('annulé')) {
      return {
        code: 'RIDE_CANCELLED',
        message: 'Ce trajet a été annulé par le conducteur.'
      };
    }

    if (lower.includes('completed') || lower.includes('terminé')) {
      return {
        code: 'RIDE_COMPLETED',
        message: 'Ce trajet est déjà terminé.'
      };
    }

    if (lower.includes('blocked') || lower.includes('bloqué')) {
      return {
        code: 'USER_BLOCKED',
        message: 'Compte restreint. Action impossible.'
      };
    }

    return {
      code: 'UNKNOWN_ERROR',
      message: msg || 'Une erreur est survenue lors de l\'opération.'
    };
  }
}
