/**
 * ==============================================================
 * Fichier :
 * [id].tsx
 *
 * Description :
 * Composant ou logique de l'application Zemy.
 *
 * Projet :
 * Zemy
 * ==============================================================
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  StyleSheet, Text, View, FlatList, TextInput,
  TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator,
  Image, Linking
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { theme } from '../../src/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';
import { WebSocketService, buildWsUrl, WSMessage } from '../../src/services/websocketService';
import { API_URL } from '../../src/services/api';
import { getMediaUrl } from '../../src/utils/media';

/**
 * Composant ChatScreen.
 *
 * Responsabilités :
 * - Affichage et gestion de l'état lié à ChatScreen.
 */
export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, token, authFetch } = useAuth();

  const flatListRef = useRef<FlatList>(null);
  const wsRef = useRef<WebSocketService | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [conversation, setConversation] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [showWarning, setShowWarning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [wsConnected, setWsConnected] = useState(false);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [sending, setSending] = useState(false);

  // Numéro de téléphone regex Bénin
  const PHONE_REGEX = /(\+229|00229)?\s?\d{2}\s?\d{2}\s?\d{2}\s?\d{2}/g;

  // ── Chargement initial des données (REST) ─────────────────────────────
  const fetchChatData = useCallback(async () => {
    try {
      setLoading(true);
      const convData = await authFetch(`/conversations/${id}/`);
      setConversation(convData);

      // Charger l'historique des messages via REST (une seule fois)
      const msgsData = await authFetch(`/messages/?conversation=${id}`);
      const msgsList = Array.isArray(msgsData) ? msgsData : (msgsData?.results || []);
      const sorted = [...msgsList].sort(
        (a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      setMessages(sorted);

      // Marquer comme lus
      await authFetch(`/messages/${id}/mark-read/`, { method: 'POST' }).catch(() => {});
    } catch (error) {
      console.error('Erreur chargement conversation:', error);
    } finally {
      setLoading(false);
    }
  }, [id, authFetch]);

  // ── Connexion WebSocket ───────────────────────────────────────────────
  useEffect(() => {
    if (!id || !token) return;

    // Charger les données puis connecter le WebSocket
    fetchChatData().then(() => {
      const wsUrl = buildWsUrl(API_URL, id);
      const ws = new WebSocketService(wsUrl, token);
      wsRef.current = ws;

      ws.onOpen = () => {
        setWsConnected(true);
      };

      ws.onClose = () => {
        setWsConnected(false);
      };

      ws.onError = () => {
        setWsConnected(false);
        console.warn('[Chat] WebSocket erreur');
      };

      ws.onReconnecting = (attempt) => {
      };

      ws.onMessage = (msg: WSMessage) => {
        if (msg.type === 'message' && msg.message) {
          // Ajouter le nouveau message en temps réel
          setMessages(prev => {
            // Éviter les doublons (si le message existe déjà, ne pas l'ajouter)
            if (prev.some(m => m.id === msg.message!.id)) return prev;
            return [...prev, msg.message!];
          });
          // Scroller vers le bas
          setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
          // Marquer comme lu (on est dans la conversation)
          ws.sendReadReceipt();
        } else if (msg.type === 'typing') {
          if (msg.user_id !== user?.id) {
            setPartnerTyping(msg.is_typing ?? false);
            // Auto-effacer l'indicateur après 3 secondes
            if (msg.is_typing) {
              setTimeout(() => setPartnerTyping(false), 3000);
            }
          }
        } else if (msg.type === 'read') {
          // Mise à jour des indicateurs de lecture si nécessaire
        }
      };

      ws.connect();
    });

    return () => {
      // Nettoyage : déconnecter le WebSocket
      wsRef.current?.disconnect();
      wsRef.current = null;
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, [id, token]);

  // ── Polling de repli (HTTP REST) si le WebSocket est déconnecté ─────────
  useEffect(() => {
    if (!id || wsConnected) return;

    const interval = setInterval(async () => {
      try {
        const msgsData = await authFetch(`/messages/?conversation=${id}`);
        const msgsList = Array.isArray(msgsData) ? msgsData : (msgsData?.results || []);
        const sorted = [...msgsList].sort(
          (a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        
        setMessages(prev => {
          if (sorted.length !== prev.length || sorted.some((m, idx) => !prev[idx] || prev[idx].id !== m.id)) {
            // Marquer comme lus car l'utilisateur est actif sur l'écran
            authFetch(`/messages/${id}/mark-read/`, { method: 'POST' }).catch(() => {});
            // Scroller vers le bas si un nouveau message arrive
            setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
            return sorted;
          }
          return prev;
        });
      } catch (error) {
        console.error('[Chat] Erreur lors du polling de messages:', error);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [id, wsConnected, authFetch]);

  // ── Gestion de l'input ────────────────────────────────────────────────
  const handleInputChange = (text: string) => {
    setInputText(text);
    PHONE_REGEX.lastIndex = 0;
    setShowWarning(PHONE_REGEX.test(text));

    // Envoyer l'indicateur "en train d'écrire"
    if (wsRef.current?.isConnected) {
      wsRef.current.sendTyping(true);
      // Stopper l'indicateur après 2 secondes d'inactivité
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        wsRef.current?.sendTyping(false);
      }, 2000);
    }
  };

  // ── Envoi d'un message ────────────────────────────────────────────────
  const handleSend = async () => {
    if (!inputText.trim()) return;

    PHONE_REGEX.lastIndex = 0;
    if (PHONE_REGEX.test(inputText)) {
      setShowWarning(true);
      return;
    }

    const content = inputText.trim();
    setInputText('');
    setShowWarning(false);

    // Arrêter l'indicateur de frappe
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    wsRef.current?.sendTyping(false);

    if (wsRef.current?.isConnected) {
      // Envoi via WebSocket (temps réel)
      wsRef.current.sendMessage(content);
    } else {
      // Fallback REST si WebSocket déconnecté
      setSending(true);
      try {
        const newMsg = await authFetch('/messages/', {
          method: 'POST',
          body: JSON.stringify({ conversation: id, content }),
        });
        setMessages(prev => [...prev, newMsg]);
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 300);
      } catch (error) {
        console.error('[Chat] Erreur envoi REST:', error);
        setInputText(content); // Restaurer le message en cas d'erreur
      } finally {
        setSending(false);
      }
    }
  };

  // ── Rendu des messages ────────────────────────────────────────────────
  const isSystemMessage = (item: any) => item.content?.startsWith('🤝');

  const otherUser = conversation?.participant_1_details?.id === user?.id
    ? conversation?.participant_2_details
    : conversation?.participant_1_details;
  const partnerName = otherUser?.full_name || 'Utilisateur';
  const partnerInitials = partnerName.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();
  const rideInfo = conversation?.ride_details || null;

  const renderMessage = useCallback(({ item }: { item: any }) => {
    if (isSystemMessage(item)) {
      return (
        <View style={styles.systemMsgContainer}>
          <View style={styles.systemMsgBubble}>
            <Text style={styles.systemMsgText}>{item.content}</Text>
          </View>
        </View>
      );
    }

    const isMe = item.sender === user?.id || item.sender_details?.id === user?.id;
    const time = new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return (
      <View style={[styles.messageRow, isMe ? styles.myRow : styles.otherRow]}>
        {!isMe && (
          <View style={styles.avatarMini}>
            <Text style={styles.avatarMiniText}>{partnerInitials}</Text>
          </View>
        )}
        <View style={[styles.bubble, isMe ? styles.myBubble : styles.otherBubble]}>
          <Text style={[styles.messageText, isMe ? styles.myText : styles.otherText]}>{item.content}</Text>
          <View style={styles.messageMeta}>
            <Text style={[styles.timeText, isMe ? styles.myTime : styles.otherTime]}>{time}</Text>
            {isMe && item.is_read && (
              <Ionicons name="checkmark-done" size={12} color="rgba(255,255,255,0.8)" />
            )}
          </View>
        </View>
      </View>
    );
  }, [user, partnerInitials]);

  if (loading || !conversation) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </SafeAreaView>
    );
  }


  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>

        <View style={styles.headerUser}>
          <View style={{ position: 'relative' }}>
            {otherUser?.avatar ? (
              <Image source={{ uri: getMediaUrl(otherUser.avatar) }} style={styles.avatarMiniImage} />
            ) : (
              <View style={styles.avatarMini}>
                <Text style={styles.avatarMiniText}>{partnerInitials}</Text>
              </View>
            )}
            <View style={[
              styles.onlineMiniDot,
              { backgroundColor: otherUser?.is_online ? '#22C55E' : '#9CA3AF' }
            ]} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerName} numberOfLines={1}>{partnerName}</Text>
            {(conversation?.booking_details || rideInfo) && (
              <Text style={styles.rideInfoText} numberOfLines={1}>
                {conversation?.booking_details
                  ? `${conversation.booking_details.departure_location?.split(',')[0]} → ${conversation.booking_details.arrival_location?.split(',')[0]}`
                  : `${rideInfo.departure_location?.split(',')[0]} → ${rideInfo.arrival_location?.split(',')[0]}`}
                {` • ${otherUser?.is_online ? 'En ligne' : 'Hors ligne'}`}
              </Text>
            )}
          </View>
        </View>

        {otherUser?.phone && (
          <TouchableOpacity 
            style={styles.callButton} 
            onPress={() => Linking.openURL(`tel:${otherUser.phone}`)}
            activeOpacity={0.7}
          >
            <Ionicons name="call" size={18} color={theme.colors.primary} />
          </TouchableOpacity>
        )}
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
        style={{ flex: 1 }}
      >
        {/* Bannière anti-numéro */}
        {showWarning && (
          <View style={styles.warningBanner}>
            <Ionicons name="warning" size={18} color={theme.colors.warningDark} />
            <Text style={styles.warningText}>
              Sécurité : Ne partagez pas de numéro de téléphone. Ce message sera bloqué.
            </Text>
          </View>
        )}

        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          initialNumToRender={15}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews={Platform.OS === 'android'}
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              <Ionicons name="chatbubbles-outline" size={40} color={theme.colors.textMuted} />
              <Text style={styles.emptyChatText}>Aucun message pour l'instant.</Text>
              <Text style={styles.emptyChatSub}>Commencez la discussion !</Text>
            </View>
          }
          ListFooterComponent={
            partnerTyping ? (
              <View style={styles.typingContainer}>
                <View style={styles.avatarMini}>
                  <Text style={styles.avatarMiniText}>{partnerInitials}</Text>
                </View>
                <View style={styles.typingBubble}>
                  <Text style={styles.typingDots}>···</Text>
                </View>
              </View>
            ) : null
          }
        />

        {/* Input Bar */}
        <View style={[styles.inputContainer, { paddingBottom: Math.max(theme.spacing.md, insets.bottom) }]}>
          <TextInput
            style={styles.textInput}
            placeholder="Écrivez votre message..."
            placeholderTextColor={theme.colors.textMuted}
            value={inputText}
            onChangeText={handleInputChange}
            multiline
          />
          <TouchableOpacity
            style={[styles.sendButton, (!inputText.trim() || sending) && styles.disabledSend]}
            onPress={handleSend}
            disabled={!inputText.trim() || sending}
            activeOpacity={0.8}
          >
            {sending ? (
              <ActivityIndicator size="small" color={theme.colors.white} />
            ) : (
              <Ionicons name="send" size={18} color={theme.colors.white} />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.card, borderBottomWidth: 1,
    borderBottomColor: theme.colors.border, ...theme.shadows.sm, gap: theme.spacing.sm
  },
  backButton: { width: 36, height: 36, justifyContent: 'center', alignItems: 'flex-start' },
  headerUser: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  headerName: { ...theme.typography.bodyLarge, fontWeight: '700', color: theme.colors.text },
  rideInfoText: { fontSize: 11, color: theme.colors.textMuted, marginTop: 1 },
  // WS indicator
  wsIndicator: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, borderWidth: 1,
  },
  wsConnected: { backgroundColor: '#f0fdf4', borderColor: '#86efac' },
  wsDisconnected: { backgroundColor: '#fef2f2', borderColor: '#fca5a5' },
  wsDot: { width: 6, height: 6, borderRadius: 3 },
  wsDotConnected: { backgroundColor: '#22c55e' },
  wsDotDisconnected: { backgroundColor: '#ef4444' },
  wsText: { fontSize: 10, fontWeight: '600' },
  wsTextConnected: { color: '#16a34a' },
  wsTextDisconnected: { color: '#dc2626' },
  // Warning
  warningBanner: {
    backgroundColor: theme.colors.warningLight, borderBottomWidth: 1,
    borderBottomColor: theme.colors.warning, flexDirection: 'row',
    alignItems: 'center', padding: theme.spacing.sm, gap: 6
  },
  warningText: { fontSize: 11, color: theme.colors.warningDark, fontWeight: '600', flex: 1 },
  // Messages
  messagesList: { padding: theme.spacing.lg, gap: theme.spacing.md, paddingBottom: 16 },
  systemMsgContainer: { alignItems: 'center', marginVertical: theme.spacing.md },
  systemMsgBubble: {
    backgroundColor: theme.colors.primaryLight, borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md, maxWidth: '90%', borderWidth: 1,
    borderColor: theme.colors.primaryLight
  },
  systemMsgText: { fontSize: 13, color: theme.colors.primaryDark, lineHeight: 20, textAlign: 'left' },
  messageRow: {
    flexDirection: 'row', alignItems: 'flex-end',
    gap: theme.spacing.sm, maxWidth: '80%'
  },
  myRow: { alignSelf: 'flex-end' },
  otherRow: { alignSelf: 'flex-start' },
  avatarMini: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: theme.colors.secondaryLight,
    justifyContent: 'center', alignItems: 'center'
  },
  avatarMiniText: { color: theme.colors.secondaryDark, fontWeight: '700', fontSize: 12 },
  avatarMiniImage: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  onlineMiniDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#22C55E', // success green
    borderWidth: 1.5,
    borderColor: theme.colors.card,
  },
  callButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: theme.colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 4,
  },
  bubble: {
    borderRadius: theme.borderRadius.lg,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10, ...theme.shadows.sm
  },
  myBubble: { backgroundColor: theme.colors.primary, borderBottomRightRadius: 2 },
  otherBubble: { backgroundColor: theme.colors.card, borderBottomLeftRadius: 2 },
  messageText: { ...theme.typography.bodyMedium },
  myText: { color: theme.colors.white },
  otherText: { color: theme.colors.text },
  messageMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 3, marginTop: 4 },
  timeText: { fontSize: 9 },
  myTime: { color: 'rgba(255, 255, 255, 0.7)' },
  otherTime: { color: theme.colors.textMuted },
  // Typing indicator
  typingContainer: {
    flexDirection: 'row', alignItems: 'flex-end',
    gap: theme.spacing.sm, paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.sm
  },
  typingBubble: {
    backgroundColor: theme.colors.card, borderRadius: theme.borderRadius.lg,
    paddingHorizontal: 16, paddingVertical: 12, borderBottomLeftRadius: 2,
    ...theme.shadows.sm
  },
  typingDots: { fontSize: 20, color: theme.colors.textMuted, letterSpacing: 2 },
  // Empty
  emptyChat: { alignItems: 'center', justifyContent: 'center', paddingTop: 60, gap: 8 },
  emptyChatText: { ...theme.typography.bodyLarge, color: theme.colors.text, fontWeight: '600' },
  emptyChatSub: { ...theme.typography.bodyMedium, color: theme.colors.textMuted },
  // Input
  inputContainer: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: theme.colors.card, padding: theme.spacing.md,
    borderTopWidth: 1, borderTopColor: theme.colors.border, gap: theme.spacing.sm
  },
  textInput: {
    flex: 1, backgroundColor: theme.colors.background, borderWidth: 1,
    borderColor: theme.colors.border, borderRadius: theme.borderRadius.xl,
    paddingHorizontal: theme.spacing.md, paddingVertical: 10,
    maxHeight: 100, color: theme.colors.text, ...theme.typography.bodyMedium
  },
  sendButton: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center', alignItems: 'center', ...theme.shadows.sm
  },
  disabledSend: { backgroundColor: theme.colors.border, shadowOpacity: 0, elevation: 0 },
});
