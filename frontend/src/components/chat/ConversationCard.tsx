/**
 * ==============================================================
 * Fichier :
 * ConversationCard.tsx
 *
 * Description :
 * Composant ou logique de l'application Zemy.
 *
 * Projet :
 * Zemy
 * ==============================================================
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { theme } from '../../styles/theme';
import { getMediaUrl } from '../../utils/media';
import { useRouter } from 'expo-router';

interface ConversationCardProps {
  item: any;
  currentUserId: string;
  onArchive?: (id: string) => void;
  onDelete?: (id: string) => void;
  onPin?: (id: string) => void;
}

/**
 * Composant ConversationCard.
 *
 * Responsabilités :
 * - Affichage et gestion de l'état lié à ConversationCard.
 */
export default function ConversationCard({ item, currentUserId, onArchive, onDelete, onPin }: ConversationCardProps) {
  const router = useRouter();
  
  // Determine the other participant
  const otherUser = item.participant_1_details?.id === currentUserId 
    ? item.participant_2_details 
    : item.participant_1_details;
  
  const userName = otherUser?.full_name || 'Utilisateur Zemy';
  const userAvatar = userName.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();
  const avatarUrl = otherUser?.avatar;
  const isOnline = otherUser?.is_online || false;

  const lastMessage = item.last_message;
  const isMe = lastMessage?.sender_details?.id === currentUserId;
  const unreadCount = item.unread_count || 0;
  
  // formatting date
  const formatTime = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return 'Hier';
    } else if (days < 7) {
      return ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'][date.getDay()];
    } else {
      return date.toLocaleDateString([], { day: '2-digit', month: 'short' });
    }
  };

  const getMessagePreview = () => {
    if (!lastMessage) return 'Nouvelle conversation';
    
    const prefix = isMe ? 'Vous : ' : '';
    let content = lastMessage.content || '';
    
    // Check for message types
    if (lastMessage.message_type === 'image') return `${prefix}Photo`;
    if (lastMessage.message_type === 'audio') return `${prefix}Vocal`;
    if (lastMessage.message_type === 'location') return `${prefix}Position`;
    if (lastMessage.message_type === 'document') return `${prefix}Document`;
    if (lastMessage.message_type === 'video') return `${prefix}Vidéo`;
    
    return `${prefix}${content}`;
  };

  const renderRightActions = () => {
    return (
      <View style={styles.actionsContainer}>
        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: theme.colors.warning }]} onPress={() => onPin && onPin(item.id)}>
          <Ionicons name="pin" size={24} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: theme.colors.primary }]} onPress={() => onArchive && onArchive(item.id)}>
          <Ionicons name="archive" size={24} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: theme.colors.error }]} onPress={() => onDelete && onDelete(item.id)}>
          <Ionicons name="trash" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
    );
  };

  // Ride info
  const ride = item.ride_details;
  const rideStatus = ride?.status || 'Terminé';

  return (
    <Swipeable
      friction={2}
      rightThreshold={40}
      renderRightActions={renderRightActions}
    >
      <TouchableOpacity
        style={styles.container}
        activeOpacity={0.7}
        onPress={() => router.push(`/chat/${item.id}`)}
      >
        <View style={styles.avatarContainer}>
          {avatarUrl ? (
            <Image source={{ uri: getMediaUrl(avatarUrl) }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>{userAvatar}</Text>
            </View>
          )}
          {isOnline && <View style={styles.onlineIndicator} />}
        </View>

        <View style={styles.contentContainer}>
          <View style={styles.headerRow}>
            <Text style={styles.name} numberOfLines={1}>{userName}</Text>
            <Text style={[styles.time, unreadCount > 0 && styles.timeUnread]}>
              {formatTime(lastMessage?.created_at || item.created_at)}
            </Text>
          </View>
          
          {ride && (
            <View style={styles.rideRow}>
              <Ionicons name="car-outline" size={14} color={theme.colors.textMuted} />
              <Text style={styles.rideText} numberOfLines={1}>
                {ride.departure_location?.split(',')[0]} → {ride.arrival_location?.split(',')[0]}
              </Text>
              <View style={[styles.badge, rideStatus === 'confirmed' ? styles.badgeSuccess : styles.badgeDefault]}>
                <Text style={styles.badgeText}>{rideStatus === 'confirmed' ? 'Confirmé' : 'Terminé'}</Text>
              </View>
            </View>
          )}
          
          <View style={styles.footerRow}>
            <Text style={[styles.messagePreview, unreadCount > 0 && styles.messageUnread]} numberOfLines={1}>
              {getMessagePreview()}
            </Text>
            
            {unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>{unreadCount}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    backgroundColor: theme.colors.background,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: theme.spacing.md,
  },
  avatarImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: theme.colors.white,
  },
  avatarCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: theme.colors.secondaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.white,
  },
  avatarText: {
    color: theme.colors.secondaryDark,
    fontWeight: '700',
    fontSize: 20,
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: theme.colors.success,
    borderWidth: 2,
    borderColor: theme.colors.white,
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  name: {
    ...theme.typography.h3,
    fontSize: 16,
    color: theme.colors.text,
    flex: 1,
    marginRight: 8,
  },
  time: {
    ...theme.typography.bodySmall,
    color: theme.colors.textLight,
  },
  timeUnread: {
    color: theme.colors.primary,
    fontWeight: '700',
  },
  rideRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  rideText: {
    ...theme.typography.bodySmall,
    color: theme.colors.textMuted,
    marginLeft: 4,
    marginRight: 8,
    flex: 1,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeDefault: {
    backgroundColor: theme.colors.border,
  },
  badgeSuccess: {
    backgroundColor: theme.colors.success + '20', // transparent green
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.colors.text,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  messagePreview: {
    ...theme.typography.bodyMedium,
    color: theme.colors.textLight,
    flex: 1,
    marginRight: 8,
  },
  messageUnread: {
    color: theme.colors.text,
    fontWeight: '600',
  },
  unreadBadge: {
    backgroundColor: theme.colors.primary,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadText: {
    color: theme.colors.white,
    fontSize: 11,
    fontWeight: '700',
  },
  actionsContainer: {
    flexDirection: 'row',
    width: 192, // 3 * 64
  },
  actionBtn: {
    width: 64,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
