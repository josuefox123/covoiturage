import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../src/styles/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';
import { CustomAlert } from '../../src/utils/CustomAlert';

const isItTimeForRide = (dateStr: string, timeStr: string) => {
  if (!dateStr || !timeStr) return false;
  const rideDate = new Date(dateStr);
  const now = new Date();
  if (rideDate.toDateString() !== now.toDateString()) return false;
  
  const [hours, minutes] = timeStr.split(':').map(Number);
  const rideTimeInMinutes = hours * 60 + minutes;
  const currentTimeInMinutes = now.getHours() * 60 + now.getMinutes();
  
  return currentTimeInMinutes >= rideTimeInMinutes - 15;
};

export default function TripsScreen() {
  const router = useRouter();
  const { user, authFetch } = useAuth();
  const [activeTab, setActiveTab] = useState<'passenger' | 'driver'>('passenger');
  const [filterTab, setFilterTab] = useState<'active' | 'archived'>('active');
  
  const [passengerTrips, setPassengerTrips] = useState<any[]>([]);
  const [driverTrips, setDriverTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [contactingId, setContactingId] = useState<string | null>(null);

  useEffect(() => {
    fetchTrips();
  }, [user]);

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
      // Fetch passenger trips (Bookings)
      const bookingsResponse = await authFetch(`/bookings/?passenger=${user.id}`);
      setPassengerTrips(bookingsResponse.results || bookingsResponse || []);
      
      // Fetch driver trips (Rides)
      const ridesResponse = await authFetch(`/rides/?driver=${user.id}`);
      setDriverTrips(ridesResponse.results || ridesResponse || []);
    } catch (error) {
      console.error('Error fetching trips:', error);
      CustomAlert.alert('Erreur', 'Impossible de charger vos trajets.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string, rideData?: any) => {
    let effectiveStatus = status.toLowerCase();
    
    if (effectiveStatus === 'active' && rideData) {
      if (!isItTimeForRide(rideData.departure_date, rideData.departure_time)) {
        return { bg: theme.colors.warningLight, text: theme.colors.warningDark, label: 'En attente' };
      }
    }
    
    switch(effectiveStatus) {
      case 'confirmed':
      case 'active':
        return { bg: theme.colors.successLight, text: theme.colors.success, label: effectiveStatus === 'active' ? 'En cours' : 'Confirmé' };
      case 'pending':
        return { bg: theme.colors.warningLight, text: theme.colors.warningDark, label: 'En attente' };
      case 'completed':
        return { bg: theme.colors.primaryLight, text: theme.colors.primary, label: 'Terminé' };
      case 'cancelled':
        return { bg: theme.colors.errorLight, text: theme.colors.error, label: 'Annulé' };
      default:
        return { bg: theme.colors.grayLight, text: theme.colors.textLight, label: status };
    }
  };

  const getFilteredTrips = (trips: any[], role: 'passenger' | 'driver') => {
      const today = new Date();
      today.setHours(0,0,0,0);
      
      return trips.filter(item => {
          const ride = role === 'passenger' ? item.ride_details : item;
          if (!ride) return false;
          
          const rideDate = new Date(ride.departure_date);
          rideDate.setHours(0,0,0,0);
          
          if (filterTab === 'active') {
              return rideDate >= today;
          } else {
              return rideDate < today;
          }
      });
  };

  const filteredPassengerTrips = getFilteredTrips(passengerTrips, 'passenger');
  const filteredDriverTrips = getFilteredTrips(driverTrips, 'driver');

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
                  const driver = ride.driver_details;
                  const badge = getStatusBadge(booking.status, ride);
                  const isActiveRightNow = ride.status === 'active' && isItTimeForRide(ride.departure_date, ride.departure_time);
                  
                  return (
                    <View key={booking.id} style={[styles.card, isActiveRightNow && styles.activeCard]}>
                      <View style={styles.cardHeader}>
                        <View style={styles.driverInfo}>
                          <View style={styles.avatar}>
                            <Text style={styles.avatarText}>{driver?.full_name ? driver.full_name.charAt(0).toUpperCase() : '?'}</Text>
                          </View>
                          <View>
                            <Text style={styles.driverName}>{driver?.full_name || driver?.phone || 'Inconnu'}</Text>
                            <View style={styles.ratingContainer}>
                              <Ionicons name="star" size={14} color={theme.colors.warning} />
                              <Text style={styles.ratingText}>{driver?.rating || '4.0'}</Text>
                            </View>
                          </View>
                        </View>
                        <View style={[styles.statusBadge, { backgroundColor: isActiveRightNow ? theme.colors.success : badge.bg }]}>
                          <Text style={[styles.statusText, { color: isActiveRightNow ? theme.colors.white : badge.text }]}>
                            {isActiveRightNow ? 'EN COURS' : badge.label}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.tripDetails}>
                        <View style={styles.detailRow}>
                          <Ionicons name="location-outline" size={20} color={theme.colors.primary} />
                          <Text style={styles.detailText}>
                            {ride.departure_location} → {ride.arrival_location}
                          </Text>
                        </View>
                        <View style={styles.detailRow}>
                          <Ionicons name="calendar-outline" size={20} color={theme.colors.textMuted} />
                          <Text style={styles.detailText}>
                            {new Date(ride.departure_date).toLocaleDateString("fr-FR", {
                              weekday: "long",
                              day: "numeric",
                              month: "long",
                            })} à {ride.departure_time}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.cardActions}>
                        <TouchableOpacity
                          style={[styles.primaryButton, contactingId === ride.id && { opacity: 0.6 }]}
                          onPress={() => contactDriver(ride.id)}
                          disabled={contactingId === ride.id}
                        >
                          {contactingId === ride.id ? (
                            <ActivityIndicator size="small" color={theme.colors.white} />
                          ) : (
                            <Text style={styles.primaryButtonText}>Contacter</Text>
                          )}
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.secondaryButton}
                          onPress={() => router.push(`/ride/${ride.id}` as any)}
                        >
                          <Text style={styles.secondaryButtonText}>Détails</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
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
                  const badge = getStatusBadge(ride.status, ride);
                  const passengersCount = ride.total_seats - ride.seats_available;
                  const isActiveRightNow = ride.status === 'active' && isItTimeForRide(ride.departure_date, ride.departure_time);
                  
                  return (
                    <View key={ride.id} style={[styles.card, isActiveRightNow && styles.activeCard]}>
                      <View style={styles.cardHeader}>
                        <View style={styles.driverInfo}>
                          <Ionicons name="people" size={24} color={theme.colors.primary} />
                          <Text style={styles.driverName}>
                            {passengersCount} passager{passengersCount > 1 ? "s" : ""}
                          </Text>
                        </View>
                        <View style={[styles.statusBadge, { backgroundColor: isActiveRightNow ? theme.colors.success : badge.bg }]}>
                          <Text style={[styles.statusText, { color: isActiveRightNow ? theme.colors.white : badge.text }]}>
                            {isActiveRightNow ? 'EN COURS' : badge.label}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.tripDetails}>
                        <View style={styles.detailRow}>
                          <Ionicons name="location-outline" size={20} color={theme.colors.primary} />
                          <Text style={styles.detailText}>
                            {ride.departure_location} → {ride.arrival_location}
                          </Text>
                        </View>
                        <View style={styles.detailRow}>
                          <Ionicons name="calendar-outline" size={20} color={theme.colors.textMuted} />
                          <Text style={styles.detailText}>
                            {new Date(ride.departure_date).toLocaleDateString("fr-FR", {
                              weekday: "long",
                              day: "numeric",
                              month: "long",
                            })} à {ride.departure_time}
                          </Text>
                        </View>
                        <View style={styles.detailRow}>
                          <Ionicons name="people-outline" size={20} color={theme.colors.textMuted} />
                          <Text style={styles.detailText}>{ride.seats_available} places restantes</Text>
                        </View>
                      </View>

                      <View style={styles.cardActions}>
                        <TouchableOpacity
                          style={styles.primaryButton}
                          onPress={() => router.push(`/ride/${ride.id}` as any)}
                        >
                          <Text style={styles.primaryButtonText}>Gérer</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.secondaryButton, { backgroundColor: theme.colors.errorLight }]}>
                          <Text style={[styles.secondaryButtonText, { color: theme.colors.error }]}>Annuler</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
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
