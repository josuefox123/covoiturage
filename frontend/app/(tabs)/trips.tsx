import React, { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { theme } from '../../src/styles/theme';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';
import { useTrips } from '../../src/hooks/useTrips';
import { CustomAlert } from '../../src/utils/CustomAlert';

import {
  EnteteTrajet,
  SwitcherRole,
  FiltresStatut,
  EtatVide,
  CarteTrajet,
  ResolveurMission
} from '../../src/features/mes-trajets';

type RoleActif = 'passenger' | 'driver';
type FiltreStatut = 'upcoming' | 'live' | 'completed' | 'cancelled';

export default function TripsScreen() {
  const router = useRouter();
  const { user, authFetch } = useAuth();
  const { fetchPassengerBookings, fetchDriverRides } = useTrips();

  const [roleTab, setRoleTab] = useState<RoleActif>('passenger');
  const [missionFilter, setMissionFilter] = useState<FiltreStatut>('upcoming');
  const [passengerTrips, setPassengerTrips] = useState<any[]>([]);
  const [driverTrips, setDriverTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ─── Chargement des données ──────────────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      chargerTrajets();
    }, [user, fetchPassengerBookings, fetchDriverRides])
  );

  const chargerTrajets = async (isRefresh = false) => {
    if (!user) { setLoading(false); return; }
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      const [bookings, rides] = await Promise.all([
        fetchPassengerBookings(),
        fetchDriverRides()
      ]);
      setPassengerTrips(bookings || []);
      setDriverTrips(rides || []);
    } catch {
      CustomAlert.alert('Erreur', 'Impossible de charger vos trajets.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => chargerTrajets(true), [user]);

  // ─── Actions passager ─────────────────────────────────────────────────
  const handleCancelBooking = async (bookingId: string) => {
    try {
      setLoading(true);
      await authFetch(`/bookings/${bookingId}/cancel/`, { method: 'POST' });
      CustomAlert.alert('Succès', 'Votre réservation a été annulée.');
      await chargerTrajets();
    } catch (err: any) {
      CustomAlert.alert('Erreur', err.message || "Impossible d'annuler la réservation.");
    } finally { setLoading(false); }
  };

  const handleAcceptOffer = async (bookingId: string) => {
    try {
      setLoading(true);
      const data = await authFetch(`/bookings/${bookingId}/passenger_accept/`, { method: 'POST' });
      if (data && !data.error) {
        router.push({ pathname: '/payment', params: { booking_id: String(bookingId), amount: String(data.amount_paid_online || data.price || 0) } });
      }
      await chargerTrajets();
    } catch (err: any) {
      CustomAlert.alert('Erreur', err.message || "Impossible d'accepter l'offre.");
    } finally { setLoading(false); }
  };

  const handleRejectOffer = async (bookingId: string) => {
    try {
      setLoading(true);
      await authFetch(`/bookings/${bookingId}/passenger_reject/`, { method: 'POST' });
      CustomAlert.alert('Annulée', 'La proposition a été refusée.');
      await chargerTrajets();
    } catch (err: any) {
      CustomAlert.alert('Erreur', err.message || 'Impossible de refuser la proposition.');
    } finally { setLoading(false); }
  };

  // ─── Filtrage ─────────────────────────────────────────────────────────
  const listeSource = roleTab === 'passenger' ? passengerTrips : driverTrips;

  const listeFiltre = listeSource.filter((item) =>
    ResolveurMission.resolveMission(item, roleTab).category === missionFilter
  );

  const compterParFiltre = (filtre: FiltreStatut) =>
    listeSource.filter((item) =>
      ResolveurMission.resolveMission(item, roleTab).category === filtre
    ).length;

  // ─── Titre de section ─────────────────────────────────────────────────
  const titreSectionMap: Record<RoleActif, Record<FiltreStatut, string>> = {
    passenger: {
      upcoming: 'Réservations à venir',
      live: 'Réservations en cours',
      completed: 'Historique des réservations',
      cancelled: 'Réservations annulées'
    },
    driver: {
      upcoming: 'Trajets publiés à venir',
      live: 'Trajets en cours de conduite',
      completed: 'Trajets terminés',
      cancelled: 'Trajets annulés'
    }
  };

  const couleurSection = { upcoming: '#D97706', live: '#059669', completed: '#7C3AED', cancelled: '#EF4444' }[missionFilter];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <EnteteTrajet
        roleActif={roleTab}
        nombreReservations={passengerTrips.length}
        nombreTrajets={driverTrips.length}
        onRefresh={() => chargerTrajets(true)}
      />

      <SwitcherRole
        roleActif={roleTab}
        nombreReservations={passengerTrips.length}
        nombreTrajets={driverTrips.length}
        onChangeRole={setRoleTab}
      />

      <FiltresStatut
        filtreActif={missionFilter}
        compteParFiltre={compterParFiltre}
        onChangeFiltre={setMissionFilter}
      />

      {/* Titre de section */}
      <View style={styles.enteteSection}>
        <View style={[styles.pointSection, { backgroundColor: couleurSection }]} />
        <Text style={styles.titreSection}>{titreSectionMap[roleTab][missionFilter]}</Text>
        <Text style={styles.compteurSection}>
          {listeFiltre.length} résultat{listeFiltre.length > 1 ? 's' : ''}
        </Text>
      </View>

      {/* Contenu */}
      {loading && !refreshing ? (
        <View style={styles.chargement}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.texteChargement}>Chargement de vos missions...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.contenuScroll}
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
          {listeFiltre.length === 0 ? (
            <EtatVide filtre={missionFilter} role={roleTab} />
          ) : (
            listeFiltre.map((item, index) => (
              <CarteTrajet
                key={item.id ? `${item.id}-${index}` : `trajet-${index}`}
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
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  enteteSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8
  },
  pointSection: { width: 6, height: 6, borderRadius: 3 },
  titreSection: { flex: 1, fontSize: 13, fontWeight: '700', color: '#475569' },
  compteurSection: { fontSize: 12, color: '#94A3B8', fontWeight: '500' },
  chargement: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 },
  texteChargement: { marginTop: 12, fontSize: 14, color: '#94A3B8', fontWeight: '500' },
  contenuScroll: { padding: 16, paddingTop: 4 }
});
