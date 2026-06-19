import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, ActivityIndicator, Animated } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';
import { Ride, Booking } from '../../src/types';
import { CustomAlert } from '../../src/utils/CustomAlert';

const COLORS = {
  primary: '#2F80ED',
  success: '#16A34A',
  error: '#DC2626',
  warning: '#F59E0B',
  white: '#FFFFFF',
  background: '#F3F4F6',
  card: '#FFFFFF',
  text: '#1F2937',
  textLight: '#6B7280',
  border: '#E5E7EB',
  grayLight: '#F9FAFB',
  primaryLight: '#EFF6FF'
};

export default function RideDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { authFetch, user } = useAuth();

  const [ride, setRide] = useState<Ride | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasBooked, setHasBooked] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);

  useEffect(() => {
    fetchRide();
  }, [id]);

  const fetchRide = async () => {
    try {
      setLoading(true);
      const data: Ride = await authFetch(`/rides/${id}/`);
      setRide(data);
      
      if (user) {
        const bookings: Booking[] = await authFetch(`/bookings/?passenger=${user.id}`);
        const myBooking = bookings.find((b) => 
          typeof b.ride === 'object' && b.ride !== null 
            ? String(b.ride.id) === String(id) 
            : String(b.ride) === String(id)
        );
        if (myBooking) setHasBooked(true);
      }
    } catch (error) {
      CustomAlert.alert("Erreur", "Impossible de charger les détails du trajet.");
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const openChat = async () => {
    setChatLoading(true);
    try {
      const conv = await authFetch('/conversations/ride-chat/', {
        method: 'POST',
        body: JSON.stringify({ ride_id: id }),
      });
      router.push(`/chat/${conv.id}`);
    } catch (error: any) {
      CustomAlert.alert('Messagerie', error.message || 'Impossible d\'ouvrir la conversation.');
    } finally {
      setChatLoading(false);
    }
  };

  const handleBooking = async () => {
    if (!user?.is_verified) {
      CustomAlert.alert('Compte non vérifié', 'Votre compte doit être vérifié pour effectuer une réservation.');
      return;
    }
    
    try {
      setBookingLoading(true);
      await authFetch('/bookings/', {
        method: 'POST',
        body: JSON.stringify({ ride: id, seats_booked: 1 })
      });

      setHasBooked(true);
      CustomAlert.alert(
        'Réservation confirmée ! 🎉',
        `Votre place avec ${ride?.driver_details?.full_name || 'le conducteur'} a été réservée. Vous pouvez maintenant discuter.`,
        [
          { text: 'Discuter maintenant', onPress: openChat },
          { text: 'Fermer', style: 'cancel' }
        ]
      );
    } catch (error: any) {
      CustomAlert.alert('Erreur', error.message || 'Impossible de réserver ce trajet.');
    } finally {
      setBookingLoading(false);
    }
  };

  if (loading || !ride) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <Text style={{ fontSize: 40, marginBottom: 16 }}>🚗</Text>
        <Text style={{ color: COLORS.textLight, fontSize: 16, fontWeight: '600' }}>Chargement du trajet...</Text>
      </SafeAreaView>
    );
  }

  const driverName = ride.driver_details?.full_name || 'Inconnu';
  const driverAvatar = (driverName || '??').split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();
  const isOwnRide = user?.id === ride.driver_details?.id;
  const canChat = hasBooked || isOwnRide;
  const isCompleted = ride.status === 'completed';

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity activeOpacity={0.85} style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Détails du trajet</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Pseudo Map Placeholder */}
        <View style={styles.mapPlaceholder}>
          <Ionicons name="map" size={48} color={COLORS.primary} style={{ opacity: 0.2 }} />
          <Text style={styles.mapText}>Aperçu de l'itinéraire</Text>
        </View>

        {isCompleted && (
          <View style={styles.completedBadge}>
            <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
            <Text style={styles.completedText}>Trajet terminé</Text>
          </View>
        )}

        {/* Big Date */}
        <Text style={styles.dateText}>{ride.departure_date}</Text>

        {/* Timeline Route Card */}
        <View style={styles.card}>
          <View style={styles.timelineItem}>
            <View style={styles.timelineDotStart} />
            <View style={styles.timelineContent}>
              <Text style={styles.locationText}>{ride.departure_location}</Text>
              <Text style={styles.timeText}>{ride.departure_time?.substring(0, 5) ?? '--:--'}</Text>
            </View>
          </View>

          <View style={styles.timelineLink}>
            <View style={styles.timelineLine} />
            <Text style={styles.distanceText}>{ride.distance_km ? `${ride.distance_km} km` : 'Trajet direct'}</Text>
          </View>

          <View style={styles.timelineItem}>
            <Ionicons name="location" size={20} color={COLORS.error} style={styles.timelineIconEnd} />
            <View style={styles.timelineContent}>
              <Text style={styles.locationText}>{ride.arrival_location}</Text>
              <Text style={styles.timeText}>Estimation {ride.distance_km ? '~' + Math.round(ride.distance_km / 60) + 'h' : '--:--'}</Text>
            </View>
          </View>
        </View>

        {/* Pricing Card */}
        <View style={styles.card}>
          <View style={styles.priceRow}>
            <View>
              <Text style={styles.priceLabel}>Prix total</Text>
              <View style={styles.seatsBadge}>
                <Ionicons name="people" size={16} color={COLORS.textLight} />
                <Text style={styles.seatsValue}>{ride.seats_available} places restantes</Text>
              </View>
            </View>
            <View style={styles.priceAmountBlock}>
              <Text style={styles.priceValue}>{ride.price_per_seat?.toLocaleString() ?? "0"}</Text>
              <Text style={styles.priceCurrency}>FCFA</Text>
              <Text style={styles.priceUnit}>par place</Text>
            </View>
          </View>
        </View>

        {/* Driver Profile */}
        <Text style={styles.sectionTitle}>Conducteur</Text>
        <View style={styles.card}>
          <View style={styles.driverRow}>
            <View style={styles.avatarBig}>
              <Text style={styles.avatarBigText}>{driverAvatar}</Text>
            </View>
            <View style={styles.driverInfo}>
              <Text style={styles.driverName}>{driverName}</Text>
              <View style={styles.driverMeta}>
                <Ionicons name="star" size={14} color={COLORS.warning} />
                <Text style={styles.ratingText}>{ride.driver_details?.rating || 'Nouveau'} • 12 trajets</Text>
              </View>
              <View style={styles.verifiedBadge}>
                <Ionicons name="shield-checkmark" size={14} color={COLORS.success} />
                <Text style={styles.verifiedText}>Conducteur vérifié</Text>
              </View>
            </View>
          </View>
          
          <View style={styles.divider} />

          {/* Vehicle Info */}
          <View style={styles.vehicleInfo}>
            <Ionicons name="car-outline" size={24} color={COLORS.textLight} />
            <Text style={styles.vehicleText}>
              {ride.driver_details?.vehicle?.model || 'Véhicule standard'} • {ride.driver_details?.vehicle?.color || 'Couleur non précisée'}
            </Text>
          </View>
          
          {/* Preferences */}
          {ride.driver_details?.preference && (
            <View style={styles.preferencesContainer}>
              <View style={styles.prefItem}>
                 <Text style={styles.prefText}>🎵 {ride.driver_details.preference.music ? "Musique" : "Pas de musique"}</Text>
              </View>
              <View style={styles.prefItem}>
                 <Text style={styles.prefText}>{ride.driver_details.preference.smoking ? "🚬 Fumeur" : "🚭 Non-fumeur"}</Text>
              </View>
              <View style={styles.prefItem}>
                 <Text style={styles.prefText}>💬 {ride.driver_details.preference.chatty ? "Bavard" : "Calme"}</Text>
              </View>
              <View style={styles.prefItem}>
                 <Text style={styles.prefText}>❄️ {ride.driver_details.preference.air_conditioner ? "Climatisation" : "Sans clim"}</Text>
              </View>
            </View>
          )}
        </View>

      </ScrollView>

      {/* Modern Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.messageBtn, !canChat && styles.messageBtnDisabled]}
          onPress={() => {
            if (!canChat) {
              CustomAlert.alert("Messagerie", "Vous devez réserver ce trajet avant de pouvoir discuter.");
            } else if (isOwnRide) {
              router.push('/(tabs)/messages');
            } else {
              openChat();
            }
          }}
          disabled={chatLoading}
          activeOpacity={0.85}
        >
          {chatLoading ? (
            <ActivityIndicator color={COLORS.primary} size="small" />
          ) : (
            <Ionicons name="chatbubble-ellipses" size={24} color={canChat ? COLORS.primary : COLORS.textLight} />
          )}
        </TouchableOpacity>

        {!isOwnRide ? (
          <TouchableOpacity
            style={[styles.bookBtn, hasBooked && styles.bookedBtn, (bookingLoading || isCompleted) && { opacity: 0.7 }]}
            onPress={handleBooking}
            disabled={hasBooked || bookingLoading || isCompleted}
            activeOpacity={0.85}
          >
            {bookingLoading ? (
               <ActivityIndicator color={COLORS.white} />
            ) : hasBooked ? (
               <View style={styles.btnRow}>
                 <Ionicons name="checkmark-circle" size={20} color={COLORS.white} />
                 <Text style={styles.bookBtnText}>Place Réservée</Text>
               </View>
            ) : isCompleted ? (
               <Text style={styles.bookBtnText}>Trajet Terminé</Text>
            ) : (
               <View style={styles.btnRow}>
                 <Text style={styles.bookBtnText}>Continuer</Text>
                 <Ionicons name="arrow-forward" size={20} color={COLORS.white} />
               </View>
            )}
          </TouchableOpacity>
        ) : (
          <View style={[styles.bookBtn, { backgroundColor: COLORS.border }]}>
             <Text style={[styles.bookBtnText, { color: COLORS.textLight }]}>C'est votre trajet</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: COLORS.white },
  backButton: { width: 44, height: 44, justifyContent: 'center', alignItems: 'flex-start' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  
  scrollContent: { padding: 16, paddingBottom: 100 },
  
  mapPlaceholder: { height: 120, backgroundColor: '#E0F2FE', borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 16, borderWidth: 1, borderColor: '#BAE6FD' },
  mapText: { fontSize: 14, color: COLORS.primary, fontWeight: '600', marginTop: 8 },

  completedBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0FDF4', padding: 12, borderRadius: 12, marginBottom: 16, justifyContent: 'center', gap: 8 },
  completedText: { color: COLORS.success, fontSize: 16, fontWeight: '700' },

  dateText: { fontSize: 22, fontWeight: '800', color: COLORS.text, marginBottom: 16 },
  
  card: { backgroundColor: COLORS.white, borderRadius: 16, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3, marginBottom: 16 },
  
  timelineItem: { flexDirection: 'row', alignItems: 'flex-start' },
  timelineDotStart: { width: 14, height: 14, borderRadius: 7, backgroundColor: COLORS.text, marginTop: 4, marginLeft: 3 },
  timelineIconEnd: { marginLeft: -1, marginTop: 2 },
  timelineContent: { marginLeft: 16, flex: 1 },
  locationText: { fontSize: 18, color: COLORS.text, fontWeight: '700' },
  timeText: { fontSize: 14, color: COLORS.textLight, marginTop: 4 },
  
  timelineLink: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  timelineLine: { width: 2, height: 40, backgroundColor: COLORS.border, marginLeft: 9 },
  distanceText: { fontSize: 13, color: COLORS.textLight, marginLeft: 24, fontWeight: '500' },

  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  priceLabel: { fontSize: 14, color: COLORS.textLight, marginBottom: 8 },
  seatsBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.grayLight, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
  seatsValue: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  
  priceAmountBlock: { alignItems: 'flex-end' },
  priceValue: { fontSize: 32, fontWeight: '800', color: COLORS.text },
  priceCurrency: { fontSize: 14, fontWeight: '700', color: COLORS.text, marginTop: -4 },
  priceUnit: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },

  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 16 },
  
  sectionTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 12, marginLeft: 4 },
  
  driverRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatarBig: { width: 64, height: 64, borderRadius: 32, backgroundColor: COLORS.primaryLight, justifyContent: 'center', alignItems: 'center' },
  avatarBigText: { color: COLORS.primary, fontSize: 24, fontWeight: '700' },
  driverInfo: { flex: 1, gap: 4 },
  driverName: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  driverMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { fontSize: 14, fontWeight: '600', color: COLORS.textLight },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  verifiedText: { fontSize: 13, fontWeight: '600', color: COLORS.success },
  
  vehicleInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  vehicleText: { fontSize: 15, fontWeight: '500', color: COLORS.text },

  preferencesContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  prefItem: { backgroundColor: COLORS.grayLight, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  prefText: { fontSize: 13, color: COLORS.text, fontWeight: '500' },
  
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.border, padding: 16, flexDirection: 'row', gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 10 },
  
  messageBtn: { width: 56, height: 56, borderRadius: 16, backgroundColor: COLORS.primaryLight, justifyContent: 'center', alignItems: 'center' },
  messageBtnDisabled: { backgroundColor: COLORS.grayLight },
  
  bookBtn: { flex: 1, height: 56, backgroundColor: COLORS.primary, borderRadius: 16, justifyContent: 'center', alignItems: 'center', shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
  bookedBtn: { backgroundColor: COLORS.success, shadowColor: COLORS.success },
  btnRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bookBtnText: { fontSize: 16, fontWeight: '700', color: COLORS.white },
});
