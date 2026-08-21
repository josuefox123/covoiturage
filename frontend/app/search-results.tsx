/**
 * ==============================================================
 * search-results.tsx
 * Page de résultats + panneau de filtres — optimisé mobile.
 * ==============================================================
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  StatusBar,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/context/AuthContext';
import { Ride } from '../src/types/ride';
import RideSearchCard from '../src/components/common/RideSearchCard';

// ─── Composants Extraits ─────────────────────────────────────────────────────
import { PRIMARY } from '../src/features/search/composants/theme-recherche';
import {
  FilterState,
  DEFAULT_FILTERS,
  FiltreModalRecherche
} from '../src/features/search/composants/FiltreModalRecherche';
import { CarteTrajetCorrespondance } from '../src/features/search/composants/CarteTrajetCorrespondance';

const getHour = (t?: string) => (t ? parseInt(t.split(':')[0], 10) : 0);

const matchesSlot = (r: Ride, slots: ('morning' | 'afternoon' | 'evening')[]) => {
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
    departure_latitude?: string;
    departure_longitude?: string;
    arrival_latitude?: string;
    arrival_longitude?: string;
    nearby?: string;
    search_mode?: string;
    latitude?: string;
    longitude?: string;
    radius?: string;
  }>();

  const departure   = raw.departure   || '';
  const destination = raw.destination || '';
  const vehicleType = raw.vehicleType || '';
  const date        = raw.date        || '';
  const passengers  = parseInt(raw.passengers || '1', 10);
  const departure_latitude  = raw.departure_latitude  || '';
  const departure_longitude = raw.departure_longitude || '';
  const arrival_latitude    = raw.arrival_latitude    || '';
  const arrival_longitude   = raw.arrival_longitude   || '';

  const isNearbySearch = raw.nearby === 'true' || raw.search_mode === 'nearby';
  const [radius, setRadius] = useState<number>(parseInt(raw.radius || '20', 10));

  const [rides,      setRides]      = useState<Ride[]>([]);
  const [connections, setConnections] = useState<any[]>([]);
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
      
      if (isNearbySearch) {
        qp.push(`search_mode=nearby`);
        if (raw.latitude) qp.push(`latitude=${raw.latitude}`);
        if (raw.longitude) qp.push(`longitude=${raw.longitude}`);
        qp.push(`radius=${radius}`);
        if (vehicleType && vehicleType !== 'covoiturage') qp.push(`vehicle_type=${encodeURIComponent(vehicleType)}`);
        if (date)        qp.push(`date=${date}`);
        if (passengers > 1) qp.push(`seats=${passengers}`);
      } else {
        if (departure)   qp.push(`departure=${encodeURIComponent(departure)}`);
        if (destination) qp.push(`destination=${encodeURIComponent(destination)}`);
        if (vehicleType && vehicleType !== 'covoiturage') qp.push(`vehicle_type=${encodeURIComponent(vehicleType)}`);
        if (date)        qp.push(`date=${date}`);
        if (passengers > 1) qp.push(`seats=${passengers}`);
        
        if (departure_latitude)  qp.push(`departure_latitude=${departure_latitude}`);
        if (departure_longitude) qp.push(`departure_longitude=${departure_longitude}`);
        if (arrival_latitude)    qp.push(`arrival_latitude=${arrival_latitude}`);
        if (arrival_longitude)   qp.push(`arrival_longitude=${arrival_longitude}`);
      }

      const qs   = qp.length ? `?${qp.join('&')}` : '';
      const data = await authFetch(`/rides/${qs}`);
      
      let list: Ride[] = [];
      let connList: any[] = [];
      
      if (data && typeof data === 'object' && ('directs' in data || 'connections' in data)) {
        list = data.directs || [];
        connList = data.connections || [];
      } else {
        list = Array.isArray(data) ? data : data?.results ?? [];
      }
      
      setConnections(connList);
      
      const now = new Date();
      const valid = list.filter((r) => {
        if ((r.seats_available ?? 0) <= 0) return false;
        if (r.status === 'completed' || r.status === 'cancelled') return false;

        // Si le trajet est 'started', il est toujours disponible pour réservation en cours de route
        if (r.status === 'started') return true;

        if (r.departure_date && r.departure_time) {
          const [h, m] = (r.departure_time as string).split(':').map(Number);
          const dep = new Date(r.departure_date);
          dep.setHours(h, m, 0, 0);

          const durationMin = r.duration_min || 240; // 4h par défaut si non spécifié
          const estimatedArrival = new Date(dep.getTime() + (durationMin + 120) * 60 * 1000);

          // Ne pas masquer si l'heure d'arrivée estimée n'est pas encore dépassée
          if (now > estimatedArrival) return false;
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
  }, [
    isNearbySearch, raw.latitude, raw.longitude, radius,
    departure, destination, vehicleType, date, passengers, authFetch,
    departure_latitude, departure_longitude, arrival_latitude, arrival_longitude
  ]);

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
      default:           list.sort((a, b) => (a.departure_time || '').localeCompare(b.departure_time || '')); break;
    }
    return list;
  }, [rides, selectedVehicle, filters]);

  const [selectedConnection, setSelectedConnection] = useState<any | null>(null);

  // Combinaison des résultats directs et correspondances
  const combinedData = useMemo(() => {
    const list: any[] = displayed.map(d => ({ ...d, cardType: 'direct' }));
    connections.forEach((c, idx) => {
      list.push({
        ...c,
        id: `conn-${idx}`,
        cardType: 'connection'
      });
    });
    return list;
  }, [displayed, connections]);

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
            {isNearbySearch
              ? 'Trajets autour de moi'
              : departure && destination
              ? `${departure} → ${destination}`
              : departure || destination || 'Tous les trajets'}
          </Text>
          <Text style={styles.headerSub} numberOfLines={1}>
            {isNearbySearch
              ? `Rayon : ${radius} km · ${headerSub}`
              : headerSub}
          </Text>
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

      {/* ── Barre de filtrage rapide par Véhicule ── */}
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
 
      {/* ── Sélecteur de rayon pour recherche de proximité ── */}
      {isNearbySearch && (
        <View style={styles.radiusCard}>
          <View style={styles.radiusHeader}>
            <View>
              <Text style={styles.radiusTitle}>Autour de moi</Text>
              <Text style={styles.radiusSubtitle}>Élargissez votre zone de recherche</Text>
            </View>
            <View style={styles.locationBadge}>
              <Ionicons name="navigate" size={14} color="#0066FF" />
              <Text style={styles.locationBadgeText}>GPS</Text>
            </View>
          </View>
          <View style={styles.radiusOptions}>
            {[5, 10, 20, 30, 50].map((value) => {
              const active = radius === value;
              return (
                <TouchableOpacity
                  key={value}
                  style={[
                    styles.radiusOption,
                    active && styles.radiusOptionActive,
                  ]}
                  onPress={() => setRadius(value)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.radiusOptionText,
                      active && styles.radiusOptionTextActive,
                    ]}
                  >
                    {value} km
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

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
          data={combinedData}
          keyExtractor={(item) => String(item.id)}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.listContent,
            combinedData.length === 0 && styles.listEmpty,
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
                {displayed.length} trajet{displayed.length !== 1 ? 's' : ''} direct{displayed.length !== 1 ? 's' : ''}
                {connections.length > 0 ? ` · ${connections.length} correspondance${connections.length !== 1 ? 's' : ''}` : ''}
              </Text>
              {activeCount > 0 && (
                <TouchableOpacity onPress={() => { setFilters(DEFAULT_FILTERS); setSelectedVehicle('all'); }}>
                  <Text style={styles.resetTxt}>Réinitialiser</Text>
                </TouchableOpacity>
              )}
            </View>
          }
          renderItem={({ item, index }) => {
            if (item.cardType === 'connection') {
              return (
                <CarteTrajetCorrespondance
                  item={item}
                  onPress={() => setSelectedConnection(item)}
                />
              );
            }
            return (
              <RideSearchCard
                ride={item}
                onPress={() => router.push({
                  pathname: `/ride/${item.id}`,
                  params: { 
                    departure, 
                    destination,
                    passenger_dep_lat: departure_latitude || '',
                    passenger_dep_lon: departure_longitude || '',
                    passenger_arr_lat: arrival_latitude || '',
                    passenger_arr_lon: arrival_longitude || '',
                    dep_waypoint_order: item.dep_waypoint_order !== undefined ? String(item.dep_waypoint_order) : '',
                    arr_waypoint_order: item.arr_waypoint_order !== undefined ? String(item.arr_waypoint_order) : ''
                  }
                } as any)}
                index={index}
                searchedDeparture={departure}
                searchedDestination={destination}
                searchedSeats={passengers}
              />
            );
          }}
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

      {/* ── Modal de filtre ── */}
      <FiltreModalRecherche
        visible={showFilter}
        filters={filters}
        rides={rides}
        onClose={() => setShowFilter(false)}
        onApply={(f) => { setFilters(f); setShowFilter(false); }}
      />

      {/* ── Modal Détails Correspondance ── */}
      <Modal
        visible={selectedConnection !== null}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setSelectedConnection(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Détails de la correspondance</Text>
              <TouchableOpacity style={styles.modalClose} onPress={() => setSelectedConnection(null)}>
                <Ionicons name="close" size={24} color="#1F2937" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalScroll}>
              <Text style={styles.modalSubtitle}>
                Votre trajet comporte 2 étapes de covoiturage pour relier votre destination.
              </Text>

              {/* Trajet 1 */}
              <View style={styles.modalSection}>
                <View style={styles.modalSectionHeader}>
                  <View style={styles.stepIndicator}><Text style={styles.stepIndicatorTxt}>1</Text></View>
                  <Text style={styles.modalSectionTitle}>Premier Trajet</Text>
                </View>
                <Text style={styles.modalLocation}>{selectedConnection?.ride_1.departure_location.split(',')[0]} ➔ {selectedConnection?.connection_point_name}</Text>
                <Text style={styles.modalTime}>Départ : {selectedConnection?.departure_time_1.substring(0, 5)} | Arrivée : {selectedConnection?.arrival_time_1.substring(0, 5)}</Text>
                <Text style={styles.modalDriver}>Conducteur : {selectedConnection?.ride_1.driver_details?.full_name} ({selectedConnection?.ride_1.vehicle_details?.brand || 'Véhicule'} {selectedConnection?.ride_1.vehicle_details?.model || ''})</Text>
                <TouchableOpacity 
                  style={styles.modalBookBtn}
                  onPress={() => {
                    setSelectedConnection(null);
                    router.push({
                      pathname: `/ride/${selectedConnection?.ride_1.id}`,
                      params: { 
                        departure: departure, 
                        destination: selectedConnection?.connection_point_name 
                      }
                    } as any);
                  }}
                >
                  <Text style={styles.modalBookBtnTxt}>Réserver le Trajet 1 ({selectedConnection?.arrival_leg_1.price.toLocaleString()} FCFA)</Text>
                </TouchableOpacity>
              </View>

              {/* Escale pivot */}
              <View style={styles.modalEscaleInfo}>
                <Ionicons name="walk" size={20} color="#0284C7" />
                <Text style={styles.modalEscaleText}>
                  Escale de <Text style={{fontWeight: '700'}}>{selectedConnection?.waiting_time_min} minutes</Text> à {selectedConnection?.connection_point_name}.
                </Text>
              </View>

              {/* Trajet 2 */}
              <View style={styles.modalSection}>
                <View style={styles.modalSectionHeader}>
                  <View style={styles.stepIndicator}><Text style={styles.stepIndicatorTxt}>2</Text></View>
                  <Text style={styles.modalSectionTitle}>Second Trajet</Text>
                </View>
                <Text style={styles.modalLocation}>{selectedConnection?.connection_point_name} ➔ {selectedConnection?.ride_2.arrival_location.split(',')[0]}</Text>
                <Text style={styles.modalTime}>Départ : {selectedConnection?.departure_time_2.substring(0, 5)} | Arrivée : {selectedConnection?.arrival_time_2.substring(0, 5)}</Text>
                <Text style={styles.modalDriver}>Conducteur : {selectedConnection?.ride_2.driver_details?.full_name} ({selectedConnection?.ride_2.vehicle_details?.brand || 'Véhicule'} {selectedConnection?.ride_2.vehicle_details?.model || ''})</Text>
                <TouchableOpacity 
                  style={styles.modalBookBtn}
                  onPress={() => {
                    setSelectedConnection(null);
                    router.push({
                      pathname: `/ride/${selectedConnection?.ride_2.id}`,
                      params: { 
                        departure: selectedConnection?.connection_point_name, 
                        destination: destination 
                      }
                    } as any);
                  }}
                >
                  <Text style={styles.modalBookBtnTxt}>Réserver le Trajet 2 ({selectedConnection?.arrival_leg_2.price.toLocaleString()} FCFA)</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFF' },
  header: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF',
    paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F0F0F0', gap: 8,
  },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  headerMid: { flex: 1, minWidth: 0 },
  headerTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },
  headerSub:   { fontSize: 11, color: '#6B7280', marginTop: 1, fontWeight: '500' },
  filterBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 11, paddingVertical: 8,
    borderRadius: 18, borderWidth: 1.5, borderColor: PRIMARY
  },
  filterBtnOn:    { backgroundColor: PRIMARY, borderColor: PRIMARY },
  filterBtnTxt:   { fontSize: 12, fontWeight: '700', color: PRIMARY },
  filterBtnTxtOn: { color: '#FFFFFF' },
  vehicleFilterBar: { backgroundColor: '#FFFFFF', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  vehicleFilterScroll: { paddingHorizontal: 16, gap: 8 },
  vehicleChip: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB'
  },
  vehicleChipActive: {
    backgroundColor: PRIMARY, borderColor: PRIMARY, shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 3
  },
  vehicleChipText: { fontSize: 13, fontWeight: '600', color: '#4B5563' },
  vehicleChipTextActive: { color: '#FFFFFF', fontWeight: '700' },
  vehicleCountBadge: { marginLeft: 6, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, backgroundColor: '#E5E7EB' },
  vehicleCountBadgeActive: { backgroundColor: 'rgba(255, 255, 255, 0.3)' },
  vehicleCountText: { fontSize: 11, fontWeight: '700', color: '#4B5563' },
  vehicleCountTextActive: { color: '#FFFFFF' },
  listContent: { padding: 14, paddingBottom: 60 },
  listEmpty:   { flex: 1 },
  listHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  countTxt:  { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  resetTxt:  { fontSize: 13, fontWeight: '600', color: PRIMARY },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 80, paddingHorizontal: 32 },
  loadTxt:  { marginTop: 14, fontSize: 14, color: '#6B7280', fontWeight: '500' },
  emptyH:   { fontSize: 17, fontWeight: '700', color: '#1F2937', marginTop: 14, marginBottom: 6, textAlign: 'center' },
  emptyP:   { fontSize: 13, color: '#6B7280', textAlign: 'center', lineHeight: 19 },
  retryBtn: { marginTop: 18, backgroundColor: PRIMARY, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14 },
  retryTxt: { color: '#fff', fontWeight: '700', fontSize: 14 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.6)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '90%', paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#111827' },
  modalClose: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  modalScroll: { padding: 20 },
  modalSubtitle: { fontSize: 14, color: '#6B7280', marginBottom: 20, lineHeight: 20 },
  modalSection: { backgroundColor: '#F9FAFB', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  modalSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  stepIndicator: { width: 24, height: 24, borderRadius: 12, backgroundColor: PRIMARY, justifyContent: 'center', alignItems: 'center' },
  stepIndicatorTxt: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  modalSectionTitle: { fontSize: 14, fontWeight: '800', color: '#111827' },
  modalLocation: { fontSize: 16, fontWeight: '700', color: '#1F2937', marginBottom: 4 },
  modalTime: { fontSize: 13, fontWeight: '600', color: '#4B5563', marginBottom: 4 },
  modalDriver: { fontSize: 12, color: '#6B7280', marginBottom: 12 },
  modalBookBtn: { backgroundColor: PRIMARY, borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  modalBookBtnTxt: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  modalEscaleText: { fontSize: 13, color: '#0284C7' },
  modalEscaleInfo: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 16, backgroundColor: '#F0F9FF', borderRadius: 12, marginVertical: 12 },
  radiusCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  radiusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  radiusTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  radiusSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  locationBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0066FF',
  },
  radiusOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  radiusOption: {
    flex: 1,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  radiusOptionActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#0066FF',
  },
  radiusOptionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  radiusOptionTextActive: {
    color: '#0066FF',
    fontWeight: '800',
  }
});
