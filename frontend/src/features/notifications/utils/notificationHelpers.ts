import { Notification } from '../types/notification';

export const formatTimeGroup = (dateStr: string): string => {
  if (!dateStr) return 'Inconnu';
  
  const date = new Date(dateStr);
  const now = new Date();
  
  // Raccourcis pour comparaison
  const isSameDay = date.getDate() === now.getDate() && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.getDate() === yesterday.getDate() && date.getMonth() === yesterday.getMonth() && date.getFullYear() === yesterday.getFullYear();

  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (isSameDay) return "Aujourd'hui";
  if (isYesterday) return "Hier";
  if (diffDays < 7) return "Cette semaine";
  if (diffDays < 30) return "Ce mois-ci";
  return "Plus ancien";
};

export const formatTimeAgo = (dateStr: string): string => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return "À l'instant";
  if (diffMins < 60) return `Il y a ${diffMins} min`;
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `Il y a ${diffHours} h`;
  
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Hier";
  
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
};

export const filterNotifications = (notifications: Notification[], filter: string, searchQuery: string): Notification[] => {
  let filtered = notifications;

  // 1. Recherche par texte
  if (searchQuery.trim() !== '') {
    const lowerQuery = searchQuery.toLowerCase();
    filtered = filtered.filter(n => 
      n.title.toLowerCase().includes(lowerQuery) || 
      n.message.toLowerCase().includes(lowerQuery)
    );
  }

  // 2. Filtres par Pill chips
  if (filter !== 'Toutes') {
    filtered = filtered.filter(n => {
      const text = (n.title + ' ' + n.message).toLowerCase();
      if (filter === 'Non lues') return !n.is_read;
      if (filter === 'Trajets') return text.includes('trajet') || text.includes('réservation') || n.type === 'RIDE' || n.type === 'BOOKING';
      if (filter === 'Paiements') return text.includes('paiement') || text.includes('fcfa') || n.type === 'PAYMENT';
      if (filter === 'Messages') return text.includes('message') || text.includes('chat') || n.type === 'MESSAGE';
      if (filter === 'Promotions') return text.includes('promo') || text.includes('cadeau') || n.type === 'PROMOTION';
      return true;
    });
  }

  return filtered;
};
