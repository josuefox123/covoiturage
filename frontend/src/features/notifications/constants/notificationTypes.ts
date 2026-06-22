import { NotificationType, Notification } from '../types/notification';

export const NOTIFICATION_THEMES = {
  SUCCESS: '#22C55E',
  ERROR: '#EF4444',
  WARNING: '#F59E0B',
  INFO: '#3B82F6',
  PRIMARY: '#2563EB',
  TEXT: '#1E293B',
  MUTED: '#64748B',
};

type IconName = 'car-sport' | 'card' | 'chatbubble' | 'settings' | 'gift' | 'shield-checkmark' | 'notifications';

export const getNotificationStyle = (notification: Notification): { icon: IconName; color: string } => {
  // 1. Déduction basée sur le 'type' natif
  if (notification.type) {
    switch (notification.type) {
      case 'RIDE':
      case 'BOOKING':
        return { icon: 'car-sport', color: NOTIFICATION_THEMES.PRIMARY };
      case 'PAYMENT':
        return { icon: 'card', color: NOTIFICATION_THEMES.SUCCESS };
      case 'MESSAGE':
        return { icon: 'chatbubble', color: NOTIFICATION_THEMES.INFO };
      case 'PROMOTION':
        return { icon: 'gift', color: NOTIFICATION_THEMES.WARNING };
      case 'SECURITY':
        return { icon: 'shield-checkmark', color: NOTIFICATION_THEMES.SUCCESS };
      case 'ACCOUNT':
      case 'SYSTEM':
        return { icon: 'settings', color: NOTIFICATION_THEMES.MUTED };
    }
  }

  // 2. Fallback heuristique si le backend n'envoie pas de type strict
  const text = (notification.title + ' ' + notification.message).toLowerCase();
  if (text.includes('vérifi') || text.includes('compte')) return { icon: 'shield-checkmark', color: NOTIFICATION_THEMES.SUCCESS };
  if (text.includes('rejet') || text.includes('échou')) return { icon: 'settings', color: NOTIFICATION_THEMES.ERROR };
  if (text.includes('paiement') || text.includes('payé') || text.includes('fcfa')) return { icon: 'card', color: NOTIFICATION_THEMES.SUCCESS };
  if (text.includes('promo') || text.includes('cadeau') || text.includes('réduction')) return { icon: 'gift', color: NOTIFICATION_THEMES.WARNING };
  if (text.includes('message') || text.includes('chat')) return { icon: 'chatbubble', color: NOTIFICATION_THEMES.INFO };
  
  return { icon: 'notifications', color: NOTIFICATION_THEMES.PRIMARY };
};
