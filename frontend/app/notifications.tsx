/**
 * ==============================================================
 * Fichier :
 * notifications.tsx
 *
 * Description :
 * Composant ou logique de l'application Zemy.
 *
 * Projet :
 * Zemy
 * ==============================================================
 */
import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, StyleSheet, SectionList, TouchableOpacity, 
  Animated, PanResponder, RefreshControl, Dimensions, Pressable, ScrollView, Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/context/AuthContext';
import { CustomAlert } from '../src/utils/CustomAlert';

const { width } = Dimensions.get('window');

const BBC_COLORS = {
  primary: '#3B82F6',
  success: '#22C55E',
  error: '#EF4444',
  warning: '#F59E0B',
  background: '#F8FAFC',
  card: '#FFFFFF',
  text: '#1E293B',
  textMuted: '#64748B',
  border: '#E2E8F0',
};

const timeAgo = (dateStr: string) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return "À l'instant";
  if (diffMins < 60) return `il y a ${diffMins} min`;
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `il y a ${diffHours} h`;
  
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Hier";
  if (diffDays < 7) return "Cette semaine";
  
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
};

const getNotifStyle = (title: string, message: string) => {
  const text = (title + ' ' + message).toLowerCase();
  if (text.includes('vérifi') || text.includes('compte')) return { icon: 'shield-checkmark', color: BBC_COLORS.success };
  if (text.includes('rejet') || text.includes('échou')) return { icon: 'close-circle', color: BBC_COLORS.error };
  if (text.includes('paiement') || text.includes('payé') || text.includes('fcfa')) return { icon: 'card', color: BBC_COLORS.success };
  if (text.includes('promo') || text.includes('cadeau') || text.includes('réduction')) return { icon: 'gift', color: BBC_COLORS.warning };
  if (text.includes('message') || text.includes('chat')) return { icon: 'chatbubble', color: BBC_COLORS.primary };
  return { icon: 'car-sport', color: BBC_COLORS.primary };
};

const renderMessage = (msg: string) => {
  if (!msg) return null;
  const parts = msg.split(/([a-zA-ZÀ-ÿ-]+\s*→\s*[a-zA-ZÀ-ÿ-]+)/g);
  return parts.map((part, i) => 
    part.includes('→') ? <Text key={i} style={styles.boldText}>{part}</Text> : part
  );
};

const PulsingDot = () => {
  const anim = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.4, duration: 1000, useNativeDriver: true })
      ])
    ).start();
  }, []);
  return <Animated.View style={[styles.pulsingDot, { opacity: anim }]} />;
};

const SwipeableNotification = ({ item, onRead, onDelete }: any) => {
  const pan = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const [readFade] = useState(new Animated.Value(item.is_read ? 0 : 1));

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dy) < 10,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dx > 100) pan.setValue(100);
        else if (gestureState.dx < -100) pan.setValue(-100);
        else pan.setValue(gestureState.dx);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx > 60) {
          // Swipe right -> Read
          Animated.timing(readFade, { toValue: 0, duration: 300, useNativeDriver: true }).start();
          Animated.spring(pan, { toValue: 0, useNativeDriver: true }).start(() => onRead(item.id));
        } else if (gestureState.dx < -60) {
          // Swipe left -> Delete
          Animated.timing(pan, { toValue: -width, duration: 250, useNativeDriver: true }).start(() => onDelete(item.id));
        } else {
          Animated.spring(pan, { toValue: 0, useNativeDriver: true }).start();
        }
      }
    })
  ).current;

  const onPressIn = () => Animated.spring(scale, { toValue: 0.98, useNativeDriver: true }).start();
  const onPressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();

  const handlePress = (openDetail: (item: any) => void) => {
    if (!item.is_read) {
      Animated.timing(readFade, { toValue: 0, duration: 300, useNativeDriver: true }).start();
      onRead(item.id);
    }
    openDetail(item);
  };

  const { icon, color } = getNotifStyle(item.title, item.message);

  return ({ openDetail }: { openDetail: (item: any) => void }) => (
    <View style={styles.swipeContainer}>
      <View style={styles.swipeActions}>
        <View style={styles.actionLeft}>
          <Ionicons name="checkmark-done" size={24} color="#FFF" />
          <Text style={styles.actionText}>Lu</Text>
        </View>
        <View style={styles.actionRight}>
          <Ionicons name="trash" size={24} color="#FFF" />
          <Text style={styles.actionText}>Supprimer</Text>
        </View>
      </View>

      <Animated.View 
        {...panResponder.panHandlers}
        style={[styles.notificationCard, { transform: [{ translateX: pan }, { scale }] }]}
      >
        <Pressable onPressIn={onPressIn} onPressOut={onPressOut} onPress={() => handlePress(openDetail)} style={styles.cardInner}>
          <View style={styles.notifHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Animated.View style={{ opacity: readFade }}>
                <PulsingDot />
              </Animated.View>
              <Text style={styles.dateText}>{timeAgo(item.created_at)}</Text>
            </View>
          </View>
          
          <View style={styles.notifContent}>
            <View style={[styles.iconContainer, { backgroundColor: color + '15' }]}>
              <Ionicons name={icon as any} size={24} color={color} />
            </View>
            <View style={styles.textContainer}>
              <Text style={styles.titleText} numberOfLines={1}>{item.title}</Text>
              <Text style={styles.messageText} numberOfLines={3}>
                {renderMessage(item.message)}
              </Text>
            </View>
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
};

const SkeletonLoader = () => (
  <View style={styles.skeletonContainer}>
    {[1, 2, 3, 4].map(i => (
      <View key={i} style={styles.skeletonCard}>
        <View style={styles.skeletonIcon} />
        <View style={styles.skeletonTextContainer}>
          <View style={styles.skeletonTitle} />
          <View style={styles.skeletonLine} />
          <View style={styles.skeletonLineShort} />
        </View>
      </View>
    ))}
  </View>
);

/**
 * Composant NotificationsScreen.
 *
 * Responsabilités :
 * - Affichage et gestion de l'état lié à NotificationsScreen.
 */
export default function NotificationsScreen() {
  const router = useRouter();
  const { authFetch, user } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('Toutes');
  const [page, setPage] = useState(1);
  const [selectedNotif, setSelectedNotif] = useState<any | null>(null);
  const detailSlide = useRef(new Animated.Value(600)).current;

  const filters = ['Toutes', 'Non lues', 'Trajets', 'Paiements', 'Compte', 'Promotions'];

  const openDetail = (item: any) => {
    setSelectedNotif(item);
    Animated.spring(detailSlide, { toValue: 0, useNativeDriver: true, friction: 8 }).start();
  };

  const closeDetail = () => {
    Animated.timing(detailSlide, { toValue: 700, duration: 280, useNativeDriver: true }).start(() => setSelectedNotif(null));
  };

  const loadNotifications = async (isRefresh = false) => {
    if (!user) return;
    try {
      if (!isRefresh && page === 1) setLoading(true);
      if (!isRefresh && page === -1) return; // No more pages
      
      const data = await authFetch(`/notifications/?page=${isRefresh ? 1 : page}`);
      const results = data.results || data || [];
      const hasNext = !!data.next;
      
      if (isRefresh) {
        setNotifications(results);
        setPage(hasNext ? 2 : -1);
      } else {
        setNotifications(prev => {
          // Filter duplicates
          const newItems = results.filter((r: any) => !prev.some((p: any) => p.id === r.id));
          return [...prev, ...newItems];
        });
        setPage(hasNext ? page + 1 : -1);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
      CustomAlert.alert('Erreur', 'Impossible de charger vos notifications.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadNotifications(true);
  };

  const markAsRead = async (id?: number) => {
    try {
      if (id) {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
        await authFetch(`/notifications/${id}/read/`, { method: 'POST' });
      } else {
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        await authFetch('/notifications/mark-read/', { method: 'POST' });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const deleteNotif = async (id: number) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    try {
      await authFetch(`/notifications/${id}/`, { method: 'DELETE' });
    } catch (e) {
      console.error(e);
    }
  };

  const filteredData = notifications.filter(n => {
    if (filter === 'Non lues') return !n.is_read;
    if (filter === 'Trajets') return n.title.toLowerCase().includes('trajet') || n.title.toLowerCase().includes('réservation');
    if (filter === 'Paiements') return n.title.toLowerCase().includes('paiement') || n.title.toLowerCase().includes('fcfa');
    if (filter === 'Compte') return n.title.toLowerCase().includes('compte') || n.title.toLowerCase().includes('vérifi');
    if (filter === 'Promotions') return n.title.toLowerCase().includes('promo') || n.title.toLowerCase().includes('cadeau');
    return true;
  });

  const groupNotificationsData = (notifs: any[]) => {
    const groups: { [key: string]: any[] } = { "Aujourd'hui": [], "Hier": [], "Cette semaine": [], "Plus ancien": [] };
    const now = new Date();
    
    notifs.forEach(n => {
      const d = new Date(n.created_at);
      const diffTime = Math.abs(now.getTime() - d.getTime());
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 0 && now.getDate() === d.getDate()) groups["Aujourd'hui"].push(n);
      else if (diffDays === 1 || (diffDays === 0 && now.getDate() !== d.getDate())) groups["Hier"].push(n);
      else if (diffDays < 7) groups["Cette semaine"].push(n);
      else groups["Plus ancien"].push(n);
    });

    return Object.keys(groups).filter(k => groups[k].length > 0).map(k => ({ title: k, data: groups[k] }));
  };

  const sections = groupNotificationsData(filteredData);
  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header Moderne */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.8}>
            <Ionicons name="arrow-back" size={24} color={BBC_COLORS.text} />
          </TouchableOpacity>
          <View style={styles.headerRight}>
            <TouchableOpacity onPress={() => markAsRead()} style={styles.readAllBtn}>
              <Text style={styles.readAllText}>Tout lire</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.settingsBtn}>
              <Ionicons name="settings-outline" size={22} color={BBC_COLORS.text} />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.headerTitleRow}>
          <Text style={styles.headerTitle}>Notifications</Text>
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>
        <Text style={styles.headerSubtitle}>Restez informé de toutes les activités</Text>
      </View>

      {/* Filtres Horizontaux */}
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {filters.map(f => (
            <TouchableOpacity 
              key={f} 
              style={[styles.filterChip, filter === f && styles.filterChipActive]}
              onPress={() => setFilter(f)}
              activeOpacity={0.7}
            >
              <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading && page === 1 ? (
        <SkeletonLoader />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item, index) => (item.id ? item.id.toString() : index.toString())}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BBC_COLORS.primary} />}
          onEndReached={() => loadNotifications()}
          onEndReachedThreshold={0.5}
          contentContainerStyle={styles.listContent}
          renderSectionHeader={({ section: { title } }) => (
            <Text style={styles.sectionHeader}>{title}</Text>
          )}
          renderItem={({ item }) => {
            const Component = SwipeableNotification({ item, onRead: markAsRead, onDelete: deleteNotif });
            return <Component openDetail={openDetail} />;
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="notifications-outline" size={48} color={BBC_COLORS.primary} />
                <View style={styles.emptyBadge} />
              </View>
              <Text style={styles.emptyTitle}>Aucune notification</Text>
              <Text style={styles.emptyText}>Les nouvelles notifications</Text>
              <Text style={styles.emptyText}>apparaîtront ici.</Text>
            </View>
          }
        />
      )}

      {/* Notification Detail Modal */}
      <Modal visible={selectedNotif !== null} animationType="none" transparent statusBarTranslucent>
        <View style={styles.detailOverlay}>
          <Animated.View style={[styles.detailSheet, { transform: [{ translateY: detailSlide }] }]}>
            {/* Header */}
            <View style={styles.detailHeader}>
              <TouchableOpacity onPress={closeDetail} style={styles.detailBackBtn} activeOpacity={0.7}>
                <Ionicons name="arrow-back" size={22} color={BBC_COLORS.text} />
              </TouchableOpacity>
              <Text style={styles.detailHeaderTitle} numberOfLines={1}>{selectedNotif?.title}</Text>
              <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.detailContent} showsVerticalScrollIndicator={false}>
              {/* Icon + Color banner */}
              {selectedNotif && (() => {
                const { icon, color } = getNotifStyle(selectedNotif.title, selectedNotif.message);
                return (
                  <View style={[styles.detailIconBanner, { backgroundColor: color + '18' }]}>
                    <View style={[styles.detailIconCircle, { backgroundColor: color + '30' }]}>
                      <Ionicons name={icon as any} size={40} color={color} />
                    </View>
                    <Text style={[styles.detailBannerLabel, { color }]}>Notification</Text>
                  </View>
                );
              })()}

              <Text style={styles.detailTitle}>{selectedNotif?.title}</Text>
              <Text style={styles.detailDate}>{selectedNotif ? timeAgo(selectedNotif.created_at) : ''}</Text>

              <View style={styles.detailDivider} />

              <Text style={styles.detailMessage}>{selectedNotif?.message}</Text>
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BBC_COLORS.background },
  header: {
    paddingHorizontal: 20, paddingTop: 10, paddingBottom: 20,
    backgroundColor: BBC_COLORS.background,
  },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-start' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  readAllBtn: { paddingVertical: 6, paddingHorizontal: 12, backgroundColor: BBC_COLORS.primary + '15', borderRadius: 20 },
  readAllText: { color: BBC_COLORS.primary, fontWeight: '700', fontSize: 13 },
  settingsBtn: { padding: 4 },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  headerTitle: { fontSize: 32, fontWeight: '800', color: BBC_COLORS.text, letterSpacing: -0.5 },
  badge: { backgroundColor: BBC_COLORS.error, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  badgeText: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },
  headerSubtitle: { fontSize: 15, color: BBC_COLORS.textMuted, fontWeight: '500' },
  
  filterContainer: { borderBottomWidth: 1, borderBottomColor: BBC_COLORS.border, paddingBottom: 12 },
  filterScroll: { paddingHorizontal: 20, gap: 10 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: BBC_COLORS.card, borderWidth: 1, borderColor: BBC_COLORS.border },
  filterChipActive: { backgroundColor: BBC_COLORS.primary, borderColor: BBC_COLORS.primary },
  filterText: { fontSize: 14, fontWeight: '600', color: BBC_COLORS.textMuted },
  filterTextActive: { color: '#FFF' },

  listContent: { padding: 20, paddingBottom: 100 },
  sectionHeader: { fontSize: 16, fontWeight: '700', color: BBC_COLORS.text, marginTop: 10, marginBottom: 16, marginLeft: 4 },
  
  swipeContainer: { position: 'relative', marginBottom: 16 },
  swipeActions: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: BBC_COLORS.background, borderRadius: 20, paddingHorizontal: 24,
  },
  actionLeft: { alignItems: 'flex-start', justifyContent: 'center', width: '50%', height: '100%', backgroundColor: BBC_COLORS.success, borderRadius: 20, paddingLeft: 24, marginLeft: -10 },
  actionRight: { alignItems: 'flex-end', justifyContent: 'center', width: '50%', height: '100%', backgroundColor: BBC_COLORS.error, borderRadius: 20, paddingRight: 24, marginRight: -10 },
  actionText: { color: '#FFF', fontWeight: 'bold', fontSize: 12, marginTop: 4 },

  notificationCard: {
    backgroundColor: BBC_COLORS.card, borderRadius: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.08, shadowRadius: 20, elevation: 5,
  },
  cardInner: { padding: 18 },
  notifHeaderRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 8 },
  pulsingDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: BBC_COLORS.primary, marginRight: 8 },
  dateText: { fontSize: 12, color: BBC_COLORS.textMuted, fontWeight: '600' },
  notifContent: { flexDirection: 'row', alignItems: 'flex-start' },
  iconContainer: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  textContainer: { flex: 1, justifyContent: 'center' },
  titleText: { fontSize: 16, fontWeight: '700', color: BBC_COLORS.text, marginBottom: 4 },
  messageText: { fontSize: 14, color: BBC_COLORS.textMuted, lineHeight: 20 },
  boldText: { fontWeight: '700', color: BBC_COLORS.text },

  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 60 },
  emptyIconCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: BBC_COLORS.primary + '10', justifyContent: 'center', alignItems: 'center', marginBottom: 24, position: 'relative' },
  emptyBadge: { position: 'absolute', top: 25, right: 28, width: 14, height: 14, borderRadius: 7, backgroundColor: BBC_COLORS.error, borderWidth: 2, borderColor: BBC_COLORS.card },
  emptyTitle: { fontSize: 20, fontWeight: 'bold', color: BBC_COLORS.text, marginBottom: 8 },
  emptyText: { fontSize: 15, color: BBC_COLORS.textMuted, textAlign: 'center', lineHeight: 22 },

  skeletonContainer: { padding: 20, gap: 16 },
  skeletonCard: { flexDirection: 'row', backgroundColor: BBC_COLORS.card, padding: 18, borderRadius: 20, opacity: 0.5 },
  skeletonIcon: { width: 50, height: 50, borderRadius: 25, backgroundColor: BBC_COLORS.border, marginRight: 16 },
  skeletonTextContainer: { flex: 1, justifyContent: 'center' },
  skeletonTitle: { width: '60%', height: 16, backgroundColor: BBC_COLORS.border, borderRadius: 8, marginBottom: 12 },
  skeletonLine: { width: '100%', height: 12, backgroundColor: BBC_COLORS.border, borderRadius: 6, marginBottom: 8 },
  skeletonLineShort: { width: '80%', height: 12, backgroundColor: BBC_COLORS.border, borderRadius: 6 },

  // Detail Modal
  detailOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end',
  },
  detailSheet: {
    backgroundColor: BBC_COLORS.card, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    maxHeight: '90%', minHeight: '60%',
    shadowColor: '#000', shadowOffset: { width: 0, height: -6 }, shadowOpacity: 0.12, shadowRadius: 20, elevation: 20,
  },
  detailHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: BBC_COLORS.border,
  },
  detailBackBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: BBC_COLORS.background,
    justifyContent: 'center', alignItems: 'center',
  },
  detailHeaderTitle: { fontSize: 16, fontWeight: '700', color: BBC_COLORS.text, flex: 1, textAlign: 'center', marginHorizontal: 8 },
  detailContent: { padding: 24, paddingBottom: 48 },
  detailIconBanner: {
    alignItems: 'center', justifyContent: 'center', paddingVertical: 28, borderRadius: 20, marginBottom: 24,
  },
  detailIconCircle: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  detailBannerLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  detailTitle: { fontSize: 22, fontWeight: '800', color: BBC_COLORS.text, marginBottom: 6, letterSpacing: -0.3 },
  detailDate: { fontSize: 13, color: BBC_COLORS.textMuted, fontWeight: '500', marginBottom: 16 },
  detailDivider: { height: 1, backgroundColor: BBC_COLORS.border, marginBottom: 20 },
  detailMessage: { fontSize: 16, color: BBC_COLORS.text, lineHeight: 26, fontWeight: '400' },
});
