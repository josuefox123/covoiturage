import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Linking, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { Ride, Booking } from '../../src/types';
import { CustomAlert } from '../../src/utils/CustomAlert';

const COLORS = {
  primary: '#2D9CDB',
  success: '#16A34A',
  error: '#DC2626',
  warning: '#F59E0B',
  white: '#FFFFFF',
  background: '#F3F4F6',
  card: '#FFFFFF',
  text: '#1F2937',
  textLight: '#6B7280',
  border: '#E5E7EB',
  grayLight: '#F9FAFB'
};

export default function RideManagementScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user, authFetch } = useAuth();
  
  const [ride, setRide] = useState<Ride | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  // Animations
  const statusAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [rideData, bookingsData] = await Promise.all([
        authFetch(`/rides/${id}/`),
        authFetch(`/bookings/?ride=${id}`)
      ]);
      setRide(rideData);
      setBookings(Array.isArray(bookingsData) ? bookingsData : bookingsData?.results || []);
    } catch (error: any) {
      CustomAlert.alert('Erreur', error.message || 'Impossible de charger le trajet.');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const playStatusAnimation = () => {
    Animated.sequence([
      Animated.timing(statusAnim, { toValue: 1.2, duration: 200, useNativeDriver: true }),
      Animated.spring(statusAnim, { toValue: 1, friction: 3, useNativeDriver: true })
    ]).start();
  };

  const handleCancelRide = () => {
    CustomAlert.alert(
      'Annuler le trajet',
      'Êtes-vous sûr de vouloir annuler ce trajet ? Tous les passagers seront notifiés.',
      [
        { text: 'Non', style: 'cancel' },
        { 
          text: 'Oui, annuler', 
          style: 'destructive',
          onPress: async () => {
            try {
              await authFetch(`/rides/${id}/cancel/`, { method: 'POST' });
              setRide(prev => prev ? { ...prev, status: 'cancelled' } : null);
              playStatusAnimation();
              CustomAlert.alert('Succès', 'Le trajet a été annulé.');
            } catch (error: any) {
              CustomAlert.alert('Erreur', error.message || 'Impossible d\'annuler le trajet.');
            }
          }
        }
      ]
    );
  };

  const handleCompleteRide = () => {
    CustomAlert.alert(
      'Terminer le trajet',
      'Confirmez-vous que ce trajet est terminé avec succès ?',
      [
        { text: 'Non', style: 'cancel' },
        { 
          text: 'Oui, terminé', 
          onPress: async () => {
            try {
              await authFetch(`/rides/${id}/complete/`, { method: 'POST' });
              setRide(prev => prev ? { ...prev, status: 'completed' } : null);
              playStatusAnimation();
              CustomAlert.alert('Succès', 'Le trajet est marqué comme terminé.');
            } catch (error: any) {
              CustomAlert.alert('Erreur', error.message || 'Impossible de terminer le trajet.');
            }
          }
        }
      ]
    );
  };

  const handleChatPassenger = async () => {
    try {
      const response = await authFetch('/conversations/ride-chat/', {
        method: 'POST',
        body: JSON.stringify({ ride_id: id }),
      });
      router.push(`/chat/${response.id}`);
    } catch (error: any) {
      CustomAlert.alert('Erreur', 'Impossible d\'ouvrir la discussion.');
    }
  };

  const handleCallPassenger = (phone?: string) => {
    if (!phone) {
      CustomAlert.alert('Erreur', 'Numéro de téléphone non disponible.');
      return;
    }
    Linking.openURL(`tel:${phone}`);
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!ride) return null;

  const confirmedBookings = bookings.filter(b => b.status === 'confirmed' || b.status === 'active');
  const cancelledBookings = bookings.filter(b => b.status === 'cancelled' || b.status === 'rejected');
  
  const totalRevenue = confirmedBookings.reduce((sum, b) => sum + ((ride.price_per_seat || 0) * (b.seats_booked || 1)), 0);
  const seatsBooked = ride.total_seats - ride.seats_available;

  const getStatusDisplay = () => {
    switch(ride.status) {
      case 'active': return { text: 'EN COURS', color: COLORS.primary, icon: 'car-outline', bg: '#EFF6FF' };
      case 'completed': return { text: 'TERMINÉ', color: COLORS.success, icon: 'checkmark-circle-outline', bg: '#F0FDF4' };
      case 'cancelled': return { text: 'ANNULÉ', color: COLORS.error, icon: 'close-circle-outline', bg: '#FEF2F2' };
      default: return { text: 'EN ATTENTE', color: COLORS.warning, icon: 'time-outline', bg: '#FFFBEB' };
    }
  };

  const statusInfo = getStatusDisplay();

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Gérer mon trajet</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        
        {/* Driver Card */}
        <View style={[styles.card, styles.driverCard]}>
          <View style={styles.driverAvatar}>
            <Text style={styles.driverAvatarText}>
              {user?.full_name ? user.full_name.substring(0, 2).toUpperCase() : 'VO'}
            </Text>
          </View>
          <View style={styles.driverInfo}>
            <Text style={styles.driverName}>Vous ({user?.full_name || 'Conducteur'})</Text>
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={14} color={COLORS.warning} />
              <Text style={styles.ratingText}>5.0</Text>
              <Text style={styles.ridesCount}>• 12 trajets</Text>
            </View>
          </View>
        </View>

        {/* Status Bar */}
        <Animated.View style={[styles.statusBar, { backgroundColor: statusInfo.bg, transform: [{ scale: statusAnim }] }]}>
          <Ionicons name={statusInfo.icon as any} size={20} color={statusInfo.color} />
          <Text style={[styles.statusText, { color: statusInfo.color }]}>{statusInfo.text}</Text>
        </Animated.View>

        {/* Timeline Trajet */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Mon trajet</Text>
          
          <View style={styles.timeline}>
            <View style={styles.timelineItem}>
              <View style={[styles.timelineDot, { borderColor: COLORS.primary }]} />
              <View style={styles.timelineLine} />
              <View style={styles.timelineContent}>
                <Text style={styles.locationText}>{ride.departure_location}</Text>
                <Text style={styles.timeText}>{ride.departure_time?.substring(0, 5)}</Text>
              </View>
            </View>
            
            <View style={styles.timelineItem}>
              <View style={[styles.timelineDot, { borderColor: COLORS.success, backgroundColor: COLORS.success }]} />
              <View style={styles.timelineContent}>
                <Text style={styles.locationText}>{ride.arrival_location}</Text>
                <Text style={styles.timeText}>Estimation {ride.distance_km ? '~' + Math.round(ride.distance_km / 60) + 'h' : '--:--'}</Text>
              </View>
            </View>
          </View>

          <View style={styles.divider} />
          
          <View style={styles.rideMeta}>
            <View style={styles.metaItem}>
              <Ionicons name="calendar-outline" size={18} color={COLORS.textLight} />
              <Text style={styles.metaText}>{ride.departure_date}</Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="people-outline" size={18} color={COLORS.textLight} />
              <Text style={styles.metaText}>{ride.seats_available} / {ride.total_seats} places</Text>
            </View>
          </View>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Prix unitaire</Text>
            <Text style={styles.statValue}>{ride.price_per_seat} FCFA</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Distance</Text>
            <Text style={styles.statValue}>{ride.distance_km || '---'} km</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Revenu estimé</Text>
            <Text style={[styles.statValue, { color: COLORS.success }]}>{totalRevenue} FCFA</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Réservations</Text>
            <Text style={styles.statValue}>{seatsBooked} places</Text>
          </View>
        </View>

        {/* Passengers */}
        <Text style={styles.sectionHeader}>Passagers confirmés ({confirmedBookings.length})</Text>
        
        {confirmedBookings.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="people" size={40} color={COLORS.border} />
            <Text style={styles.emptyText}>Aucun passager pour l'instant</Text>
          </View>
        ) : (
          confirmedBookings.map((booking) => (
            <View key={booking.id} style={styles.passengerCard}>
              <View style={styles.passengerHeader}>
                <View style={styles.passengerAvatar}>
                  <Text style={styles.passengerAvatarText}>
                    {booking.passenger_details?.full_name?.substring(0,2).toUpperCase() || 'PA'}
                  </Text>
                </View>
                <View style={styles.passengerDetails}>
                  <Text style={styles.passengerName}>{booking.passenger_details?.full_name}</Text>
                  <Text style={styles.passengerPhone}>{booking.passenger_details?.phone || 'Numéro masqué'}</Text>
                  <View style={styles.ratingRow}>
                    <Ionicons name="star" size={12} color={COLORS.warning} />
                    <Text style={styles.ratingTextSmall}>4.8</Text>
                    <Text style={styles.seatBadge}>{booking.seats_booked} place(s)</Text>
                  </View>
                </View>
              </View>

              <View style={styles.paymentRow}>
                <Text style={styles.paymentLabel}>Paiement:</Text>
                <Text style={styles.paymentValue}>{(ride.price_per_seat || 0) * (booking.seats_booked || 1)} FCFA</Text>
                <View style={[styles.paymentBadge, { backgroundColor: '#F0FDF4' }]}>
                  <Text style={[styles.paymentBadgeText, { color: COLORS.success }]}>Payé</Text>
                </View>
              </View>

              <View style={styles.passengerActions}>
                <TouchableOpacity style={styles.actionBtn} onPress={handleChatPassenger}>
                  <Ionicons name="chatbubble-outline" size={20} color={COLORS.primary} />
                  <Text style={[styles.actionBtnText, { color: COLORS.primary }]}>Message</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={() => handleCallPassenger(booking.passenger_details?.phone)}>
                  <Ionicons name="call-outline" size={20} color={COLORS.success} />
                  <Text style={[styles.actionBtnText, { color: COLORS.success }]}>Appeler</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}

        {/* Cancelled Bookings */}
        {cancelledBookings.length > 0 && (
          <>
            <Text style={styles.sectionHeader}>Réservations annulées ({cancelledBookings.length})</Text>
            {cancelledBookings.map((booking) => (
              <View key={booking.id} style={[styles.passengerCard, { opacity: 0.7 }]}>
                <View style={styles.passengerHeader}>
                  <View style={[styles.passengerAvatar, { backgroundColor: COLORS.grayLight }]}>
                    <Text style={[styles.passengerAvatarText, { color: COLORS.textLight }]}>
                      {booking.passenger_details?.full_name?.substring(0,2).toUpperCase() || 'PA'}
                    </Text>
                  </View>
                  <View style={styles.passengerDetails}>
                    <Text style={[styles.passengerName, { color: COLORS.textLight, textDecorationLine: 'line-through' }]}>
                      {booking.passenger_details?.full_name}
                    </Text>
                    <Text style={styles.passengerPhone}>Annulé</Text>
                  </View>
                </View>
              </View>
            ))}
          </>
        )}

        {/* Preferences & Vehicle Info */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Véhicule & Préférences</Text>
          <View style={styles.prefRow}>
            <Ionicons name="car-outline" size={22} color={COLORS.textLight} />
            <View style={styles.prefContent}>
              <Text style={styles.prefTitle}>Mon Véhicule</Text>
              <Text style={styles.prefSubtitle}>Immatriculé • Autorisé</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.prefTags}>
            <View style={styles.tag}>
              <Ionicons name="logo-no-smoking" size={16} color={COLORS.text} />
              <Text style={styles.tagText}>Non fumeur</Text>
            </View>
            <View style={styles.tag}>
              <Ionicons name="musical-notes-outline" size={16} color={COLORS.text} />
              <Text style={styles.tagText}>Musique</Text>
            </View>
            <View style={styles.tag}>
              <Ionicons name="briefcase-outline" size={16} color={COLORS.text} />
              <Text style={styles.tagText}>Bagages acceptés</Text>
            </View>
          </View>
        </View>

        {/* Main Actions */}
        {ride.status === 'active' && (
          <View style={styles.mainActions}>
            <TouchableOpacity style={styles.btnSuccess} onPress={handleCompleteRide} activeOpacity={0.8}>
              <Ionicons name="checkmark-done" size={22} color={COLORS.white} />
              <Text style={styles.btnSuccessText}>Terminer le trajet</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.btnDanger} onPress={handleCancelRide} activeOpacity={0.8}>
              <Ionicons name="close" size={22} color={COLORS.error} />
              <Text style={styles.btnDangerText}>Annuler le trajet</Text>
            </TouchableOpacity>
          </View>
        )}
        
        {/* Spacer for FAB */}
        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Floating Action Button */}
      {confirmedBookings.length > 0 && ride.status === 'active' && (
        <View style={styles.fabContainer}>
          <TouchableOpacity style={styles.fab} onPress={handleChatPassenger} activeOpacity={0.9}>
            <Ionicons name="chatbubbles" size={20} color={COLORS.white} />
            <Text style={styles.fabText}>Contacter tous les passagers</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { justifyContent: 'center', alignItems: 'center' },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    padding: 16, 
    backgroundColor: COLORS.white, 
    borderBottomWidth: 1, 
    borderBottomColor: COLORS.border 
  },
  backButton: { padding: 8, marginLeft: -8 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  content: { padding: 16 },
  
  card: { 
    backgroundColor: COLORS.white, 
    borderRadius: 16, 
    padding: 20, 
    marginBottom: 16, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.05, 
    shadowRadius: 8, 
    elevation: 3 
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 16 },
  sectionHeader: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginTop: 8, marginBottom: 12, marginLeft: 4 },
  
  driverCard: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  driverAvatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  driverAvatarText: { color: COLORS.white, fontSize: 18, fontWeight: 'bold' },
  driverInfo: { flex: 1 },
  driverName: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  ratingRow: { flexDirection: 'row', alignItems: 'center' },
  ratingText: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginLeft: 4 },
  ridesCount: { fontSize: 14, color: COLORS.textLight, marginLeft: 8 },

  statusBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12, marginBottom: 16, gap: 8 },
  statusText: { fontSize: 14, fontWeight: '700', letterSpacing: 1 },

  timeline: { paddingLeft: 8, marginBottom: 16 },
  timelineItem: { flexDirection: 'row', marginBottom: 16, position: 'relative' },
  timelineDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 3, backgroundColor: COLORS.white, zIndex: 2, marginTop: 4 },
  timelineLine: { position: 'absolute', top: 18, left: 6, width: 2, height: 36, backgroundColor: COLORS.border, zIndex: 1 },
  timelineContent: { marginLeft: 16, flex: 1 },
  locationText: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  timeText: { fontSize: 14, color: COLORS.textLight, marginTop: 2 },

  divider: { height: 1, backgroundColor: COLORS.grayLight, marginVertical: 12 },
  
  rideMeta: { flexDirection: 'row', justifyContent: 'space-between' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaText: { fontSize: 14, fontWeight: '600', color: COLORS.text },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  statBox: { width: '48%', backgroundColor: COLORS.white, padding: 16, borderRadius: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
  statLabel: { fontSize: 12, color: COLORS.textLight, marginBottom: 4 },
  statValue: { fontSize: 16, fontWeight: '700', color: COLORS.text },

  emptyState: { backgroundColor: COLORS.white, padding: 32, borderRadius: 16, alignItems: 'center', marginBottom: 24 },
  emptyText: { color: COLORS.textLight, marginTop: 12, fontSize: 15 },

  passengerCard: { backgroundColor: COLORS.white, borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  passengerHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  passengerAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#E0F2FE', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  passengerAvatarText: { color: COLORS.primary, fontSize: 16, fontWeight: '700' },
  passengerDetails: { flex: 1 },
  passengerName: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 2 },
  passengerPhone: { fontSize: 13, color: COLORS.textLight, marginBottom: 4 },
  ratingTextSmall: { fontSize: 13, fontWeight: '600', color: COLORS.text, marginLeft: 4, marginRight: 8 },
  seatBadge: { backgroundColor: COLORS.grayLight, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, fontSize: 12, color: COLORS.text, overflow: 'hidden' },

  paymentRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.grayLight, padding: 12, borderRadius: 10, marginBottom: 16 },
  paymentLabel: { fontSize: 14, color: COLORS.textLight, marginRight: 8 },
  paymentValue: { fontSize: 14, fontWeight: '700', color: COLORS.text, flex: 1 },
  paymentBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  paymentBadgeText: { fontSize: 12, fontWeight: '700' },

  passengerActions: { flexDirection: 'row', gap: 12 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 10, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border, gap: 8 },
  actionBtnText: { fontSize: 14, fontWeight: '600' },

  prefRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  prefContent: { flex: 1 },
  prefTitle: { fontSize: 16, fontWeight: '600', color: COLORS.text },
  prefSubtitle: { fontSize: 13, color: COLORS.textLight, marginTop: 2 },
  prefTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.grayLight, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, gap: 6 },
  tagText: { fontSize: 13, color: COLORS.text, fontWeight: '500' },

  mainActions: { marginTop: 8, gap: 16 },
  btnSuccess: { flexDirection: 'row', backgroundColor: COLORS.success, padding: 18, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 8, shadowColor: COLORS.success, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
  btnSuccessText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
  btnDanger: { flexDirection: 'row', backgroundColor: COLORS.white, padding: 18, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: '#FECACA' },
  btnDangerText: { color: COLORS.error, fontSize: 16, fontWeight: '700' },

  fabContainer: { position: 'absolute', bottom: 24, left: 16, right: 16, alignItems: 'center' },
  fab: { flexDirection: 'row', backgroundColor: COLORS.primary, paddingVertical: 16, paddingHorizontal: 24, borderRadius: 30, alignItems: 'center', justifyContent: 'center', gap: 10, shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
  fabText: { color: COLORS.white, fontSize: 15, fontWeight: '700' },
});
