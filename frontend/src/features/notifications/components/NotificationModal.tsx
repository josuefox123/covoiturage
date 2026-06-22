import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
  if (!notification) return null;

  const { icon, color } = getNotificationStyle(notification);

  return (
    <AppBottomSheet
      visible={!!notification}
      onClose={onClose}
      snapPoints={['75%', '95%']}
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
          
          {/* Si on avait des infos structurées depuis l'API */}
          {notification.ride_id && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Trajet concerné</Text>
              <Text style={styles.detailValue}>#{notification.ride_id}</Text>
            </View>
          )}
          {notification.amount && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Montant</Text>
              <Text style={[styles.detailValue, { color: theme.colors.success }]}>
                {notification.amount} FCFA
              </Text>
            </View>
          )}
        </View>
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
});
