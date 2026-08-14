/**
 * Zemy — Écran Détail Trajet Passager
 * Refactorisé : composants extraits dans src/features/ride/composants/
 */
import React, { useState, useRef } from 'react';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity,
  ActivityIndicator, Linking, Animated, Share,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { RefreshControl } from 'react-native';
import { useAuth } from '../../src/context/AuthContext';
import { useBooking } from '../../src/hooks/useBooking';
import { CustomAlert } from '../../src/utils/CustomAlert';
import { getRideAction } from '../../src/utils/bookingState';
import { useRideDetails } from '@/src/features/ride/hooks/useRideDetails';
import { RideMap } from '@/src/features/ride/components/RideMap';
import { PassengerCard } from '@/src/features/ride/components/PassengerCard';
import { BookingConfirmModal } from '@/src/features/ride/modals/BookingConfirmModal';
import { BookingSuccessModal } from '@/src/features/ride/modals/BookingSuccessModal';
import { PassengerNegotiationModal } from '@/src/features/ride/modals/PassengerNegotiationModal';

// ─── Nouveaux composants extraits ────────────────────────────────────────────
import { EcranChargement, FadeInCard, TitreSection } from '@/src/features/ride/composants/AnimationsFade';
import { BoutonReservation } from '@/src/features/ride/composants/BoutonReservation';
import { PiedDePageTrajet } from '@/src/features/ride/composants/PiedDePageTrajet';
import { CarteConducteur } from '@/src/features/ride/composants/CarteConducteur';
import { CarteItineraire } from '@/src/features/ride/composants/CarteItineraire';
import { CarteBillet } from '@/src/features/ride/composants/CarteBillet';
import { CarteSecurite } from '@/src/features/ride/composants/CarteSecurite';
import { C, SHsm, SHmd } from '@/src/features/ride/composants/theme-trajet';

export default function RideDetailScreen() {
  const {
    id, departure, destination,
    passenger_dep_lat, passenger_dep_lon,
    passenger_arr_lat, passenger_arr_lon,
    dep_waypoint_order, arr_waypoint_order,
  } = useLocalSearchParams<{
    id: string; departure?: string; destination?: string;
    passenger_dep_lat?: string; passenger_dep_lon?: string;
    passenger_arr_lat?: string; passenger_arr_lon?: string;
    dep_waypoint_order?: string; arr_waypoint_order?: string;
  }>();

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { authFetch, user } = useAuth();
  const { createBooking } = useBooking();

  const {
    ride, loading, refreshing, hasBooked, bookingId, myBooking,
    bookings, bookingLoading, chatLoading, bookingState, portionMetrics,
    onRefresh, openChat, handleChatWithPassenger, performBooking,
    handlePassengerAccept, handlePassengerReject, handleCancelBooking, fetchRide,
  } = useRideDetails(
    id as string, departure, destination,
    passenger_dep_lat, passenger_dep_lon,
    passenger_arr_lat, passenger_arr_lon,
    dep_waypoint_order, arr_waypoint_order,
    authFetch, user, createBooking
  );

  const depLocation = departure || myBooking?.departure_location;
  const destLocation = destination || myBooking?.arrival_location;

  const [showBookModal, setShowBookModal] = useState(false);
  const [showSuccModal, setShowSuccModal] = useState(false);
  const [showNegModal, setShowNegModal] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  if (loading || !ride) return <EcranChargement />;

  // ─── Helpers ──────────────────────────────────────────────────────────────
  const isOwnRide = user?.id === ride.driver_details?.id;
  const canChat = (myBooking && (myBooking.payment_status === 'paid' || myBooking.payment_status === 'escrow')) || isOwnRide;
  const isCompleted = ride.status === 'completed';
  const isStarted = ride.status === 'started';
  const rideAction = getRideAction(bookingState);
  const extractCity = (locStr: string | undefined): string => {
    if (!locStr) return '';
    const parts = locStr.replace(/\//g, ',').split(',').map((p) => p.trim());
    const ignore = new Set(['bénin', 'benin', 'togo', 'nigeria', 'ghana', 'burkina', 'france']);
    const cleanParts = parts.filter((p) => p && !ignore.has(p.toLowerCase()));
    return cleanParts.length ? cleanParts[cleanParts.length - 1].toLowerCase() : (parts[0] || '').toLowerCase();
  };

  const isIntermediatePickup = (() => {
    if (!depLocation || !ride) return false;
    const searchDepCity = extractCity(depLocation);
    const rideDepCity = extractCity(ride.departure_location);
    return !!(searchDepCity && rideDepCity && searchDepCity !== rideDepCity);
  })();

  const isIntermediateDropoff = (() => {
    if (!destLocation || !ride) return false;
    const searchDestCity = extractCity(destLocation);
    const rideDestCity = extractCity(ride.arrival_location);
    return !!(searchDestCity && rideDestCity && searchDestCity !== rideDestCity);
  })();

  const isMid = isIntermediatePickup || isIntermediateDropoff;

  const getArrival = (): string => {
    if (!ride) return '--:--';
    try {
      const [h, m] = ride.departure_time.split(':').map(Number);
      const tot = h * 60 + m + (ride.duration_min || 60);
      return `${String(Math.floor(tot / 60) % 24).padStart(2, '0')}:${String(tot % 60).padStart(2, '0')}`;
    } catch { return '--:--'; }
  };

  const fmtDur = (mins: number): string => {
    if (!mins) return '-';
    if (mins < 60) return `${mins} min`;
    const h = Math.floor(mins / 60), m = mins % 60;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
  };

  const haversine = (la1: number, lo1: number, la2: number, lo2: number): number => {
    const R = 6371, dLa = (la2 - la1) * Math.PI / 180, dLo = (lo2 - lo1) * Math.PI / 180;
    const a = Math.sin(dLa / 2) ** 2 + Math.cos(la1 * Math.PI / 180) * Math.cos(la2 * Math.PI / 180) * Math.sin(dLo / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const approachDist = (() => {
    if (!departure || !passenger_dep_lat || !passenger_dep_lon || !ride.departure_latitude || !ride.departure_longitude) return null;
    const d = haversine(
      parseFloat(String(ride.departure_latitude)),
      parseFloat(String(ride.departure_longitude)),
      parseFloat(passenger_dep_lat),
      parseFloat(passenger_dep_lon)
    );
    return d > 0.5 ? d : null;
  })();

  const confirmedPax = bookings.filter((b: any) =>
    b.payment_status !== 'pending' && ['confirmed', 'active', 'completed'].includes(b.status)
  );

  const depShort = (departure || ride.departure_location).split(',')[0];
  const arrShort = (destination || ride.arrival_location).split(',')[0];

  // ─── Actions ──────────────────────────────────────────────────────────────
  const handleBooking = () => {
    if (bookingLoading || hasBooked) return;
    if (!user?.is_verified) { CustomAlert.alert('Compte non vérifié', 'Votre compte doit être vérifié.'); return; }
    setShowBookModal(true);
  };

  const handleRetryPayment = () => {
    if (!bookingId || !myBooking) return;
    const amount = (myBooking as any).portion_price || myBooking.amount_paid_online || (ride ? ride.price_per_seat : 0);
    router.push({ pathname: '/payment', params: { booking_id: String(bookingId), amount: String(amount) } });
  };

  const handleCancel = () => {
    CustomAlert.alert('Annuler ma réservation', 'Voulez-vous vraiment annuler ?', [
      { text: 'Non, garder', style: 'cancel' },
      { text: 'Oui, annuler', style: 'destructive', onPress: () => setTimeout(() => {
        CustomAlert.alert('Confirmation définitive', 'Le conducteur en sera notifié.', [
          { text: 'Retour', style: 'cancel' },
          { text: "Confirmer l'annulation", style: 'destructive', onPress: async () => await handleCancelBooking() },
        ]);
      }, 500) },
    ]);
  };

  const animBtn = (fn: () => void) => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.94, duration: 90, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();
    fn();
  };

  const handleShare = async () => {
    if (!ride) return;
    try {
      await Share.share({ message: `Zemy: ${ride.departure_location.split(',')[0]} → ${ride.arrival_location.split(',')[0]} ${new Date(ride.departure_date).toLocaleDateString('fr-FR')} ${ride.departure_time?.substring(0, 5)}` });
    } catch { }
  };

  return (
    <SafeAreaView style={ss.screen} edges={['left', 'right']}>

      {/* En-tête flottant */}
      <View style={[ss.fhdr, { top: insets.top + 10 }]} pointerEvents="box-none">
        <TouchableOpacity style={ss.glassBtn} onPress={() => router.back()} activeOpacity={0.85}>
          <Ionicons name="chevron-back" size={22} color={C.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <TouchableOpacity style={[ss.glassBtn, { marginRight: 8 }]} onPress={() => CustomAlert.alert('Favoris', 'Trajet ajouté aux favoris !')} activeOpacity={0.85}>
          <Ionicons name="heart-outline" size={19} color={C.error} />
        </TouchableOpacity>
        <TouchableOpacity style={ss.glassBtn} onPress={handleShare} activeOpacity={0.85}>
          <Ionicons name="share-outline" size={19} color={C.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 + insets.bottom }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
      >
        {/* ── Carte Hero + Map ── */}
        <View style={ss.hero}>
          <RideMap
            ride={ride}
            passenger_dep_lat={passenger_dep_lat}
            passenger_dep_lon={passenger_dep_lon}
            passenger_arr_lat={passenger_arr_lat}
            passenger_arr_lon={passenger_arr_lon}
            departure={departure}
            destination={destination}
          />

          {/* Badge statut */}
          {(isCompleted || isStarted) && (
            <View style={ss.heroBadgeWrap} pointerEvents="none">
              <View style={[ss.badge, { backgroundColor: isCompleted ? '#F0FDF4' : 'rgba(47,128,237,0.85)' }]}>
                {isStarted && <View style={ss.liveDot} />}
                <Ionicons name={isCompleted ? 'checkmark-circle' : 'navigate'} size={13} color={isCompleted ? C.success : C.white} />
                <Text style={[ss.badgeText, { color: isCompleted ? C.success : C.white }]}>
                  {isCompleted ? 'Trajet terminé' : 'En cours'}
                </Text>
              </View>
            </View>
          )}

          {/* Carte glassmorphism flottante */}
          <FadeInCard delay={200} style={ss.glassCard}>
            <View style={ss.gcRouteRow}>
              <View style={ss.gcRouteCol}>
                <View style={[ss.gcDot, { backgroundColor: C.success }]} />
                <Text style={ss.gcCityLabel} numberOfLines={1}>{depShort}</Text>
                <Text style={ss.gcTimeLabel}>{ride.departure_time?.substring(0, 5)}</Text>
              </View>
              <View style={ss.gcConnector}>
                <View style={ss.gcLine} />
                <View style={ss.gcArrowCircle}><Ionicons name="arrow-forward" size={14} color={C.primary} /></View>
                <View style={ss.gcLine} />
              </View>
              <View style={[ss.gcRouteCol, { alignItems: 'flex-end' }]}>
                <View style={[ss.gcDot, { backgroundColor: C.error }]} />
                <Text style={[ss.gcCityLabel, { textAlign: 'right' }]} numberOfLines={1}>{arrShort}</Text>
                <Text style={[ss.gcTimeLabel, { textAlign: 'right' }]}>{getArrival()}</Text>
              </View>
            </View>
            <View style={ss.gcDivider} />
            <View style={ss.gcStatsRow}>
              {[
                { icon: 'calendar', bg: '#EBF4FF', val: new Date(ride.departure_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }), color: C.primary },
                { icon: 'time', bg: '#FFF7ED', val: fmtDur(ride.duration_min ?? 0), color: C.warning },
                { icon: 'people', bg: '#F0FDF4', val: `${ride.seats_available} place${ride.seats_available !== 1 ? 's' : ''}`, color: C.success },
                { icon: 'wallet', bg: '#EBF4FF', val: isMid ? 'Sur devis' : `${ride.price_per_seat?.toLocaleString() ?? '0'} F`, color: C.primary },
              ].map((s, i, arr) => (
                <React.Fragment key={i}>
                  <View style={ss.gcStat}>
                    <View style={[ss.gcStatIcon, { backgroundColor: s.bg }]}>
                      <Ionicons name={s.icon as any} size={13} color={s.color} />
                    </View>
                    <Text style={[ss.gcStatVal, i === 3 && { color: C.primary, fontWeight: '800' }]}>{s.val}</Text>
                  </View>
                  {i < arr.length - 1 && <View style={ss.gcStatSep} />}
                </React.Fragment>
              ))}
            </View>
          </FadeInCard>
        </View>

        {/* Poignée de défilement */}
        <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 4, backgroundColor: C.bg }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: C.borderMid }} />
        </View>

        <View style={ss.cards}>

          {/* Carte Prix */}
          <FadeInCard delay={80}>
            <View style={[ss.card, { flexDirection: 'row', alignItems: 'center' }]}>
              <View style={{ flex: 1 }}>
                <Text style={ss.pLabel}>{isMid ? 'Prix estimé' : 'Prix par place'}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>
                  {isMid
                    ? <Text style={[ss.pAmt, { fontSize: 28, color: C.warning }]}>À confirmer</Text>
                    : <><Text style={ss.pAmt}>{ride.price_per_seat?.toLocaleString() ?? '0'}</Text><Text style={ss.pCur}> FCFA</Text></>
                  }
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 }}>
                  <Ionicons name="people" size={14} color={C.success} />
                  <Text style={{ fontSize: 13, color: C.success, fontWeight: '700' }}>
                    {ride.seats_available} place{ride.seats_available !== 1 ? 's' : ''} restante{ride.seats_available !== 1 ? 's' : ''}
                  </Text>
                </View>
              </View>
              <View style={ss.pIcon}><Ionicons name="wallet" size={26} color={C.primary} /></View>
            </View>
          </FadeInCard>

          {/* Carte Conducteur */}
          {!isOwnRide && (
            <FadeInCard delay={120}>
              <CarteConducteur
                ride={ride}
                canChat={canChat}
                chatLoading={chatLoading}
                heureDepart={ride.departure_time?.substring(0, 5)}
                heureArrivee={getArrival()}
                dureeTxt={fmtDur(ride.duration_min ?? 0)}
                onOpenChat={openChat}
              />
            </FadeInCard>
          )}

          {/* Carte Portion de voyage */}
          {depLocation && destLocation && !isOwnRide && (
            <FadeInCard delay={180}>
              <View style={[ss.card, { padding: 0, overflow: 'hidden' }]}>
                <View style={{ height: 4, backgroundColor: C.primary }} />
                <View style={{ padding: 20 }}>
                  <TitreSection titre="Votre portion de voyage" icone="navigate-outline" />
                  <View style={{ gap: 0, marginBottom: 16 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                      <View style={[ss.ptDot, { backgroundColor: C.success }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 15, fontWeight: '800', color: C.text }}>{depLocation.split(',')[0]}</Text>
                        <Text style={{ fontSize: 11, color: C.textSec, marginTop: 2 }}>
                          Votre embarquement{bookingState?.estimated_departure_time ? ` · ~${bookingState.estimated_departure_time}` : ''}
                        </Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 5, paddingVertical: 4 }}>
                      <View style={{ width: 2, height: 24, backgroundColor: C.primary + '40', borderRadius: 1 }} />
                      {portionMetrics && (
                        <Text style={{ fontSize: 12, color: C.primary, fontWeight: '700' }}>
                          {portionMetrics.distanceKm} km · ~{portionMetrics.durationMin} min
                        </Text>
                      )}
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                      <View style={[ss.ptDot, { backgroundColor: C.error }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 15, fontWeight: '800', color: C.text }}>{destLocation.split(',')[0]}</Text>
                        <Text style={{ fontSize: 11, color: C.textSec, marginTop: 2 }}>Votre dépose</Text>
                      </View>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderTopWidth: 1, borderTopColor: C.border }}>
                    <Text style={{ fontSize: 13, color: C.textSec, fontWeight: '600' }}>Tarif estimé</Text>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: C.primary }}>
                      {isMid ? 'À confirmer par le conducteur' : `${ride.price_per_seat?.toLocaleString()} FCFA`}
                    </Text>
                  </View>
                  {approachDist && (
                    <View style={ss.infoBox}>
                      <Ionicons name="information-circle-outline" size={16} color={C.primary} />
                      <Text style={ss.infoTxt}>
                        Le conducteur débute à {ride.departure_location.split(',')[0]}. Vous le rejoindrez à {depLocation.split(',')[0]} (~{approachDist.toFixed(1)} km).
                      </Text>
                    </View>
                  )}
                  {isMid && (
                    <View style={ss.warnBox}>
                      <Ionicons name="alert-circle-outline" size={16} color={C.warning} />
                      <Text style={ss.warnTxt}>Le conducteur proposera le tarif après votre demande. Vous ne payez qu'après son acceptation.</Text>
                    </View>
                  )}
                </View>
              </View>
            </FadeInCard>
          )}

          {/* Carte Billet */}
          <FadeInCard delay={200}>
            <CarteBillet myBooking={myBooking} ride={ride} />
          </FadeInCard>

          {/* Carte Itinéraire */}
          <FadeInCard delay={240}>
            <CarteItineraire ride={ride} departure={departure} destination={destination} heureArrivee={getArrival()} />
          </FadeInCard>

          {/* Note de trajet intermédiaire (NB) */}
          {(isIntermediatePickup || isIntermediateDropoff) && (
            <FadeInCard delay={260}>
              <View style={ss.warnBox}>
                <Ionicons name="information-circle-outline" size={18} color="#D97706" style={{ marginTop: 2 }} />
                <View style={{ flex: 1 }}>
                  <Text style={[ss.warnTxt, { fontWeight: '700', marginBottom: 2, color: '#92400E' }]}>
                    Note Importante (Trajet Intermédiaire)
                  </Text>
                  <Text style={ss.warnTxt}>
                    {isIntermediatePickup && isIntermediateDropoff
                      ? `Votre trajet correspond à des arrêts intermédiaires sur l'itinéraire global du conducteur (${(ride.departure_location || '').split(',')[0]} ➔ ${(ride.arrival_location || '').split(',')[0]}).`
                      : isIntermediatePickup
                        ? `Le lieu de départ recherché (${(depLocation || '').split(',')[0]}) n'est pas le départ initial du chauffeur (Départ initial : ${(ride.departure_location || '').split(',')[0]}).`
                        : `Le lieu d'arrivée recherché (${(destLocation || '').split(',')[0]}) n'est pas le terminus final du chauffeur (Terminus : ${(ride.arrival_location || '').split(',')[0]}).`}
                  </Text>
                </View>
              </View>
            </FadeInCard>
          )}

          {/* Note du conducteur */}
          {ride.description && (
            <FadeInCard delay={300}>
              <View style={ss.card}>
                <TitreSection titre="Note du conducteur" icone="chatbox-ellipses-outline" />
                <Text style={{ fontSize: 48, color: C.primary + '28', lineHeight: 40, fontWeight: '900', marginBottom: -8 }}>"</Text>
                <Text style={{ fontSize: 15, color: C.textSec, lineHeight: 24, fontStyle: 'italic' }}>{ride.description}</Text>
              </View>
            </FadeInCard>
          )}

          {/* Sécurité */}
          <FadeInCard delay={420}>
            <CarteSecurite />
          </FadeInCard>

          {/* Liste des passagers (vue conducteur) */}
          {isOwnRide && (
            <FadeInCard delay={300}>
              <View style={ss.card}>
                <TitreSection titre={`Passagers (${confirmedPax.length})`} icone="people-outline" />
                {confirmedPax.length === 0
                  ? (
                    <View style={{ alignItems: 'center', paddingVertical: 24, gap: 10 }}>
                      <Ionicons name="people" size={36} color={C.borderMid} />
                      <Text style={{ fontSize: 14, color: C.textSec }}>Aucun passager confirmé</Text>
                    </View>
                  )
                  : confirmedPax.map((bk: any) => (
                    <PassengerCard
                      key={bk.id}
                      booking={bk}
                      onMessage={handleChatWithPassenger}
                      onCall={(ph?: string) => {
                        if (!ph) { CustomAlert.alert('Erreur', 'Numéro indisponible.'); return; }
                        Linking.openURL(`tel:${ph}`);
                      }}
                    />
                  ))
                }
              </View>
            </FadeInCard>
          )}
        </View>
      </ScrollView>

      {/* Pied de page fixe */}
      <PiedDePageTrajet
        prixParPlace={ride.price_per_seat}
        isMid={isMid}
        canChat={canChat}
        chatLoading={chatLoading}
        isOwnRide={isOwnRide}
        myBooking={myBooking}
        paddingBottom={insets.bottom}
        onOpenChat={openChat}
      >
        <BoutonReservation
          rideAction={rideAction}
          bookingLoading={bookingLoading}
          isStarted={isStarted}
          scaleAnim={scaleAnim}
          onBooking={handleBooking}
          onRetryPayment={handleRetryPayment}
          onCancel={handleCancel}
          onShowNegModal={() => setShowNegModal(true)}
        />
      </PiedDePageTrajet>

      {/* Modals */}
      <BookingConfirmModal
        visible={showBookModal}
        ride={ride}
        departure={departure}
        destination={destination}
        bookingLoading={bookingLoading}
        pricePerSeat={bookingState?.price ?? ride?.price_per_seat}
        onClose={() => setShowBookModal(false)}
        onConfirm={async (seats, customPrice, msg) => {
          const ok = await performBooking(seats, customPrice, msg);
          if (ok) { setShowBookModal(false); setShowSuccModal(true); }
        }}
      />
      <BookingSuccessModal
        visible={showSuccModal}
        driverName={ride.driver_details?.full_name || 'Inconnu'}
        onClose={() => { setShowSuccModal(false); fetchRide(); }}
      />
      <PassengerNegotiationModal
        visible={showNegModal}
        myBooking={myBooking}
        driverName={ride.driver_details?.full_name || 'Inconnu'}
        departure={departure}
        destination={destination}
        bookingLoading={bookingLoading}
        onClose={() => setShowNegModal(false)}
        onAccept={async () => {
          if (myBooking) { const s = await handlePassengerAccept(myBooking.id); if (s) setShowNegModal(false); }
        }}
        onReject={async () => {
          if (myBooking) { const s = await handlePassengerReject(myBooking.id); if (s) setShowNegModal(false); }
        }}
      />
    </SafeAreaView>
  );
}

const ss = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  fhdr: { position: 'absolute', left: 16, right: 16, zIndex: 200, flexDirection: 'row', alignItems: 'center' },
  glassBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.94)', alignItems: 'center', justifyContent: 'center', ...SHmd },
  hero: { height: 420, position: 'relative', backgroundColor: '#F5F5F0' },
  heroBadgeWrap: { position: 'absolute', top: 16, left: 16, zIndex: 10 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, alignSelf: 'flex-start' },
  badgeText: { fontSize: 12, fontWeight: '700' },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFFFFF' },
  glassCard: {
    position: 'absolute', left: 16, right: 16, bottom: 16, zIndex: 50,
    backgroundColor: 'rgba(255,255,255,0.88)', borderRadius: 24,
    paddingHorizontal: 18, paddingVertical: 16,
    shadowColor: '#0F172A', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18, shadowRadius: 24, elevation: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)',
  },
  gcRouteRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  gcRouteCol: { flex: 1, alignItems: 'flex-start', gap: 3 },
  gcDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: '#FFFFFF', marginBottom: 2, ...SHsm },
  gcCityLabel: { fontSize: 17, fontWeight: '800', color: C.text, lineHeight: 20 },
  gcTimeLabel: { fontSize: 12, fontWeight: '600', color: C.textSec },
  gcConnector: { flex: 0, flexDirection: 'column', alignItems: 'center', marginHorizontal: 10, gap: 2, marginTop: 2 },
  gcLine: { flex: 1, width: 1, minHeight: 14, backgroundColor: C.borderMid },
  gcArrowCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: C.primaryLight, alignItems: 'center', justifyContent: 'center' },
  gcDivider: { height: 1, backgroundColor: C.border, marginBottom: 12 },
  gcStatsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  gcStat: { flex: 1, alignItems: 'center', gap: 5 },
  gcStatIcon: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  gcStatVal: { fontSize: 11, fontWeight: '700', color: C.text, textAlign: 'center' },
  gcStatSep: { width: 1, height: 32, backgroundColor: C.border },
  cards: { paddingHorizontal: 16, paddingTop: 8, gap: 12 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, ...SHsm },
  pLabel: { fontSize: 12, fontWeight: '600', color: C.textSec, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  pAmt: { fontSize: 36, fontWeight: '900', color: C.text, lineHeight: 40 },
  pCur: { fontSize: 16, fontWeight: '700', color: C.textSec, marginBottom: 4 },
  pIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: C.primaryLight, alignItems: 'center', justifyContent: 'center' },
  ptDot: { width: 12, height: 12, borderRadius: 6, marginTop: 4, borderWidth: 2, borderColor: '#FFFFFF', ...SHsm },
  infoBox: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: C.primaryLight, borderRadius: 12, padding: 12, marginTop: 10 },
  infoTxt: { fontSize: 12, color: C.primaryDark, flex: 1, lineHeight: 18, fontWeight: '500' },
  warnBox: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: C.warningLight, borderRadius: 12, padding: 12, marginTop: 10 },
  warnTxt: { fontSize: 12, color: '#92400E', flex: 1, lineHeight: 18, fontWeight: '500' },
});
