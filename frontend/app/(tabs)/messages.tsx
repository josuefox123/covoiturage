/**
 * ==============================================================
 * Fichier :
 * messages.tsx
 *
 * Description :
 * Composant ou logique de l'application Zemy.
 *
 * Projet :
 * Zemy
 * ==============================================================
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, TextInput, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { theme } from '../../src/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';
import ConversationCard from '../../src/components/chat/ConversationCard';
import MessageEmptyState from '../../src/components/chat/MessageEmptyState';
import MessageSkeleton from '../../src/components/chat/MessageSkeleton';

const FILTERS = ['Tous', 'Non lus', 'Conducteurs', 'Passagers', 'Actifs', 'Terminés', 'Favoris'];

/**
 * Composant MessagesScreen.
 *
 * Responsabilités :
 * - Affichage et gestion de l'état lié à MessagesScreen.
 */
export default function MessagesScreen() {
  const router = useRouter();
  const authCtx = useAuth();
  const user = authCtx?.user ?? null;
  const authFetch = authCtx?.authFetch ?? (async () => []);
  
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('Tous');

  // Real-time polling
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null);

  const fetchConversations = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      const data = await authFetch('/conversations/');
      let filtered = Array.isArray(data) ? data : (data.results || []);
      // Filter out support conversations
      filtered = filtered.filter((c: any) => c.conversation_type !== 'support');
      
      // Sort by latest message
      filtered.sort((a: any, b: any) => {
        const dateA = a.last_message?.created_at || a.updated_at || a.created_at;
        const dateB = b.last_message?.created_at || b.updated_at || b.created_at;
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      });
      
      setConversations(filtered);
    } catch (error) {
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [authFetch]);

  // Handle Focus & Polling
  useFocusEffect(
    useCallback(() => {
      if (user) {
        fetchConversations();
        // Start polling every 10 seconds for real-time updates without refreshing indicator
        const interval = setInterval(() => {
          fetchConversations(true);
        }, 10000);
        setPollInterval(interval);

        return () => {
          clearInterval(interval);
        };
      }
    }, [user, fetchConversations])
  );

  // Swipe Actions
  const handleArchive = useCallback((id: string) => {
    // Optimistic UI update
    setConversations(prev => prev.filter(c => c.id !== id));
  }, []);

  const handleDelete = useCallback((id: string) => {
    setConversations(prev => prev.filter(c => c.id !== id));
  }, []);

  const handlePin = useCallback((id: string) => {
    // Pin to top locally for now
    setConversations(prev => {
      const idx = prev.findIndex(c => c.id === id);
      if (idx > -1) {
        const item = prev[idx];
        const newArr = [...prev];
        newArr.splice(idx, 1);
        newArr.unshift(item);
        return newArr;
      }
      return prev;
    });
  }, []);

  // Filter & Search Logic
  const filteredConversations = useMemo(() => {
    return conversations.filter(c => {
      // 1. Search Query
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const otherUser = c.participant_1_details?.id === user?.id ? c.participant_2_details : c.participant_1_details;
        const nameMatch = otherUser?.full_name?.toLowerCase().includes(q);
        const msgMatch = c.last_message?.content?.toLowerCase().includes(q);
        const rideMatch = c.ride_details?.departure_location?.toLowerCase().includes(q) || c.ride_details?.arrival_location?.toLowerCase().includes(q);
        
        if (!nameMatch && !msgMatch && !rideMatch) return false;
      }

      // 2. Filters
      switch(activeFilter) {
        case 'Non lus':
          return c.unread_count > 0;
        case 'Conducteurs':
          // Assuming user is passenger for this ride
          return c.ride_details?.driver === c.participant_2_details?.id; // rough logic, adjust based on schema
        case 'Passagers':
          return c.ride_details?.driver === user?.id;
        case 'Actifs':
          return c.ride_details?.status === 'confirmed' || c.ride_details?.status === 'started';
        case 'Terminés':
          return c.ride_details?.status === 'completed';
        default:
          return true; // 'Tous'
      }
    });
  }, [conversations, searchQuery, activeFilter, user]);

  const renderItem = useCallback(({ item }: { item: any }) => (
    <ConversationCard 
      item={item} 
      currentUserId={user?.id || ''} 
      onArchive={handleArchive}
      onDelete={handleDelete}
      onPin={handlePin}
    />
  ), [user, handleArchive, handleDelete, handlePin]);

  const keyExtractor = useCallback((item: any) => item.id.toString(), []);

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
          <Text style={{ color: theme.colors.white, fontWeight: 'bold' }}>Se connecter</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">Discussions</Text>
        
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={theme.colors.textMuted} style={styles.searchIcon} />
          <TextInput 
            style={styles.searchInput}
            placeholder="Rechercher (nom, ville, message)..."
            placeholderTextColor={theme.colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            accessibilityLabel="Rechercher dans les conversations"
            accessibilityHint="Saisissez un nom, une ville ou un mot-clé de message"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={theme.colors.textLight} />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersScroll} contentContainerStyle={styles.filtersContainer}>
          {FILTERS.map(filter => (
            <TouchableOpacity 
              key={filter}
              style={[styles.filterChip, activeFilter === filter && styles.filterChipActive]}
              onPress={() => setActiveFilter(filter)}
            >
              <Text style={[styles.filterText, activeFilter === filter && styles.filterTextActive]}>{filter}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* List */}
      {loading && conversations.length === 0 ? (
        <View style={{ flex: 1, paddingHorizontal: theme.spacing.lg }}>
          <MessageSkeleton />
          <MessageSkeleton />
          <MessageSkeleton />
          <MessageSkeleton />
          <MessageSkeleton />
        </View>
      ) : (
        <FlatList
          data={filteredConversations}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshing={loading && conversations.length > 0}
          onRefresh={() => fetchConversations(false)}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews={true}
          ListEmptyComponent={<MessageEmptyState />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: theme.colors.background 
  },
  header: { 
    paddingHorizontal: theme.spacing.lg, 
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    backgroundColor: theme.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  title: { 
    ...theme.typography.h2, 
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    height: 48,
    marginBottom: theme.spacing.md,
  },
  searchIcon: {
    marginRight: theme.spacing.sm,
  },
  searchInput: {
    flex: 1,
    ...theme.typography.bodyMedium,
    color: theme.colors.text,
    height: '100%',
  },
  filtersScroll: {
    marginBottom: theme.spacing.xs,
  },
  filtersContainer: {
    paddingRight: theme.spacing.xl,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: theme.colors.border,
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: theme.colors.primary,
  },
  filterText: {
    ...theme.typography.bodyMedium,
    color: theme.colors.textLight,
    fontWeight: '500',
  },
  filterTextActive: {
    color: theme.colors.white,
    fontWeight: '700',
  },
  listContent: { 
    paddingBottom: theme.spacing.xl,
    paddingTop: theme.spacing.md,
  },
  separator: { 
    height: 1, 
    backgroundColor: theme.colors.border,
    marginLeft: 88, // Align with content, bypassing avatar
  },
});
