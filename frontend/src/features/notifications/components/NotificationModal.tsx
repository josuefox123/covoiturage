import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { AppBottomSheet } from '../../../components/AppBottomSheet';
import { Notification } from '../types/notification';
import { theme } from '../../../styles/theme';
import { getNotificationStyle } from '../constants/notificationTypes';
import { formatTimeAgo } from '../utils/notificationHelpers';

interface Props {
  notification: Notification | null;
  onClose: () => void;
}

export const NotificationModal = ({ notification, onClose }: Props) => {
  const router = useRouter();

  if (!notification) return null;

  const { icon, color } = getNotificationStyle(notification);

  // Helper pour valider la présence d'un ID valide (exclut null, undefined, "null", "undefined", etc.)
  const isValidId = (id: any) => {
    if (id === undefined || id === null) return false;
    const s = String(id).trim().toLowerCase();
    return s !== '' && s !== 'null' && s !== 'undefined' && s !== '0';
  };

  // Parser les données supplémentaires du backend
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
  const amount = notification.amount || extraData.amount || extraData.price;

  const handleAction = () => {
    onClose();

    try {
      // 1. Si discussion/chat direct
      if (conversationId) {
        router.push(`/chat/${conversationId}`);
        return;
      }

      // 2. Si trajet direct
      if (rideId) {
        // Déterminer s'il s'agit d'une notification destinée au conducteur
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

      // 3. Fallbacks selon type
      if (notification.type === 'MESSAGE') {
        router.push('/(tabs)/messages');
      } else if (notification.type === 'BOOKING' || notification.type === 'RIDE') {
        router.push('/(tabs)/trips');
      } else if (notification.type === 'PAYMENT') {
        router.push('/(tabs)/earnings');
      }
    } catch (err) {
      console.warn("Navigation inside modal failed:", err);
    }
  };

  const getButtonText = () => {
    if (conversationId) return 'Ouvrir la discussion';
    if (rideId) return 'Consulter le trajet';
    if (notification.type === 'MESSAGE') return 'Aller aux messages';
    if (notification.type === 'PAYMENT') return 'Voir mes gains';
    return 'Consulter les détails';
  };

  return (
    <AppBottomSheet
      visible={!!notification}
      onClose={onClose}
      snapPoints={['75%', '90%']}
      initialIndex={0}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={[styles.iconContainer, { backgroundColor: color + '15' }]}>
            <Ionicons name={icon} size={32} color={color} />
          </View>
          <Text style={styles.date}>{formatTimeAgo(notification.created_at)}</Text>
        </View>

        <Text style={styles.title}>{notification.title}</Text>

        <View style={styles.divider} />

        <View style={styles.detailsContainer}>
          <Text style={styles.sectionTitle}>Détails</Text>
          <Text style={styles.message}>{notification.message}</Text>

          {rideId ? (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Réf. Trajet</Text>
              <Text style={styles.detailValue}>#{rideId}</Text>
            </View>
          ) : null}
          {amount ? (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Montant</Text>
              <Text style={[styles.detailValue, { color: theme.colors.success }]}>
                {amount} FCFA
              </Text>
            </View>
          ) : null}
        </View>

        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: theme.colors.primary }]}
          onPress={handleAction}
          activeOpacity={0.9}
        >
          <Text style={styles.actionBtnText}>{getButtonText()}</Text>
          <Ionicons name="arrow-forward" size={16} color="#FFFFFF" style={{ marginLeft: 6 }} />
        </TouchableOpacity>
      </View>
    </AppBottomSheet>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingTop: theme.spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  date: {
    fontSize: 14,
    color: theme.colors.textMuted,
    fontFamily: 'Inter-Medium',
  },
  title: {
    fontSize: 22,
    fontFamily: 'Inter-Bold',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: theme.spacing.lg,
  },
  detailsContainer: {
    backgroundColor: '#F8FAFC',
    padding: theme.spacing.lg,
    borderRadius: 16,
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: theme.colors.textMuted,
    fontFamily: 'Inter-Bold',
    marginBottom: theme.spacing.md,
  },
  message: {
    fontSize: 16,
    color: theme.colors.text,
    fontFamily: 'Inter-Regular',
    lineHeight: 24,
    marginBottom: theme.spacing.lg,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  detailLabel: {
    fontSize: 14,
    color: theme.colors.textMuted,
    fontFamily: 'Inter-Medium',
  },
  detailValue: {
    fontSize: 14,
    color: theme.colors.text,
    fontFamily: 'Inter-Bold',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: 16,
    marginTop: theme.spacing.sm,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: 'Inter-Bold',
    fontWeight: '700',
  },
});
