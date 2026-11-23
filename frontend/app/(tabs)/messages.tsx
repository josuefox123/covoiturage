/**
 * ==============================================================
 * Fichier :
 * messages.tsx
 *
 * Description :
 * Page Messages de l'application Zemy — Interface mobile épurée,
 * moderne et fluide inspirée des standards de messagerie actuels.
 *
 * Projet :
 * Zemy
 * ==============================================================
 */
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  TextInput,
  StatusBar,
} from 'react-native';
import { useRouter, useFocusEffect, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';
import ConversationCard from '../../src/components/chat/ConversationCard';
import MessageEmptyState from '../../src/components/chat/MessageEmptyState';
import MessageSkeleton from '../../src/components/chat/MessageSkeleton';

type FilterType = 'Tous' | 'Non lus';

export default function MessagesScreen() {
  const router = useRouter();
  const authCtx = useAuth();
  const user = authCtx?.user ?? null;
  const authFetch = authCtx?.authFetch ?? (async () => []);

  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('Tous');

  const scrollRef = useRef<any>(null);
  const navigation = useNavigation();

  // Récupération des conversations
  const fetchConversations = useCallback(
    async (isSilent = false) => {
      try {
        if (!isSilent) setLoading(true);
        const data = await authFetch('/conversations/');
        let filtered = Array.isArray(data) ? data : data?.results || [];

        // Exclure les conversations de support
        filtered = filtered.filter((c: any) => c.conversation_type !== 'support');

        // Trier par message le plus récent
        filtered.sort((a: any, b: any) => {
          const dateA = a.last_message?.created_at || a.updated_at || a.created_at;
          const dateB = b.last_message?.created_at || b.updated_at || b.created_at;
          return new Date(dateB).getTime() - new Date(dateA).getTime();
        });

        setConversations(filtered);
      } catch (error) {
        // En cas d'erreur réseau, on préserve l'état actuel
      } finally {
        if (!isSilent) setLoading(false);
      }
    },
    [authFetch]
  );

  // Scroll to top sur tap de l'onglet
  useEffect(() => {
    const unsubscribe = navigation.addListener('tabPress' as any, () => {
      scrollRef.current?.scrollToOffset?.({ offset: 0, animated: true });
    });
    return unsubscribe;
  }, [navigation]);

  // Focus & Polling silencieux (toutes les 10 secondes)
  useFocusEffect(
    useCallback(() => {
      scrollRef.current?.scrollToOffset?.({ offset: 0, animated: false });
      if (user) {
        fetchConversations();
        const interval = setInterval(() => {
          fetchConversations(true);
        }, 10000);

        return () => {
          clearInterval(interval);
        };
      }
    }, [user, fetchConversations])
  );

  // Compteur global de messages non lus
  const totalUnread = useMemo(() => {
    return conversations.reduce((acc, c) => acc + (c.unread_count || 0), 0);
  }, [conversations]);

  // Filtrage et recherche
  const filteredConversations = useMemo(() => {
    return conversations.filter((c) => {
      // 1. Filtre Non lus
      if (activeFilter === 'Non lus' && (c.unread_count || 0) <= 0) {
        return false;
      }

      // 2. Recherche textuelle
      if (searchQuery.trim().length > 0) {
        const q = searchQuery.toLowerCase().trim();
        const otherUser =
          c.participant_1_details?.id === user?.id
            ? c.participant_2_details
            : c.participant_1_details;

        const nameMatch = (otherUser?.full_name || '').toLowerCase().includes(q);
        const msgMatch = (c.last_message?.content || '').toLowerCase().includes(q);
        const depMatch = (
          c.booking_details?.departure_location ||
          c.ride_details?.departure_location ||
          ''
        )
          .toLowerCase()
          .includes(q);
        const arrMatch = (
          c.booking_details?.arrival_location ||
          c.ride_details?.arrival_location ||
          ''
        )
          .toLowerCase()
          .includes(q);

        return nameMatch || msgMatch || depMatch || arrMatch;
      }

      return true;
    });
  }, [conversations, searchQuery, activeFilter, user]);

  const renderItem = useCallback(
    ({ item }: { item: any }) => (
      <ConversationCard item={item} currentUserId={user?.id || ''} />
    ),
    [user?.id]
  );

  const keyExtractor = useCallback((item: any) => item.id.toString(), []);

  // État non connecté
  if (!user) {
    return (
      <SafeAreaView style={styles.loggedOutContainer} edges={['top']}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.loggedOutContent}>
          <View style={styles.loggedOutIconWrap}>
            <Ionicons name="chatbubbles-outline" size={44} color="#2563EB" />
          </View>
          <Text style={styles.loggedOutTitle}>Vos messages</Text>
          <Text style={styles.loggedOutSub}>
            Connectez-vous pour échanger avec vos conducteurs et passagers.
          </Text>
          <TouchableOpacity
            style={styles.loginBtn}
            onPress={() => router.push('/(auth)/login')}
            activeOpacity={0.85}
          >
            <Text style={styles.loginBtnText}>Se connecter</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" />

      {/* ── Header épuré ── */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <View style={styles.titleRow}>
            <Text style={styles.headerTitle}>Messages</Text>
            {totalUnread > 0 && (
              <View style={styles.unreadTotalBadge}>
                <Text style={styles.unreadTotalText}>
                  {totalUnread > 99 ? '99+' : totalUnread}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* ── Barre de recherche ── */}
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color="#64748B" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher une discussion..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCorrect={false}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close-circle" size={17} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>

        {/* ── Filtres compacts (Tous / Non lus) ── */}
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterPill, activeFilter === 'Tous' && styles.filterPillActive]}
            onPress={() => setActiveFilter('Tous')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.filterPillText,
                activeFilter === 'Tous' && styles.filterPillTextActive,
              ]}
            >
              Tous ({conversations.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterPill, activeFilter === 'Non lus' && styles.filterPillActive]}
            onPress={() => setActiveFilter('Non lus')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.filterPillText,
                activeFilter === 'Non lus' && styles.filterPillTextActive,
              ]}
            >
              Non lus {totalUnread > 0 ? `(${totalUnread})` : ''}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Liste des conversations ── */}
      {loading && conversations.length === 0 ? (
        <View style={styles.skeletonList}>
          <MessageSkeleton />
          <MessageSkeleton />
          <MessageSkeleton />
          <MessageSkeleton />
          <MessageSkeleton />
        </View>
      ) : (
        <FlatList
          ref={scrollRef}
          data={filteredConversations}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshing={loading && conversations.length > 0}
          onRefresh={() => fetchConversations(false)}
          initialNumToRender={12}
          maxToRenderPerBatch={10}
          windowSize={7}
          removeClippedSubviews={true}
          ListEmptyComponent={
            <MessageEmptyState
              type={
                searchQuery.trim().length > 0
                  ? 'no-search'
                  : activeFilter === 'Non lus'
                  ? 'no-unread'
                  : 'empty'
              }
              searchQuery={searchQuery}
              onResetSearch={() => setSearchQuery('')}
              onResetFilter={() => setActiveFilter('Tous')}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.4,
  },
  unreadTotalBadge: {
    backgroundColor: '#2563EB',
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadTotalText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    height: 40,
    marginBottom: 10,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
    paddingVertical: 0,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  filterPillActive: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  filterPillTextActive: {
    color: '#2563EB',
    fontWeight: '700',
  },
  listContent: {
    paddingBottom: 100,
  },
  separator: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginLeft: 78,
  },
  skeletonList: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loggedOutContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loggedOutContent: {
    alignItems: 'center',
    paddingHorizontal: 32,
    maxWidth: 320,
  },
  loggedOutIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  loggedOutTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
    textAlign: 'center',
  },
  loggedOutSub: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  loginBtn: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 12,
  },
  loginBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
});
