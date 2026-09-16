import React, { useMemo } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DeviceEventEmitter } from 'react-native';
import { useAuth } from '../../../context/AuthContext';
import { notificationService } from '../services/notification.service';
import { Notification } from '../types/notification';

export const NOTIFICATIONS_QUERY_KEY = ['notifications'];

export function useNotificationQueries() {
  const { authFetch, user } = useAuth();
  const queryClient = useQueryClient();

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    refetch,
    isRefetching
  } = useInfiniteQuery({
    queryKey: NOTIFICATIONS_QUERY_KEY,
    queryFn: ({ pageParam = 1 }) => notificationService.fetchNotifications(authFetch, pageParam),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      if (lastPage.next) {
        return parseInt(lastPage.next, 10);
      }
      return undefined;
    },
    enabled: !!user, // Ne pas fetch si non connecté
  });

  const markAsReadMutation = useMutation({
    mutationFn: (id: number) => notificationService.markAsRead(authFetch, id),
    onMutate: async (id) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
      const previousData = queryClient.getQueryData(NOTIFICATIONS_QUERY_KEY);

      queryClient.setQueryData(NOTIFICATIONS_QUERY_KEY, (old: any) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            results: page.results.map((n: Notification) => 
              n.id === id ? { ...n, is_read: true } : n
            )
          }))
        };
      });

      return { previousData };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
      DeviceEventEmitter.emit('refreshBadges');
    },
    onError: (err, id, context) => {
      // Revert in case of error
      if (context?.previousData) {
        queryClient.setQueryData(NOTIFICATIONS_QUERY_KEY, context.previousData);
      }
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: () => notificationService.markAllAsRead(authFetch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
      DeviceEventEmitter.emit('refreshBadges');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => notificationService.deleteNotification(authFetch, id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
      const previousData = queryClient.getQueryData(NOTIFICATIONS_QUERY_KEY);

      queryClient.setQueryData(NOTIFICATIONS_QUERY_KEY, (old: any) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            results: page.results.filter((n: Notification) => n.id !== id)
          }))
        };
      });

      return { previousData };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
      DeviceEventEmitter.emit('refreshBadges');
    },
    onError: (err, id, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(NOTIFICATIONS_QUERY_KEY, context.previousData);
      }
    },
  });

  // Aplatir les pages, dédupliquer par ID unique et trier du plus récent au plus ancien
  const notifications: Notification[] = useMemo(() => {
    const raw: Notification[] = data?.pages.flatMap((page) => page.results) || [];
    const seen = new Set<number | string>();
    const deduplicated: Notification[] = [];

    for (const item of raw) {
      if (!item || item.id === undefined || item.id === null) continue;
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      deduplicated.push(item);
    }

    return deduplicated.sort((a, b) => {
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return dateB - dateA;
    });
  }, [data]);

  return {
    notifications,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
    isRefetching,
    markAsRead: (id: number) => markAsReadMutation.mutate(id),
    markAllAsRead: () => markAllAsReadMutation.mutate(),
    deleteNotification: (id: number) => deleteMutation.mutate(id),
  };
}
