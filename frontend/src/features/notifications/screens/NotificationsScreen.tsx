import React, { useState, useMemo, useCallback } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Text, TextInput, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../../styles/theme';

import { useNotificationQueries } from '../hooks/useNotificationQueries';
import { NotificationFilterType, Notification } from '../types/notification';
import { filterNotifications, formatTimeGroup } from '../utils/notificationHelpers';

import { NotificationCard } from '../components/NotificationCard';
import { NotificationFilters } from '../components/NotificationFilters';
import { NotificationModal } from '../components/NotificationModal';
import { NotificationSkeleton } from '../components/NotificationSkeleton';
import { EmptyState } from '../components/EmptyState';

const FILTERS: NotificationFilterType[] = ['Toutes', 'Non lues', 'Trajets', 'Paiements', 'Messages', 'Promotions'];

export default function NotificationsScreen() {
  const router = useRouter();
  const {
    notifications,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
    isRefetching,
    markAsRead,
    markAllAsRead,
    deleteNotification
  } = useNotificationQueries();

  const [selectedFilter, setSelectedFilter] = useState<NotificationFilterType>('Toutes');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNotif, setSelectedNotif] = useState<Notification | null>(null);

  const handleNotificationPress = useCallback((notification: Notification) => {
    // Helper pour valider la présence d'un ID valide (exclut null, undefined, "null", "undefined", etc.)
    const isValidId = (id: any) => {
      if (id === undefined || id === null) return false;
      const s = String(id).trim().toLowerCase();
      return s !== '' && s !== 'null' && s !== 'undefined' && s !== '0';
    };

    // 1. Parser le payload de données du backend
    let extraData: any = {};
    if (notification.data) {
      try {
        extraData = typeof notification.data === 'string'
          ? JSON.parse(notification.data)
          : notification.data;
      } catch (e) {
        extraData = {};
      }
    }

    const rideId = [notification.ride_id, extraData.ride_id, extraData.rideId, notification.rideId].find(isValidId);
    const bookingId = [notification.booking_id, extraData.booking_id, extraData.bookingId, notification.bookingId].find(isValidId);
    const conversationId = [notification.conversation_id, extraData.conversation_id, extraData.conversationId, notification.conversationId].find(isValidId);

    try {
      // 2. Redirection instantanée si chat ou trajet disponible
      if (conversationId) {
        router.push(`/chat/${conversationId}`);
        return;
      }

      if (rideId) {
        const titleLower = (notification.title || '').toLowerCase();
        const msgLower = (notification.message || '').toLowerCase();
        const isDriverAction =
          titleLower.includes('demande') ||
          titleLower.includes('réservation') ||
          titleLower.includes('réserve') ||
          msgLower.includes('a réservé') ||
          msgLower.includes('veut réserver');

        if (isDriverAction) {
          router.push(`/ride-management/${rideId}`);
        } else {
          router.push(`/ride/${rideId}`);
        }
        return;
      }

      // 3. Redirections fallback de type d'onglet
      if (notification.type === 'MESSAGE') {
        router.push('/(tabs)/messages');
      } else if (notification.type === 'PAYMENT') {
        router.push('/(tabs)/earnings');
      } else if (notification.type === 'BOOKING' || notification.type === 'RIDE') {
        router.push('/(tabs)/trips');
      } else {
        // Pour les notifications système ou info pure sans ID de redirection, on affiche la bottom sheet
        setSelectedNotif(notification);
      }
    } catch (err) {
      console.warn("Navigation failed, falling back to modal:", err);
      setSelectedNotif(notification);
    }
  }, [router]);

  // Optimisation via useMemo pour le filtrage et la recherche
  const filteredData = useMemo(() => {
    return filterNotifications(notifications, selectedFilter, searchQuery);
  }, [notifications, selectedFilter, searchQuery]);

  const unreadCount = useMemo(() => {
    return notifications.filter(n => !n.is_read).length;
  }, [notifications]);

  const handleEndReached = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerTop}>
        <View style={styles.titleRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <View>
            <Text style={styles.title}>Notifications</Text>
            {unreadCount > 0 && (
              <Text style={styles.subtitle}>{unreadCount} nouvelle{unreadCount > 1 ? 's' : ''}</Text>
            )}
          </View>
        </View>
        <TouchableOpacity style={styles.readAllBtn} onPress={markAllAsRead}>
          <Ionicons name="checkmark-done" size={20} color={theme.colors.primary} />
          <Text style={styles.readAllText}>Tout lire</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={theme.colors.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher une notification..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor={theme.colors.textMuted}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color={theme.colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      <NotificationFilters
        filters={FILTERS}
        selectedFilter={selectedFilter}
        onSelect={setSelectedFilter}
      />
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {renderHeader()}

      {isLoading ? (
        <NotificationSkeleton />
      ) : isError ? (
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>Erreur de chargement. Veuillez réessayer.</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()}>
            <Text style={styles.retryText}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredData}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <NotificationCard
              notification={item}
              onRead={markAsRead}
              onDelete={deleteNotification}
              onPress={handleNotificationPress}
            />
          )}
          ListEmptyComponent={<EmptyState filter={selectedFilter} />}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              colors={[theme.colors.primary]}
              tintColor={theme.colors.primary}
            />
          }
          ListFooterComponent={
            isFetchingNextPage ? <NotificationSkeleton /> : null
          }
        />
      )}

      <NotificationModal
        notification={selectedNotif}
        onClose={() => setSelectedNotif(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingTop: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    marginRight: 12,
  },
  title: {
    fontSize: 28,
    fontFamily: 'Inter-Bold',
    color: theme.colors.text,
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.primary,
    fontFamily: 'Inter-Medium',
    marginTop: 2,
  },
  readAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary + '15',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  readAllText: {
    color: theme.colors.primary,
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    marginLeft: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    marginHorizontal: theme.spacing.lg,
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 8,
    marginBottom: theme.spacing.md,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Inter-Regular',
    fontSize: 15,
    color: theme.colors.text,
  },
  listContent: {
    padding: theme.spacing.md,
    paddingBottom: 100,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontFamily: 'Inter-Medium',
    color: theme.colors.error,
    marginBottom: theme.spacing.md,
  },
  retryBtn: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: {
    color: '#FFFFFF',
    fontFamily: 'Inter-Bold',
  },
});
