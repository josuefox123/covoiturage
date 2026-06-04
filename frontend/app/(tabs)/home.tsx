import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  Animated,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { theme } from '../../src/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';
import { ScrollView, Modal } from 'react-native';
import LocationPicker from '../../src/components/LocationPicker';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

interface Ride {
  id: string;
  driver_details: {
    full_name: string;
    avatar: string | null;
    rating: number;
  };
  departure_location: string;
  arrival_location: string;
  departure_time: string;
  departure_date: string;
  price_per_seat: number;
  seats_available: number;
}

const ADS_DATA = [
  { id: '1', title: '50% sur votre 1er trajet !', subtitle: 'Offre exclusive de bienvenue', color1: theme.colors.success, color2: '#059669', icon: 'ticket-outline' },
  { id: '2', title: 'Devenez chauffeur', subtitle: 'Gagnez plus avec vos trajets quotidiens', color1: theme.colors.primary, color2: theme.colors.primaryDark, icon: 'car-outline' },
  { id: '3', title: 'Parrainez un ami', subtitle: 'Recevez 2000 FCFA pour chaque ami invité', color1: theme.colors.warning, color2: '#D97706', icon: 'gift-outline' },
];

const QUICK_ACTIONS = [
  { icon: 'car-outline', label: 'Publier', color: theme.colors.primary },
  { icon: 'calendar-outline', label: 'Réserver', color: theme.colors.success },
  { icon: 'chatbubbles-outline', label: 'Messages', color: theme.colors.primary },
  { icon: 'person-outline', label: 'Profil', color: '#8B5CF6' },
];

const RECENT_SEARCHES = [
  'Cotonou → Porto-Novo',
  'Cotonou → Parakou',
  'Porto-Novo → Cotonou',
];

// Composant séparé pour chaque carte de trajet
const RideCard = React.memo(({ item, index, onPress }: { item: Ride; index: number; onPress: () => void }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      delay: index * 50,
      useNativeDriver: true,
    }).start();
  }, []);

  const driverName = item.driver_details?.full_name || 'Inconnu';
  const avatarInitials = driverName.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();
  const price = item.price_per_seat?.toLocaleString() || '0';

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }}>
      <TouchableOpacity
        style={styles.rideCard}
        onPress={onPress}
        activeOpacity={0.9}
      >
        <LinearGradient
          colors={['#FFFFFF', '#F8FAFC']}
          style={styles.rideCardGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.cardHeader}>
            <View style={styles.driverInfo}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarText}>{avatarInitials}</Text>
              </View>
              <View>
                <Text style={styles.driverName}>{driverName}</Text>
                <View style={styles.ratingRow}>
                  <Ionicons name="star" size={14} color={theme.colors.warning} />
                  <Text style={styles.ratingText}>{item.driver_details?.rating || 4.5}</Text>
                </View>
              </View>
            </View>
            <View style={styles.priceContainer}>
              <Text style={styles.priceText}>{price} FCFA</Text>
              <Text style={styles.priceUnit}>/place</Text>
            </View>
          </View>

          <View style={styles.routeContainer}>
            <View style={styles.timelineContainer}>
              <View style={styles.timelineDotStart} />
              <View style={styles.timelineLine} />
              <View style={styles.timelineDotEnd} />
            </View>
            <View style={styles.routeDetails}>
              <View style={styles.routePoint}>
                <Text style={styles.locationText} numberOfLines={1}>
                  {item.departure_location || 'Lieu de départ'}
                </Text>
                <Text style={styles.timeText}>
                  {item.departure_time ? item.departure_time.substring(0, 5) : '--:--'}
                </Text>
              </View>
              <View style={styles.routePoint}>
                <Text style={styles.locationText} numberOfLines={1}>
                  {item.arrival_location || "Lieu d'arrivée"}
                </Text>
                <Text style={styles.dateText}>
                  {item.departure_date || 'Date non définie'}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.cardFooter}>
            <View style={styles.seatsBadge}>
              <Ionicons name="people-outline" size={14} color={theme.colors.primary} />
              <Text style={styles.seatsText}>{item.seats_available || 0} places</Text>
            </View>
            <View style={styles.detailsBtn}>
              <Text style={styles.detailsBtnText}>Voir détails</Text>
              <Ionicons name="arrow-forward" size={14} color={theme.colors.primary} />
            </View>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
});

// Composant pour les actions rapides
const QuickActions = React.memo(() => (
  <View style={styles.quickActionsContainer}>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickActionsScroll}>
    </ScrollView>
  </View>
));

// Composant pour l'historique de recherche
const SearchHistory = React.memo(({ onSelect }: { onSelect: (search: string) => void }) => (
  <View style={styles.searchHistory}>
    <Text style={styles.searchHistoryTitle}>Recherches récentes</Text>
    {RECENT_SEARCHES.map((search, index) => (
      <TouchableOpacity key={index} style={styles.historyItem} onPress={() => onSelect(search)}>
        <Ionicons name="time-outline" size={16} color={theme.colors.textLight} />
        <Text style={styles.historyText}>{search}</Text>
        <Ionicons name="close-outline" size={16} color={theme.colors.textLight} />
      </TouchableOpacity>
    ))}
  </View>
));

export default function HomeScreen() {
  const router = useRouter();
  const authCtx = useAuth();
  const user = authCtx?.user ?? null;
  const authFetch = authCtx?.authFetch ?? (async () => []);

  const [departure, setDeparture] = useState('');
  const [destination, setDestination] = useState('');
  const [pickingLocationFor, setPickingLocationFor] = useState<'departure' | 'arrival' | null>(null);
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('Tous');
  const [showSearchHistory, setShowSearchHistory] = useState(false);

  const scrollY = useRef(new Animated.Value(0)).current;
  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [1, 0.9],
    extrapolate: 'clamp',
  });
  const headerScale = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [1, 0.95],
    extrapolate: 'clamp',
  });

  useEffect(() => {
    fetchRides();
  }, []);

  const fetchRides = async () => {
    try {
      setLoading(true);
      const data = await authFetch('/rides/');
      setRides(data);
    } catch (error) {
      console.log('Erreur fetchRides:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchRides();
    setRefreshing(false);
  };

  const handleRecentSearch = (search: string) => {
    const [dep, dest] = search.split(' → ');
    setDeparture(dep || '');
    setDestination(dest || '');
    setShowSearchHistory(false);
  };

  const handleRidePress = useCallback((rideId: string) => {
    router.push(`/ride/${rideId}`);
  }, [router]);

  const renderRideItem = useCallback(({ item, index }: { item: Ride; index: number }) => (
    <RideCard item={item} index={index} onPress={() => handleRidePress(item.id)} />
  ), [handleRidePress]);

  const filteredRides = useMemo(() => {
    let filtered = rides;

    if (departure && destination) {
      filtered = filtered.filter(r =>
        r.departure_location?.toLowerCase().includes(departure.toLowerCase()) &&
        r.arrival_location?.toLowerCase().includes(destination.toLowerCase())
      );
    } else if (departure) {
      filtered = filtered.filter(r => r.departure_location?.toLowerCase().includes(departure.toLowerCase()));
    } else if (destination) {
      filtered = filtered.filter(r => r.arrival_location?.toLowerCase().includes(destination.toLowerCase()));
    }

    if (selectedFilter === 'Prix le plus bas') {
      filtered = [...filtered].sort((a, b) => (a.price_per_seat || 0) - (b.price_per_seat || 0));
    } else if (selectedFilter === 'Départ plus proche') {
      filtered = [...filtered].sort((a, b) => {
        const dateA = a.departure_date ? new Date(a.departure_date).getTime() : 0;
        const dateB = b.departure_date ? new Date(b.departure_date).getTime() : 0;
        return dateA - dateB;
      });
    }

    return filtered;
  }, [rides, departure, destination, selectedFilter]);

  const filters = ['Tous', 'Prix le plus bas', 'Départ plus proche', 'Note maximale'];

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.headerBackground, { opacity: headerOpacity }]}>
        <LinearGradient colors={[theme.colors.primary, theme.colors.primaryDark]} style={StyleSheet.absoluteFillObject}>
          <View style={styles.headerPattern}>
            {[...Array(20)].map((_, i) => (
              <View key={i} style={[styles.patternDot, { left: (i * 40) % width, top: (i * 30) % 200 }]} />
            ))}
          </View>
        </LinearGradient>
      </Animated.View>

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <Animated.FlatList
          data={filteredRides}
          renderItem={renderRideItem}
          keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} colors={[theme.colors.primary]} />
          }
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
          scrollEventThrottle={16}
          ListEmptyComponent={
            !loading ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="car-outline" size={64} color={theme.colors.border} />
                <Text style={styles.emptyTitle}>Aucun trajet trouvé</Text>
                <Text style={styles.emptyText}>Essayez de modifier vos critères de recherche</Text>
                <TouchableOpacity style={styles.emptyButton} onPress={() => router.push('/(auth)/become-driver')}>
                  <Text style={styles.emptyButtonText}>Devenir chauffeur</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <ActivityIndicator size="large" color={theme.colors.primary} style={styles.loader} />
            )
          }
          ListHeaderComponent={
            <>
              <Animated.View style={[styles.header, { transform: [{ scale: headerScale }] }]}>
                <View>
                  <Text style={styles.greeting}>Bonjour 👋</Text>
                  <Text style={styles.title}>{user?.full_name || 'Cher voyageur'}</Text>
                </View>
                <TouchableOpacity style={styles.profileBtn} onPress={() => router.push('/(tabs)/profile')}>
                  {user?.avatar ? (
                    <Image source={{ uri: user.avatar }} style={styles.profileAvatar} />
                  ) : (
                    <View style={styles.profileDefault}>
                      <Ionicons name="person-outline" size={24} color={theme.colors.primary} />
                    </View>
                  )}
                </TouchableOpacity>
              </Animated.View>

              <View style={styles.searchCard}>
                <View style={styles.searchRow}>
                  <View style={styles.searchIconDeparture}>
                    <Ionicons name="location" size={20} color={theme.colors.primary} />
                  </View>
                  <TouchableOpacity style={styles.searchInputBtn} onPress={() => setPickingLocationFor('departure')}>
                    <Text style={!departure ? styles.searchPlaceholder : styles.searchText}>
                      {departure || 'Où partez-vous ?'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.searchDivider}>
                  <View style={styles.searchDividerLine} />
                  <TouchableOpacity style={styles.swapBtn} onPress={() => {
                    const temp = departure;
                    setDeparture(destination);
                    setDestination(temp);
                  }}>
                    <Ionicons name="swap-vertical" size={14} color={theme.colors.white} />
                  </TouchableOpacity>
                </View>

                <View style={styles.searchRow}>
                  <View style={styles.searchIconArrival}>
                    <Ionicons name="navigate" size={20} color={theme.colors.secondary} />
                  </View>
                  <TouchableOpacity style={styles.searchInputBtn} onPress={() => setPickingLocationFor('arrival')}>
                    <Text style={!destination ? styles.searchPlaceholder : styles.searchText}>
                      {destination || 'Où allez-vous ?'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity style={styles.searchButton} onPress={() => fetchRides()}>
                  <LinearGradient colors={[theme.colors.primary, theme.colors.primaryDark]} style={styles.searchButtonGradient}>
                    <Ionicons name="search-outline" size={20} color={theme.colors.white} />
                    <Text style={styles.searchButtonText}>Rechercher</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>

              {(departure || destination) && (
                <View style={styles.activeFilters}>
                  {departure ? (
                    <View style={styles.filterChip}>
                      <Text style={styles.filterChipText}>Départ: {departure}</Text>
                      <TouchableOpacity onPress={() => setDeparture('')}>
                        <Ionicons name="close-circle" size={16} color={theme.colors.primary} />
                      </TouchableOpacity>
                    </View>
                  ) : null}
                  {destination ? (
                    <View style={styles.filterChip}>
                      <Text style={styles.filterChipText}>Arrivée: {destination}</Text>
                      <TouchableOpacity onPress={() => setDestination('')}>
                        <Ionicons name="close-circle" size={16} color={theme.colors.primary} />
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </View>
              )}

              {showSearchHistory ? <SearchHistory onSelect={handleRecentSearch} /> : null}

              <QuickActions />

              <View style={styles.carouselContainer}>
                <FlatList
                  horizontal
                  data={ADS_DATA}
                  keyExtractor={(item) => item.id}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: theme.spacing.lg, gap: 12 }}
                  snapToInterval={280 + 12}
                  decelerationRate="fast"
                  renderItem={({ item }) => (
                    <TouchableOpacity activeOpacity={0.9}>
                      <LinearGradient
                        colors={[item.color1, item.color2]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.adCard}
                      >
                        <View style={styles.adContent}>
                          <Text style={styles.adTitle}>{item.title}</Text>
                          <Text style={styles.adSubtitle}>{item.subtitle}</Text>
                        </View>
                        <Ionicons name={item.icon as any} size={48} color="rgba(255,255,255,0.2)" style={styles.adIcon} />
                      </LinearGradient>
                    </TouchableOpacity>
                  )}
                />
              </View>

              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Trajets disponibles</Text>
                <Text style={styles.sectionCount}>{filteredRides.length} trajets</Text>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersScroll}>
                {filters.map((filter) => (
                  <TouchableOpacity
                    key={filter}
                    style={[styles.filterPill, selectedFilter === filter && styles.filterPillActive]}
                    onPress={() => setSelectedFilter(filter)}
                  >
                    <Text style={[styles.filterPillText, selectedFilter === filter && styles.filterPillTextActive]}>
                      {filter}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          }
        />
      </SafeAreaView>

      <Modal visible={pickingLocationFor !== null} animationType="slide">
        <LocationPicker
          title={pickingLocationFor === 'departure' ? 'Lieu de départ' : "Lieu d'arrivée"}
          onLocationSelected={(loc) => {
            if (pickingLocationFor === 'departure') setDeparture(loc.name);
            else setDestination(loc.name);
            setPickingLocationFor(null);
          }}
          onCancel={() => setPickingLocationFor(null)}
        />
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  headerBackground: { position: 'absolute', top: 0, left: 0, right: 0, height: 280, overflow: 'hidden' },
  headerPattern: { flex: 1, opacity: 0.1 },
  patternDot: { position: 'absolute', width: 4, height: 4, borderRadius: 2, backgroundColor: theme.colors.white },
  safeArea: { flex: 1 },
  listContent: { paddingBottom: theme.spacing.xl },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: theme.spacing.lg, marginTop: 10, marginBottom: theme.spacing.lg },
  greeting: { fontSize: 14, color: 'rgba(255,255,255,0.8)', fontWeight: '500' },
  title: { fontSize: 22, fontWeight: '800', color: theme.colors.white, marginTop: 2 },
  profileBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: theme.colors.white, justifyContent: 'center', alignItems: 'center', shadowColor: theme.colors.black, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4, overflow: 'hidden' },
  profileAvatar: { width: 48, height: 48, borderRadius: 24 },
  profileDefault: { width: 48, height: 48, borderRadius: 24, backgroundColor: theme.colors.white, justifyContent: 'center', alignItems: 'center' },
  searchCard: { backgroundColor: theme.colors.white, borderRadius: 24, padding: theme.spacing.md, marginHorizontal: theme.spacing.lg, marginBottom: theme.spacing.md, shadowColor: theme.colors.black, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 5 },
  searchRow: { flexDirection: 'row', alignItems: 'center' },
  searchIconDeparture: { width: 36, height: 36, borderRadius: 18, backgroundColor: `${theme.colors.primary}15`, justifyContent: 'center', alignItems: 'center' },
  searchIconArrival: { width: 36, height: 36, borderRadius: 18, backgroundColor: `${theme.colors.secondary}15`, justifyContent: 'center', alignItems: 'center' },
  searchInputBtn: { flex: 1, marginLeft: theme.spacing.md, paddingVertical: 12 },
  searchText: { fontSize: 15, color: theme.colors.text, fontWeight: '600' },
  searchPlaceholder: { fontSize: 15, color: theme.colors.textMuted },
  searchDivider: { flexDirection: 'row', alignItems: 'center', marginVertical: 4, marginLeft: 16, position: 'relative' },
  searchDividerLine: { width: 2, height: 20, backgroundColor: theme.colors.border },
  swapBtn: { position: 'absolute', left: 20, top: -8, width: 28, height: 28, borderRadius: 14, backgroundColor: theme.colors.primary, justifyContent: 'center', alignItems: 'center', shadowColor: theme.colors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 3 },
  searchButton: { marginTop: theme.spacing.md },
  searchButtonGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 12 },
  searchButtonText: { color: theme.colors.white, fontSize: 15, fontWeight: '700' },
  activeFilters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: theme.spacing.lg, marginBottom: theme.spacing.md },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: `${theme.colors.primary}10`, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  filterChipText: { fontSize: 13, color: theme.colors.primary, fontWeight: '500' },
  searchHistory: { backgroundColor: theme.colors.white, marginHorizontal: theme.spacing.lg, marginBottom: theme.spacing.md, borderRadius: 16, padding: theme.spacing.md, shadowColor: theme.colors.black, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  searchHistoryTitle: { fontSize: 14, fontWeight: '600', color: theme.colors.text, marginBottom: 12 },
  historyItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  historyText: { flex: 1, fontSize: 14, color: theme.colors.textLight },
  quickActionsContainer: { marginBottom: theme.spacing.xl, paddingHorizontal: theme.spacing.lg },
  quickActionsScroll: { gap: 16 },
  quickAction: { alignItems: 'center', gap: 8 },
  quickActionIcon: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  quickActionLabel: { fontSize: 12, color: theme.colors.textLight, fontWeight: '500' },
  carouselContainer: { marginBottom: theme.spacing.xl },
  adCard: { width: 280, height: 110, borderRadius: 16, padding: theme.spacing.md, justifyContent: 'center', position: 'relative', overflow: 'hidden', marginRight: 12 },
  adContent: { zIndex: 2 },
  adTitle: { fontSize: 16, fontWeight: '800', color: theme.colors.white, marginBottom: 4 },
  adSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.85)' },
  adIcon: { position: 'absolute', right: -10, bottom: -10, zIndex: 1, transform: [{ rotate: '-15deg' }] },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: theme.spacing.lg, marginBottom: theme.spacing.md },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: theme.colors.text },
  sectionCount: { fontSize: 13, color: theme.colors.textLight, fontWeight: '500' },
  filtersScroll: { paddingHorizontal: theme.spacing.lg, gap: 10, marginBottom: theme.spacing.md },
  filterPill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: theme.colors.white, borderWidth: 1, borderColor: theme.colors.border },
  filterPillActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  filterPillText: { fontSize: 13, color: theme.colors.textLight, fontWeight: '600' },
  filterPillTextActive: { color: theme.colors.white },
  rideCard: { marginHorizontal: theme.spacing.lg, marginBottom: theme.spacing.md },
  rideCardGradient: { borderRadius: 20, padding: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.border },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.md },
  driverInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.primaryLight, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: theme.colors.primary, fontWeight: '700', fontSize: 16 },
  driverName: { fontSize: 15, fontWeight: '700', color: theme.colors.text },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  ratingText: { fontSize: 12, color: theme.colors.textLight },
  priceContainer: { alignItems: 'flex-end' },
  priceText: { fontSize: 18, fontWeight: '800', color: theme.colors.primary },
  priceUnit: { fontSize: 10, color: theme.colors.textLight },
  routeContainer: { flexDirection: 'row', marginBottom: theme.spacing.md },
  timelineContainer: { alignItems: 'center', width: 20, marginRight: 12 },
  timelineDotStart: { width: 10, height: 10, borderRadius: 5, backgroundColor: theme.colors.primary },
  timelineDotEnd: { width: 10, height: 10, borderRadius: 5, backgroundColor: theme.colors.secondary },
  timelineLine: { width: 2, flex: 1, backgroundColor: theme.colors.border, marginVertical: 4 },
  routeDetails: { flex: 1, gap: 16 },
  routePoint: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  locationText: { fontSize: 14, fontWeight: '500', color: theme.colors.text, flex: 1 },
  timeText: { fontSize: 13, color: theme.colors.textLight, fontWeight: '600' },
  dateText: { fontSize: 13, color: theme.colors.textLight },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: theme.spacing.md, borderTopWidth: 1, borderTopColor: theme.colors.border },
  seatsBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: `${theme.colors.primary}10`, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  seatsText: { fontSize: 12, color: theme.colors.primary, fontWeight: '600' },
  detailsBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  detailsBtnText: { fontSize: 13, color: theme.colors.primary, fontWeight: '700' },
  emptyContainer: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: theme.spacing.xl },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: theme.colors.text, marginTop: 16, marginBottom: 8 },
  emptyText: { fontSize: 14, color: theme.colors.textLight, textAlign: 'center', marginBottom: 24 },
  emptyButton: { backgroundColor: theme.colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  emptyButtonText: { color: theme.colors.white, fontWeight: '700' },
  loader: { marginTop: 40 },
});