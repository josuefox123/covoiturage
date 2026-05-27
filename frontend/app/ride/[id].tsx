import React, { useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { theme } from '../../src/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

interface MockRideDetail {
  id: string;
  driverName: string;
  driverAvatar: string;
  driverRating: number;
  driverPhone: string;
  departure: string;
  arrival: string;
  time: string;
  date: string;
  price: number;
  seatsAvailable: number;
  vehicle: string;
  vehiclePlate: string;
  preferences: string[];
}

const RIDE_DETAILS: Record<string, MockRideDetail> = {
  '1': {
    id: '1',
    driverName: 'Chérif G.',
    driverAvatar: 'CG',
    driverRating: 4.8,
    driverPhone: '+229 97 12 34 56',
    departure: 'Cotonou (Carrefour Étoile Rouge)',
    arrival: 'Parakou (Dépôt Nord)',
    time: '07:30',
    date: 'Aujourd\'hui, 27 Mai',
    price: 7500,
    seatsAvailable: 3,
    vehicle: 'Toyota Corolla Grise',
    vehiclePlate: '9876-RB-BJ',
    preferences: ['Musique OK', 'Pas de cigarette', 'Climatisé'],
  },
  '2': {
    id: '2',
    driverName: 'Amina T.',
    driverAvatar: 'AT',
    driverRating: 4.9,
    driverPhone: '+229 96 98 76 54',
    departure: 'Abomey-Calavi (Entrée UAC)',
    arrival: 'Porto-Novo (Mairie Centre)',
    time: '14:15',
    date: 'Aujourd\'hui, 27 Mai',
    price: 1500,
    seatsAvailable: 2,
    vehicle: 'Hyundai Elantra Bleue',
    vehiclePlate: '4321-RC-BJ',
    preferences: ['Discussion OK', 'Musique douce', 'Climatisé'],
  },
  '3': {
    id: '3',
    driverName: 'Dona S.',
    driverAvatar: 'DS',
    driverRating: 4.6,
    driverPhone: '+229 90 22 33 44',
    departure: 'Ouidah (Esplanade Basilique)',
    arrival: 'Cotonou (Plage Fidjrossè)',
    time: '09:00',
    date: 'Demain, 28 Mai',
    price: 1200,
    seatsAvailable: 4,
    vehicle: 'Nissan Almera Rouge',
    vehiclePlate: '1122-RD-BJ',
    preferences: ['Pas de tabac', 'Discussion modérée'],
  },
  '4': {
    id: '4',
    driverName: 'Koffi B.',
    driverAvatar: 'KB',
    driverRating: 4.7,
    driverPhone: '+229 95 55 66 77',
    departure: 'Bohicon (Carrefour principal)',
    arrival: 'Cotonou (Marina Mall)',
    time: '16:30',
    date: 'Demain, 28 Mai',
    price: 3500,
    seatsAvailable: 1,
    vehicle: 'Peugeot 301 Noire',
    vehiclePlate: '5566-RE-BJ',
    preferences: ['Climatisé', 'Musique locale OK'],
  }
};

export default function RideDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [booked, setBooked] = useState(false);

  const ride = RIDE_DETAILS[id || '1'] || RIDE_DETAILS['1'];

  const handleBooking = () => {
    setBooked(true);
    Alert.alert(
      'Réservation confirmée ! 🎉',
      `Votre place avec ${ride.driverName} a été réservée. Vous pouvez maintenant le contacter directement par chat.`,
      [
        {
          text: 'Discuter avec le chauffeur',
          onPress: () => router.push(`/chat/${ride.id}`)
        },
        {
          text: 'Fermer',
          style: 'cancel'
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Détails du trajet</Text>
        <View style={{ width: 44 }} />{/* Balance space */}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Route Details Card */}
        <View style={styles.card}>
          <Text style={styles.dateText}>{ride.date}</Text>
          
          <View style={styles.routeContainer}>
            <View style={styles.timelineContainer}>
              <View style={styles.timelineDot} />
              <View style={styles.timelineLine} />
              <View style={[styles.timelineDot, { backgroundColor: theme.colors.secondary }]} />
            </View>
            <View style={styles.routeDetails}>
              <View style={styles.routePoint}>
                <Text style={styles.timeText}>{ride.time}</Text>
                <Text style={styles.locationText}>{ride.departure}</Text>
              </View>
              <View style={[styles.routePoint, { marginTop: 32 }]}>
                <Text style={styles.timeText}>Arrivée approx.</Text>
                <Text style={styles.locationText}>{ride.arrival}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Cost & Spots */}
        <View style={styles.pricingCard}>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Prix par passager</Text>
            <Text style={styles.priceValue}>{ride.price.toLocaleString()} FCFA</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Places restantes</Text>
            <Text style={styles.seatsValue}>{ride.seatsAvailable} places</Text>
          </View>
        </View>

        {/* Driver Profile */}
        <Text style={styles.sectionTitle}>Votre conducteur</Text>
        <View style={styles.card}>
          <View style={styles.driverRow}>
            <View style={styles.avatarBig}>
              <Text style={styles.avatarBigText}>{ride.driverAvatar}</Text>
            </View>
            <View style={styles.driverInfo}>
              <Text style={styles.driverName}>{ride.driverName}</Text>
              <View style={styles.ratingRow}>
                <Ionicons name="star" size={16} color="#F59E0B" />
                <Text style={styles.ratingText}>{ride.driverRating} • Avis certifiés</Text>
              </View>
              <View style={styles.verifiedBadge}>
                <Ionicons name="shield-checkmark" size={12} color={theme.colors.success} />
                <Text style={styles.verifiedText}>Téléphone et ID vérifiés</Text>
              </View>
            </View>
          </View>
          
          <View style={styles.divider} />
          
          {/* Vehicle */}
          <View style={styles.infoRow}>
            <Ionicons name="car-outline" size={20} color={theme.colors.textLight} />
            <View>
              <Text style={styles.infoLabel}>Véhicule</Text>
              <Text style={styles.infoValue}>{ride.vehicle} ({ride.vehiclePlate})</Text>
            </View>
          </View>

          {/* Preferences */}
          <View style={[styles.infoRow, { marginTop: 12 }]}>
            <Ionicons name="options-outline" size={20} color={theme.colors.textLight} />
            <View>
              <Text style={styles.infoLabel}>Préférences</Text>
              <View style={styles.prefContainer}>
                {ride.preferences.map((pref, index) => (
                  <View key={index} style={styles.prefBadge}>
                    <Text style={styles.prefText}>{pref}</Text>
                  </View>
                ))}
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
          onPress={() => router.push(`/chat/${ride.id}`)}
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
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.card,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    ...theme.typography.h3,
    color: theme.colors.text,
  },
  scrollContent: {
    padding: theme.spacing.lg,
    paddingBottom: 100,
  },
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    ...theme.shadows.sm,
    marginBottom: theme.spacing.md,
  },
  dateText: {
    ...theme.typography.bodyLarge,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.lg,
  },
  routeContainer: {
    flexDirection: 'row',
    paddingLeft: 6,
  },
  timelineContainer: {
    alignItems: 'center',
    width: 12,
    marginRight: theme.spacing.lg,
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: theme.colors.primary,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: theme.colors.border,
    marginVertical: 4,
  },
  routeDetails: {
    flex: 1,
  },
  routePoint: {
    flexDirection: 'column',
  },
  timeText: {
    ...theme.typography.bodySmall,
    color: theme.colors.textMuted,
    fontWeight: '600',
    marginBottom: 4,
  },
  locationText: {
    ...theme.typography.bodyLarge,
    color: theme.colors.text,
    fontWeight: '600',
  },
  pricingCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    ...theme.shadows.sm,
    marginBottom: theme.spacing.lg,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceLabel: {
    ...theme.typography.bodyMedium,
    color: theme.colors.textLight,
  },
  priceValue: {
    ...theme.typography.h2,
    color: theme.colors.primary,
    fontSize: 22,
  },
  seatsValue: {
    ...theme.typography.bodyLarge,
    fontWeight: '700',
    color: theme.colors.text,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: theme.spacing.md,
  },
  sectionTitle: {
    ...theme.typography.bodyLarge,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
    paddingLeft: 4,
  },
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  avatarBig: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: theme.colors.secondaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarBigText: {
    color: theme.colors.secondaryDark,
    fontSize: 20,
    fontWeight: '700',
  },
  driverInfo: {
    flex: 1,
    gap: 2,
  },
  driverName: {
    ...theme.typography.bodyLarge,
    fontWeight: '700',
    color: theme.colors.text,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    ...theme.typography.bodySmall,
    color: theme.colors.textLight,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  verifiedText: {
    fontSize: 11,
    color: theme.colors.success,
    fontWeight: '600',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.md,
  },
  infoLabel: {
    ...theme.typography.bodySmall,
    color: theme.colors.textMuted,
    fontWeight: '600',
  },
  infoValue: {
    ...theme.typography.bodyMedium,
    color: theme.colors.text,
    marginTop: 2,
  },
  prefContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
    marginTop: 6,
  },
  prefBadge: {
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.sm,
  },
  prefText: {
    fontSize: 11,
    color: theme.colors.textLight,
  },
  policyAlert: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    backgroundColor: theme.colors.secondaryLight,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginBottom: theme.spacing.xl,
  },
  policyTitle: {
    ...theme.typography.bodyMedium,
    fontWeight: '700',
    color: theme.colors.secondaryDark,
  },
  policyDesc: {
    ...theme.typography.bodySmall,
    color: theme.colors.secondaryDark,
    marginTop: 2,
    lineHeight: 16,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.colors.card,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    padding: theme.spacing.md,
    flexDirection: 'row',
    gap: theme.spacing.md,
    ...theme.shadows.lg,
  },
  messageBtn: {
    width: 52,
    height: 52,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bookBtn: {
    flex: 1,
    height: 52,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadows.sm,
  },
  bookedBtn: {
    backgroundColor: theme.colors.success,
  },
  bookBtnText: {
    ...theme.typography.button,
    color: '#fff',
  },
});
