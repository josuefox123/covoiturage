import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, FlatList, Image, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { theme } from '../../src/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

interface Ride {
  id: string;
  driverName: string;
  driverAvatar: string;
  driverRating: number;
  departure: string;
  arrival: string;
  time: string;
  date: string;
  price: number;
  seatsAvailable: number;
}

const MOCK_RIDES: Ride[] = [
  {
    id: '1',
    driverName: 'Chérif G.',
    driverAvatar: 'CG',
    driverRating: 4.8,
    departure: 'Cotonou (Étoile Rouge)',
    arrival: 'Parakou (Dépôt)',
    time: '07:30',
    date: 'Aujourd\'hui',
    price: 7500,
    seatsAvailable: 3,
  },
  {
    id: '2',
    driverName: 'Amina T.',
    driverAvatar: 'AT',
    driverRating: 4.9,
    departure: 'Abomey-Calavi (UAC)',
    arrival: 'Porto-Novo (Mairie)',
    time: '14:15',
    date: 'Aujourd\'hui',
    price: 1500,
    seatsAvailable: 2,
  },
  {
    id: '3',
    driverName: 'Dona S.',
    driverAvatar: 'DS',
    driverRating: 4.6,
    departure: 'Ouidah (Basilique)',
    arrival: 'Cotonou (Fidjrossè)',
    time: '09:00',
    date: 'Demain',
    price: 1200,
    seatsAvailable: 4,
  },
  {
    id: '4',
    driverName: 'Koffi B.',
    driverAvatar: 'KB',
    driverRating: 4.7,
    departure: 'Bohicon (Carrefour)',
    arrival: 'Cotonou (Marina)',
    time: '16:30',
    date: 'Demain',
    price: 3500,
    seatsAvailable: 1,
  }
];

export default function HomeScreen() {
  const router = useRouter();
  const [departure, setDeparture] = useState('');
  const [destination, setDestination] = useState('');

  const renderRideItem = ({ item }: { item: Ride }) => (
    <TouchableOpacity 
      style={styles.rideCard}
      onPress={() => router.push(`/ride/${item.id}`)}
      activeOpacity={0.9}
    >
      <View style={styles.cardHeader}>
        <View style={styles.driverInfo}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{item.driverAvatar}</Text>
          </View>
          <View>
            <Text style={styles.driverName}>{item.driverName}</Text>
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={14} color="#F59E0B" />
              <Text style={styles.ratingText}>{item.driverRating}</Text>
            </View>
          </View>
        </View>
        <View style={styles.priceContainer}>
          <Text style={styles.priceText}>{item.price.toLocaleString()} FCFA</Text>
        </View>
      </View>

      <View style={styles.routeContainer}>
        <View style={styles.timelineContainer}>
          <View style={styles.timelineDot} />
          <View style={styles.timelineLine} />
          <View style={[styles.timelineDot, { backgroundColor: theme.colors.secondary }]} />
        </View>
        <View style={styles.routeDetails}>
          <View style={styles.routePoint}>
            <Text style={styles.locationText}>{item.departure}</Text>
            <Text style={styles.timeText}>{item.time}</Text>
          </View>
          <View style={[styles.routePoint, { marginTop: 16 }]}>
            <Text style={styles.locationText}>{item.arrival}</Text>
            <Text style={styles.timeText}>{item.date}</Text>
          </View>
        </View>
      </View>

      <View style={styles.cardFooter}>
        <View style={styles.infoBadge}>
          <Ionicons name="people-outline" size={16} color={theme.colors.textLight} />
          <Text style={styles.infoBadgeText}>{item.seatsAvailable} places restantes</Text>
        </View>
        <View style={styles.detailsBtn}>
          <Text style={styles.detailsBtnText}>Détails</Text>
          <Ionicons name="chevron-forward" size={14} color={theme.colors.primary} />
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={MOCK_RIDES}
        renderItem={renderRideItem}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <>
            {/* Greeting Header */}
            <View style={styles.header}>
              <View>
                <Text style={styles.greeting}>Bonjour 👋</Text>
                <Text style={styles.title}>Où allez-vous aujourd'hui ?</Text>
              </View>
              <TouchableOpacity style={styles.notificationBtn} onPress={() => router.push('/(tabs)/profile')}>
                <Ionicons name="notifications-outline" size={24} color={theme.colors.text} />
                <View style={styles.notifBadge} />
              </TouchableOpacity>
            </View>

            {/* Search Card */}
            <View style={styles.searchCard}>
              <View style={styles.searchRow}>
                <Ionicons name="location-outline" size={20} color={theme.colors.primary} style={styles.searchIcon} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Départ (ex: Cotonou...)"
                  placeholderTextColor={theme.colors.textMuted}
                  value={departure}
                  onChangeText={setDeparture}
                />
              </View>

              <View style={styles.divider} />

              <View style={styles.searchRow}>
                <Ionicons name="flag-outline" size={20} color={theme.colors.secondary} style={styles.searchIcon} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Destination (ex: Porto-Novo...)"
                  placeholderTextColor={theme.colors.textMuted}
                  value={destination}
                  onChangeText={setDestination}
                />
              </View>

              <TouchableOpacity style={styles.searchBtn} activeOpacity={0.8}>
                <Ionicons name="search" size={20} color="#fff" />
                <Text style={styles.searchBtnText}>Rechercher un trajet</Text>
              </TouchableOpacity>
            </View>

            {/* Ad Banner */}
            <TouchableOpacity style={styles.adBannerContainer} activeOpacity={0.9}>
              <Image source={require('../../assets/ad_banner.png')} style={styles.adBannerImage} />
              <View style={styles.adBannerOverlay}>
                <Text style={styles.adBannerText}>Découvrez le Bénin en toute sérénité !</Text>
                <View style={styles.adBannerBadge}>
                  <Text style={styles.adBannerBadgeText}>Sponsorisé</Text>
                </View>
              </View>
            </TouchableOpacity>

            {/* Section Title */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Trajets à proximité</Text>
              <TouchableOpacity>
                <Text style={styles.seeAllText}>Tout voir</Text>
              </TouchableOpacity>
            </View>
          </>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  listContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: theme.spacing.lg,
  },
  greeting: {
    ...theme.typography.bodyMedium,
    color: theme.colors.textLight,
  },
  title: {
    ...theme.typography.h2,
    color: theme.colors.text,
    fontSize: 22,
    marginTop: 2,
  },
  notificationBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadows.sm,
  },
  notifBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.error,
  },
  searchCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.md,
    ...theme.shadows.md,
    marginBottom: theme.spacing.xl,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 50,
  },
  searchIcon: {
    marginRight: theme.spacing.md,
  },
  searchInput: {
    flex: 1,
    color: theme.colors.text,
    ...theme.typography.bodyLarge,
    height: '100%',
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginLeft: 36,
    marginVertical: 4,
  },
  searchBtn: {
    backgroundColor: theme.colors.primary,
    flexDirection: 'row',
    height: 52,
    borderRadius: theme.borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: theme.spacing.md,
    gap: 8,
    ...theme.shadows.sm,
  },
  searchBtnText: {
    ...theme.typography.button,
    color: '#fff',
  },
  adBannerContainer: {
    marginBottom: theme.spacing.xl,
    borderRadius: theme.borderRadius.xl,
    overflow: 'hidden',
    height: 140,
    ...theme.shadows.md,
  },
  adBannerImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  adBannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  adBannerText: {
    ...theme.typography.h2,
    color: '#fff',
    maxWidth: '90%',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 4,
  },
  adBannerBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  adBannerBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  sectionTitle: {
    ...theme.typography.h3,
    color: theme.colors.text,
  },
  seeAllText: {
    ...theme.typography.bodySmall,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  rideCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    ...theme.shadows.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingBottom: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  driverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  avatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: theme.colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: theme.colors.primaryDark,
    fontWeight: '700',
    fontSize: 14,
  },
  driverName: {
    ...theme.typography.bodyMedium,
    fontWeight: '600',
    color: theme.colors.text,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 1,
  },
  ratingText: {
    ...theme.typography.bodySmall,
    color: theme.colors.textLight,
  },
  priceContainer: {
    backgroundColor: theme.colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.sm,
  },
  priceText: {
    color: theme.colors.primaryDark,
    fontWeight: '700',
    fontSize: 14,
  },
  routeContainer: {
    flexDirection: 'row',
    paddingLeft: 6,
    marginBottom: theme.spacing.md,
  },
  timelineContainer: {
    alignItems: 'center',
    width: 12,
    marginRight: theme.spacing.md,
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  locationText: {
    ...theme.typography.bodyMedium,
    color: theme.colors.text,
    fontWeight: '500',
    maxWidth: '75%',
  },
  timeText: {
    ...theme.typography.bodySmall,
    color: theme.colors.textLight,
    fontWeight: '600',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: theme.spacing.sm,
  },
  infoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  infoBadgeText: {
    ...theme.typography.bodySmall,
    color: theme.colors.textLight,
  },
  detailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  detailsBtnText: {
    ...theme.typography.bodySmall,
    color: theme.colors.primary,
    fontWeight: '700',
  },
});
