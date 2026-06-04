import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, Text, View, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { theme } from '../../src/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user, authFetch } = useAuth();
  
  const flatListRef = useRef<FlatList>(null);
  
  const [conversation, setConversation] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [showWarning, setShowWarning] = useState(false);
  const [loading, setLoading] = useState(true);

  // Phone number regex detection (Benin formats: 8 digits, spaces, hyphens, and international +229)
  const PHONE_REGEX = /(\+229|00229)?\s?\d{2}\s?\d{2}\s?\d{2}\s?\d{2}/g;

  useEffect(() => {
    fetchChatData();
    // In a real app, use WebSockets. Here we poll every 5 seconds for simplicity.
    const interval = setInterval(() => {
      fetchMessagesOnly();
    }, 5000);
    return () => clearInterval(interval);
  }, [id]);

  const fetchChatData = async () => {
    try {
      setLoading(true);
      const convData = await authFetch(`/conversations/${id}/`);
      setConversation(convData);
      
      await fetchMessagesOnly();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessagesOnly = async () => {
    try {
      const msgsData = await authFetch('/messages/');
      // Filter for this conversation
      const filtered = msgsData.filter((m: any) => m.conversation === id);
      // Sort by created_at
      filtered.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      setMessages(filtered);
    } catch (error) {
      // silent fail for polling
    }
  };

  const handleInputChange = (text: string) => {
    setInputText(text);
    if (PHONE_REGEX.test(text)) {
      setShowWarning(true);
    } else {
      setShowWarning(false);
    }
  };

  const handleSend = async () => {
    if (!inputText.trim()) return;

    if (PHONE_REGEX.test(inputText)) {
      setShowWarning(true);
      return;
    }

    try {
      await authFetch('/messages/', {
        method: 'POST',
        body: JSON.stringify({
          conversation: id,
          content: inputText.trim()
        })
      });
      setInputText('');
      setShowWarning(false);
      fetchMessagesOnly();
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 300);
    } catch (error) {
      console.error(error);
    }
  };

  const renderMessage = ({ item }: { item: any }) => {
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
          <Text style={[styles.timeText, isMe ? styles.myTime : styles.otherTime]}>{time}</Text>
        </View>
      </View>
    );
  };

  if (loading || !conversation) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </SafeAreaView>
    );
  }

  const otherUser = conversation.participant_1_details?.id === user?.id 
    ? conversation.participant_2_details 
    : conversation.participant_1_details;
  
  const partnerName = otherUser?.full_name || 'Utilisateur';
  const partnerInitials = partnerName.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        
        <View style={styles.headerUser}>
          <View style={styles.avatarMini}>
            <Text style={styles.avatarMiniText}>{partnerInitials}</Text>
          </View>
          <View>
            <Text style={styles.headerName}>{partnerName}</Text>
            <Text style={styles.statusText}>En ligne</Text>
          </View>
        </View>
        
        <TouchableOpacity style={styles.callButton}>
          <Ionicons name="call-outline" size={22} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        style={{ flex: 1 }}
      >
        {/* Anti-number warning banner */}
        {showWarning && (
          <View style={styles.warningBanner}>
            <Ionicons name="warning" size={18} color="#92400E" />
            <Text style={styles.warningText}>
              ⚠️ Sécurité : Ne partagez pas de numéro de téléphone. Le système détectera et bloquera le message.
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
        />

        {/* Input Bar */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            placeholder="Écrivez votre message..."
            placeholderTextColor={theme.colors.textMuted}
            value={inputText}
            onChangeText={handleInputChange}
            multiline
          />
          <TouchableOpacity 
            style={[styles.sendButton, !inputText.trim() && styles.disabledSend]} 
            onPress={handleSend}
            disabled={!inputText.trim()}
            activeOpacity={0.8}
          >
            <Ionicons name="send" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F5F9' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.sm, backgroundColor: theme.colors.card, borderBottomWidth: 1, borderBottomColor: theme.colors.border, ...theme.shadows.sm },
  backButton: { width: 36, height: 36, justifyContent: 'center', alignItems: 'flex-start' },
  headerUser: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  headerName: { ...theme.typography.bodyLarge, fontWeight: '700', color: theme.colors.text },
  statusText: { fontSize: 11, color: theme.colors.success, fontWeight: '600' },
  callButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: theme.colors.border },
  warningBanner: { backgroundColor: '#FEF3C7', borderBottomWidth: 1, borderBottomColor: '#FCD34D', flexDirection: 'row', alignItems: 'center', padding: theme.spacing.sm, gap: 6 },
  warningText: { fontSize: 11, color: '#92400E', fontWeight: '600', flex: 1 },
  messagesList: { padding: theme.spacing.lg, gap: theme.spacing.md },
  messageRow: { flexDirection: 'row', alignItems: 'flex-end', gap: theme.spacing.sm, maxWidth: '80%' },
  myRow: { alignSelf: 'flex-end' },
  otherRow: { alignSelf: 'flex-start' },
  avatarMini: { width: 34, height: 34, borderRadius: 17, backgroundColor: theme.colors.secondaryLight, justifyContent: 'center', alignItems: 'center' },
  avatarMiniText: { color: theme.colors.secondaryDark, fontWeight: '700', fontSize: 12 },
  bubble: { borderRadius: theme.borderRadius.lg, paddingHorizontal: theme.spacing.md, paddingVertical: 10, ...theme.shadows.sm },
  myBubble: { backgroundColor: theme.colors.primary, borderBottomRightRadius: 2 },
  otherBubble: { backgroundColor: theme.colors.card, borderBottomLeftRadius: 2 },
  messageText: { ...theme.typography.bodyMedium },
  myText: { color: '#fff' },
  otherText: { color: theme.colors.text },
  timeText: { fontSize: 9, alignSelf: 'flex-end', marginTop: 4 },
  myTime: { color: 'rgba(255, 255, 255, 0.7)' },
  otherTime: { color: theme.colors.textMuted },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.card, padding: theme.spacing.md, borderTopWidth: 1, borderTopColor: theme.colors.border, gap: theme.spacing.sm },
  textInput: { flex: 1, backgroundColor: theme.colors.background, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.borderRadius.xl, paddingHorizontal: theme.spacing.md, paddingVertical: 10, maxHeight: 100, color: theme.colors.text, ...theme.typography.bodyMedium },
  sendButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.primary, justifyContent: 'center', alignItems: 'center', ...theme.shadows.sm },
  disabledSend: { backgroundColor: theme.colors.border, shadowOpacity: 0, elevation: 0 },
});
