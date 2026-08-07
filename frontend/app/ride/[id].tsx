/**
 * ==============================================================
 * Zemy — Ride Detail Screen (Premium Redesign 2026)
 * Inspired by: Uber, Airbnb, BlaBlaCar, Apple HIG, Material 3
 * [Touched to reload Metro cache]
 * ==============================================================
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Linking, Image,
  Animated, Share, Dimensions, Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';
import { useBooking } from '../../src/hooks/useBooking';
import { CustomAlert } from '../../src/utils/CustomAlert';
import { getRideAction } from '../../src/utils/bookingState';
import { getMediaUrl } from '../../src/utils/media';
import { useRideDetails } from '@/src/features/ride/hooks/useRideDetails';
import { RideMap } from '@/src/features/ride/components/RideMap';
import { PassengerCard } from '@/src/features/ride/components/PassengerCard';
import { BookingConfirmModal } from '@/src/features/ride/modals/BookingConfirmModal';
import { BookingSuccessModal } from '@/src/features/ride/modals/BookingSuccessModal';
import { PassengerNegotiationModal } from '@/src/features/ride/modals/PassengerNegotiationModal';

const { width: SW } = Dimensions.get('window');

const C = {
  primary: '#2F80ED', primaryDark: '#1A65C8', primaryLight: '#EBF4FF',
  success: '#22C55E', successLight: '#F0FDF4',
  error: '#EF4444',
  warning: '#F59E0B', warningLight: '#FFFBEB',
  white: '#FFFFFF', bg: '#F8FAFC', card: '#FFFFFF',
  text: '#0F172A', textSec: '#64748B', textLight: '#94A3B8',
  border: '#F1F5F9', borderMid: '#E2E8F0', shadow: '#0F172A',
};

const SHsm = { shadowColor: C.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 };
const SHmd = { shadowColor: C.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 16, elevation: 6 };
const SHlg = { shadowColor: C.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 24, elevation: 12 };

function FadeInCard({ children, delay = 0, style }: { children: React.ReactNode; delay?: number; style?: any }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const ty = useRef(new Animated.Value(24)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 500, delay, useNativeDriver: true }),
      Animated.timing(ty, { toValue: 0, duration: 500, delay, useNativeDriver: true }),
    ]).start();
  }, []);
  return (
    <Animated.View style={[{ opacity, transform: [{ translateY: ty }] }, style]}>
      {children}
    </Animated.View>
  );
}

function SkeletonBlock({ width, height, radius = 10, style }: { width: number | string; height: number; radius?: number; style?: any }) {
  const p = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(p, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(p, { toValue: 0.4, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return <Animated.View style={[{ width, height, borderRadius: radius, backgroundColor: '#E2E8F0', opacity: p }, style]} />;
}

function LoadingSkeleton() {
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SkeletonBlock width="100%" height={340} radius={0} />
      <View style={{ padding: 20, gap: 16 }}>
        <SkeletonBlock width="70%" height={24} />
        <SkeletonBlock width="50%" height={16} />
        <View style={{ height: 16 }} />
        <SkeletonBlock width="100%" height={120} radius={20} />
        <SkeletonBlock width="100%" height={90} radius={20} />
        <SkeletonBlock width="100%" height={90} radius={20} />
      </View>
    </View>
  );
}

function SectionTitle({ title, icon }: { title: string; icon: string }) {
  return (
    <View style={ss.stRow}>
      <Ionicons name={icon as any} size={16} color={C.primary} />
      <Text style={ss.stText}>{title}</Text>
    </View>
  );
}

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

  const isIntermediate = (): boolean => {
    if (!ride) return false;
    if (ride.price_per_seat && (ride as any).original_price_per_seat &&
        ride.price_per_seat !== (ride as any).original_price_per_seat) return true;
    if (depLocation && depLocation.split(',')[0].trim().toLowerCase() !== ride.departure_location.split(',')[0].trim().toLowerCase()) return true;
    if (destLocation && destLocation.split(',')[0].trim().toLowerCase() !== ride.arrival_location.split(',')[0].trim().toLowerCase()) return true;
    return false;
  };

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
      {
        text: 'Oui, annuler', style: 'destructive',
        onPress: () => setTimeout(() => {
          CustomAlert.alert('Confirmation définitive', 'Le conducteur en sera notifié.', [
            { text: 'Retour', style: 'cancel' },
            { text: "Confirmer l'annulation", style: 'destructive', onPress: async () => await handleCancelBooking() },
          ]);
        }, 500),
      },
    ]);
  };

  const handleShare = async () => {
    if (!ride) return;
    try {
      await Share.share({
        message: `Zemy: ${ride.departure_location.split(',')[0]} → ${ride.arrival_location.split(',')[0]} ${new Date(ride.departure_date).toLocaleDateString('fr-FR')} ${ride.departure_time?.substring(0, 5)}`,
      });
    } catch { }
  };

  const animBtn = (fn: () => void) => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.94, duration: 90, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();
    fn();
  };

  if (loading || !ride) return <LoadingSkeleton />;

  const driverName = ride.driver_details?.full_name || 'Inconnu';
  const initials = driverName.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();
  const isOwnRide = user?.id === ride.driver_details?.id;
  const canChat = (myBooking && (myBooking.payment_status === 'paid' || myBooking.payment_status === 'escrow')) || isOwnRide;
  const isCompleted = ride.status === 'completed';
  const isStarted = ride.status === 'started';
  const rideAction = getRideAction(bookingState);
  const isMid = isIntermediate();
  const vehicle = ride.driver_details?.vehicles?.[0];
  const depShort = (departure || ride.departure_location).split(',')[0];
  const arrShort = (destination || ride.arrival_location).split(',')[0];
  const approachDist = (() => {
    if (!departure || !passenger_dep_lat || !passenger_dep_lon || !ride.departure_latitude || !ride.departure_longitude) return null;
    const d = haversine(
      parseFloat(ride.departure_latitude as any), parseFloat(ride.departure_longitude as any),
      parseFloat(passenger_dep_lat), parseFloat(passenger_dep_lon)
    );
    return d > 0.5 ? d : null;
  })();
  const confirmedPax = bookings.filter((b: any) =>
    b.payment_status !== 'pending' && ['confirmed', 'active', 'completed'].includes(b.status)
  );

  const StatusBadge = () => {
    if (isCompleted) return (
      <View style={[ss.badge, { backgroundColor: C.successLight }]}>
        <Ionicons name="checkmark-circle" size={13} color={C.success} />
        <Text style={[ss.badgeText, { color: C.success }]}>Trajet terminé</Text>
      </View>
    );
    if (isStarted) return (
      <View style={[ss.badge, { backgroundColor: 'rgba(47,128,237,0.85)' }]}>
        <View style={ss.liveDot} />
        <Text style={[ss.badgeText, { color: C.white }]}>En cours</Text>
      </View>
    );
    return null;
  };
  const BookBtn = () => {
    const wrap = (content: React.ReactNode, fn: () => void, extraStyle?: any, dis?: boolean) => (
      <Animated.View style={{ flex: 1, transform: [{ scale: scaleAnim }] }}>
        <TouchableOpacity
          style={[ss.bookBtn, extraStyle, dis && { opacity: 0.6 }]}
          onPress={() => animBtn(fn)}
          disabled={dis}
          activeOpacity={0.9}
        >
          {content}
        </TouchableOpacity>
      </Animated.View>
    );

    switch (rideAction.action) {
      case 'own_ride':
        return <View style={[ss.bookBtn, { backgroundColor: C.borderMid }]}><Text style={[ss.bookBtnTxt, { color: C.textSec }]} adjustsFontSizeToFit numberOfLines={1}>Votre trajet</Text></View>;
      case 'completed':
        return <View style={[ss.bookBtn, { backgroundColor: C.borderMid }]}><Text style={[ss.bookBtnTxt, { color: C.textSec }]} adjustsFontSizeToFit numberOfLines={1}>Trajet terminé</Text></View>;
      case 'reserve':
      case 'expired':
      case 'cancelled':
        return wrap(
          bookingLoading ? <ActivityIndicator color={C.white} /> :
          isStarted ? <Text style={ss.bookBtnTxt} adjustsFontSizeToFit numberOfLines={1}>En cours</Text> : (
            <View style={ss.rowC}><Text style={ss.bookBtnTxt} adjustsFontSizeToFit numberOfLines={1}>Réserver maintenant</Text><Ionicons name="arrow-forward" size={19} color={C.white} /></View>
          ),
          handleBooking, {}, bookingLoading || isStarted
        );
      case 'waiting_driver':
        return wrap(
          <View style={ss.rowC}><Ionicons name="time-outline" size={17} color={C.white} /><Text style={ss.bookBtnTxt} adjustsFontSizeToFit numberOfLines={1}>En attente</Text></View>,
          () => CustomAlert.alert('En attente', 'Le conducteur doit approuver votre demande.'),
          { backgroundColor: C.warning }
        );
      case 'offer_received':
        return wrap(
          <View style={ss.rowC}><Ionicons name="alert-circle" size={17} color={C.white} /><Text style={ss.bookBtnTxt} adjustsFontSizeToFit numberOfLines={1}>Proposition reçue</Text></View>,
          () => setShowNegModal(true), { backgroundColor: C.warning }
        );
      case 'pay':
        return wrap(
          bookingLoading ? <ActivityIndicator color={C.white} /> : (
            <View style={ss.rowC}><Ionicons name="card" size={17} color={C.white} /><Text style={ss.bookBtnTxt} adjustsFontSizeToFit numberOfLines={1}>{rideAction.label}</Text></View>
          ),
          handleRetryPayment, {}, bookingLoading
        );
      case 'payment_processing':
        return (
          <View style={[ss.bookBtn, { backgroundColor: C.warning }]}>
            <View style={ss.rowC}><ActivityIndicator color={C.white} /><Text style={ss.bookBtnTxt} adjustsFontSizeToFit numberOfLines={1}>Validation…</Text></View>
          </View>
        );
      case 'confirmed':
        return wrap(
          bookingLoading ? <ActivityIndicator color={C.white} /> : (
            <View style={ss.rowC}><Ionicons name="close-circle" size={17} color={C.white} /><Text style={ss.bookBtnTxt} adjustsFontSizeToFit numberOfLines={1}>Annuler</Text></View>
          ),
          handleCancel, { backgroundColor: C.error }, bookingLoading
        );
      default: return null;
    }
  };

  return (
    <SafeAreaView style={ss.screen} edges={['left', 'right']}>

      {/* FLOATING HEADER — 3 buttons */}
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
        {/* ── HERO MAP ── */}
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

          {/* Status badge (top-left, above glass card) */}
          {(isCompleted || isStarted) && (
            <View style={ss.heroBadgeWrap} pointerEvents="none">
              <StatusBadge />
            </View>
          )}

          {/* ── GLASSMORPHISM FLOATING CARD ── */}
          <FadeInCard delay={200} style={ss.glassCard}>
            {/* Route row */}
            <View style={ss.gcRouteRow}>
              {/* Departure */}
              <View style={ss.gcRouteCol}>
                <View style={[ss.gcDot, { backgroundColor: C.success }]} />
                <Text style={ss.gcCityLabel} numberOfLines={1}>{depShort}</Text>
                <Text style={ss.gcTimeLabel}>{ride.departure_time?.substring(0, 5)}</Text>
              </View>

              {/* Arrow connector */}
              <View style={ss.gcConnector}>
                <View style={ss.gcLine} />
                <View style={ss.gcArrowCircle}>
                  <Ionicons name="arrow-forward" size={14} color={C.primary} />
                </View>
                <View style={ss.gcLine} />
              </View>

              {/* Arrival */}
              <View style={[ss.gcRouteCol, { alignItems: 'flex-end' }]}>
                <View style={[ss.gcDot, { backgroundColor: C.error }]} />
                <Text style={[ss.gcCityLabel, { textAlign: 'right' }]} numberOfLines={1}>{arrShort}</Text>
                <Text style={[ss.gcTimeLabel, { textAlign: 'right' }]}>{getArrival()}</Text>
              </View>
            </View>

            {/* Divider */}
            <View style={ss.gcDivider} />

            {/* Stats row */}
            <View style={ss.gcStatsRow}>
              <View style={ss.gcStat}>
                <View style={[ss.gcStatIcon, { backgroundColor: '#EBF4FF' }]}>
                  <Ionicons name="calendar" size={13} color={C.primary} />
                </View>
                <Text style={ss.gcStatVal}>
                  {new Date(ride.departure_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                </Text>
              </View>

              <View style={ss.gcStatSep} />

              <View style={ss.gcStat}>
                <View style={[ss.gcStatIcon, { backgroundColor: '#FFF7ED' }]}>
                  <Ionicons name="time" size={13} color={C.warning} />
                </View>
                <Text style={ss.gcStatVal}>{fmtDur(ride.duration_min ?? 0)}</Text>
              </View>

              <View style={ss.gcStatSep} />

              <View style={ss.gcStat}>
                <View style={[ss.gcStatIcon, { backgroundColor: '#F0FDF4' }]}>
                  <Ionicons name="people" size={13} color={C.success} />
                </View>
                <Text style={ss.gcStatVal}>{ride.seats_available} place{ride.seats_available !== 1 ? 's' : ''}</Text>
              </View>

              <View style={ss.gcStatSep} />

              <View style={ss.gcStat}>
                <View style={[ss.gcStatIcon, { backgroundColor: '#EBF4FF' }]}>
                  <Ionicons name="wallet" size={13} color={C.primary} />
                </View>
                <Text style={[ss.gcStatVal, { color: C.primary, fontWeight: '800' }]}>
                  {isMid ? 'Sur devis' : `${ride.price_per_seat?.toLocaleString() ?? '0'} F`}
                </Text>
              </View>
            </View>
          </FadeInCard>
        </View>

        {/* SHEET HANDLE */}
        <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 4, backgroundColor: C.bg }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: C.borderMid }} />
        </View>

        <View style={ss.cards}>

          {/* PORTION CARD (Recherche / Segment) */}
          {depLocation && destLocation && !isOwnRide && (
            <FadeInCard delay={40}>
              <View style={ss.portionCard}>
                <View style={ss.portionHeader}>
                  <View style={ss.portionHeaderBadge}>
                    <Ionicons name="navigate-circle-outline" size={14} color={C.primary} />
                    <Text style={ss.portionHeaderBadgeTxt}>VOTRE PORTION RECHERCHÉE</Text>
                  </View>
                </View>

                {/* Segment Route Timeline */}
                <View style={ss.portionRoute}>
                  {/* Dep */}
                  <View style={ss.portionRouteRow}>
                    <View style={[ss.portionDot, { backgroundColor: C.success }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={ss.portionCity}>{depLocation.split(',')[0]}</Text>
                      <Text style={ss.portionTime}>
                        Embarquement{bookingState?.estimated_departure_time ? ` estimé vers ~${bookingState.estimated_departure_time}` : ''}
                      </Text>
                    </View>
                  </View>

                  {/* Line with metrics */}
                  <View style={ss.portionConnector}>
                    <View style={ss.portionLine} />
                    {portionMetrics && (
                      <View style={ss.portionMetricsPill}>
                        <Text style={ss.portionMetricsTxt}>
                          {portionMetrics.distanceKm} km • {fmtDur(portionMetrics.durationMin)}
                        </Text>
                      </View>
                    )}
                    <View style={ss.portionLine} />
                  </View>

                  {/* Arr */}
                  <View style={ss.portionRouteRow}>
                    <View style={[ss.portionDot, { backgroundColor: C.error }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={ss.portionCity}>{destLocation.split(',')[0]}</Text>
                      <Text style={ss.portionTime}>Dépose</Text>
                    </View>
                  </View>
                </View>

                {/* Price estimation */}
                <View style={ss.portionPriceRow}>
                  <Text style={ss.portionPriceLbl}>Tarif portion estimé</Text>
                  <Text style={ss.portionPriceVal}>
                    {isMid ? 'À confirmer' : `${ride.price_per_seat?.toLocaleString()} FCFA`}
                  </Text>
                </View>

                {/* Warnings / Infos */}
                {approachDist && (
                  <View style={ss.approachBox}>
                    <Ionicons name="information-circle-outline" size={16} color={C.primary} />
                    <Text style={ss.approachTxt}>
                      Le conducteur démarre à {ride.departure_location.split(',')[0]}. Vous le rejoindrez à {depLocation.split(',')[0]} (~{approachDist.toFixed(1)} km d'approche).
                    </Text>
                  </View>
                )}

                {isMid && (
                  <View style={ss.approachBoxWarn}>
                    <Ionicons name="alert-circle-outline" size={16} color={C.warning} />
                    <Text style={ss.approachTxtWarn}>
                      Trajet partiel : le conducteur proposera un prix sur mesure après validation de votre demande. Aucun paiement avant son acceptation.
                    </Text>
                  </View>
                )}
              </View>
            </FadeInCard>
          )}

          {/* PRICE CARD */}
          <FadeInCard delay={80}>
            <View style={[ss.card, { flexDirection: 'row', alignItems: 'center' }]}>
              <View style={{ flex: 1 }}>
                <Text style={ss.pLabel}>{isMid ? 'Prix estimé' : 'Prix par place'}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>
                  {isMid
                    ? <Text style={[ss.pAmt, { fontSize: 28, color: C.warning }]}>À confirmer</Text>
                    : (
                      <>
                        <Text style={ss.pAmt}>{ride.price_per_seat?.toLocaleString() ?? '0'}</Text>
                        <Text style={ss.pCur}> FCFA</Text>
                      </>
                    )
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

          {/* DRIVER CARD */}
          {!isOwnRide && (
            <FadeInCard delay={120}>
              <View style={ss.card}>
                <SectionTitle title="Votre conducteur" icon="person-circle-outline" />
                <View style={{ flexDirection: 'row', gap: 14, marginBottom: 16 }}>
                  <View style={{ position: 'relative' }}>
                    {ride.driver_details?.avatar
                      ? <Image source={{ uri: getMediaUrl(ride.driver_details.avatar) }} style={ss.avatar} />
                      : (
                        <View style={[ss.avatar, ss.avatarPH]}>
                          <Text style={ss.avatarI}>{initials}</Text>
                        </View>
                      )
                    }
                    <View style={ss.vBadge}><Ionicons name="checkmark" size={10} color={C.white} /></View>
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={ss.dName}>{driverName}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Ionicons name="shield-checkmark" size={13} color={C.success} />
                      <Text style={{ fontSize: 12, color: C.success, fontWeight: '700' }}>Compte vérifié</Text>
                    </View>
                    <Text style={{ fontSize: 13, color: C.textSec }}>
                      <Text style={{ color: C.primary, fontWeight: '700' }}>{ride.driver_details?.rides_count ?? 0}</Text>{' '}trajets effectués
                    </Text>
                  </View>
                </View>
                {vehicle && (
                  <View style={ss.vRow}>
                    <Ionicons name="car-sport" size={18} color={C.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: C.text }}>{vehicle.brand_model}</Text>
                      <Text style={{ fontSize: 12, color: C.textSec, marginTop: 2 }}>
                        {[vehicle.color, vehicle.license_plate].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                    <View style={ss.vtBadge}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: C.primary }}>
                        {vehicle.vehicle_type === 'moto' ? 'Moto' : 'Voiture'}
                      </Text>
                    </View>
                  </View>
                )}
                <View style={ss.dStats}>
                  <View style={ss.dStat}><Text style={ss.dStatV}>{ride.departure_time?.substring(0, 5)}</Text><Text style={ss.dStatL}>Départ</Text></View>
                  <View style={{ width: 1, height: 28, backgroundColor: C.borderMid }} />
                  <View style={ss.dStat}><Text style={ss.dStatV}>{getArrival()}</Text><Text style={ss.dStatL}>Arrivée</Text></View>
                  <View style={{ width: 1, height: 28, backgroundColor: C.borderMid }} />
                  <View style={ss.dStat}><Text style={ss.dStatV}>{fmtDur(ride.duration_min ?? 0)}</Text><Text style={ss.dStatL}>Durée</Text></View>
                </View>
                {canChat && (
                  <TouchableOpacity style={ss.chatCTA} onPress={openChat} disabled={chatLoading} activeOpacity={0.85}>
                    {chatLoading
                      ? <ActivityIndicator color={C.primary} size="small" />
                      : (
                        <>
                          <Ionicons name="chatbubble-ellipses-outline" size={16} color={C.primary} />
                          <Text style={{ fontSize: 14, fontWeight: '700', color: C.primary }}>Contacter le conducteur</Text>
                        </>
                      )
                    }
                  </TouchableOpacity>
                )}
              </View>
            </FadeInCard>
          )}

          {/* PORTION CARD */}
          {depLocation && destLocation && !isOwnRide && (
            <FadeInCard delay={180}>
              <View style={[ss.card, { padding: 0, overflow: 'hidden' }]}>
                <View style={{ height: 4, backgroundColor: C.primary }} />
                <View style={{ padding: 20 }}>
                  <SectionTitle title="Votre portion de voyage" icon="navigate-outline" />
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
                      <Text style={ss.warnTxt}>
                        Le conducteur proposera le tarif après votre demande. Vous ne payez qu'après son acceptation.
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </FadeInCard>
          )}

          {/* TICKET SUMMARY CARD */}
          {myBooking && (myBooking.payment_status === 'paid' || myBooking.payment_status === 'escrow') ? (
            <FadeInCard delay={200}>
              <View style={[ss.card, { borderColor: C.primaryLight, borderWidth: 1.5 }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <View style={ss.rowC}>
                    <Ionicons name="qr-code-outline" size={20} color={C.primary} />
                    <Text style={{ fontSize: 15, fontWeight: '800', color: C.text }}>Votre Billet de Voyage</Text>
                  </View>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: C.primary }}>
                    T-{myBooking.id.substring(0, 8).toUpperCase()}
                  </Text>
                </View>
                <Text style={{ fontSize: 13, color: C.textSec, marginBottom: 12 }}>
                  Votre réservation est payée et validée. Présentez ce billet au conducteur lors de la montée.
                </Text>
                <TouchableOpacity
                  style={{ backgroundColor: C.primaryLight, paddingVertical: 10, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}
                  onPress={() => router.push({
                    pathname: '/payment/success',
                    params: { booking_id: myBooking.id, amount: String(myBooking.portion_price || ride.price_per_seat || 0) }
                  })}
                >
                  <Text style={{ fontSize: 13, fontWeight: '700', color: C.primary }}>Afficher le QR Code & Billet</Text>
                </TouchableOpacity>
              </View>
            </FadeInCard>
          ) : null}

          {/* ITINERARY CARD */}
          <FadeInCard delay={240}>
            <View style={ss.card}>
              <SectionTitle title={departure && destination ? "Itinéraire complet" : "Itinéraire"} icon="map-outline" />
              <View>
                <View style={{ flexDirection: 'row', gap: 16 }}>
                  <View style={{ alignItems: 'center', width: 20 }}>
                    <View style={[ss.itDot, { backgroundColor: C.primary, width: 14, height: 14 }]} />
                    <View style={ss.itLine} />
                  </View>
                  <View style={{ flex: 1, paddingBottom: 20 }}>
                    <Text style={ss.itCity}>{ride.departure_location.split(',')[0]}</Text>
                    <Text style={ss.itTime}>{ride.departure_time?.substring(0, 5)}</Text>
                  </View>
                </View>
                {(ride.stopovers || []).map((stop: any, idx: number) => (
                  <View key={idx} style={{ flexDirection: 'row', gap: 16 }}>
                    <View style={{ alignItems: 'center', width: 20 }}>
                      <View style={[ss.itDot, { backgroundColor: C.warning, width: 10, height: 10 }]} />
                      <View style={ss.itLine} />
                    </View>
                    <View style={{ flex: 1, paddingBottom: 20 }}>
                      <Text style={ss.itCity}>{(stop.name || stop.location || 'Escale').split(',')[0]}</Text>
                      {stop.arrival_time && <Text style={ss.itTime}>{stop.arrival_time?.substring(0, 5)}</Text>}
                    </View>
                  </View>
                ))}
                <View style={{ flexDirection: 'row', gap: 16 }}>
                  <View style={{ alignItems: 'center', width: 20 }}>
                    <View style={[ss.itDot, { backgroundColor: C.error, width: 14, height: 14 }]} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={ss.itCity}>{ride.arrival_location.split(',')[0]}</Text>
                    <Text style={ss.itTime}>{getArrival()}</Text>
                  </View>
                </View>
              </View>
            </View>
          </FadeInCard>

          {/* DESCRIPTION CARD */}
          {ride.description && (
            <FadeInCard delay={300}>
              <View style={ss.card}>
                <SectionTitle title="Note du conducteur" icon="chatbox-ellipses-outline" />
                <Text style={{ fontSize: 48, color: C.primary + '28', lineHeight: 40, fontWeight: '900', marginBottom: -8 }}>"</Text>
                <Text style={{ fontSize: 15, color: C.textSec, lineHeight: 24, fontStyle: 'italic' }}>{ride.description}</Text>
              </View>
            </FadeInCard>
          )}

          {/* SAFETY CARD */}
          <FadeInCard delay={420}>
            <View style={[ss.card, { backgroundColor: '#F8FAFC' }]}>
              <SectionTitle title="Votre sécurité" icon="shield-checkmark-outline" />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                {[
                  { icon: 'card-outline', label: 'Paiement sécurisé', color: C.primary },
                  { icon: 'person-circle-outline', label: 'Conducteur vérifié', color: C.success },
                  { icon: 'headset-outline', label: 'Assistance 24/7', color: C.warning },
                  { icon: 'lock-closed-outline', label: 'Données protégées', color: C.error },
                ].map((it, i) => (
                  <View key={i} style={{ width: (SW - 32 - 40 - 12) / 2, alignItems: 'center', gap: 8 }}>
                    <View style={[ss.sfIcon, { backgroundColor: it.color + '18' }]}>
                      <Ionicons name={it.icon as any} size={20} color={it.color} />
                    </View>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: C.text, textAlign: 'center', lineHeight: 16 }}>{it.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          </FadeInCard>

          {/* PASSENGER LIST (own ride) */}
          {isOwnRide && (
            <FadeInCard delay={300}>
              <View style={ss.card}>
                <SectionTitle title={`Passagers (${confirmedPax.length})`} icon="people-outline" />
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

      <View style={[ss.footer, { paddingBottom: Math.max(16, insets.bottom + 8) }]}>
        <View style={{ minWidth: 90, paddingRight: 4 }}>
          {isMid
            ? <Text style={{ fontSize: 16, fontWeight: '900', color: C.text }} numberOfLines={1} adjustsFontSizeToFit>À confirmer</Text>
            : (
              <Text numberOfLines={1} adjustsFontSizeToFit>
                <Text style={{ fontSize: 20, fontWeight: '900', color: C.text }}>{ride.price_per_seat?.toLocaleString() ?? '0'}</Text>
                <Text style={{ fontSize: 13, color: C.textSec, fontWeight: '700' }}> FCFA</Text>
              </Text>
            )
          }
          <Text style={{ fontSize: 11, color: C.textSec, marginTop: 1 }} numberOfLines={1} adjustsFontSizeToFit>par place</Text>
        </View>
        <TouchableOpacity
          style={[ss.chatFootBtn, !canChat && { opacity: 0.4 }]}
          onPress={() => {
            if (isOwnRide) {
              openChat();
            } else if (myBooking && (myBooking.payment_status === 'paid' || myBooking.payment_status === 'escrow')) {
              openChat();
            } else if (myBooking) {
              CustomAlert.alert('Messagerie', 'Veuillez payer votre réservation pour discuter avec le conducteur.');
            } else {
              CustomAlert.alert('Messagerie', 'Réservez ce trajet pour discuter.');
            }
          }}
          disabled={chatLoading}
          activeOpacity={0.8}
        >
          {chatLoading
            ? <ActivityIndicator color={C.primary} size="small" />
            : <Ionicons name="chatbubble-ellipses" size={22} color={C.primary} />
          }
        </TouchableOpacity>
        <BookBtn />
      </View>

      {/* MODALS */}
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
        driverName={driverName}
        onClose={() => { setShowSuccModal(false); fetchRide(); }}
      />
      <PassengerNegotiationModal
        visible={showNegModal}
        myBooking={myBooking}
        driverName={driverName}
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
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.white },

  /* ── Glassmorphism Card ── */
  glassCard: {
    position: 'absolute', left: 16, right: 16, bottom: 16, zIndex: 50,
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderRadius: 24,
    paddingHorizontal: 18, paddingVertical: 16,
    shadowColor: '#0F172A', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18, shadowRadius: 24, elevation: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)',
  },
  gcRouteRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 0, marginBottom: 12 },
  gcRouteCol: { flex: 1, alignItems: 'flex-start', gap: 3 },
  gcDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: C.white, marginBottom: 2, ...SHsm },
  gcCityLabel: { fontSize: 17, fontWeight: '800', color: C.text, lineHeight: 20 },
  gcTimeLabel: { fontSize: 12, fontWeight: '600', color: C.textSec },
  gcConnector: { flex: 0, flexDirection: 'column', alignItems: 'center', paddingTop: 0, marginHorizontal: 10, gap: 2, marginTop: 2 },
  gcLine: { flex: 1, width: 1, minHeight: 14, backgroundColor: C.borderMid },
  gcArrowCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: C.primaryLight, alignItems: 'center', justifyContent: 'center' },
  gcDivider: { height: 1, backgroundColor: C.border, marginBottom: 12 },
  gcStatsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  gcStat: { flex: 1, alignItems: 'center', gap: 5 },
  gcStatIcon: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  gcStatVal: { fontSize: 11, fontWeight: '700', color: C.text, textAlign: 'center' },
  gcStatSep: { width: 1, height: 32, backgroundColor: C.border },

  /* legacy refs kept for safety */
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  routeDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: C.white },
  routeTW: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  routeCity: { fontSize: 18, fontWeight: '800', color: C.white, flex: 1 },
  routeTime: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.8)' },
  metaRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.18)' },
  chipTxt: { fontSize: 11, fontWeight: '700', color: C.white },
  cards: { paddingHorizontal: 16, paddingTop: 8, gap: 12 },
  card: { backgroundColor: C.card, borderRadius: 20, padding: 20, ...SHsm },
  stRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 16 },
  stText: { fontSize: 15, fontWeight: '800', color: C.text },
  pLabel: { fontSize: 12, fontWeight: '600', color: C.textSec, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  pAmt: { fontSize: 36, fontWeight: '900', color: C.text, lineHeight: 40 },
  pCur: { fontSize: 16, fontWeight: '700', color: C.textSec, marginBottom: 4 },
  pIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: C.primaryLight, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 60, height: 60, borderRadius: 30 },
  avatarPH: { backgroundColor: C.primaryLight, alignItems: 'center', justifyContent: 'center' },
  avatarI: { fontSize: 22, fontWeight: '800', color: C.primary },
  vBadge: { position: 'absolute', bottom: -2, right: -2, width: 20, height: 20, borderRadius: 10, backgroundColor: C.success, borderWidth: 2, borderColor: C.white, alignItems: 'center', justifyContent: 'center' },
  dName: { fontSize: 18, fontWeight: '800', color: C.text },
  vRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.bg, borderRadius: 14, padding: 14, marginBottom: 16 },
  vtBadge: { backgroundColor: C.primaryLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  dStats: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.bg, borderRadius: 14, padding: 14, marginBottom: 14 },
  dStat: { flex: 1, alignItems: 'center', gap: 3 },
  dStatV: { fontSize: 16, fontWeight: '800', color: C.text },
  dStatL: { fontSize: 11, color: C.textSec, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
  chatCTA: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderColor: C.primary, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16 },
  ptDot: { width: 12, height: 12, borderRadius: 6, marginTop: 4, borderWidth: 2, borderColor: C.white, ...SHsm },
  infoBox: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: C.primaryLight, borderRadius: 12, padding: 12, marginTop: 10 },
  infoTxt: { fontSize: 12, color: C.primaryDark, flex: 1, lineHeight: 18, fontWeight: '500' },
  warnBox: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: C.warningLight, borderRadius: 12, padding: 12, marginTop: 10 },
  warnTxt: { fontSize: 12, color: '#92400E', flex: 1, lineHeight: 18, fontWeight: '500' },
  itDot: { borderRadius: 8, borderWidth: 2, borderColor: C.white, ...SHsm },
  itLine: { flex: 1, width: 2, backgroundColor: C.borderMid, marginVertical: 4, borderRadius: 1, minHeight: 24 },
  itCity: { fontSize: 14, fontWeight: '700', color: C.text },
  itTime: { fontSize: 12, color: C.textSec, marginTop: 2, fontWeight: '500' },
  sfIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.white, paddingHorizontal: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: C.border, ...SHmd },
  chatFootBtn: { width: 48, height: 48, borderRadius: 16, borderWidth: 1.5, borderColor: C.primary + '40', backgroundColor: C.primaryLight, alignItems: 'center', justifyContent: 'center' },
  bookBtn: { flex: 1, height: 52, borderRadius: 16, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center', ...SHlg },
  bookBtnTxt: { fontSize: 15, fontWeight: '800', color: C.white },
  rowC: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, flex: 1, paddingHorizontal: 4 },
  cancelBtn: { backgroundColor: C.error },
  primaryLight: { backgroundColor: C.primaryLight },

  /* ── Portion Card Styles ── */
  portionCard: { backgroundColor: C.card, borderRadius: 20, padding: 20, ...SHsm, borderWidth: 1, borderColor: C.border, marginBottom: 4 },
  portionHeader: { marginBottom: 14 },
  portionHeaderBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.primaryLight, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, alignSelf: 'flex-start' },
  portionHeaderBadgeTxt: { fontSize: 9, fontWeight: '800', color: C.primary, letterSpacing: 0.5 },
  portionRoute: { gap: 0 },
  portionRouteRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  portionDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: C.white, marginTop: 4, ...SHsm },
  portionCity: { fontSize: 15, fontWeight: '800', color: C.text },
  portionTime: { fontSize: 12, color: C.textSec, marginTop: 2 },
  portionConnector: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 4, paddingVertical: 6 },
  portionLine: { flex: 1, height: 2, backgroundColor: C.borderMid, borderRadius: 1 },
  portionMetricsPill: { backgroundColor: C.primaryLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  portionMetricsTxt: { fontSize: 11, color: C.primary, fontWeight: '700' },
  portionPriceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: C.border },
  portionPriceLbl: { fontSize: 13, color: C.textSec, fontWeight: '600' },
  portionPriceVal: { fontSize: 18, fontWeight: '900', color: C.primary },
  approachBox: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: C.primaryLight, borderRadius: 12, padding: 12, marginTop: 12 },
  approachTxt: { fontSize: 12, color: C.primaryDark, flex: 1, lineHeight: 18, fontWeight: '500' },
  approachBoxWarn: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: C.warningLight, borderRadius: 12, padding: 12, marginTop: 12 },
  approachTxtWarn: { fontSize: 12, color: '#92400E', flex: 1, lineHeight: 18, fontWeight: '500' },
});
