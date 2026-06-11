import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Keyboard,
  KeyboardEvent,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useAuth } from '../src/context/AuthContext';
import { theme } from '../src/styles/theme';
import { CustomAlert } from '../src/utils/CustomAlert';

interface Message {
  id: string;
  sender: string;
  sender_details: { id: string; full_name: string; phone: string };
  content: string;
  message_type: 'text' | 'image' | 'audio' | 'file' | 'location';
  attachment: string | null;
  attachment_url: string | null;
  location_lat: number | null;
  location_lng: number | null;
  is_read: boolean;
  created_at: string;
}

interface Conversation {
  id: string;
  conversation_type: string;
  participant_1: string;
  participant_1_details?: { id: string; full_name: string; phone: string };
  participant_2: string | null;
}

export default function SupportChatScreen() {
  const router = useRouter();
  const { user, authFetch } = useAuth();
  const flatListRef = useRef<FlatList>(null);
  const insets = useSafeAreaInsets();

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [text, setText] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // --- Keyboard height tracking (most reliable on Android) ---
  useEffect(() => {
    const showListener = Keyboard.addListener(
      Platform.OS === 'android' ? 'keyboardDidShow' : 'keyboardWillShow',
      (e: KeyboardEvent) => {
        setKeyboardHeight(e.endCoordinates.height);
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      }
    );
    const hideListener = Keyboard.addListener(
      Platform.OS === 'android' ? 'keyboardDidHide' : 'keyboardWillHide',
      () => setKeyboardHeight(0)
    );
    return () => {
      showListener.remove();
      hideListener.remove();
    };
  }, []);

  // --- Init: Get or create support conversation ---
  useEffect(() => {
    initChat();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const initChat = async () => {
    try {
      const conv = await authFetch('/conversations/support-chat/');
      setConversation(conv);
      await loadMessages(conv.id);
      // Poll every 5 seconds for new messages
      pollRef.current = setInterval(() => loadMessages(conv.id), 5000);
    } catch (e: any) {
      CustomAlert.alert('Erreur', e.message || 'Impossible de charger le chat support.');
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (convId: string) => {
    try {
      const data = await authFetch(`/messages/?conversation=${convId}`);
      setMessages(Array.isArray(data) ? data : (data.results || []));
    } catch (e) {
      // Silently fail on polling errors
    }
  };

  const scrollToBottom = () => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 150);
  };

  useEffect(() => {
    if (messages.length > 0) scrollToBottom();
  }, [messages.length]);

  // --- Send text message ---
  const sendText = async () => {
    if (!text.trim() || !conversation) return;
    const content = text.trim();
    setText('');
    setSendingMessage(true);
    try {
      await authFetch('/messages/', {
        method: 'POST',
        body: JSON.stringify({
          conversation: conversation.id,
          content,
          message_type: 'text',
        }),
      });
      await loadMessages(conversation.id);
    } catch (e: any) {
      CustomAlert.alert('Erreur', e.message || "Impossible d'envoyer le message.");
    } finally {
      setSendingMessage(false);
    }
  };

  // --- Send media via FormData ---
  const sendMedia = async (
    type: 'image',
    uri: string,
    name: string,
    mimeType: string
  ) => {
    if (!conversation) return;
    setSendingMessage(true);
    try {
      const formData = new FormData();
      formData.append('conversation', conversation.id);
      formData.append('content', '');
      formData.append('message_type', type);
      formData.append('attachment', { uri, name, type: mimeType } as any);

      await authFetch('/messages/', {
        method: 'POST',
        body: formData,
      });
      await loadMessages(conversation.id);
    } catch (e: any) {
      CustomAlert.alert('Erreur', e.message || "Impossible d'envoyer le fichier.");
    } finally {
      setSendingMessage(false);
    }
  };

  // --- Pick image from gallery ---
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      CustomAlert.alert('Permission refusée', "L'accès à la galerie est requis.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const name = asset.uri.split('/').pop() || 'photo.jpg';
      await sendMedia('image', asset.uri, name, asset.mimeType || 'image/jpeg');
    }
  };

  // --- Take a photo ---
  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      CustomAlert.alert('Permission refusée', "L'accès à la caméra est requis.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const name = asset.uri.split('/').pop() || 'photo.jpg';
      await sendMedia('image', asset.uri, name, asset.mimeType || 'image/jpeg');
    }
  };

  // --- Share location ---
  const shareLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      CustomAlert.alert('Permission refusée', "L'accès à la localisation est requis.");
      return;
    }
    if (!conversation) return;
    setSendingMessage(true);
    try {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      await authFetch('/messages/', {
        method: 'POST',
        body: JSON.stringify({
          conversation: conversation.id,
          content: 'Ma position actuelle',
          message_type: 'location',
          location_lat: loc.coords.latitude,
          location_lng: loc.coords.longitude,
        }),
      });
      await loadMessages(conversation.id);
    } catch (e: any) {
      CustomAlert.alert('Erreur', e.message || 'Impossible de partager la position.');
    } finally {
      setSendingMessage(false);
    }
  };

  // --- Format time ---
  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  // --- Render message bubble ---
  const renderMessage = ({ item }: { item: Message }) => {
    // "isMe" = ce message a été envoyé par l'utilisateur connecté sur l'appli mobile
    // On compare les IDs en string pour éviter les problèmes de type (UUID vs string)
    const myId = String(user?.id || '');
    const senderId = String(item.sender_details?.id || item.sender || '');
    const isMe = myId !== '' && myId === senderId;

    return (
      <View style={[styles.msgRow, isMe ? styles.msgRowRight : styles.msgRowLeft]}>
        {!isMe && (
          <View style={styles.avatar}>
            <Ionicons name="headset" size={16} color={theme.colors.primary} />
          </View>
        )}
        <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
          {!isMe && (
            <Text style={styles.senderName}>
              {item.sender_details?.full_name || 'Support'}
            </Text>
          )}

          {item.message_type === 'text' && (
            <Text style={[styles.msgText, isMe ? styles.msgTextMe : styles.msgTextThem]}>
              {item.content}
            </Text>
          )}

          {item.message_type === 'image' && item.attachment_url && (
            <Image
              source={{ uri: item.attachment_url }}
              style={styles.msgImage}
              resizeMode="cover"
            />
          )}

          {item.message_type === 'audio' && (
            <View style={styles.mediaRow}>
              <Ionicons name="musical-note" size={20} color={isMe ? theme.colors.white : theme.colors.primary} />
              <Text style={[styles.msgText, isMe ? styles.msgTextMe : styles.msgTextThem, { marginLeft: 6 }]}>
                Message audio
              </Text>
            </View>
          )}

          {item.message_type === 'file' && (
            <TouchableOpacity
              style={styles.mediaRow}
              onPress={() => item.attachment_url && Linking.openURL(item.attachment_url)}
            >
              <Ionicons name="document-attach" size={20} color={isMe ? theme.colors.white : theme.colors.primary} />
              <Text style={[styles.msgText, isMe ? styles.msgTextMe : styles.msgTextThem, { marginLeft: 6 }]}>
                Fichier joint
              </Text>
            </TouchableOpacity>
          )}

          {item.message_type === 'location' && (
            <TouchableOpacity
              style={styles.mediaRow}
              onPress={() => {
                const url = `https://maps.google.com/?q=${item.location_lat},${item.location_lng}`;
                Linking.openURL(url);
              }}
            >
              <Ionicons name="location" size={20} color={isMe ? theme.colors.white : theme.colors.primary} />
              <Text style={[styles.msgText, isMe ? styles.msgTextMe : styles.msgTextThem, { marginLeft: 6 }]}>
                {item.content || 'Position partagée — Voir sur la carte'}
              </Text>
            </TouchableOpacity>
          )}

          <Text style={[styles.msgTime, isMe ? styles.msgTimeMe : styles.msgTimeThem]}>
            {formatTime(item.created_at)}
          </Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Connexion au support…</Text>
      </SafeAreaView>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <View style={styles.headerAvatar}>
            <Ionicons name="headset" size={20} color={theme.colors.white} />
          </View>
          <View>
            <Text style={styles.headerTitle}>Support Client</Text>
            <Text style={styles.headerSubtitle}>Zemy Bénin</Text>
          </View>
        </View>
        <View style={styles.onlineDot} />
      </View>

      {/* Messages list — takes all available space */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.messagesList}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubbles-outline" size={64} color={theme.colors.textMuted} />
            <Text style={styles.emptyTitle}>Démarrez la conversation</Text>
            <Text style={styles.emptySubtitle}>
              Notre équipe vous répondra dans les plus brefs délais.
            </Text>
          </View>
        }
      />

      {/* Input toolbar — sits just above the keyboard using paddingBottom */}
      <View style={[styles.toolbar, { paddingBottom: keyboardHeight > 0 ? keyboardHeight : Math.max(insets.bottom, 8) }]}>
        {/* Media action buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.actionBtn} onPress={pickImage} disabled={sendingMessage}>
            <Ionicons name="image-outline" size={22} color={theme.colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={takePhoto} disabled={sendingMessage}>
            <Ionicons name="camera-outline" size={22} color={theme.colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={shareLocation} disabled={sendingMessage}>
            <Ionicons name="location-outline" size={22} color={theme.colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Text input + send */}
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Écrivez votre message…"
            placeholderTextColor={theme.colors.textMuted}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={1000}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!text.trim() || sendingMessage) && styles.sendBtnDisabled]}
            onPress={sendText}
            disabled={!text.trim() || sendingMessage}
          >
            {sendingMessage ? (
              <ActivityIndicator size="small" color={theme.colors.white} />
            ) : (
              <Ionicons name="send" size={18} color={theme.colors.white} />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
  },
  loadingText: {
    marginTop: 12,
    color: theme.colors.textMuted,
    fontSize: 14,
  },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.colors.card,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    gap: 12,
  },
  backBtn: { padding: 4 },
  headerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text,
  },
  headerSubtitle: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  onlineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.success,
  },
  // Messages
  messagesList: {
    padding: 16,
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: theme.colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  msgRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginVertical: 4,
  },
  msgRowRight: { justifyContent: 'flex-end' },
  msgRowLeft: { justifyContent: 'flex-start' },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: theme.colors.primary + '22',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  bubble: {
    maxWidth: '78%',
    borderRadius: 18,
    padding: 10,
    gap: 4,
  },
  bubbleMe: {
    backgroundColor: theme.colors.primary,
    borderBottomRightRadius: 4,
  },
  bubbleThem: {
    backgroundColor: theme.colors.card,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  senderName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: theme.colors.primary,
    marginBottom: 4,
  },
  msgText: { fontSize: 15, lineHeight: 20 },
  msgTextMe: { color: theme.colors.white },
  msgTextThem: { color: theme.colors.text },
  msgTime: { fontSize: 10, marginTop: 2 },
  msgTimeMe: { color: 'rgba(255,255,255,0.7)', textAlign: 'right' },
  msgTimeThem: { color: theme.colors.textMuted },
  msgImage: {
    width: 200,
    height: 150,
    borderRadius: 12,
  },
  mediaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  // Toolbar
  toolbar: {
    backgroundColor: theme.colors.card,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 16 : 8,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 8,
  },
  actionBtn: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: theme.colors.primary + '15',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: theme.colors.background,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: theme.colors.text,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.5 },
});