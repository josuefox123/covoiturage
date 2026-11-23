/**
 * ==============================================================
 * Fichier :
 * ConversationCard.tsx
 *
 * Description :
 * Élément de liste de conversation moderne, compact et épuré
 * inspiré des meilleures applications de messagerie mobile.
 *
 * Projet :
 * Zemy
 * ==============================================================
 */
import React, { memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getMediaUrl } from '../../utils/media';

interface ConversationCardProps {
  item: any;
  currentUserId: string;
}

function formatTime(dateStr?: string) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (days === 0) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (days === 1) {
    return 'Hier';
  } else if (days < 7) {
    return ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'][date.getDay()];
  } else {
    return date.toLocaleDateString([], { day: '2-digit', month: 'short' });
  }
}

function getMessagePreview(lastMessage: any, isMe: boolean) {
  if (!lastMessage) return { text: 'Nouvelle conversation', icon: null };

  const prefix = isMe ? 'Vous : ' : '';
  const type = lastMessage.message_type;

  if (type === 'image') return { text: `${prefix}Photo`, icon: 'image-outline' };
  if (type === 'audio') return { text: `${prefix}Message vocal`, icon: 'mic-outline' };
  if (type === 'location') return { text: `${prefix}Position partagée`, icon: 'location-outline' };
  if (type === 'document') return { text: `${prefix}Document`, icon: 'document-text-outline' };
  if (type === 'video') return { text: `${prefix}Vidéo`, icon: 'videocam-outline' };

  return { text: `${prefix}${lastMessage.content || ''}`, icon: null };
}

function ConversationCardComponent({ item, currentUserId }: ConversationCardProps) {
  const router = useRouter();

  // Identifier le correspondant
  const otherUser =
    item.participant_1_details?.id === currentUserId
      ? item.participant_2_details
      : item.participant_1_details;

  const userName = otherUser?.full_name || 'Membre Zemy';
  const userInitials = userName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n: string) => n[0])
    .join('')
    .toUpperCase() || 'Z';

  const avatarUrl = otherUser?.avatar;
  const isOnline = !!otherUser?.is_online;

  const lastMessage = item.last_message;
  const isMe = lastMessage?.sender_details?.id === currentUserId;
  const unreadCount = item.unread_count || 0;
  const hasUnread = unreadCount > 0;

  const timeFormatted = formatTime(lastMessage?.created_at || item.updated_at || item.created_at);
  const preview = getMessagePreview(lastMessage, isMe);

  // Contexte de trajet
  const booking = item.booking_details;
  const ride = item.ride_details;
  const depCity = (booking?.departure_location || ride?.departure_location || '').split(',')[0].trim();
  const arrCity = (booking?.arrival_location || ride?.arrival_location || '').split(',')[0].trim();
  const hasRoute = !!depCity && !!arrCity;

  const rideStatus = booking?.status || ride?.status;
  const isConfirmed = ['confirmed', 'active', 'started'].includes(rideStatus);

  return (
    <TouchableOpacity
      style={[styles.row, hasUnread && styles.rowUnread]}
      activeOpacity={0.65}
      onPress={() => router.push(`/chat/${item.id}`)}
    >
      {/* ── Avatar du correspondant ── */}
      <View style={styles.avatarWrap}>
        {avatarUrl ? (
          <Image source={{ uri: getMediaUrl(avatarUrl) }} style={styles.avatarImg} />
        ) : (
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarInitials}>{userInitials}</Text>
          </View>
        )}
        {isOnline && <View style={styles.onlineDot} />}
      </View>

      {/* ── Corps de la conversation ── */}
      <View style={styles.mainContent}>
        {/* Ligne 1 : Nom & Date */}
        <View style={styles.topRow}>
          <Text style={[styles.userName, hasUnread && styles.userNameUnread]} numberOfLines={1}>
            {userName}
          </Text>
          <Text style={[styles.timeText, hasUnread && styles.timeTextUnread]}>
            {timeFormatted}
          </Text>
        </View>

        {/* Ligne 2 : Itinéraire covoiturage (discret) */}
        {hasRoute && (
          <View style={styles.routeRow}>
            <Ionicons name="car-outline" size={13} color="#64748B" />
            <Text style={styles.routeText} numberOfLines={1}>
              {depCity} → {arrCity}
            </Text>
            {isConfirmed && (
              <View style={styles.statusPill}>
                <Text style={styles.statusPillText}>Confirmé</Text>
              </View>
            )}
          </View>
        )}

        {/* Ligne 3 : Dernier message & Badge non lu */}
        <View style={styles.bottomRow}>
          <View style={styles.messageBox}>
            {preview.icon && (
              <Ionicons
                name={preview.icon as any}
                size={14}
                color={hasUnread ? '#2563EB' : '#64748B'}
                style={{ marginRight: 4 }}
              />
            )}
            <Text
              style={[styles.messageText, hasUnread && styles.messageTextUnread]}
              numberOfLines={1}
            >
              {preview.text}
            </Text>
          </View>

          {hasUnread && (
            <View style={styles.unreadPill}>
              <Text style={styles.unreadCountText}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default memo(ConversationCardComponent);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
  },
  rowUnread: {
    backgroundColor: '#F8FAFC',
  },
  avatarWrap: {
    position: 'relative',
    marginRight: 12,
  },
  avatarImg: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F1F5F9',
  },
  avatarCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  avatarInitials: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1D4ED8',
    letterSpacing: -0.3,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  mainContent: {
    flex: 1,
    justifyContent: 'center',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  userName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
    flex: 1,
    marginRight: 8,
  },
  userNameUnread: {
    fontWeight: '700',
    color: '#0F172A',
  },
  timeText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
  timeTextUnread: {
    color: '#2563EB',
    fontWeight: '700',
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 3,
  },
  routeText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
    flexShrink: 1,
  },
  statusPill: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    marginLeft: 4,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  messageBox: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  messageText: {
    fontSize: 13,
    color: '#64748B',
    flexShrink: 1,
  },
  messageTextUnread: {
    color: '#0F172A',
    fontWeight: '600',
  },
  unreadPill: {
    backgroundColor: '#2563EB',
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadCountText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
});
