import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { theme } from '../../src/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';

export default function MessagesScreen() {
  const router = useRouter();
  const authCtx = useAuth();
  const user = authCtx?.user ?? null;
  const authFetch = authCtx?.authFetch ?? (async () => []);
  
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchConversations();
    }
  }, [user]);

  const fetchConversations = async () => {
    try {
      setLoading(true);
      const data = await authFetch('/conversations/');
      setConversations(data);
    } catch (error) {
      console.log('Erreur fetchConversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }: { item: any }) => {
    // Determine the other participant
    const otherUser = item.participant_1_details?.id === user?.id 
      ? item.participant_2_details 
      : item.participant_1_details;
    
    const userName = otherUser?.full_name || 'Utilisateur';
    const userAvatar = userName.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();
    const lastMsgContent = item.last_message?.content || 'Nouvelle conversation';
    const isUnread = item.last_message && !item.last_message.is_read && item.last_message.sender_details?.id !== user?.id;

    return (
      <TouchableOpacity
        style={styles.chatCard}
        onPress={() => router.push(`/chat/${item.id}`)}
        activeOpacity={0.7}
      >
        <View style={styles.avatarContainer}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{userAvatar}</Text>
          </View>
          {isUnread && <View style={styles.activeIndicator} />}
        </View>

        <View style={styles.chatDetails}>
          <View style={styles.chatHeader}>
            <Text style={styles.userName}>{userName}</Text>
          </View>
          
          <Text style={styles.lastMessage} numberOfLines={1}>
            {lastMsgContent}
          </Text>
        </View>

        <View style={styles.rightActions}>
          {isUnread ? (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>1</Text>
            </View>
          ) : (
            <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (!user) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: theme.spacing.xl }]}>
        <Ionicons name="chatbubbles-outline" size={80} color={theme.colors.textMuted} />
        <Text style={{ ...theme.typography.h3, marginTop: 16, marginBottom: 8, textAlign: 'center' }}>Vos messages</Text>
        <Text style={{ ...theme.typography.bodyMedium, color: theme.colors.textLight, textAlign: 'center', marginBottom: 24 }}>Connectez-vous pour échanger avec les conducteurs et passagers.</Text>
        <TouchableOpacity 
          style={{ backgroundColor: theme.colors.primary, paddingHorizontal: 32, paddingVertical: 14, borderRadius: theme.borderRadius.lg }}
          onPress={() => router.push('/(auth)/login')}
        >
          <Text style={{ color: '#fff', fontWeight: 'bold' }}>Se connecter</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Discussions 💬</Text>
        <Text style={styles.subtitle}>Échangez avec vos conducteurs et passagers.</Text>
      </View>

      <FlatList
        data={conversations}
        renderItem={renderItem}
        keyExtractor={(item) => item.id.toString()}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        refreshing={loading}
        onRefresh={fetchConversations}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubble-ellipses-outline" size={48} color={theme.colors.textMuted} />
              <Text style={styles.emptyTitle}>Aucune discussion</Text>
              <Text style={styles.emptySubtitle}>Vos conversations apparaîtront ici lorsque vous réserverez ou publierez un trajet.</Text>
            </View>
          ) : (
            <ActivityIndicator size="large" color={theme.colors.primary} style={{marginTop: 50}} />
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: { paddingHorizontal: theme.spacing.lg, marginVertical: theme.spacing.lg },
  title: { ...theme.typography.h2, color: theme.colors.text },
  subtitle: { ...theme.typography.bodyLarge, color: theme.colors.textLight, marginTop: 4 },
  listContent: { paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xl },
  chatCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.card, borderRadius: theme.borderRadius.lg, padding: theme.spacing.md, ...theme.shadows.sm },
  avatarContainer: { position: 'relative', marginRight: theme.spacing.md },
  avatarCircle: { width: 50, height: 50, borderRadius: 25, backgroundColor: theme.colors.secondaryLight, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: theme.colors.secondaryDark, fontWeight: '700', fontSize: 16 },
  activeIndicator: { position: 'absolute', bottom: 2, right: 2, width: 14, height: 14, borderRadius: 7, backgroundColor: theme.colors.success, borderWidth: 2, borderColor: '#fff' },
  chatDetails: { flex: 1 },
  chatHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  userName: { ...theme.typography.bodyLarge, fontWeight: '600', color: theme.colors.text },
  lastMessage: { ...theme.typography.bodyMedium, color: theme.colors.textLight, marginTop: 4 },
  rightActions: { marginLeft: theme.spacing.sm, justifyContent: 'center', alignItems: 'center' },
  unreadBadge: { backgroundColor: theme.colors.primary, width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  unreadText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  separator: { height: theme.spacing.md },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 80, paddingHorizontal: theme.spacing.xl },
  emptyTitle: { ...theme.typography.h3, color: theme.colors.text, marginTop: theme.spacing.md, marginBottom: theme.spacing.xs },
  emptySubtitle: { ...theme.typography.bodyMedium, color: theme.colors.textMuted, textAlign: 'center' },
});
