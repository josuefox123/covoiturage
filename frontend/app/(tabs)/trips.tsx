import React, { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../src/styles/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';
import { useTrips } from '../../src/hooks/useTrips';
import { CustomAlert } from '../../src/utils/CustomAlert';
import { MissionCard } from '../../src/features/trip-mission/MissionCard';
import { MissionResolver } from '../../src/features/trip-mission/MissionResolver';
import { rideSessionManager } from '../../src/features/ride-session/manager/RideSessionManager';

export default function TripsScreen() {
  const router = useRouter();
  const { user, authFetch } = useAuth();
  const { fetchPassengerBookings, fetchDriverRides } = useTrips();
  
  const [roleTab, setRoleTab] = useState<'passenger' | 'driver'>('passenger');
  const [missionFilter, setMissionFilter] = useState<'upcoming' | 'live' | 'completed'>('upcoming');
  
  const [passengerTrips, setPassengerTrips] = useState<any[]>([]);
  const [driverTrips, setDriverTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchTrips();
    }, [user, fetchPassengerBookings, fetchDriverRides])
  );

  const fetchTrips = async (isRefreshing = false) => {
    if (!user) {
      setLoading(false);
      return;
    }
    
    if (isRefreshing) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      const [bookings, rides] = await Promise.all([
        fetchPassengerBookings(),
        fetchDriverRides(),
      ]);
      setPassengerTrips(bookings || []);
      setDriverTrips(rides || []);
    } catch (error) {
      console.error('Error fetching trips:', error);
      CustomAlert.alert('Erreur', 'Impossible de charger vos trajets.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    fetchTrips(true);
  }, [user, fetchPassengerBookings, fetchDriverRides]);

  const handleCancelBooking = async (bookingId: string) => {
    try {
      setLoading(true);
      await authFetch(`/bookings/${bookingId}/cancel/`, { method: 'POST' });
      CustomAlert.alert('Succès', 'Votre réservation a été annulée.');
      await fetchTrips(false);
    } catch (err: any) {
      CustomAlert.alert('Erreur', err.message || 'Impossible d\'annuler la réservation.');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptOffer = async (bookingId: string) => {
    try {
      setLoading(true);
      const data = await authFetch(`/bookings/${bookingId}/passenger_accept/`, { method: 'POST' });
      if (data && !data.error) {
        router.push({
          pathname: '/payment',
          params: {
            booking_id: String(bookingId),
            amount: String(data.amount_paid_online || data.price || 0)
          }
        });
      }
      await fetchTrips(false);
    } catch (err: any) {
      CustomAlert.alert('Erreur', err.message || 'Impossible d\'accepter l\'offre.');
    } finally {
      setLoading(false);
    }
  };

  const handleRejectOffer = async (bookingId: string) => {
    try {
      setLoading(true);
      await authFetch(`/bookings/${bookingId}/passenger_reject/`, { method: 'POST' });
      CustomAlert.alert('Annulée', 'La proposition a été refusée.');
      await fetchTrips(false);
    } catch (err: any) {
      CustomAlert.alert('Erreur', err.message || 'Impossible de refuser la proposition.');
    } finally {
      setLoading(false);
    }
  };

  // Filter items by Mission Category
  const getFilteredItems = () => {
    const rawList = roleTab === 'passenger' ? passengerTrips : driverTrips;

    return rawList.filter((item) => {
      const mission = MissionResolver.resolveMission(item, roleTab);
      return mission.category === missionFilter;
    });
  };

  const filteredItems = getFilteredItems();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mes Trajets</Text>
      </View>

      {/* Role Switcher Tabs */}
      <View style={styles.roleTabsContainer}>
        <TouchableOpacity
          style={[styles.roleTab, roleTab === 'passenger' && styles.roleTabActive]}
          onPress={() => setRoleTab('passenger')}
        >
          <Ionicons
            name="person-outline"
            size={16}
            color={roleTab === 'passenger' ? theme.colors.primary : theme.colors.textLight}
          />
          <Text style={[styles.roleTabText, roleTab === 'passenger' && styles.roleTabTextActive]}>
            Passager ({passengerTrips.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.roleTab, roleTab === 'driver' && styles.roleTabActive]}
          onPress={() => setRoleTab('driver')}
        >
          <Ionicons
            name="car-sport-outline"
            size={16}
            color={roleTab === 'driver' ? theme.colors.primary : theme.colors.textLight}
          />
          <Text style={[styles.roleTabText, roleTab === 'driver' && styles.roleTabTextActive]}>
            Conducteur ({driverTrips.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Mission Category Filters */}
      <View style={styles.filterBar}>
        <TouchableOpacity
          style={[styles.filterChip, missionFilter === 'upcoming' && styles.filterChipActive]}
          onPress={() => setMissionFilter('upcoming')}
        >
          <Text style={[styles.filterChipText, missionFilter === 'upcoming' && styles.filterChipTextActive]}>
            À venir
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterChip, missionFilter === 'live' && styles.filterChipActive]}
          onPress={() => setMissionFilter('live')}
        >
          <Text style={[styles.filterChipText, missionFilter === 'live' && styles.filterChipTextActive]}>
            En cours
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterChip, missionFilter === 'completed' && styles.filterChipActive]}
          onPress={() => setMissionFilter('completed')}
        >
          <Text style={[styles.filterChipText, missionFilter === 'completed' && styles.filterChipTextActive]}>
            Terminés
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Chargement de vos missions...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[theme.colors.primary]}
              tintColor={theme.colors.primary}
            />
          }
        >
          {filteredItems.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="map-outline" size={48} color={theme.colors.grayDark} />
              <Text style={styles.emptyTitle}>Aucune mission dans cette catégorie</Text>
              <Text style={styles.emptySubtitle}>
                {missionFilter === 'upcoming'
                  ? 'Vos réservations et départs à venir s\'afficheront ici.'
                  : missionFilter === 'live'
                  ? 'Aucun trajet actuellement en cours de route.'
                  : 'Historique de vos trajets et réservations terminés.'}
              </Text>
            </View>
          ) : (
            filteredItems.map((item, index) => (
              <MissionCard
                key={item.id ? `${item.id}-${index}` : `mission-${index}`}
                item={item}
                role={roleTab}
                onCancelBooking={handleCancelBooking}
                onAcceptOffer={handleAcceptOffer}
                onRejectOffer={handleRejectOffer}
              />
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB'
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6'
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.text
  },
  roleTabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    gap: 12
  },
  roleTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    gap: 6
  },
  roleTabActive: {
    backgroundColor: theme.colors.primaryLight
  },
  roleTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textLight
  },
  roleTabTextActive: {
    color: theme.colors.primary,
    fontWeight: '700'
  },
  filterBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#E5E7EB'
  },
  filterChipActive: {
    backgroundColor: theme.colors.primary
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.text
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700'
  },
  scrollContent: {
    padding: 16
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: theme.colors.textLight
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
    marginTop: 12,
    marginBottom: 6,
    textAlign: 'center'
  },
  emptySubtitle: {
    fontSize: 13,
    color: theme.colors.textLight,
    textAlign: 'center',
    lineHeight: 18
  }
});
