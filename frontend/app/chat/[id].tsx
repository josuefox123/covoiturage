import React, { useState, useRef } from 'react';
import { StyleSheet, Text, View, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { theme } from '../../src/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

interface Message {
  id: string;
  text: string;
  sender: 'me' | 'other';
  time: string;
}

const INITIAL_MESSAGES: Record<string, Message[]> = {
  '1': [
    { id: '1', text: 'Bonjour ! Est-ce que le départ est toujours à 07h30 ?', sender: 'me', time: '10:15' },
    { id: '2', text: 'Bonjour, oui tout à fait ! Je serai garé devant la pharmacie de l\'Étoile Rouge.', sender: 'other', time: '10:18' },
    { id: '3', text: 'Super, on se voit à l\'Étoile Rouge à 07h30 précises. Bonne soirée !', sender: 'me', time: '10:24' }
  ],
  '2': [
    { id: '1', text: 'Bonjour Amina, où se trouve le point de rendez-vous exact à Calavi ?', sender: 'me', time: 'Hier' },
    { id: '2', text: 'Bonjour ! Juste devant le grand portail de l\'UAC, côté pavés.', sender: 'other', time: 'Hier' },
    { id: '3', text: 'Pas de souci, j\'ai bien reçu ton numéro.', sender: 'me', time: 'Hier' }
  ],
  '3': [
    { id: '1', text: 'Bonjour Dona, j\'ai deux valises. C\'est d\'accord ?', sender: 'me', time: 'Lundi' },
    { id: '2', text: 'Le coffre est assez grand pour deux grosses valises ?', sender: 'other', time: 'Lundi' }
  ]
};

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const flatListRef = useRef<FlatList>(null);
  
  const partnerName = id === '1' ? 'Chérif G.' : id === '2' ? 'Amina T.' : 'Dona S.';
  const partnerInitials = id === '1' ? 'CG' : id === '2' ? 'AT' : 'DS';

  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES[id || '1'] || INITIAL_MESSAGES['1']);
  const [inputText, setInputText] = useState('');
  const [showWarning, setShowWarning] = useState(false);

  // Phone number regex detection (Benin formats: 8 digits, spaces, hyphens, and international +229)
  const PHONE_REGEX = /(\+229|00229)?\s?\d{2}\s?\d{2}\s?\d{2}\s?\d{2}/g;

  const handleInputChange = (text: string) => {
    setInputText(text);
    // Check for phone numbers
    if (PHONE_REGEX.test(text)) {
      setShowWarning(true);
    } else {
      setShowWarning(false);
    }
  };

  const handleSend = () => {
    if (!inputText.trim()) return;

    // Strict check: if there is a phone number, block or warn
    if (PHONE_REGEX.test(inputText)) {
      AlertMock();
      return;
    }

    const newMessage: Message = {
      id: Date.now().toString(),
      text: inputText.trim(),
      sender: 'me',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, newMessage]);
    setInputText('');
    setShowWarning(false);

    // Auto-scroll to end
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);

    // Simulate reply after 1.5s
    setTimeout(() => {
      const replyMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: 'D\'accord, bien reçu ! 👍',
        sender: 'other',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, replyMessage]);
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }, 1500);
  };

  const AlertMock = () => {
    // Mock popup for anti-number violation
    setShowWarning(true);
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMe = item.sender === 'me';
    return (
      <View style={[styles.messageRow, isMe ? styles.myRow : styles.otherRow]}>
        {!isMe && (
          <View style={styles.avatarMini}>
            <Text style={styles.avatarMiniText}>{partnerInitials}</Text>
          </View>
        )}
        <View style={[styles.bubble, isMe ? styles.myBubble : styles.otherBubble]}>
          <Text style={[styles.messageText, isMe ? styles.myText : styles.otherText]}>{item.text}</Text>
          <Text style={[styles.timeText, isMe ? styles.myTime : styles.otherTime]}>{item.time}</Text>
        </View>
      </View>
    );
  };

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
          keyExtractor={(item) => item.id}
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
  container: {
    flex: 1,
    backgroundColor: '#F1F5F9', // light gray background for messages
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.card,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    ...theme.shadows.sm,
  },
  backButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerUser: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  headerName: {
    ...theme.typography.bodyLarge,
    fontWeight: '700',
    color: theme.colors.text,
  },
  statusText: {
    fontSize: 11,
    color: theme.colors.success,
    fontWeight: '600',
  },
  callButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  warningBanner: {
    backgroundColor: '#FEF3C7',
    borderBottomWidth: 1,
    borderBottomColor: '#FCD34D',
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.sm,
    gap: 6,
  },
  warningText: {
    fontSize: 11,
    color: '#92400E',
    fontWeight: '600',
    flex: 1,
  },
  messagesList: {
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: theme.spacing.sm,
    maxWidth: '80%',
  },
  myRow: {
    alignSelf: 'flex-end',
  },
  otherRow: {
    alignSelf: 'flex-start',
  },
  avatarMini: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: theme.colors.secondaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarMiniText: {
    color: theme.colors.secondaryDark,
    fontWeight: '700',
    fontSize: 12,
  },
  bubble: {
    borderRadius: theme.borderRadius.lg,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
    ...theme.shadows.sm,
  },
  myBubble: {
    backgroundColor: theme.colors.primary,
    borderBottomRightRadius: 2,
  },
  otherBubble: {
    backgroundColor: theme.colors.card,
    borderBottomLeftRadius: 2,
  },
  messageText: {
    ...theme.typography.bodyMedium,
  },
  myText: {
    color: '#fff',
  },
  otherText: {
    color: theme.colors.text,
  },
  timeText: {
    fontSize: 9,
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  myTime: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  otherTime: {
    color: theme.colors.textMuted,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    padding: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    gap: theme.spacing.sm,
  },
  textInput: {
    flex: 1,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.xl,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
    maxHeight: 100,
    color: theme.colors.text,
    ...theme.typography.bodyMedium,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadows.sm,
  },
  disabledSend: {
    backgroundColor: theme.colors.border,
    shadowOpacity: 0,
    elevation: 0,
  },
});
