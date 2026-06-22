import React, { useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Animated as RNAnimated, Alert } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { Notification } from '../types/notification';
import { theme } from '../../../styles/theme';
import { getNotificationStyle } from '../constants/notificationTypes';
import { formatTimeAgo } from '../utils/notificationHelpers';

interface Props {
  notification: Notification;
  onRead: (id: number) => void;
  onDelete: (id: number) => void;
  onPress: (notification: Notification) => void;
}

export const NotificationCard = ({ notification, onRead, onDelete, onPress }: Props) => {
  const swipeableRef = useRef<Swipeable>(null);
  const { icon, color } = getNotificationStyle(notification);

  const handleDeletePress = () => {
    swipeableRef.current?.close();
    Alert.alert(
      "Supprimer la notification",
      "Êtes-vous sûr de vouloir supprimer cette notification définitivement ?",
      [
        { text: "Annuler", style: "cancel" },
        { text: "Supprimer", style: "destructive", onPress: () => onDelete(notification.id) }
      ]
    );
  };

  const handleLongPress = () => {
    Alert.alert(
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

  const renderRightActions = (progress: RNAnimated.AnimatedInterpolation<number>, dragX: RNAnimated.AnimatedInterpolation<number>) => {
    const scale = dragX.interpolate({
      inputRange: [-80, -40, 0],
      outputRange: [1, 0.8, 0],
      extrapolate: 'clamp',
    });

    return (
      <Pressable onPress={handleDeletePress} style={styles.deleteAction}>
        <RNAnimated.View style={[styles.deleteIconContainer, { transform: [{ scale }] }]}>
          <Ionicons name="trash" size={24} color="#FFFFFF" />
        </RNAnimated.View>
      </Pressable>
    );
  };

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      friction={2}
      rightThreshold={40}
    >
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
            <Text style={styles.time}>{formatTimeAgo(notification.created_at)}</Text>
          </View>
          <Text style={[styles.message, !notification.is_read && styles.textBold]} numberOfLines={2}>
            {notification.message}
          </Text>
        </View>
      </Pressable>
    </Swipeable>
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
  deleteAction: {
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    borderRadius: 18,
    marginBottom: theme.spacing.md,
    marginLeft: theme.spacing.sm,
  },
  deleteIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
