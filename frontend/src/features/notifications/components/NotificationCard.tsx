import React, { useRef } from 'react';
import { View, Text, StyleSheet, Pressable, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Notification } from '../types/notification';
import { theme } from '../../../styles/theme';
import { getNotificationStyle } from '../constants/notificationTypes';
import { formatTimeAgo } from '../utils/notificationHelpers';
import { CustomAlert } from '../../../utils/CustomAlert';

interface Props {
  notification: Notification;
  onRead: (id: number) => void;
  onDelete: (id: number) => void;
  onPress: (notification: Notification) => void;
}

export const NotificationCard = ({ notification, onRead, onDelete, onPress }: Props) => {
  const { icon, color } = getNotificationStyle(notification);

  const handleDeletePress = () => {
    CustomAlert.alert(
      "Supprimer la notification",
      "Êtes-vous sûr de vouloir supprimer cette notification définitivement ?",
      [
        { text: "Annuler", style: "cancel" },
        { text: "Supprimer", style: "destructive", onPress: () => onDelete(notification.id) }
      ]
    );
  };

  const handleLongPress = () => {
    CustomAlert.alert(
      "Options",
      "Que souhaitez-vous faire ?",
      [
        { text: "Marquer comme lu", onPress: () => !notification.is_read && onRead(notification.id) },
        { text: "Copier le texte", onPress: () => {} },
        { text: "Supprimer", style: "destructive", onPress: handleDeletePress },
        { text: "Annuler", style: "cancel" }
      ]
    );
  };

  return (
      <Pressable 
        style={[styles.card, !notification.is_read && styles.cardUnread]}
        onPress={() => {
          if (!notification.is_read) onRead(notification.id);
          onPress(notification);
        }}
        onLongPress={handleLongPress}
        delayLongPress={400}
      >
        {!notification.is_read && <View style={styles.unreadDot} />}
        
        <View style={[styles.iconContainer, { backgroundColor: color + '15' }]}>
          <Ionicons name={icon} size={24} color={color} />
        </View>

        <View style={styles.content}>
          <View style={styles.headerRow}>
            <Text style={[styles.title, !notification.is_read && styles.textBold]} numberOfLines={1}>
              {notification.title}
            </Text>
            <View style={styles.rightHeader}>
              <Text style={styles.time}>{formatTimeAgo(notification.created_at)}</Text>
              <TouchableOpacity onPress={handleDeletePress} style={styles.trashBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="trash-outline" size={18} color="#EF4444" />
              </TouchableOpacity>
            </View>
          </View>
          <Text style={[styles.message, !notification.is_read && styles.textBold]} numberOfLines={2}>
            {notification.message}
          </Text>
        </View>
      </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    padding: theme.spacing.md,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    marginBottom: theme.spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.02)',
  },
  cardUnread: {
    backgroundColor: '#F8FAFC',
    borderColor: theme.colors.primary + '20',
  },
  unreadDot: {
    position: 'absolute',
    top: 16,
    left: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.primary,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
    marginLeft: 6,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 15,
    fontFamily: 'Inter-Medium',
    color: theme.colors.text,
    flex: 1,
    paddingRight: 8,
  },
  time: {
    fontSize: 12,
    color: theme.colors.textMuted,
    fontFamily: 'Inter-Regular',
  },
  message: {
    fontSize: 14,
    color: theme.colors.textMuted,
    fontFamily: 'Inter-Regular',
    lineHeight: 20,
  },
  textBold: {
    fontFamily: 'Inter-Bold',
    color: theme.colors.text,
  },
  rightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trashBtn: {
    marginLeft: 8,
  },

});
