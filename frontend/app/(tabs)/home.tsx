/**
 * ==============================================================
 * home.tsx — Écran d'accueil Zemy
 * Recherche classique + Recherche autour de moi
 * ==============================================================
 */

import React, { useState, useCallback, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Animated,
  RefreshControl,
  Platform,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';

import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../../src/context/AuthContext';
import { useBadges } from '../../src/context/BadgeContext';
import VerificationModal from '../../src/components/VerificationModal';

import Header from '../../src/components/home/Header';
import ServiceSelector, {
  VehicleType,
} from '../../src/components/home/ServiceSelector';

import SearchCard, {
  SearchParams,
} from '../../src/components/home/SearchCard';

import PromoCard from '../../src/components/home/PromoCard';
import TodayTrips from '../../src/components/home/TodayTrips';
import LocationPicker from '../../src/components/LocationPicker';
import { CustomAlert } from '../../src/utils/CustomAlert';

export default function HomeScreen() {
  const router = useRouter();

  const {
    user,
    refreshUser,
    hasStartedVerification,
    setHasStartedVerification,
  } = useAuth();

  const { notifCount } = useBadges();

  // ============================================================
  // STATES
  // ============================================================

  const [refreshing, setRefreshing] = useState(false);

  const [pickingFor, setPickingFor] = useState<
    'departure' | 'arrival' | null
  >(null);

  const [nearbyLoading, setNearbyLoading] = useState(false);

  const [searchParams, setSearchParams] = useState<SearchParams>({
    departure: '',
    destination: '',
    vehicleType: 'covoiturage',
    date: new Date(),
    tripType: 'aller',
    passengers: 1,
  });

  const [coords, setCoords] = useState<{
    departure_lat?: number;
    departure_lon?: number;
    departure_note?: string;
    arrival_lat?: number;
    arrival_lon?: number;
    arrival_note?: string;
  }>({});

  // ============================================================
  // SEARCH
  // ============================================================

  const updateSearch = useCallback(
    (patch: Partial<SearchParams>) => {
      setSearchParams((previous) => ({
        ...previous,
        ...patch,
      }));
    },
    []
  );

  const handleVehicleSelect = useCallback((type: VehicleType) => {
    setSearchParams((previous) => ({
      ...previous,
      vehicleType: type,
    }));
  }, []);

  // ============================================================
  // VERIFICATION
  // ============================================================

  const shouldShowVerif =
    !!user &&
    !user.is_verified &&
    user.verification_status !== 'pending' &&
    !hasStartedVerification;

  const [showVerifModal, setShowVerifModal] = useState(false);

  // ============================================================
  // SCROLL
  // ============================================================

  const scrollY = useRef(new Animated.Value(0)).current;

  const [refreshKey, setRefreshKey] = useState(0);

  useFocusEffect(
    useCallback(() => {
      refreshUser();
      setShowVerifModal(shouldShowVerif);
      setRefreshKey((key) => key + 1);
    }, [shouldShowVerif, refreshUser])
  );

  // ============================================================
  // REFRESH
  // ============================================================

  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await refreshUser();
      setRefreshKey((key) => key + 1);
    } finally {
      setRefreshing(false);
    }
  }, [refreshUser]);

  // ============================================================
  // RECHERCHE CLASSIQUE
  // ============================================================

  const handleSearch = useCallback(() => {
    const rawDeparture = searchParams.departure.trim();
    const rawDestination = searchParams.destination.trim();

    const departure = rawDeparture.split('|||')[0];
    const destination = rawDestination.split('|||')[0];

    if (!departure && !destination) {
      CustomAlert.alert(
        'Lieu requis',
        'Veuillez renseigner au moins un lieu de départ ou une destination.'
      );
      return;
    }

    if (
      departure &&
      destination &&
      departure.toLowerCase() === destination.toLowerCase()
    ) {
      CustomAlert.alert(
        'Trajet invalide',
        'Le lieu de départ et la destination ne peuvent pas être identiques.'
      );
      return;
    }

    router.push({
      pathname: '/search-results',
      params: {
        departure,
        destination,
        vehicleType: searchParams.vehicleType,
        date: searchParams.date.toISOString().split('T')[0],
        tripType: searchParams.tripType,
        passengers: String(searchParams.passengers),
        departure_latitude:
          coords.departure_lat !== undefined
            ? String(coords.departure_lat)
            : '',
        departure_longitude:
          coords.departure_lon !== undefined
            ? String(coords.departure_lon)
            : '',
        arrival_latitude:
          coords.arrival_lat !== undefined
            ? String(coords.arrival_lat)
            : '',
        arrival_longitude:
          coords.arrival_lon !== undefined
            ? String(coords.arrival_lon)
            : '',
        search_mode: 'normal',
      },
    } as any);
  }, [searchParams, coords, router]);

  // ============================================================
  // RECHERCHE AUTOUR DE MOI
  // ============================================================

  const handleNearbySearch = useCallback(async () => {
    if (nearbyLoading) {
      return;
    }

    try {
      setNearbyLoading(true);

      const {
        status: existingStatus,
      } = await Location.getForegroundPermissionsAsync();

      let permissionStatus = existingStatus;

      if (existingStatus !== Location.PermissionStatus.GRANTED) {
        const permission =
          await Location.requestForegroundPermissionsAsync();
        permissionStatus = permission.status;
      }

      if (permissionStatus !== Location.PermissionStatus.GRANTED) {
        CustomAlert.alert(
          'Localisation nécessaire',
          'Autorisez la localisation pour rechercher les trajets disponibles autour de vous.'
        );
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const latitude = location.coords.latitude;
      const longitude = location.coords.longitude;

      setCoords((previous) => ({
        ...previous,
        departure_lat: latitude,
        departure_lon: longitude,
      }));

      router.push({
        pathname: '/search-results',
        params: {
          search_mode: 'nearby',
          nearby: 'true',
          latitude: String(latitude),
          longitude: String(longitude),
          radius: '20',
          vehicleType: searchParams.vehicleType,
          date: searchParams.date.toISOString().split('T')[0],
          tripType: searchParams.tripType,
          passengers: String(searchParams.passengers),
        },
      } as any);
    } catch (error) {
      console.error('[NearbySearch] Erreur GPS:', error);
      CustomAlert.alert(
        'Erreur de localisation',
        'Impossible de récupérer votre position. Vérifiez que le GPS de votre téléphone est activé.'
      );
    } finally {
      setNearbyLoading(false);
    }
  }, [
    nearbyLoading,
    router,
    searchParams.vehicleType,
    searchParams.date,
    searchParams.tripType,
    searchParams.passengers,
  ]);

  // ============================================================
  // VOIR TOUS LES TRAJETS
  // ============================================================

  const handleSeeAll = useCallback(() => {
    router.push({
      pathname: '/search-results',
      params: {
        vehicleType: searchParams.vehicleType,
      },
    } as any);
  }, [router, searchParams.vehicleType]);

  // ============================================================
  // USER
  // ============================================================

  const userName =
    user?.full_name?.split(' ')[0] || 'Voyageur';

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <View style={styles.container}>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#0066FF"
            colors={['#0066FF']}
            progressViewOffset={Platform.OS === 'android' ? 60 : 0}
          />
        }
      >

        {/* ====================================================
            HEADER
        ==================================================== */}

        <SafeAreaView edges={['top']} style={styles.safeHeader}>
          <Header
            userName={userName}
            userAvatar={user?.avatar}
            scrollY={scrollY}
            onNotifPress={() => router.push('/notifications')}
            onProfilePress={() => router.push('/(tabs)/profile')}
            notifCount={notifCount}
          />
        </SafeAreaView>

        {/* ====================================================
            CONTENT
        ==================================================== */}

        <View style={styles.content}>

          {/* =================================================
              SELECTEUR SERVICE
          ================================================= */}

          <ServiceSelector
            selected={searchParams.vehicleType}
            onSelect={handleVehicleSelect}
          />

          {/* =================================================
              RECHERCHE AUTOUR DE MOI
          ================================================= */}

          <TouchableOpacity
            style={[
              styles.nearbyCard,
              nearbyLoading && styles.nearbyCardLoading,
            ]}
            activeOpacity={0.88}
            onPress={handleNearbySearch}
            disabled={nearbyLoading}
          >

            <View style={styles.nearbyIconWrapper}>
              {nearbyLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="navigate" size={18} color="#FFFFFF" />
              )}
            </View>

            <View style={styles.nearbyContent}>
              <Text style={styles.nearbyTitle}>
                {nearbyLoading
                  ? 'Localisation en cours...'
                  : 'Rechercher autour de moi'}
              </Text>
              <Text style={styles.nearbySubtitle}>
                Trajets disponibles dans un rayon de 20 km
              </Text>
            </View>

            {!nearbyLoading && (
              <View style={styles.nearbyArrow}>
                <Ionicons name="arrow-forward" size={18} color="#0066FF" />
              </View>
            )}

          </TouchableOpacity>

          {/* =================================================
              RECHERCHE CLASSIQUE
          ================================================= */}

          <SearchCard
            params={searchParams}
            onChange={updateSearch}
            onSearch={handleSearch}
            onPickLocation={(type) => setPickingFor(type)}
            departureNote={coords.departure_note}
            arrivalNote={coords.arrival_note}
          />

          {/* =================================================
              PROMOTION
          ================================================= */}

          <PromoCard />

          {/* =================================================
              TRAJETS DU JOUR
          ================================================= */}

          <TodayTrips
            key={refreshKey}
            onTripPress={(id) => router.push(`/ride/${id}` as any)}
            onSeeAll={handleSeeAll}
          />

        </View>

      </Animated.ScrollView>

      {/* ======================================================
          LOCATION PICKER
      ====================================================== */}

      {pickingFor !== null && (
        <LocationPicker
          title={
            pickingFor === 'departure'
              ? 'Lieu de départ'
              : "Lieu d'arrivée"
          }

          initialLocation={
            pickingFor === 'departure' &&
              searchParams.departure &&
              coords.departure_lat !== undefined &&
              coords.departure_lon !== undefined
              ? {
                latitude: coords.departure_lat,
                longitude: coords.departure_lon,
                name: searchParams.departure,
              }
              : pickingFor === 'arrival' &&
                searchParams.destination &&
                coords.arrival_lat !== undefined &&
                coords.arrival_lon !== undefined
                ? {
                  latitude: coords.arrival_lat,
                  longitude: coords.arrival_lon,
                  name: searchParams.destination,
                }
                : undefined
          }

          onLocationSelected={(loc) => {
            const fullNameWithNote = loc.name + (loc.note ? `|||${loc.note}` : '');
            if (pickingFor === 'departure') {
              updateSearch({ departure: fullNameWithNote });
              setCoords((previous) => ({
                ...previous,
                departure_lat: loc.latitude,
                departure_lon: loc.longitude,
                departure_note: loc.note,
              }));
            } else {
              updateSearch({ destination: fullNameWithNote });
              setCoords((previous) => ({
                ...previous,
                arrival_lat: loc.latitude,
                arrival_lon: loc.longitude,
                arrival_note: loc.note,
              }));
            }
            setPickingFor(null);
          }}

          onCancel={() => setPickingFor(null)}
        />
      )}

      {/* ======================================================
          VERIFICATION
      ====================================================== */}

      <VerificationModal
        visible={showVerifModal}
        onDismiss={() => setShowVerifModal(false)}
        onVerify={() => {
          setShowVerifModal(false);
          setHasStartedVerification(true);
          router.push('/verify-identity');
        }}
        userName={userName}
      />

    </View>
  );
}

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({

  container: {
    flex: 1,
    backgroundColor: '#F7F9FC',
  },

  safeHeader: {
    backgroundColor: '#0066FF',
  },

  content: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 40,
  },

  // ----------------------------------------------------------
  // HERO
  // ----------------------------------------------------------

  heroSection: {
    marginBottom: 12,
  },

  heroEyebrow: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.1,
    color: '#0066FF',
    marginBottom: 4,
  },

  heroTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '900',
    color: '#0F172A',
  },

  heroTitleAccent: {
    color: '#0066FF',
  },

  // ----------------------------------------------------------
  // NEARBY
  // ----------------------------------------------------------

  nearbyCard: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E6ECF5',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 3,
  },

  nearbyCardLoading: {
    opacity: 0.75,
  },

  nearbyIconWrapper: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#0066FF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#0066FF',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },

  nearbyContent: {
    flex: 1,
    marginLeft: 13,
  },

  nearbyTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },

  nearbySubtitle: {
    marginTop: 2,
    fontSize: 11,
    lineHeight: 15,
    color: '#64748B',
    fontWeight: '500',
  },

  nearbyArrow: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
});