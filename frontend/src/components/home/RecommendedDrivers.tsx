/**
 * RecommendedDrivers — section dynamique connectée à l'API /users/?is_verified=true
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { getMediaUrl } from '../../utils/media';

const PRIMARY = '#0066FF';

interface ApiDriver {
  id: string;
  full_name: string;
  avatar: string | null;
  rating?: number;
  rides_count?: number;
  is_verified?: boolean;
}

function DriverCard({ item }: { item: ApiDriver }) {
  const avatarUrl = item.avatar ? getMediaUrl(item.avatar) : undefined;

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.88}>
      <View style={styles.avatarWrapper}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarInitial}>
              {item.full_name?.charAt(0)?.toUpperCase() || '?'}
            </Text>
          </View>
        )}
        {item.is_verified && (
          <View style={styles.verifiedBadge}>
            <Ionicons name="checkmark-circle" size={16} color={PRIMARY} />
          </View>
        )}
      </View>
      <Text style={styles.name} numberOfLines={1}>
        {item.full_name?.split(' ')[0] || 'Conducteur'}
      </Text>
      {item.rating ? (
        <View style={styles.ratingRow}>
          <Ionicons name="star" size={11} color="#F59E0B" />
          <Text style={styles.rating}>{item.rating.toFixed(1)}</Text>
        </View>
      ) : null}
      {item.rides_count != null ? (
        <Text style={styles.trips}>{item.rides_count} trajet{item.rides_count !== 1 ? 's' : ''}</Text>
      ) : null}
      {item.is_verified && (
        <View style={styles.verifiedTag}>
          <Text style={styles.verifiedText}>Vérifié</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function RecommendedDrivers() {
  const { authFetch } = useAuth();
  const [drivers, setDrivers] = useState<ApiDriver[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDrivers = useCallback(async () => {
    try {
      const data = await authFetch('/users/?is_staff=false&is_verified=true');
      const list: ApiDriver[] = Array.isArray(data) ? data : data?.results || [];
      // Sort by rating desc, take top 6
      const sorted = list
        .filter((u) => u.is_verified)
        .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
        .slice(0, 6);
      setDrivers(sorted);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    fetchDrivers();
  }, [fetchDrivers]);

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator color={PRIMARY} />
      </View>
    );
  }

  if (drivers.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Conducteurs vérifiés</Text>
      </View>
      <FlatList
        data={drivers}
        keyExtractor={(item) => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => <DriverCard item={item} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 24 },
  loaderContainer: { padding: 32, alignItems: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  title: { fontSize: 18, fontWeight: '700', color: '#111827', letterSpacing: -0.3 },
  list: { paddingHorizontal: 20, gap: 12 },
  card: {
    width: 106,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  avatarWrapper: { position: 'relative', marginBottom: 8 },
  avatar: { width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: '#EEF3FF' },
  avatarFallback: { backgroundColor: '#EEF3FF', justifyContent: 'center', alignItems: 'center' },
  avatarInitial: { fontSize: 20, fontWeight: '700', color: PRIMARY },
  verifiedBadge: { position: 'absolute', bottom: -2, right: -2, backgroundColor: '#fff', borderRadius: 10 },
  name: { fontSize: 13, fontWeight: '700', color: '#111827', marginBottom: 4 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 2 },
  rating: { fontSize: 12, fontWeight: '600', color: '#374151' },
  trips: { fontSize: 10, color: '#9CA3AF', fontWeight: '500', marginBottom: 6 },
  verifiedTag: { backgroundColor: '#EEF3FF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  verifiedText: { fontSize: 9, fontWeight: '700', color: PRIMARY, textTransform: 'uppercase', letterSpacing: 0.5 },
});
