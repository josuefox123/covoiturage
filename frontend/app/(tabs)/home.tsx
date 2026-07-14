/**
 * ==============================================================
 * home.tsx — Écran d'accueil Zemy, 100% dynamique.
 * ==============================================================
 */
import React, { useState, useCallback, useRef } from 'react';
import {
  StyleSheet,
  View,
  Animated,
  RefreshControl,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../../src/context/AuthContext';
import VerificationModal from '../../src/components/VerificationModal';

import Header from '../../src/components/home/Header';
import ServiceSelector, { VehicleType } from '../../src/components/home/ServiceSelector';
import SearchCard, { SearchParams } from '../../src/components/home/SearchCard';
import PromoCard from '../../src/components/home/PromoCard';
import TodayTrips from '../../src/components/home/TodayTrips';
import BottomSpacing from '../../src/components/home/BottomSpacing';

export default function HomeScreen() {
  const router = useRouter();
  const { user, refreshUser, hasStartedVerification, setHasStartedVerification } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  // ── Search state ─────────────────────────────────────────────────────────
  const [searchParams, setSearchParams] = useState<SearchParams>({
    departure: '',
    destination: '',
    vehicleType: 'covoiturage',
    date: new Date(),
    tripType: 'aller',
    passengers: 1,
  });

  const updateSearch = (patch: Partial<SearchParams>) =>
    setSearchParams((p) => ({ ...p, ...patch }));

  // Sync vehicleType card ↔ searchParams.vehicleType
  const handleVehicleSelect = (type: VehicleType) =>
    setSearchParams((p) => ({ ...p, vehicleType: type }));

  // ── Verification modal ────────────────────────────────────────────────────
  const shouldShowVerif =
    !!user &&
    !user.is_verified &&
    user.verification_status !== 'pending' &&
    !hasStartedVerification;

  const [showVerifModal, setShowVerifModal] = useState(false);

  // ── Scroll ────────────────────────────────────────────────────────────────
  const scrollY = useRef(new Animated.Value(0)).current;

  useFocusEffect(
    useCallback(() => {
      refreshUser();
      setShowVerifModal(shouldShowVerif);
    }, [shouldShowVerif])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshUser();
    setRefreshing(false);
  }, [refreshUser]);

  // ── Navigate to search results ───────────────────────────────────────────
  const handleSearch = () => {
    router.push({
      pathname: '/search-results',
      params: {
        departure: searchParams.departure,
        destination: searchParams.destination,
        vehicleType: searchParams.vehicleType,
        date: searchParams.date.toISOString().split('T')[0], // YYYY-MM-DD
        tripType: searchParams.tripType,
        passengers: String(searchParams.passengers),
      },
    } as any);
  };

  const handleSeeAll = () => {
    router.push({
      pathname: '/search-results',
      params: { vehicleType: searchParams.vehicleType },
    } as any);
  };

  const userName = user?.full_name?.split(' ')[0] || 'Voyageur';

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
        <SafeAreaView edges={['top']} style={styles.safeHeader}>
          <Header
            userName={userName}
            scrollY={scrollY}
            onNotifPress={() => router.push('/notifications')}
          />
        </SafeAreaView>

        <View style={styles.content}>
          <ServiceSelector
            selected={searchParams.vehicleType}
            onSelect={handleVehicleSelect}
          />

          <SearchCard
            params={searchParams}
            onChange={updateSearch}
            onSearch={handleSearch}
          />

          <PromoCard />
          <TodayTrips
            onTripPress={(id) => router.push(`/ride/${id}` as any)}
            onSeeAll={handleSeeAll}
          />
          <BottomSpacing />
        </View>
      </Animated.ScrollView>

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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFF' },
  safeHeader: { backgroundColor: '#0066FF' },
  content: { paddingTop: 12 },
});