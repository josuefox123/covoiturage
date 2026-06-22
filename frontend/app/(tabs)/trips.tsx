/**
 * ==============================================================
 * Fichier :
 * trips.tsx
 *
 * Description :
 * Composant ou logique de l'application Zemy.
 *
 * Projet :
 * Zemy
 * ==============================================================
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../src/styles/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';
import { useTrips } from '../../src/hooks/useTrips';
import { CustomAlert } from '../../src/utils/CustomAlert';
import RideCard from '../../src/components/common/RideCard';

const isItTimeForLiveRide = (dateStr: string, timeStr: string) => {
  if (!dateStr || !timeStr) return false;
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, minutes] = timeStr.split(':').map(Number);
  const departureDate = new Date(year, month - 1, day, hours, minutes, 0, 0);
  const now = new Date();
  const tenMinutesBefore = new Date(departureDate.getTime() - 10 * 60 * 1000);
  return now.getTime() >= tenMinutesBefore.getTime();
};

/**
 * Composant TripsScreen.
 *
 * Responsabilités :
 * - Affichage et gestion de l'état lié à TripsScreen.
 */
export default function TripsScreen() {
  const router = useRouter();
  const { user, authFetch } = useAuth();
  const { fetchPassengerBookings, fetchDriverRides, loading: tripsLoading } = useTrips();
  const [activeTab, setActiveTab] = useState<'passenger' | 'driver'>('passenger');
  const [filterTab, setFilterTab] = useState<'active' | 'archived'>('active');
  
  const [passengerTrips, setPassengerTrips] = useState<any[]>([]);
  const [driverTrips, setDriverTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [contactingId, setContactingId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      fetchTrips();
    }, [user, fetchPassengerBookings, fetchDriverRides])
  );

  const contactDriver = async (rideId: string) => {
    setContactingId(rideId);
    try {
      const conv = await authFetch('/conversations/ride-chat/', {
        method: 'POST',
        body: JSON.stringify({ ride_id: rideId }),
      });
      router.push(`/chat/${conv.id}`);
    } catch (error: any) {
      CustomAlert.alert('Messagerie', error.message || 'Impossible d\'ouvrir la conversation.');
    } finally {
      setContactingId(null);
    }
  };

  const fetchTrips = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    try {
      const [bookings, rides] = await Promise.all([
        fetchPassengerBookings(),
        fetchDriverRides(),
      ]);
      setPassengerTrips(bookings);
      setDriverTrips(rides);
    } catch (error) {
      console.error('Error fetching trips:', error);
      CustomAlert.alert('Erreur', 'Impossible de charger vos trajets.');
    } finally {
      setLoading(false);
    }
  };

  // Logic removed since it's now in RideCard

  const getFilteredTrips = (trips: any[], role: 'passenger' | 'driver') => {
    const now = new Date();

    return trips.filter(item => {
      const ride = role === 'passenger' ? item.ride_details : item;
      if (!ride) return false;

      // Construire le datetime exact de départ (date + heure)
      let departureDateTime: Date;
      if (ride.departure_date && ride.departure_time) {
        const [h, m] = (ride.departure_time as string).split(':').map(Number);
        departureDateTime = new Date(ride.departure_date);
        departureDateTime.setHours(h, m, 0, 0);
      } else {
        departureDateTime = new Date(ride.departure_date);
        departureDateTime.setHours(23, 59, 59, 999);
      }

      if (filterTab === 'active') {
        // Actif = départ dans le futur ET statut non terminé
        return departureDateTime > now && ride.status !== 'completed' && ride.status !== 'cancelled';
      } else {
        // Archivé = départ passé OU statut terminé/annulé
        return departureDateTime <= now || ride.status === 'completed' || ride.status === 'cancelled';
      }
    });
  };

  const filteredPassengerTrips = getFilteredTrips(passengerTrips, 'passenger');
  const filteredDriverTrips = getFilteredTrips(driverTrips, 'driver');

  if (!user) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!user.is_verified) {
    return (
      <SafeAreaView style={[styles.safeArea, { justifyContent: 'center', alignItems: 'center', padding: theme.spacing.xl }]}>
        <Ionicons name="shield-checkmark-outline" size={80} color={theme.colors.textMuted} />
        <Text style={[styles.headerTitle, { color: theme.colors.text, marginTop: 16 }]}>Compte non vérifié</Text>
        <Text style={[styles.headerSubtitle, { color: theme.colors.textMuted, textAlign: 'center', marginBottom: 24, marginTop: 8 }]}>
          Votre compte doit être vérifié pour accéder à vos trajets.
        </Text>
        <TouchableOpacity 
          style={{ backgroundColor: theme.colors.primary, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12 }} 
          onPress={() => router.push('/verify-identity')}
        >
          <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>Se faire vérifier</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mes trajets</Text>
        <Text style={styles.headerSubtitle}>Gérez vos réservations</Text>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'passenger' && styles.tabButtonActive]}
          onPress={() => setActiveTab('passenger')}
        >
          <Text style={[styles.tabText, activeTab === 'passenger' && styles.tabTextActive]}>
            Passager
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'driver' && styles.tabButtonActive]}
          onPress={() => setActiveTab('driver')}
        >
          <Text style={[styles.tabText, activeTab === 'driver' && styles.tabTextActive]}>
            Conducteur
          </Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.subTabContainer}>
        <TouchableOpacity
          style={[styles.subTabButton, filterTab === 'active' && styles.subTabButtonActive]}
          onPress={() => setFilterTab('active')}
        >
          <Text style={[styles.subTabText, filterTab === 'active' && styles.subTabTextActive]}>
            Actifs
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.subTabButton, filterTab === 'archived' && styles.subTabButtonActive]}
          onPress={() => setFilterTab('archived')}
        >
          <Text style={[styles.subTabText, filterTab === 'archived' && styles.subTabTextActive]}>
            Archives
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {activeTab === 'passenger' ? (
            <View style={styles.listContainer}>
              {filteredPassengerTrips.length === 0 ? (
                <Text style={styles.emptyText}>Aucun trajet {filterTab === 'active' ? 'actif' : 'archivé'} en tant que passager.</Text>
              ) : (
                filteredPassengerTrips.map((booking: any) => {
                  const ride = booking.ride_details;
                  if (!ride) return null;
                  const isActiveRightNow = (ride.status === 'active' || ride.status === 'started') &&
                                           isItTimeForLiveRide(ride.departure_date, ride.departure_time) &&
                                           booking.status === 'confirmed';
                  
                  return (
                    <RideCard
                      key={booking.id}
                      ride={ride}
                      role="passenger"
                      bookingStatus={booking.status}
                      isActiveRightNow={isActiveRightNow}
                      primaryActionLabel="Contacter"
                      onPressPrimary={() => contactDriver(ride.id)}
                      isPrimaryLoading={contactingId === ride.id}
                      secondaryActionLabel="Détails"
                      onPressSecondary={() => router.push(`/ride/${ride.id}` as any)}
                    />
                  );
                })
              )}
            </View>
          ) : (
            <View style={styles.listContainer}>
              {filteredDriverTrips.length === 0 ? (
                <Text style={styles.emptyText}>Aucun trajet {filterTab === 'active' ? 'actif' : 'archivé'} en tant que conducteur.</Text>
              ) : (
                filteredDriverTrips.map((ride: any) => {
                  const isActiveRightNow = (ride.status === 'active' || ride.status === 'started') &&
                                           isItTimeForLiveRide(ride.departure_date, ride.departure_time);
                  return (
                    <RideCard
                      key={ride.id}
                      ride={ride}
                      role="driver"
                      isActiveRightNow={isActiveRightNow}
                      primaryActionLabel="Gérer"
                      onPressPrimary={() => router.push(`/ride-management/${ride.id}` as any)}
                      secondaryActionLabel="Annuler"
                      onPressSecondary={() => {}}
                    />
                  );
                })
              )}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.xl + theme.spacing.md,
    backgroundColor: theme.colors.primary,
    borderBottomLeftRadius: theme.borderRadius.xl,
    borderBottomRightRadius: theme.borderRadius.xl,
  },
  headerTitle: {
    ...theme.typography.h1,
    color: theme.colors.white,
    marginBottom: theme.spacing.xs,
  },
  headerSubtitle: {
    ...theme.typography.bodyMedium,
    color: theme.colors.primaryLight,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: theme.colors.card,
    marginHorizontal: theme.spacing.lg,
    marginTop: -theme.spacing.xl,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.xs,
    ...theme.shadows.md,
    zIndex: 10,
  },
  tabButton: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
    borderRadius: theme.borderRadius.md,
  },
  tabButtonActive: {
    backgroundColor: theme.colors.primary,
  },
  tabText: {
    ...theme.typography.button,
    color: theme.colors.textLight,
  },
  tabTextActive: {
    color: theme.colors.white,
  },
  subTabContainer: {
    flexDirection: 'row',
    marginHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    gap: 12,
  },
  subTabButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  subTabButtonActive: {
    backgroundColor: theme.colors.primaryLight,
    borderColor: theme.colors.primary,
  },
  subTabText: {
    ...theme.typography.bodyMedium,
    color: theme.colors.textLight,
  },
  subTabTextActive: {
    color: theme.colors.primary,
    fontWeight: '700',
  },
  scrollContent: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    ...theme.typography.bodyLarge,
    color: theme.colors.textLight,
    textAlign: 'center',
    marginTop: theme.spacing.xl,
  },
  listContainer: {
    gap: theme.spacing.md,
  },
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    ...theme.shadows.sm,
    borderColor: theme.colors.border,
  },
  activeCard: {
    borderColor: theme.colors.success,
    borderWidth: 2,
    backgroundColor: theme.colors.successLightest,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  driverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: theme.colors.white,
    fontWeight: '700',
    fontSize: 16,
  },
  driverName: {
    ...theme.typography.h3,
    color: theme.colors.text,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    ...theme.typography.bodySmall,
    color: theme.colors.warningDark,
    fontWeight: '600',
  },
  statusBadge: {
    backgroundColor: theme.colors.successLight,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.full,
  },
  statusText: {
    ...theme.typography.caption,
    color: theme.colors.success,
  },
  tripDetails: {
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  detailText: {
    ...theme.typography.bodyMedium,
    color: theme.colors.textLight,
  },
  cardActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  primaryButtonText: {
    ...theme.typography.button,
    color: theme.colors.white,
  },
  secondaryButton: {
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.grayLight,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    ...theme.typography.button,
    color: theme.colors.textLight,
  },
});
