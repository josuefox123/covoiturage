/**
 * ==============================================================
 * search-results.tsx
 * Page de résultats + panneau de filtres — optimisé mobile.
 * ==============================================================
 */
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  ScrollView,
  Animated,
  Platform,
  Dimensions,
  StatusBar,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/context/AuthContext';
import { Ride } from '../src/types/ride';
import RideSearchCard from '../src/components/common/RideSearchCard';

const PRIMARY = '#0066FF';
const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// ─── Types ────────────────────────────────────────────────────────────────────
type SortOption = 'earliest' | 'price_asc' | 'price_desc' | 'rating';
type TimeSlot   = 'morning' | 'afternoon' | 'evening';

interface FilterState {
  sort: SortOption;
  timeSlots: TimeSlot[];
  verifiedOnly: boolean;
  minSeats: number;
}

const DEFAULT_FILTERS: FilterState = {
  sort: 'earliest',
  timeSlots: [],
  verifiedOnly: false,
  minSeats: 1,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const getHour = (t?: string) => (t ? parseInt(t.split(':')[0], 10) : 0);

const matchesSlot = (r: Ride, slots: TimeSlot[]) => {
  if (!slots.length) return true;
  const h = getHour(r.departure_time);
  return slots.some((s) =>
    s === 'morning' ? h >= 6 && h < 12
    : s === 'afternoon' ? h >= 12 && h < 18
    : h >= 18
  );
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

// ─── Filter Modal ─────────────────────────────────────────────────────────────

const SORT_OPTIONS: { id: SortOption; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'earliest',   label: 'Départ le plus tôt', icon: 'time-outline' },
  { id: 'price_asc',  label: 'Prix le plus bas',    icon: 'trending-down-outline' },
  { id: 'price_desc', label: 'Prix le plus élevé',  icon: 'trending-up-outline' },
  { id: 'rating',     label: 'Meilleure note',       icon: 'star-outline' },
];

const TIME_SLOTS: { id: TimeSlot; range: string; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'morning',   range: '06:00 – 12:00', label: 'Matin',      icon: 'sunny-outline' },
  { id: 'afternoon', range: '12:01 – 18:00', label: 'Après-midi', icon: 'partly-sunny-outline' },
  { id: 'evening',   range: 'Après 18:00',   label: 'Soirée',     icon: 'moon-outline' },
];

interface FilterModalProps {
  visible: boolean;
  filters: FilterState;
  rides: Ride[];
  onClose: () => void;
  onApply: (f: FilterState) => void;
}

function FilterModal({ visible, filters, rides, onClose, onApply }: FilterModalProps) {
  const insets = useSafeAreaInsets();
  const [local, setLocal] = useState<FilterState>(filters);
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  useEffect(() => {
    if (visible) {
      setLocal(filters);
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 260,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const toggleSlot = (s: TimeSlot) =>
    setLocal((p) => ({
      ...p,
      timeSlots: p.timeSlots.includes(s)
        ? p.timeSlots.filter((x) => x !== s)
        : [...p.timeSlots, s],
    }));

  const countSlot = (s: TimeSlot) => rides.filter((r) => matchesSlot(r, [s])).length;

  /* ── render ── */
  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType="none"
      onRequestClose={onClose}
    >
      {/* Dim backdrop */}
      <TouchableOpacity
        style={StyleSheet.absoluteFillObject}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={fm.backdrop} />
      </TouchableOpacity>

      {/* Sheet */}
      <Animated.View
        style={[
          fm.sheet,
          {
            paddingBottom: insets.bottom + 12,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        {/* Drag handle */}
        <View style={fm.handle} />

        {/* Title bar */}
        <View style={fm.titleBar}>
          <TouchableOpacity onPress={onClose} style={fm.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={20} color="#374151" />
          </TouchableOpacity>
          <Text style={fm.titleTxt}>Filtrer</Text>
          <TouchableOpacity onPress={() => setLocal(DEFAULT_FILTERS)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={fm.clearTxt}>Tout effacer</Text>
          </TouchableOpacity>
        </View>

        {/* Scrollable content */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          bounces={false}
          contentContainerStyle={fm.scrollContent}
        >

          {/* ── Trier par ── */}
          <Text style={fm.sectionHead}>Trier par</Text>
          {SORT_OPTIONS.map((o) => (
            <TouchableOpacity
              key={o.id}
              style={fm.row}
              onPress={() => setLocal((p) => ({ ...p, sort: o.id }))}
              activeOpacity={0.75}
            >
              <View style={fm.rowLeft}>
                <View style={[fm.radio, local.sort === o.id && fm.radioOn]}>
                  {local.sort === o.id && <View style={fm.radioDot} />}
                </View>
                <Text style={fm.rowLabel}>{o.label}</Text>
              </View>
              <View style={[fm.iconBox, local.sort === o.id && fm.iconBoxOn]}>
                <Ionicons name={o.icon} size={16} color={local.sort === o.id ? PRIMARY : '#9CA3AF'} />
              </View>
            </TouchableOpacity>
          ))}

          <View style={fm.sep} />

          {/* ── Heure de départ ── */}
          <Text style={fm.sectionHead}>Heure de départ</Text>
          {TIME_SLOTS.map((s) => {
            const on = local.timeSlots.includes(s.id);
            return (
              <TouchableOpacity
                key={s.id}
                style={fm.row}
                onPress={() => toggleSlot(s.id)}
                activeOpacity={0.75}
              >
                <View style={fm.rowLeft}>
                  <View style={[fm.checkbox, on && fm.checkboxOn]}>
                    {on && <Ionicons name="checkmark" size={13} color="#fff" />}
                  </View>
                  <View>
                    <Text style={fm.rowLabel}>{s.range}</Text>
                    <Text style={fm.rowSub}>{s.label}</Text>
                  </View>
                </View>
                <View style={fm.slotRight}>
                  <View style={[fm.iconBox, on && fm.iconBoxOn]}>
                    <Ionicons name={s.icon} size={16} color={on ? PRIMARY : '#9CA3AF'} />
                  </View>
                  <Text style={fm.countTxt}>{countSlot(s.id)}</Text>
                </View>
              </TouchableOpacity>
            );
          })}

          <View style={fm.sep} />

          {/* ── Confiance & sécurité ── */}
          <Text style={fm.sectionHead}>Confiance et sécurité</Text>
          <TouchableOpacity
            style={fm.row}
            onPress={() => setLocal((p) => ({ ...p, verifiedOnly: !p.verifiedOnly }))}
            activeOpacity={0.75}
          >
            <View style={fm.rowLeft}>
              <View style={[fm.checkbox, local.verifiedOnly && fm.checkboxOn]}>
                {local.verifiedOnly && <Ionicons name="checkmark" size={13} color="#fff" />}
              </View>
              <Text style={fm.rowLabel}>Profil Vérifié</Text>
            </View>
            <Ionicons name="shield-checkmark" size={20} color={PRIMARY} />
          </TouchableOpacity>

          <View style={fm.sep} />

          {/* ── Places minimum ── */}
          <Text style={fm.sectionHead}>Places disponibles minimum</Text>
          <View style={fm.chipsRow}>
            {[1, 2, 3, 4, 5].map((n) => {
              const on = local.minSeats === n;
              return (
                <TouchableOpacity
                  key={n}
                  style={[fm.chip, on && fm.chipOn]}
                  onPress={() => setLocal((p) => ({ ...p, minSeats: n }))}
                  activeOpacity={0.8}
                >
                  <Text style={[fm.chipTxt, on && fm.chipTxtOn]}>{n}+</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Bottom padding so last item isn't behind footer */}
          <View style={{ height: 24 }} />
        </ScrollView>

        {/* Sticky footer */}
        <View style={fm.footer}>
          <TouchableOpacity
            style={fm.applyBtn}
            onPress={() => onApply(local)}
            activeOpacity={0.9}
          >
            <Text style={fm.applyTxt}>Voir les trajets</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function SearchResultsScreen() {
  const router = useRouter();
  const { authFetch } = useAuth();
  const raw = useLocalSearchParams<{
    departure: string;
    destination: string;
    vehicleType: string;
    date: string;
    tripType: string;
    passengers: string;
  }>();

  const departure   = raw.departure   || '';
  const destination = raw.destination || '';
  const vehicleType = raw.vehicleType || '';
  const date        = raw.date        || '';
  const passengers  = parseInt(raw.passengers || '1', 10);

  const [rides,      setRides]      = useState<Ride[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [filters,    setFilters]    = useState<FilterState>(DEFAULT_FILTERS);
  const [showFilter, setShowFilter] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<string>(
    vehicleType && ['voiture', 'moto', 'tricycle'].includes(vehicleType.toLowerCase())
      ? vehicleType.toLowerCase()
      : 'all'
  );

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchRides = useCallback(async () => {
    try {
      setError(null);
      const qp: string[] = [];
      if (departure)   qp.push(`departure=${encodeURIComponent(departure)}`);
      if (destination) qp.push(`destination=${encodeURIComponent(destination)}`);
      if (vehicleType && vehicleType !== 'covoiturage') qp.push(`vehicle_type=${encodeURIComponent(vehicleType)}`);
      if (date)        qp.push(`date=${date}`);
      if (passengers > 1) qp.push(`seats=${passengers}`);

      const qs   = qp.length ? `?${qp.join('&')}` : '';
      const data = await authFetch(`/rides/${qs}`);
      const list: Ride[] = Array.isArray(data) ? data : data?.results ?? [];

      const now   = new Date();
      const valid = list.filter((r) => {
        if ((r.seats_available ?? 1) < passengers) return false;
        if (r.departure_date && r.departure_time) {
          const [h, m] = (r.departure_time as string).split(':').map(Number);
          const dep = new Date(r.departure_date);
          dep.setHours(h, m, 0, 0);
          if (dep < now) return false;
        }
        return true;
      });
      setRides(valid);
    } catch (e: any) {
      setError(e?.message || 'Erreur réseau');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [departure, destination, vehicleType, date, passengers, authFetch]);

  useEffect(() => { fetchRides(); }, [fetchRides]);

  // ── Filter + sort (client-side) ───────────────────────────────────────────
  const displayed = useMemo(() => {
    let list = [...rides];

    // Filtrage par type de véhicule (Voiture, Moto, Tricycle)
    if (selectedVehicle !== 'all') {
      list = list.filter((r) => {
        const vt = (r.driver_details?.vehicles?.[0]?.vehicle_type || (r as any).vehicle_type || 'voiture').toLowerCase();
        return vt === selectedVehicle;
      });
    }

    if (filters.timeSlots.length)  list = list.filter((r) => matchesSlot(r, filters.timeSlots));
    if (filters.verifiedOnly)       list = list.filter((r) => r.driver_details?.is_verified);
    if (filters.minSeats > 1)       list = list.filter((r) => (r.seats_available ?? 0) >= filters.minSeats);

    switch (filters.sort) {
      case 'price_asc':  list.sort((a, b) => (a.price_per_seat ?? 0) - (b.price_per_seat ?? 0)); break;
      case 'price_desc': list.sort((a, b) => (b.price_per_seat ?? 0) - (a.price_per_seat ?? 0)); break;
      case 'rating':     list.sort((a, b) => (b.driver_details?.rating ?? 0) - (a.driver_details?.rating ?? 0)); break;
      default:           list.sort((a, b) => (a.departure_time || '').localeCompare(b.departure_time || '')); break;
    }
    return list;
  }, [rides, selectedVehicle, filters]);

  const activeCount = useMemo(() => {
    let c = 0;
    if (selectedVehicle !== 'all')        c++;
    if (filters.sort !== 'earliest')     c++;
    if (filters.timeSlots.length)         c++;
    if (filters.verifiedOnly)             c++;
    if (filters.minSeats > 1)             c++;
    return c;
  }, [selectedVehicle, filters]);

  const headerSub = [
    date ? fmtDate(date) : "Aujourd'hui",
    `${passengers} passager${passengers > 1 ? 's' : ''}`,
    vehicleType ? vehicleType.charAt(0).toUpperCase() + vehicleType.slice(1) : '',
  ].filter(Boolean).join(' · ');

  const VEHICLE_CAT_FILTERS = [
    { id: 'all', label: 'Tous', icon: 'grid-outline' },
    { id: 'voiture', label: 'Voiture', icon: 'car-outline' },
    { id: 'moto', label: 'Moto', icon: 'bicycle-outline' },
    { id: 'tricycle', label: 'Tricycle', icon: 'car-sport-outline' },
  ];

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>

        <View style={styles.headerMid}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {departure && destination
              ? `${departure} → ${destination}`
              : departure || destination || 'Tous les trajets'}
          </Text>
          <Text style={styles.headerSub} numberOfLines={1}>{headerSub}</Text>
        </View>

        <TouchableOpacity
          style={[styles.filterBtn, activeCount > 0 && styles.filterBtnOn]}
          onPress={() => setShowFilter(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="options-outline" size={17} color={activeCount > 0 ? '#fff' : PRIMARY} />
          <Text style={[styles.filterBtnTxt, activeCount > 0 && styles.filterBtnTxtOn]}>
            Filtrer{activeCount > 0 ? ` · ${activeCount}` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Barre de filtrage rapide par Véhicule (Voiture, Moto, Tricycle) ── */}
      <View style={styles.vehicleFilterBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.vehicleFilterScroll}
        >
          {VEHICLE_CAT_FILTERS.map((cat) => {
            const isActive = selectedVehicle === cat.id;
            const count = cat.id === 'all'
              ? rides.length
              : rides.filter((r) => {
                  const vt = (r.driver_details?.vehicles?.[0]?.vehicle_type || (r as any).vehicle_type || 'voiture').toLowerCase();
                  return vt === cat.id;
                }).length;

            return (
              <TouchableOpacity
                key={cat.id}
                style={[styles.vehicleChip, isActive && styles.vehicleChipActive]}
                onPress={() => setSelectedVehicle(cat.id)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={cat.icon as any}
                  size={15}
                  color={isActive ? '#FFFFFF' : '#4B5563'}
                  style={{ marginRight: 6 }}
                />
                <Text style={[styles.vehicleChipText, isActive && styles.vehicleChipTextActive]}>
                  {cat.label}
                </Text>
                <View style={[styles.vehicleCountBadge, isActive && styles.vehicleCountBadgeActive]}>
                  <Text style={[styles.vehicleCountText, isActive && styles.vehicleCountTextActive]}>
                    {count}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── Body ── */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={PRIMARY} />
          <Text style={styles.loadTxt}>Recherche en cours…</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={54} color="#D1D5DB" />
          <Text style={styles.emptyH}>Erreur de connexion</Text>
          <Text style={styles.emptyP}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchRides}>
            <Text style={styles.retryTxt}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={displayed}
          keyExtractor={(item) => String(item.id)}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.listContent,
            displayed.length === 0 && styles.listEmpty,
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchRides(); }}
              tintColor={PRIMARY}
              colors={[PRIMARY]}
            />
          }
          ListHeaderComponent={
            <View style={styles.listHeader}>
              <Text style={styles.countTxt}>
                {displayed.length} trajet{displayed.length !== 1 ? 's' : ''}
              </Text>
              {activeCount > 0 && (
                <TouchableOpacity onPress={() => { setFilters(DEFAULT_FILTERS); setSelectedVehicle('all'); }}>
                  <Text style={styles.resetTxt}>Réinitialiser</Text>
                </TouchableOpacity>
              )}
            </View>
          }
          renderItem={({ item, index }) => (
            <RideSearchCard
              ride={item}
              onPress={() => router.push(`/ride/${item.id}` as any)}
              index={index}
            />
          )}
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="car-outline" size={64} color="#D1D5DB" />
              <Text style={styles.emptyH}>Aucun trajet trouvé</Text>
              <Text style={styles.emptyP}>
                {activeCount > 0
                  ? 'Essayez de réinitialiser vos filtres.'
                  : 'Aucun trajet disponible pour le moment.'}
              </Text>
              {activeCount > 0 && (
                <TouchableOpacity style={styles.retryBtn} onPress={() => setFilters(DEFAULT_FILTERS)}>
                  <Text style={styles.retryTxt}>Réinitialiser les filtres</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}

      {/* ── Filter Modal ── */}
      <FilterModal
        visible={showFilter}
        filters={filters}
        rides={rides}
        onClose={() => setShowFilter(false)}
        onApply={(f) => { setFilters(f); setShowFilter(false); }}
      />
    </SafeAreaView>
  );
}

// ─── Styles: main screen ──────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFF' },

  /* header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    gap: 8,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center', alignItems: 'center',
  },
  headerMid: { flex: 1, minWidth: 0 },
  headerTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },
  headerSub:   { fontSize: 11, color: '#6B7280', marginTop: 1, fontWeight: '500' },
  filterBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 11, paddingVertical: 8,
    borderRadius: 18, borderWidth: 1.5, borderColor: PRIMARY,
  },
  filterBtnOn:    { backgroundColor: PRIMARY, borderColor: PRIMARY },
  filterBtnTxt:   { fontSize: 12, fontWeight: '700', color: PRIMARY },
  filterBtnTxtOn: { color: '#FFFFFF' },

  /* vehicle filter bar */
  vehicleFilterBar: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  vehicleFilterScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  vehicleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  vehicleChipActive: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  vehicleChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
  },
  vehicleChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  vehicleCountBadge: {
    marginLeft: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: '#E5E7EB',
  },
  vehicleCountBadgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  vehicleCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4B5563',
  },
  vehicleCountTextActive: {
    color: '#FFFFFF',
  },

  /* list */
  listContent: { padding: 14, paddingBottom: 60 },
  listEmpty:   { flex: 1 },
  listHeader:  {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 10,
  },
  countTxt:  { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  resetTxt:  { fontSize: 13, fontWeight: '600', color: PRIMARY },

  /* states */
  center: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    paddingVertical: 80, paddingHorizontal: 32,
  },
  loadTxt:  { marginTop: 14, fontSize: 14, color: '#6B7280', fontWeight: '500' },
  emptyH:   { fontSize: 17, fontWeight: '700', color: '#1F2937', marginTop: 14, marginBottom: 6, textAlign: 'center' },
  emptyP:   { fontSize: 13, color: '#6B7280', textAlign: 'center', lineHeight: 19 },
  retryBtn: { marginTop: 18, backgroundColor: PRIMARY, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14 },
  retryTxt: { color: '#fff', fontWeight: '700', fontSize: 14 },
});

// ─── Styles: filter modal ─────────────────────────────────────────────────────
const fm = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.50)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    // Max height = 88% of screen so it never overflows
    maxHeight: SCREEN_HEIGHT * 0.88,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 24,
  },

  /* drag handle */
  handle: {
    alignSelf: 'center',
    width: 40, height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    marginTop: 10,
    marginBottom: 4,
  },

  /* title bar */
  titleBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  closeBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center', alignItems: 'center',
  },
  titleTxt:  { fontSize: 17, fontWeight: '800', color: '#111827' },
  clearTxt:  { fontSize: 13, fontWeight: '600', color: PRIMARY },

  /* scroll */
  scrollContent: { paddingHorizontal: 18, paddingTop: 6, paddingBottom: 100 },

  /* section */
  sectionHead: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
    marginTop: 18,
    marginBottom: 4,
  },

  /* row */
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
  },
  rowLeft:  { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  rowLabel: { fontSize: 15, fontWeight: '500', color: '#1F2937' },
  rowSub:   { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  rowIcon: { fontSize: 18 },
  iconBox: {
    width: 30, height: 30, borderRadius: 8,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center', alignItems: 'center',
  },
  iconBoxOn: { backgroundColor: '#EEF3FF' },
  slotRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  countTxt: { fontSize: 13, fontWeight: '700', color: '#9CA3AF', minWidth: 20, textAlign: 'right' },

  /* radio */
  radio: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: '#D1D5DB',
    justifyContent: 'center', alignItems: 'center',
  },
  radioOn:  { borderColor: PRIMARY },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: PRIMARY },

  /* checkbox */
  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 2, borderColor: '#D1D5DB',
    justifyContent: 'center', alignItems: 'center',
  },
  checkboxOn: { backgroundColor: PRIMARY, borderColor: PRIMARY },

  /* separator */
  sep: { height: 1, backgroundColor: '#F3F4F6', marginTop: 16 },

  /* seat chips */
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingVertical: 12 },
  chip: {
    paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: 50, borderWidth: 1.5, borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  chipOn:    { backgroundColor: PRIMARY, borderColor: PRIMARY },
  chipTxt:   { fontSize: 14, fontWeight: '700', color: '#6B7280' },
  chipTxtOn: { color: '#FFFFFF' },

  /* sticky footer */
  footer: {
    paddingHorizontal: 18,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  applyBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 18,
    paddingVertical: 15,
    alignItems: 'center',
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  applyTxt: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
});
