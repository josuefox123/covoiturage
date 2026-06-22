import { Notification } from '../types/notification';

export interface PaginatedNotifications {
  count: number;
  next: string | null;
  previous: string | null;
  results: Notification[];
}

export const notificationService = {
  fetchNotifications: async (authFetch: any, pageParam: number): Promise<PaginatedNotifications> => {
    const data = await authFetch(`/notifications/?page=${pageParam}`);
    
    // Si l'API retourne directement un tableau (sans pagination DRF standard)
    if (Array.isArray(data)) {
      return {
        count: data.length,
        next: null,
        previous: null,
        results: data,
      };
    }
    
    // Format classique paginé
    return {
      count: data.count || 0,
      next: data.next ? String(pageParam + 1) : null,
      previous: data.previous,
      results: data.results || data || [],
    };
  },

  markAsRead: async (authFetch: any, id: number): Promise<void> => {
    await authFetch(`/notifications/${id}/read/`, { method: 'POST' });
  },

  markAllAsRead: async (authFetch: any): Promise<void> => {
    // Si l'endpoint existe sur le backend, sinon on pourrait mapper
    await authFetch('/notifications/read-all/', { method: 'POST' });
  },

  deleteNotification: async (authFetch: any, id: number): Promise<void> => {
    await authFetch(`/notifications/${id}/`, { method: 'DELETE' });
  }
};
