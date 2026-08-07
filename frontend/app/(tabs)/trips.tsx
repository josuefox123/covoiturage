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
  const [missionFilter, setMissionFilter] = useState<'upcoming' | 'live' | 'completed' | 'cancelled'>('upcoming');
  
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

  const getCountByFilter = (filter: 'upcoming' | 'live' | 'completed' | 'cancelled') => {
    const rawList = roleTab === 'passenger' ? passengerTrips : driverTrips;
    return rawList.filter((item) => {
      const mission = MissionResolver.resolveMission(item, roleTab);
      return mission.category === filter;
    }).length;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Premium Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Mes Trajets</Text>
          <Text style={styles.headerSub}>
            {roleTab === 'passenger' ? `${passengerTrips.length} réservation${passengerTrips.length > 1 ? 's' : ''}` : `${driverTrips.length} trajet${driverTrips.length > 1 ? 's' : ''} publié${driverTrips.length > 1 ? 's' : ''}`}
          </Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={() => fetchTrips(true)}>
          <Ionicons name="refresh-outline" size={20} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Role Switcher — Pill Style */}
      <View style={styles.roleTabsContainer}>
        <TouchableOpacity
          style={[styles.roleTab, roleTab === 'passenger' && styles.roleTabPassengerActive]}
          onPress={() => setRoleTab('passenger')}
        >
          <View style={[styles.roleTabIcon, roleTab === 'passenger' && styles.roleTabIconPassengerActive]}>
            <Ionicons
              name="person"
              size={15}
              color={roleTab === 'passenger' ? '#FFFFFF' : '#94A3B8'}
            />
          </View>
          <View>
            <Text style={[styles.roleTabLabel, roleTab === 'passenger' && styles.roleTabLabelActive]}>
              Passager
            </Text>
            <Text style={[styles.roleTabCount, roleTab === 'passenger' && styles.roleTabCountActive]}>
              {passengerTrips.length} réservation{passengerTrips.length > 1 ? 's' : ''}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.roleTab, roleTab === 'driver' && styles.roleTabDriverActive]}
          onPress={() => setRoleTab('driver')}
        >
          <View style={[styles.roleTabIcon, roleTab === 'driver' && styles.roleTabIconDriverActive]}>
            <Ionicons
              name="car-sport"
              size={15}
              color={roleTab === 'driver' ? '#FFFFFF' : '#94A3B8'}
            />
          </View>
          <View>
            <Text style={[styles.roleTabLabel, roleTab === 'driver' && styles.roleTabLabelDriverActive]}>
              Conducteur
            </Text>
            <Text style={[styles.roleTabCount, roleTab === 'driver' && styles.roleTabCountDriverActive]}>
              {driverTrips.length} trajet{driverTrips.length > 1 ? 's' : ''}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Mission Category Filters — Rich Cards */}
      <View style={styles.filterBar}>
        {/* À venir */}
        <TouchableOpacity
          style={[styles.filterCard, missionFilter === 'upcoming' && styles.filterCardUpcomingActive]}
          onPress={() => setMissionFilter('upcoming')}
        >
          <View style={[styles.filterCardIcon, missionFilter === 'upcoming' && { backgroundColor: '#FEF3C7' }]}>
            <Ionicons
              name="time-outline"
              size={18}
              color={missionFilter === 'upcoming' ? '#D97706' : '#94A3B8'}
            />
          </View>
          <Text style={[styles.filterCardTitle, missionFilter === 'upcoming' && { color: '#D97706', fontWeight: '800' }]}>
            À venir
          </Text>
          <View style={[styles.filterCardBadge, missionFilter === 'upcoming' && { backgroundColor: '#FDE68A' }]}>
            <Text style={[styles.filterCardBadgeText, missionFilter === 'upcoming' && { color: '#B45309' }]}>
              {getCountByFilter('upcoming')}
            </Text>
          </View>
        </TouchableOpacity>

        {/* En cours */}
        <TouchableOpacity
          style={[styles.filterCard, missionFilter === 'live' && styles.filterCardLiveActive]}
          onPress={() => setMissionFilter('live')}
        >
          {missionFilter === 'live' && (
            <View style={styles.liveIndicator} />
          )}
          <View style={[styles.filterCardIcon, missionFilter === 'live' && { backgroundColor: '#D1FAE5' }]}>
            <Ionicons
              name="navigate"
              size={18}
              color={missionFilter === 'live' ? '#059669' : '#94A3B8'}
            />
          </View>
          <Text style={[styles.filterCardTitle, missionFilter === 'live' && { color: '#059669', fontWeight: '800' }]}>
            En cours
          </Text>
          <View style={[styles.filterCardBadge, missionFilter === 'live' && { backgroundColor: '#A7F3D0' }]}>
            <Text style={[styles.filterCardBadgeText, missionFilter === 'live' && { color: '#065F46' }]}>
              {getCountByFilter('live')}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Terminés */}
        <TouchableOpacity
          style={[styles.filterCard, missionFilter === 'completed' && styles.filterCardCompletedActive]}
          onPress={() => setMissionFilter('completed')}
        >
          <View style={[styles.filterCardIcon, missionFilter === 'completed' && { backgroundColor: '#EDE9FE' }]}>
            <Ionicons
              name="checkmark-done"
              size={18}
              color={missionFilter === 'completed' ? '#7C3AED' : '#94A3B8'}
            />
          </View>
          <Text style={[styles.filterCardTitle, missionFilter === 'completed' && { color: '#7C3AED', fontWeight: '800' }]} numberOfLines={1} adjustsFontSizeToFit>
            Terminés
          </Text>
          <View style={[styles.filterCardBadge, missionFilter === 'completed' && { backgroundColor: '#DDD6FE' }]}>
            <Text style={[styles.filterCardBadgeText, missionFilter === 'completed' && { color: '#5B21B6' }]}>
              {getCountByFilter('completed')}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Annulés */}
        <TouchableOpacity
          style={[styles.filterCard, missionFilter === 'cancelled' && styles.filterCardCancelledActive]}
          onPress={() => setMissionFilter('cancelled')}
        >
          <View style={[styles.filterCardIcon, missionFilter === 'cancelled' && { backgroundColor: '#FEE2E2' }]}>
            <Ionicons
              name="close-circle"
              size={18}
              color={missionFilter === 'cancelled' ? '#EF4444' : '#94A3B8'}
            />
          </View>
          <Text style={[styles.filterCardTitle, missionFilter === 'cancelled' && { color: '#EF4444', fontWeight: '800' }]} numberOfLines={1} adjustsFontSizeToFit>
            Annulés
          </Text>
          <View style={[styles.filterCardBadge, missionFilter === 'cancelled' && { backgroundColor: '#FCA5A5' }]}>
            <Text style={[styles.filterCardBadgeText, missionFilter === 'cancelled' && { color: '#7F1D1D' }]}>
              {getCountByFilter('cancelled')}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Section Title */}
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionDot, {
          backgroundColor: missionFilter === 'upcoming' ? '#D97706' : missionFilter === 'live' ? '#059669' : missionFilter === 'completed' ? '#7C3AED' : '#EF4444'
        }]} />
        <Text style={styles.sectionTitle}>
          {roleTab === 'passenger'
            ? missionFilter === 'upcoming' ? 'Réservations à venir'
              : missionFilter === 'live' ? 'Réservations en cours'
              : missionFilter === 'completed' ? 'Historique des réservations'
              : 'Réservations annulées'
            : missionFilter === 'upcoming' ? 'Trajets publiés à venir'
              : missionFilter === 'live' ? 'Trajets en cours de conduite'
              : missionFilter === 'completed' ? 'Trajets terminés'
              : 'Trajets annulés'}
        </Text>
        <Text style={styles.sectionCount}>
          {filteredItems.length} résultat{filteredItems.length > 1 ? 's' : ''}
        </Text>
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
              <View style={styles.emptyIconWrapper}>
                <Ionicons
                  name={missionFilter === 'upcoming' ? 'time-outline' : missionFilter === 'live' ? 'navigate-outline' : 'checkmark-done-outline'}
                  size={40}
                  color={missionFilter === 'upcoming' ? '#D97706' : missionFilter === 'live' ? '#059669' : '#7C3AED'}
                />
              </View>
              <Text style={styles.emptyTitle}>
                {missionFilter === 'upcoming' ? 'Aucune mission à venir' : missionFilter === 'live' ? 'Aucun trajet en cours' : missionFilter === 'completed' ? 'Aucun historique' : 'Aucun trajet annulé'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {roleTab === 'passenger'
                  ? missionFilter === 'upcoming'
                    ? 'Vos réservations confirmées et en attente apparaîtront ici.'
                    : missionFilter === 'live'
                    ? 'Aucune réservation active en ce moment.'
                    : missionFilter === 'completed'
                    ? 'Votre historique de voyages s\'affichera ici.'
                    : 'Vos réservations annulées ou expirées s\'afficheront ici.'
                  : missionFilter === 'upcoming'
                  ? 'Vos trajets publiés et à venir sont listés ici.'
                  : missionFilter === 'live'
                  ? 'Aucun trajet que vous conduisez actuellement.'
                  : missionFilter === 'completed'
                  ? 'Vos trajets effectués apparaissent ici.'
                  : 'Vos trajets annulés s\'afficheront ici.'}
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
    backgroundColor: '#F8FAFC'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9'
  },
  headerLeft: {
    flex: 1
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3
  },
  headerSub: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
    fontWeight: '500'
  },
  refreshBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center'
  },

  // ─── Role Switcher ───────────────────────────────────
  roleTabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9'
  },
  roleTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    gap: 10
  },
  roleTabPassengerActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3
  },
  roleTabDriverActive: {
    backgroundColor: '#FFF7ED',
    borderColor: '#F97316',
    shadowColor: '#F97316',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3
  },
  roleTabIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center'
  },
  roleTabIconPassengerActive: {
    backgroundColor: '#3B82F6'
  },
  roleTabIconDriverActive: {
    backgroundColor: '#F97316'
  },
  roleTabLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#94A3B8'
  },
  roleTabLabelActive: {
    color: '#3B82F6'
  },
  roleTabLabelDriverActive: {
    color: '#F97316'
  },
  roleTabCount: {
    fontSize: 11,
    color: '#CBD5E1',
    fontWeight: '500',
    marginTop: 1
  },
  roleTabCountActive: {
    color: '#93C5FD'
  },
  roleTabCountDriverActive: {
    color: '#FDBA74'
  },

  // ─── Filter Cards ──────────────────────────────────
  filterBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9'
  },
  filterCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    gap: 6,
    position: 'relative',
    overflow: 'hidden'
  },
  filterCardUpcomingActive: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FCD34D',
    shadowColor: '#D97706',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 2
  },
  filterCardLiveActive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#6EE7B7',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 2
  },
  filterCardCompletedActive: {
    backgroundColor: '#F5F3FF',
    borderColor: '#C4B5FD',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 2
  },
  filterCardCancelledActive: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 2
  },
  filterCardIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center'
  },
  filterCardTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
    textAlign: 'center'
  },
  filterCardBadge: {
    minWidth: 22,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6
  },
  filterCardBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B'
  },
  liveIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#10B981'
  },

  // ─── Section Header ────────────────────────────────
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8
  },
  sectionDot: {
    width: 6,
    height: 6,
    borderRadius: 3
  },
  sectionTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: '#475569'
  },
  sectionCount: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500'
  },

  // ─── Content ─────────────────────────────────────
  scrollContent: {
    padding: 16,
    paddingTop: 4
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
    color: '#94A3B8',
    fontWeight: '500'
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20
  },
  emptyIconWrapper: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 8,
    textAlign: 'center'
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 20,
    fontWeight: '500'
  }
});

