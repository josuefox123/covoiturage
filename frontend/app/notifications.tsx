import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../src/styles/theme';
import { useAuth } from '../src/context/AuthContext';
import { CustomAlert } from '../src/utils/CustomAlert';

export default function NotificationsScreen() {
  const router = useRouter();
  const { authFetch, user } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const data = await authFetch('/notifications/');
      setNotifications(data.results || data || []);
      
      // Mark all as read in background
      if (data && (data.results || data).length > 0) {
         authFetch('/notifications/mark-read/', { method: 'POST' }).catch(e => console.error(e));
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
      CustomAlert.alert('Erreur', 'Impossible de charger vos notifications.');
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={[styles.notificationCard, !item.is_read && styles.unreadCard]}>
      <View style={styles.iconContainer}>
        <Ionicons name="megaphone" size={24} color={theme.colors.primary} />
      </View>
      <View style={styles.contentContainer}>
        <View style={styles.headerRow}>
          <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.date}>
            {new Date(item.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
          </Text>
        </View>
        <Text style={styles.message}>{item.message}</Text>
      </View>
      {!item.is_read && <View style={styles.unreadDot} />}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.8}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="notifications-off-outline" size={64} color={theme.colors.textMuted} />
              <Text style={styles.emptyTitle}>Aucune notification</Text>
              <Text style={styles.emptyText}>Vous êtes à jour !</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.card, borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-start' },
  headerTitle: { ...theme.typography.h2, color: theme.colors.text },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: theme.spacing.md, flexGrow: 1 },
  notificationCard: {
    flexDirection: 'row', padding: theme.spacing.md, backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg, marginBottom: theme.spacing.sm,
    borderWidth: 1, borderColor: theme.colors.border, alignItems: 'flex-start'
  },
  unreadCard: {
    backgroundColor: theme.colors.primaryLight + '20', // Light primary background
    borderColor: theme.colors.primaryLight,
  },
  iconContainer: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: theme.colors.primaryLight,
    justifyContent: 'center', alignItems: 'center', marginRight: theme.spacing.md,
  },
  contentContainer: { flex: 1 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  title: { ...theme.typography.h3, color: theme.colors.text, flex: 1, marginRight: 8 },
  date: { ...theme.typography.caption, color: theme.colors.textLight },
  message: { ...theme.typography.bodyMedium, color: theme.colors.textLight, lineHeight: 20 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.primary, marginTop: 6, marginLeft: 8 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100 },
  emptyTitle: { ...theme.typography.h2, color: theme.colors.text, marginTop: theme.spacing.lg, marginBottom: theme.spacing.xs },
  emptyText: { ...theme.typography.bodyMedium, color: theme.colors.textLight },
});
