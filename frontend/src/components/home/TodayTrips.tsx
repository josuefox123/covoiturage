/**
 * TodayTrips — section dynamique connectée à l'API /rides/
 * Affiche les 3 prochains trajets disponibles depuis le backend.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { Ride } from '../../types/ride';
import { getMediaUrl } from '../../utils/media';

const PRIMARY = '#0066FF';

function TripCard({ item, onPress }: { item: Ride; onPress: () => void }) {
  const driver = item.driver_details;
  const avatarUrl = driver?.avatar ? getMediaUrl(driver.avatar) : undefined;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.88}>
      {/* Driver */}
      <View style={styles.driverRow}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarInitial}>
              {driver?.full_name?.charAt(0)?.toUpperCase() || '?'}
            </Text>
          </View>
        )}
        <View style={styles.driverInfo}>
          <Text style={styles.driverName}>{driver?.full_name || 'Conducteur'}</Text>
        </View>
        <View style={styles.priceBadge}>
          <Text style={styles.price}>{(item.price_per_seat ?? 0).toLocaleString()}</Text>
          <Text style={styles.currency}>FCFA</Text>
        </View>
      </View>

      {/* Route */}
      <View style={styles.routeRow}>
        <View style={styles.routeLeft}>
          <View style={styles.dotBlue} />
          <View style={styles.routeLine} />
          <View style={styles.dotGreen} />
        </View>
        <View style={styles.routeDetails}>
          <View style={styles.routePoint}>
            <Text style={styles.routeCity} numberOfLines={1}>{item.departure_location}</Text>
            {item.departure_time ? (
              <Text style={styles.routeTime}>
                {item.departure_time.substring(0, 5)}
              </Text>
            ) : null}
          </View>
          <View style={[styles.routePoint, { marginTop: 14 }]}>
            <Text style={styles.routeCity} numberOfLines={1}>{item.arrival_location}</Text>
            {item.departure_date ? (
              <Text style={styles.routeDate}>
                {new Date(item.departure_date).toLocaleDateString('fr-FR', {
                  day: 'numeric',
                  month: 'short',
                })}
              </Text>
            ) : null}
          </View>
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <View style={styles.seatsBadge}>
          <Ionicons name="person" size={12} color={PRIMARY} />
          <Text style={styles.seatsText}>
            {item.seats_available} place{item.seats_available !== 1 ? 's' : ''}
          </Text>
        </View>
        <TouchableOpacity style={styles.bookBtn} onPress={onPress} activeOpacity={0.85}>
          <Text style={styles.bookBtnText}>Voir</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

interface TodayTripsProps {
  onTripPress: (id: string) => void;
  onSeeAll: () => void;
}

export default function TodayTrips({ onTripPress, onSeeAll }: TodayTripsProps) {
  const { authFetch } = useAuth();
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRides = useCallback(async () => {
    try {
      const data = await authFetch(`/rides/?_t=${Date.now()}`);
      const list: Ride[] = Array.isArray(data) ? data : data?.results || [];
      const now = new Date();
      const available = list
        .filter((r) => {
          if ((r.seats_available ?? 1) <= 0) return false;
          if (r.status === 'completed' || r.status === 'cancelled') return false;
          if (r.status === 'started') return true;
          if (r.departure_date && r.departure_time) {
            const [h, m] = (r.departure_time as string).split(':').map(Number);
            const dep = new Date(r.departure_date);
            dep.setHours(h, m, 0, 0);
            const durationMin = r.duration_min || 240;
            const estimatedArrival = new Date(dep.getTime() + (durationMin + 120) * 60 * 1000);
            if (now > estimatedArrival) return false;
          }
          return true;
        })
        .slice(0, 3); // Show only 3 latest
      setRides(available);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useFocusEffect(
    useCallback(() => {
      fetchRides();
    }, [fetchRides])
  );

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator color={PRIMARY} />
      </View>
    );
  }

  if (rides.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Trajets disponibles</Text>
          <Text style={styles.subtitle}>{rides.length} trajet{rides.length !== 1 ? 's' : ''} prochains</Text>
        </View>
        <TouchableOpacity onPress={onSeeAll} activeOpacity={0.8}>
          <Text style={styles.seeAll}>Voir tout</Text>
        </TouchableOpacity>
      </View>
      {rides.map((trip) => (
        <TripCard key={trip.id} item={trip} onPress={() => onTripPress(trip.id)} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 24 },
  loaderContainer: { padding: 32, alignItems: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  title: { fontSize: 18, fontWeight: '700', color: '#111827', letterSpacing: -0.3 },
  subtitle: { fontSize: 12, color: '#6B7280', marginTop: 2, fontWeight: '500' },
  seeAll: { fontSize: 13, fontWeight: '600', color: PRIMARY, marginTop: 4 },
  card: {
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  avatar: { width: 44, height: 44, borderRadius: 22, marginRight: 10, borderWidth: 2, borderColor: '#EEF3FF' },
  avatarFallback: { backgroundColor: '#EEF3FF', justifyContent: 'center', alignItems: 'center' },
  avatarInitial: { fontSize: 18, fontWeight: '700', color: PRIMARY },
  driverInfo: { flex: 1 },
  driverName: { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 3 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  rating: { fontSize: 12, fontWeight: '600', color: '#374151' },
  priceBadge: { alignItems: 'flex-end' },
  price: { fontSize: 18, fontWeight: '800', color: PRIMARY, lineHeight: 22 },
  currency: { fontSize: 10, fontWeight: '600', color: '#6B7280' },
  routeRow: { flexDirection: 'row', marginBottom: 14 },
  routeLeft: { width: 20, alignItems: 'center', marginRight: 12, paddingTop: 3 },
  dotBlue: { width: 10, height: 10, borderRadius: 5, backgroundColor: PRIMARY },
  routeLine: { width: 2, flex: 1, backgroundColor: '#E5E7EB', marginVertical: 4 },
  dotGreen: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#10B981' },
  routeDetails: { flex: 1, justifyContent: 'space-between' },
  routePoint: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  routeCity: { fontSize: 14, fontWeight: '600', color: '#111827', flex: 1, marginRight: 8 },
  routeTime: { fontSize: 13, fontWeight: '700', color: PRIMARY },
  routeDate: { fontSize: 12, color: '#9CA3AF', fontWeight: '500' },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  seatsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#EEF3FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  seatsText: { fontSize: 11, fontWeight: '600', color: PRIMARY },
  bookBtn: {
    backgroundColor: PRIMARY,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 12,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  bookBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
});
