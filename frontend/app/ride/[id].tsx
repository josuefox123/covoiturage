import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { theme } from '../../src/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';

export default function RideDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { authFetch } = useAuth();

  const [ride, setRide] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [booked, setBooked] = useState(false);

  useEffect(() => {
    fetchRide();
  }, [id]);

  const fetchRide = async () => {
    try {
      setLoading(true);
      const data = await authFetch(`/rides/${id}/`);
      setRide(data);
    } catch (error) {
      Alert.alert("Erreur", "Impossible de charger les détails du trajet.");
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleBooking = async () => {
    try {
      setBooked(true);
      await authFetch('/bookings/', {
        method: 'POST',
        body: JSON.stringify({
          ride: id,
          seats_booked: 1
        })
      });

      // Optionally create a conversation
      const convData = await authFetch('/conversations/', {
        method: 'POST',
        body: JSON.stringify({
          ride: id,
          participant_2: ride.driver_details.id // Assuming backend accepts this or it's handled differently. 
          // For a fully working app, we should adjust the backend to handle conversation creation gracefully.
        })
      }).catch(e => null);

      Alert.alert(
        'Réservation confirmée ! 🎉',
        `Votre place avec ${ride.driver_details.full_name} a été réservée.`,
        [
          {
            text: 'Fermer',
            style: 'cancel'
          }
        ]
      );
    } catch (error: any) {
      setBooked(false);
      Alert.alert('Erreur', error.message || 'Impossible de réserver ce trajet.');
    }
  };

  if (loading || !ride) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </SafeAreaView>
    );
  }

  const driverName = ride.driver_details?.full_name || 'Inconnu';
  const driverAvatar = driverName.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Détails du trajet</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Route Details Card */}
        <View style={styles.card}>
          <Text style={styles.dateText}>{ride.departure_date}</Text>

          <View style={styles.routeContainer}>
            <View style={styles.timelineContainer}>
              <View style={styles.timelineDot} />
              <View style={styles.timelineLine} />
              <View style={[styles.timelineDot, { backgroundColor: theme.colors.secondary }]} />
            </View>
            <View style={styles.routeDetails}>
              <View style={styles.routePoint}>
                <Text style={styles.timeText}>{ride.departure_time.substring(0, 5)}</Text>
                <Text style={styles.locationText}>{ride.departure_location}</Text>
              </View>
              <View style={[styles.routePoint, { marginTop: 32 }]}>
                <Text style={styles.timeText}>Arrivée approx.</Text>
                <Text style={styles.locationText}>{ride.arrival_location}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Cost & Spots */}
        <View style={styles.pricingCard}>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Prix par passager</Text>
            <Text style={styles.priceValue}>{ride.price_per_seat.toLocaleString()} FCFA</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Places restantes</Text>
            <Text style={styles.seatsValue}>{ride.seats_available} places</Text>
          </View>
        </View>

        {/* Driver Profile */}
        <Text style={styles.sectionTitle}>Votre conducteur</Text>
        <View style={styles.card}>
          <View style={styles.driverRow}>
            <View style={styles.avatarBig}>
              <Text style={styles.avatarBigText}>{driverAvatar}</Text>
            </View>
            <View style={styles.driverInfo}>
              <Text style={styles.driverName}>{driverName}</Text>
              <View style={styles.ratingRow}>
                <Ionicons name="star" size={16} color={theme.colors.warning} />
                <Text style={styles.ratingText}>{ride.driver_details?.rating || 0} • Avis certifiés</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Anti-number policy note */}
        <View style={styles.policyAlert}>
          <Ionicons name="warning-outline" size={20} color={theme.colors.secondaryDark} />
          <View style={{ flex: 1 }}>
            <Text style={styles.policyTitle}>Sécurité importante</Text>
            <Text style={styles.policyDesc}>
              Pour votre sécurité, n'échangez pas de numéros de téléphone en commentaire. Utilisez la messagerie intégrée.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Footer Booking Buttons */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.messageBtn}
          onPress={() => { }} // Needs conversation ID logic for full implementation
          activeOpacity={0.8}
        >
          <Ionicons name="chatbubble-outline" size={22} color={theme.colors.primary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.bookBtn, booked && styles.bookedBtn]}
          onPress={handleBooking}
          disabled={booked}
          activeOpacity={0.8}
        >
          <Text style={styles.bookBtnText}>
            {booked ? 'Place Réservée ✓' : 'Réserver une place'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.sm, backgroundColor: theme.colors.card, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  backButton: { width: 44, height: 44, justifyContent: 'center', alignItems: 'flex-start' },
  headerTitle: { ...theme.typography.h3, color: theme.colors.text },
  scrollContent: { padding: theme.spacing.lg, paddingBottom: 100 },
  card: { backgroundColor: theme.colors.card, borderRadius: theme.borderRadius.xl, padding: theme.spacing.xl, ...theme.shadows.sm, marginBottom: theme.spacing.md },
  dateText: { ...theme.typography.bodyLarge, fontWeight: '700', color: theme.colors.text, marginBottom: theme.spacing.lg },
  routeContainer: { flexDirection: 'row', paddingLeft: 6 },
  timelineContainer: { alignItems: 'center', width: 12, marginRight: theme.spacing.lg, justifyContent: 'space-between', paddingVertical: 6 },
  timelineDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: theme.colors.primary },
  timelineLine: { width: 2, flex: 1, backgroundColor: theme.colors.border, marginVertical: 4 },
  routeDetails: { flex: 1 },
  routePoint: { flexDirection: 'column' },
  timeText: { ...theme.typography.bodySmall, color: theme.colors.textMuted, fontWeight: '600', marginBottom: 4 },
  locationText: { ...theme.typography.bodyLarge, color: theme.colors.text, fontWeight: '600' },
  pricingCard: { backgroundColor: theme.colors.card, borderRadius: theme.borderRadius.xl, padding: theme.spacing.lg, ...theme.shadows.sm, marginBottom: theme.spacing.lg },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  priceLabel: { ...theme.typography.bodyMedium, color: theme.colors.textLight },
  priceValue: { ...theme.typography.h2, color: theme.colors.primary, fontSize: 22 },
  seatsValue: { ...theme.typography.bodyLarge, fontWeight: '700', color: theme.colors.text },
  divider: { height: 1, backgroundColor: theme.colors.border, marginVertical: theme.spacing.md },
  sectionTitle: { ...theme.typography.bodyLarge, fontWeight: '700', color: theme.colors.text, marginBottom: theme.spacing.sm, paddingLeft: 4 },
  driverRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  avatarBig: { width: 60, height: 60, borderRadius: 30, backgroundColor: theme.colors.secondaryLight, justifyContent: 'center', alignItems: 'center' },
  avatarBigText: { color: theme.colors.secondaryDark, fontSize: 20, fontWeight: '700' },
  driverInfo: { flex: 1, gap: 2 },
  driverName: { ...theme.typography.bodyLarge, fontWeight: '700', color: theme.colors.text },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { ...theme.typography.bodySmall, color: theme.colors.textLight },
  policyAlert: { flexDirection: 'row', gap: theme.spacing.md, backgroundColor: theme.colors.secondaryLight, padding: theme.spacing.md, borderRadius: theme.borderRadius.lg, borderWidth: 1, borderColor: '#FDE68A', marginBottom: theme.spacing.xl, marginTop: theme.spacing.md },
  policyTitle: { ...theme.typography.bodyMedium, fontWeight: '700', color: theme.colors.secondaryDark },
  policyDesc: { ...theme.typography.bodySmall, color: theme.colors.secondaryDark, marginTop: 2, lineHeight: 16 },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: theme.colors.card, borderTopWidth: 1, borderTopColor: theme.colors.border, padding: theme.spacing.md, flexDirection: 'row', gap: theme.spacing.md, ...theme.shadows.lg },
  messageBtn: { width: 52, height: 52, borderRadius: theme.borderRadius.lg, borderWidth: 1.5, borderColor: theme.colors.primary, justifyContent: 'center', alignItems: 'center' },
  bookBtn: { flex: 1, height: 52, backgroundColor: theme.colors.primary, borderRadius: theme.borderRadius.lg, justifyContent: 'center', alignItems: 'center', ...theme.shadows.sm },
  bookedBtn: { backgroundColor: theme.colors.success },
  bookBtnText: { ...theme.typography.button, color: theme.colors.white },
});
