/**
 * ============================================================
 * Zemy — Ride Management Screen (Premium Redesign 2026)
 * Inspired by: BlaBlaCar, Uber Driver, Bolt, Airbnb, Revolut
 * ============================================================
 */
import React, { useRef, useEffect, useState } from 'react';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity,
  ActivityIndicator, Animated, RefreshControl, Modal,
  TextInput, Linking, Image, Dimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { CustomAlert } from '../../src/utils/CustomAlert';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { API_URL } from '@/src/services/api';
import { getMediaUrl } from '../../src/utils/media';
import { useRideManagement } from '@/src/features/ride-management/hooks/useRideManagement';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SW } = Dimensions.get('window');

// ─── Color Palette ──────────────────────────────────────────
const C = {
  primary: '#2563EB',
  primaryDark: '#1D4ED8',
  primaryLight: '#DBEAFE',
  success: '#22C55E',
  successLight: '#DCFCE7',
  error: '#EF4444',
  errorLight: '#FEE2E2',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  white: '#FFFFFF',
  bg: '#F8FAFC',
  card: '#FFFFFF',
  text: '#111827',
  textSec: '#6B7280',
  textLight: '#9CA3AF',
  border: '#F1F5F9',
  borderMid: '#E5E7EB',
  shadow: '#111827',
};

// ─── Shadow tokens ────────────────────────────────────────────
const SHsm = { shadowColor: C.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 };
const SHmd = { shadowColor: C.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 5 };
const SHlg = { shadowColor: C.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 24, elevation: 10 };

// ─── Micro-animation helpers ─────────────────────────────────
function useFadeSlide(delay = 0) {
  const op = useRef(new Animated.Value(0)).current;
  const ty = useRef(new Animated.Value(22)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(op, { toValue: 1, duration: 500, delay, useNativeDriver: true }),
      Animated.timing(ty, { toValue: 0, duration: 480, delay, useNativeDriver: true }),
    ]).start();
  }, []);
  return { opacity: op, transform: [{ translateY: ty }] };
}

// ─── Skeleton Block ──────────────────────────────────────────
function Skel({ w, h, r = 10, mb = 0 }: { w: number | string; h: number; r?: number; mb?: number }) {
  const p = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(p, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(p, { toValue: 0.4, duration: 800, useNativeDriver: true }),
    ])).start();
  }, []);
  return <Animated.View style={{ width: w as any, height: h, borderRadius: r, backgroundColor: '#E5E7EB', opacity: p, marginBottom: mb }} />;
}

function LoadingScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ height: 64, backgroundColor: C.white, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 12, ...SHsm }}>
        <Skel w={36} h={36} r={18} />
        <View style={{ flex: 1, gap: 6 }}>
          <Skel w="60%" h={16} />
          <Skel w="40%" h={12} />
        </View>
        <Skel w={36} h={36} r={18} />
      </View>
      <View style={{ padding: 16, gap: 16 }}>
        <Skel w="100%" h={200} r={24} />
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Skel w={(SW - 44) / 2} h={100} r={20} />
          <Skel w={(SW - 44) / 2} h={100} r={20} />
        </View>
        <Skel w="100%" h={140} r={20} />
        <Skel w="100%" h={140} r={20} />
      </View>
    </View>
  );
}

// ─── Pref Chip ────────────────────────────────────────────────
function PrefChip({ iconName, label, active }: { iconName: any; label: string; active: boolean }) {
  return (
    <View style={[s.chip, active ? s.chipActive : s.chipInactive]}>
      <Ionicons name={iconName} size={15} color={active ? C.primary : C.textSec} />
      <Text style={[s.chipTxt, { color: active ? C.primary : C.textSec }]}>{label}</Text>
    </View>
  );
}

// ─── Status Info helper ───────────────────────────────────────
function getStatusInfo(status: string) {
  switch (status) {
    case 'active': return { label: 'PLANIFIÉ', color: C.primary, bg: C.primaryLight, icon: 'calendar-outline' };
    case 'completed': return { label: 'TERMINÉ', color: C.success, bg: C.successLight, icon: 'checkmark-circle' };
    case 'cancelled': return { label: 'ANNULÉ', color: C.error, bg: C.errorLight, icon: 'close-circle' };
    case 'started': return { label: 'EN COURS', color: C.success, bg: C.successLight, icon: 'car' };
    default: return { label: 'EN ATTENTE', color: C.warning, bg: C.warningLight, icon: 'time' };
  }
}

function fmtDuration(mins?: number) {
  if (!mins) return '-';
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60), m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

// ─── Hero Card ────────────────────────────────────────────────
function HeroCard({ ride }: { ride: any }) {
  const anim = useFadeSlide(100);
  const si = getStatusInfo(ride.status);
  const depCity = ride.departure_location?.split(',')[0] || 'Départ';
  const arrCity = ride.arrival_location?.split(',')[0] || 'Arrivée';

  return (
    <Animated.View style={[anim, { marginBottom: 16 }]}>
      <LinearGradient
        colors={['#2563EB', '#1D4ED8', '#1E40AF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s.heroCard}
      >
        {/* Decorative circles */}
        <View style={[s.heroCircle1, { backgroundColor: 'rgba(255,255,255,0.12)' }]} pointerEvents="none" />
        <View style={[s.heroCircle2, { backgroundColor: 'rgba(255,255,255,0.08)' }]} pointerEvents="none" />

        {/* Status badge */}
        <View style={[s.heroBadge, { backgroundColor: si.bg }]}>
          <Ionicons name={si.icon as any} size={13} color={si.color} />
          <Text style={[s.heroBadgeTxt, { color: si.color }]}>{si.label}</Text>
        </View>

        {/* Route */}
        <View style={s.heroRoute}>
          <View style={s.heroRouteCol}>
            <View style={s.heroDepDot} />
            <Text style={s.heroCity}>{depCity}</Text>
            <Text style={s.heroTime}>{ride.departure_time?.substring(0, 5)}</Text>
          </View>
          <View style={s.heroConnector}>
            <View style={s.heroConnLine} />
            <View style={s.heroConnArrow}>
              <Ionicons name="arrow-forward" size={14} color={C.white} />
            </View>
            <View style={s.heroConnLine} />
          </View>
          <View style={[s.heroRouteCol, { alignItems: 'flex-end' }]}>
            <View style={s.heroArrDot} />
            <Text style={[s.heroCity, { textAlign: 'right' }]}>{arrCity}</Text>
            <Text style={[s.heroTime, { textAlign: 'right' }]}>{ride.departure_date}</Text>
          </View>
        </View>

        {/* Meta strip */}
        <View style={s.heroMeta}>
          <View style={s.heroMetaItem}>
            <Ionicons name="time-outline" size={15} color="rgba(255,255,255,0.8)" />
            <Text style={s.heroMetaTxt}>{fmtDuration(ride.duration_min)}</Text>
          </View>
          <View style={s.heroMetaDivider} />
          <View style={s.heroMetaItem}>
            <Ionicons name="people-outline" size={15} color="rgba(255,255,255,0.8)" />
            <Text style={s.heroMetaTxt}>{ride.seats_available} / {ride.total_seats} places</Text>
          </View>
          <View style={s.heroMetaDivider} />
          <View style={s.heroMetaItem}>
            <Ionicons name="wallet-outline" size={15} color="rgba(255,255,255,0.8)" />
            <Text style={s.heroMetaTxt}>{ride.price_per_seat?.toLocaleString()} FCFA</Text>
          </View>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

// ─── Stats Grid ────────────────────────────────────────────────
function StatsGrid({ ride, totalRevenue, seatsBooked }: { ride: any; totalRevenue: number; seatsBooked: number }) {
  const anim = useFadeSlide(200);
  const items = [
    { iconName: 'people' as const, value: `${seatsBooked}/${ride.total_seats}`, label: 'Places vendues', color: C.primary, bg: C.primaryLight },
    { iconName: 'wallet' as const, value: `${totalRevenue.toLocaleString()}`, label: 'FCFA gagnés', color: C.success, bg: C.successLight },
    { iconName: 'car' as const, value: ride.driver_details?.vehicles?.[0]?.vehicle_type?.toUpperCase() || '-', label: 'Type véhicule', color: C.warning, bg: C.warningLight },
    { iconName: 'calendar' as const, value: new Date(ride.departure_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }), label: 'Date du trajet', color: C.error, bg: C.errorLight },
  ];
  return (
    <Animated.View style={[{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 }, anim]}>
      {items.map((it, i) => (
        <View key={i} style={[s.statCard, { backgroundColor: it.bg, width: (SW - 44) / 2 }]}>
          <View style={{ marginBottom: 6 }}>
            <Ionicons name={it.iconName} size={26} color={it.color} />
          </View>
          <Text style={[s.statVal, { color: it.color }]}>{it.value}</Text>
          <Text style={s.statLbl}>{it.label}</Text>
        </View>
      ))}
    </Animated.View>
  );
}

// ─── Timeline ─────────────────────────────────────────────────
function Timeline({ ride }: { ride: any }) {
  const anim = useFadeSlide(150);
  const stops = ride.stopovers || [];
  const depCity = ride.departure_location?.split(',')[0];
  const arrCity = ride.arrival_location?.split(',')[0];

  const allStops = [
    { city: depCity, sub: ride.departure_location?.split(',')[1]?.trim() || '', time: ride.departure_time?.substring(0, 5), label: 'Départ', dot: C.primary },
    ...stops.map((st: any) => ({ city: (st.name || st.location || 'Escale').split(',')[0], sub: '', time: st.arrival_time?.substring(0, 5) || '', label: 'Escale', dot: C.warning })),
    { city: arrCity, sub: ride.arrival_location?.split(',')[1]?.trim() || '', time: '', label: 'Arrivée', dot: C.error },
  ];

  return (
    <Animated.View style={[s.card, anim]}>
      <View style={s.cardHeader}>
        <View style={[s.cardIconWrap, { backgroundColor: C.primaryLight }]}>
          <Ionicons name="map-outline" size={18} color={C.primary} />
        </View>
        <Text style={s.cardTitle}>Itinéraire</Text>
      </View>
      {allStops.map((st, idx) => (
        <View key={idx} style={{ flexDirection: 'row', gap: 14 }}>
          <View style={{ alignItems: 'center', width: 20 }}>
            <View style={[s.tlDot, { backgroundColor: st.dot, width: idx === 0 || idx === allStops.length - 1 ? 16 : 12, height: idx === 0 || idx === allStops.length - 1 ? 16 : 12 }]} />
            {idx < allStops.length - 1 && <View style={s.tlLine} />}
          </View>
          <View style={{ flex: 1, paddingBottom: idx < allStops.length - 1 ? 24 : 0 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <Text style={s.tlCity}>{st.city}</Text>
                {st.sub ? <Text style={s.tlSub}>{st.sub}</Text> : null}
              </View>
              {st.time ? (
                <View style={[s.tlTimePill, { backgroundColor: st.dot + '18' }]}>
                  <Text style={[s.tlTimeTxt, { color: st.dot }]}>{st.time}</Text>
                </View>
              ) : null}
            </View>
            <Text style={[s.tlLabel, { color: st.dot }]}>{st.label}</Text>
          </View>
        </View>
      ))}
      {ride.description ? (
        <View style={s.descBox}>
          <Text style={{ fontSize: 36, color: C.primary + '30', lineHeight: 32, fontWeight: '900', marginBottom: -6 }}>"</Text>
          <Text style={s.descTxt}>{ride.description}</Text>
        </View>
      ) : null}
    </Animated.View>
  );
}

// ─── Booking Card (pending) ────────────────────────────────────
function PendingBookingCard({ booking, ridePrice, onAccept, onReject, onMessage }: any) {
  const anim = useFadeSlide(280);
  const pax = booking.passenger_details;
  const name = pax?.full_name || 'Passager';
  const initials = name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();
  const seatsReq = booking.seats_booked || 1;
  const price = booking.portion_price ? Math.round(booking.portion_price / seatsReq) : ridePrice || 0;

  return (
    <Animated.View style={[s.bookCard, anim]}>
      {/* Pending badge */}
      <View style={s.pendingBadge}>
        <View style={s.pendingDot} />
        <Text style={s.pendingTxt}>Demande en attente</Text>
      </View>

      <View style={{ flexDirection: 'row', gap: 14, marginBottom: 16 }}>
        {pax?.avatar
          ? <Image source={{ uri: getMediaUrl(pax.avatar) }} style={s.paxAvatar} />
          : <View style={[s.paxAvatar, s.paxAvatarPH]}><Text style={s.paxInitials}>{initials}</Text></View>
        }
        <View style={{ flex: 1, gap: 3 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={s.paxName}>{name}</Text>
            <View style={s.verifiedBadge}><Ionicons name="checkmark" size={9} color={C.white} /></View>
          </View>
          <Text style={{ fontSize: 12, color: C.textSec }}>{seatsReq} place{seatsReq > 1 ? 's' : ''} demandée{seatsReq > 1 ? 's' : ''}</Text>
          {(booking.departure_location || booking.arrival_location) && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
              <View style={[s.miniDot, { backgroundColor: C.success }]} />
              <Text style={{ fontSize: 11, color: C.textSec, flex: 1 }} numberOfLines={1}>
                {booking.departure_location?.split(',')[0]} → {booking.arrival_location?.split(',')[0]}
              </Text>
            </View>
          )}
        </View>
        <View style={{ alignItems: 'flex-end', gap: 3 }}>
          <Text style={s.paxPrice}>{(price * seatsReq).toLocaleString()}</Text>
          <Text style={{ fontSize: 11, color: C.textSec, fontWeight: '600' }}>FCFA</Text>
        </View>
      </View>

      <View style={s.bookBtns}>
        <TouchableOpacity style={s.rejectBtn} onPress={onReject} activeOpacity={0.85}>
          <Ionicons name="close" size={17} color={C.error} />
          <Text style={s.rejectTxt}>Refuser</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.acceptBtn} onPress={onAccept} activeOpacity={0.85}>
          <Ionicons name="checkmark" size={17} color={C.white} />
          <Text style={s.acceptTxt}>Accepter</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

// ─── Passenger Card (confirmed) ────────────────────────────────
function PassengerCard({ booking, onMessage, onCall, onBoard, onDownloadManifest, downloadingManifestId }: any) {
  const anim = useFadeSlide(320);
  const pax = booking.passenger_details;
  const name = pax?.full_name || 'Passager';
  const initials = name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();
  const isBoarded = booking.status === 'started';

  const statusChip = (() => {
    switch (booking.status) {
      case 'confirmed': return { label: 'Confirmé', color: C.success, bg: C.successLight };
      case 'active': return { label: 'Actif', color: C.primary, bg: C.primaryLight };
      case 'started': return { label: 'Embarqué ✓', color: C.success, bg: C.successLight };
      case 'completed': return { label: 'Terminé', color: C.textSec, bg: C.border };
      default: return { label: booking.status, color: C.textSec, bg: C.border };
    }
  })();

  return (
    <Animated.View style={[s.paxCard, anim]}>
      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 14 }}>
        {pax?.avatar
          ? <Image source={{ uri: getMediaUrl(pax.avatar) }} style={s.paxAvatar} />
          : <View style={[s.paxAvatar, s.paxAvatarPH]}><Text style={s.paxInitials}>{initials}</Text></View>
        }
        <View style={{ flex: 1, gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={s.paxName}>{name}</Text>
              <View style={s.verifiedBadge}><Ionicons name="checkmark" size={9} color={C.white} /></View>
            </View>
            <View style={[s.statusChip, { backgroundColor: statusChip.bg }]}>
              <Text style={[s.statusChipTxt, { color: statusChip.color }]}>{statusChip.label}</Text>
            </View>
          </View>
          {pax?.phone_number && (
            <Text style={{ fontSize: 12, color: C.textSec }}>{pax.phone_number}</Text>
          )}
          {(booking.departure_location || booking.arrival_location) && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <View style={[s.miniDot, { backgroundColor: C.success }]} />
              <Text style={{ fontSize: 11, color: C.textSec }} numberOfLines={1}>
                {booking.departure_location?.split(',')[0]} → {booking.arrival_location?.split(',')[0]}
              </Text>
            </View>
          )}
          <Text style={{ fontSize: 12, color: C.primary, fontWeight: '700' }}>
            {((booking.amount_paid_online || 0)).toLocaleString()} FCFA
          </Text>
        </View>
      </View>

      <View style={s.paxActions}>
        <TouchableOpacity style={s.paxActBtn} onPress={() => onCall(pax?.phone_number)} activeOpacity={0.8}>
          <Ionicons name="call" size={16} color={C.success} />
          <Text style={[s.paxActTxt, { color: C.success }]}>Appeler</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.paxActBtn} onPress={() => onMessage(pax?.id)} activeOpacity={0.8}>
          <Ionicons name="chatbubble-ellipses" size={16} color={C.primary} />
          <Text style={[s.paxActTxt, { color: C.primary }]}>Message</Text>
        </TouchableOpacity>
        {!isBoarded && onBoard && (
          <TouchableOpacity style={[s.paxActBtn, { backgroundColor: C.warning + '18' }]} onPress={onBoard} activeOpacity={0.8}>
            <Ionicons name="qr-code" size={16} color={C.warning} />
            <Text style={[s.paxActTxt, { color: C.warning }]}>Ticket</Text>
          </TouchableOpacity>
        )}
        {onDownloadManifest && (
          <TouchableOpacity
            style={[s.paxActBtn, { backgroundColor: C.primaryLight }]}
            onPress={() => onDownloadManifest(booking.id)}
            disabled={downloadingManifestId === booking.id}
            activeOpacity={0.8}
          >
            {downloadingManifestId === booking.id
              ? <ActivityIndicator size="small" color={C.primary} />
              : <Ionicons name="download-outline" size={16} color={C.primary} />
            }
            <Text style={[s.paxActTxt, { color: C.primary }]}>Fiche</Text>
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
}

// ─── Vehicle & Prefs Card ─────────────────────────────────────
function VehicleCard({ ride }: { ride: any }) {
  const anim = useFadeSlide(400);
  const v = ride.driver_details?.vehicles?.[0];

  const prefs = [
    { iconName: (v?.music ?? ride.music) ? 'musical-notes-outline' : 'volume-mute-outline', label: (v?.music ?? ride.music) ? 'Musique' : 'Pas de musique', active: !!(v?.music ?? ride.music) },
    { iconName: 'snow-outline', label: (v?.air_conditioner ?? ride.air_conditioner) ? 'Climatisation' : 'Pas de clim', active: !!(v?.air_conditioner ?? ride.air_conditioner) },
    { iconName: 'close-circle-outline', label: (v?.smoking ?? ride.smoking) ? 'Fumeur OK' : 'Non-fumeur', active: !(v?.smoking ?? ride.smoking) },
    { iconName: 'paw-outline', label: (v?.pets_allowed ?? ride.pets_allowed) ? 'Animaux admis' : 'Sans animaux', active: !!(v?.pets_allowed ?? ride.pets_allowed) },
    { iconName: 'chatbubble-ellipses-outline', label: (v?.chatty ?? ride.chatty) ? 'Discussion' : 'Calme', active: !!(v?.chatty ?? ride.chatty) },
    { iconName: 'briefcase-outline', label: (v?.luggage_allowed ?? ride.luggage_allowed) ? 'Bagages admis' : 'Bagages limités', active: !!(v?.luggage_allowed ?? ride.luggage_allowed) },
    { iconName: 'stop-circle-outline', label: (v?.stops_allowed ?? ride.stops_allowed) ? 'Arrêts possibles' : 'Direct', active: !!(v?.stops_allowed ?? ride.stops_allowed) },
  ];

  return (
    <Animated.View style={[s.card, anim]}>
      <View style={s.cardHeader}>
        <View style={[s.cardIconWrap, { backgroundColor: C.warningLight }]}>
          <Ionicons name="car-sport" size={18} color={C.warning} />
        </View>
        <Text style={s.cardTitle}>Véhicule</Text>
      </View>

      {v ? (
        <View style={s.vehicleRow}>
          <View style={s.vehicleIconBig}>
            <Ionicons name="car-sport-outline" size={32} color={C.warning} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.vehicleModel}>{v.brand_model}</Text>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
              {v.color && <View style={s.vehiclePill}><Text style={s.vehiclePillTxt}>Couleur : {v.color}</Text></View>}
              {v.license_plate && <View style={s.vehiclePill}><Text style={s.vehiclePillTxt}>Immatriculation : {v.license_plate}</Text></View>}
              {v.vehicle_type && <View style={[s.vehiclePill, { backgroundColor: C.primaryLight }]}><Text style={[s.vehiclePillTxt, { color: C.primary }]}>{v.vehicle_type.toUpperCase()}</Text></View>}
            </View>
          </View>
        </View>
      ) : (
        <Text style={{ color: C.textSec, fontStyle: 'italic', fontSize: 14 }}>Aucun véhicule enregistré.</Text>
      )}

      <View style={s.divider} />

      <View style={s.cardHeader}>
        <View style={[s.cardIconWrap, { backgroundColor: C.successLight }]}>
          <Ionicons name="options-outline" size={18} color={C.success} />
        </View>
        <Text style={s.cardTitle}>Préférences</Text>
      </View>
      <View style={s.chipsRow}>
        {prefs.map((p, i) => <PrefChip key={i} iconName={p.iconName} label={p.label} active={p.active} />)}
      </View>
    </Animated.View>
  );
}

// ─── Scanner Premium ──────────────────────────────────────────
function PremiumScanner({ visible, onClose, scanned, onScan, permission, requestPermission }: any) {
  const laserY = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!visible) return;
    Animated.loop(
      Animated.sequence([
        Animated.timing(laserY, { toValue: 220, duration: 1800, useNativeDriver: true }),
        Animated.timing(laserY, { toValue: 0, duration: 1800, useNativeDriver: true }),
      ])
    ).start();
    return () => laserY.stopAnimation();
  }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#0A0A0F' }}>
        {/* Header */}
        <View style={s.scanHdr}>
          <TouchableOpacity style={s.scanCloseBtn} onPress={onClose} activeOpacity={0.8}>
            <Ionicons name="chevron-down" size={24} color={C.white} />
          </TouchableOpacity>
          <Text style={s.scanTitle}>Scanner le ticket</Text>
          <View style={{ width: 44 }} />
        </View>

        {/* Camera area */}
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          {!permission ? (
            <ActivityIndicator size="large" color={C.primary} />
          ) : !permission.granted ? (
            <View style={{ padding: 32, alignItems: 'center', gap: 20 }}>
              <Ionicons name="camera-outline" size={64} color="rgba(255,255,255,0.4)" />
              <Text style={{ color: C.white, fontSize: 16, textAlign: 'center', lineHeight: 24 }}>
                L'accès à la caméra est nécessaire pour scanner les tickets.
              </Text>
              <TouchableOpacity style={[s.scanPermBtn]} onPress={requestPermission} activeOpacity={0.85}>
                <Text style={{ color: C.white, fontSize: 15, fontWeight: '700' }}>Autoriser la caméra</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <CameraView
                style={StyleSheet.absoluteFillObject}
                facing="back"
                onBarcodeScanned={scanned ? undefined : onScan}
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              />
              {/* Dark overlay with hole */}
              <View style={s.scanOverlay}>
                <View style={s.scanOverlayTop} />
                <View style={{ flexDirection: 'row' }}>
                  <View style={s.scanOverlaySide} />
                  {/* Scan frame */}
                  <View style={s.scanFrame}>
                    {/* Corner markers */}
                    {['tl', 'tr', 'bl', 'br'].map((pos) => (
                      <View key={pos} style={[s.scanCorner,
                        pos.includes('t') ? { top: 0 } : { bottom: 0 },
                        pos.includes('l') ? { left: 0 } : { right: 0 },
                        pos.includes('t') && pos.includes('l') ? { borderTopWidth: 3, borderLeftWidth: 3 } : {},
                        pos.includes('t') && pos.includes('r') ? { borderTopWidth: 3, borderRightWidth: 3 } : {},
                        pos.includes('b') && pos.includes('l') ? { borderBottomWidth: 3, borderLeftWidth: 3 } : {},
                        pos.includes('b') && pos.includes('r') ? { borderBottomWidth: 3, borderRightWidth: 3 } : {},
                      ]} />
                    ))}
                    {/* Laser line */}
                    <Animated.View style={[s.laserLine, { transform: [{ translateY: laserY }] }]} />
                  </View>
                  <View style={s.scanOverlaySide} />
                </View>
                <View style={s.scanOverlayBottom} />
              </View>
              <View style={s.scanInstruction}>
                <Text style={s.scanInstructionTxt}>Positionnez le QR Code dans le cadre</Text>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ─── Main Screen ───────────────────────────────────────────────
export default function RideManagementScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, authFetch } = useAuth();

  const {
    ride, bookings, loading, refreshing,
    editingBooking, customPriceText, statusAnim,
    setEditingBooking, setCustomPriceText,
    onRefresh, handleAcceptBooking, handleRejectBooking,
    handleCancelRide, handleCompleteRide, handleChatWithPassenger,
  } = useRideManagement(id as string, authFetch, user);

  const [showScanner, setShowScanner] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [selectedBookingForCode, setSelectedBookingForCode] = useState<any>(null);
  const [downloadingManifestId, setDownloadingManifestId] = useState<string | null>(null);

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const scrollY = useRef(new Animated.Value(0)).current;

  // FAB hide on scroll
  const fabTranslate = scrollY.interpolate({ inputRange: [0, 80], outputRange: [0, 120], extrapolate: 'clamp' });

  const handleBoardWithCode = async (bookingId: string) => {
    if (!selectedBookingForCode) return;
    const cleanCode = manualCode.trim().replace('T-', '').toUpperCase();
    const expectedPrefix = selectedBookingForCode.id.substring(0, 8).toUpperCase();
    const fullIdMatch = manualCode.trim() === selectedBookingForCode.id;
    if (cleanCode !== expectedPrefix && !fullIdMatch) {
      CustomAlert.alert('Code incorrect', 'Le code saisi ne correspond pas à ce passager.'); return;
    }
    try {
      await authFetch(`/bookings/${bookingId}/board/`, { method: 'POST' });
      CustomAlert.alert('Succès', 'Embarquement validé !');
      setShowCodeModal(false); setManualCode(''); setSelectedBookingForCode(null);
      await onRefresh();
    } catch (err: any) {
      CustomAlert.alert('Erreur', err.message || "Impossible de valider l'embarquement.");
    }
  };

  const handleDownloadManifest = async (bookingId: string) => {
    try {
      setDownloadingManifestId(bookingId);
      const FileSystem = require('expo-file-system/legacy');
      const Sharing = require('expo-sharing');
      const SecureStore = require('expo-secure-store');
      const isSharingAvailable = await Sharing.isAvailableAsync();
      if (!isSharingAvailable) { CustomAlert.alert('Non disponible', "Le partage n'est pas disponible."); return; }
      const storedToken = await SecureStore.getItemAsync('zemy_access_token');
      const manifestUrl = `${API_URL}/bookings/${bookingId}/manifest/`;
      const localUri = (FileSystem.documentDirectory ?? '') + `reservation_${bookingId.substring(0, 8)}.pdf`;
      const result = await FileSystem.downloadAsync(manifestUrl, localUri, { headers: storedToken ? { Authorization: `Bearer ${storedToken}` } : {} });
      if (result.status === 200) {
        await Sharing.shareAsync(result.uri, { mimeType: 'application/pdf', dialogTitle: 'Reconnaissance de réservation Zemy', UTI: 'com.adobe.pdf' });
      } else {
        CustomAlert.alert('Erreur', 'Impossible de télécharger le document.');
      }
    } catch { CustomAlert.alert('Erreur', 'Impossible de générer la reconnaissance.'); }
    finally { setDownloadingManifestId(null); }
  };

  const handleBarCodeScanned = async ({ type, data }: { type: string; data: string }) => {
    setScanned(true);
    let bookingId = '';
    let passengerName = 'le passager';
    try {
      const parsed = JSON.parse(data);
      bookingId = parsed.booking || data;
      passengerName = parsed.passenger || 'le passager';
    } catch { bookingId = data; }
    if (!bookingId || bookingId.length < 10) {
      CustomAlert.alert('Erreur', 'QR code invalide.', [{ text: 'OK', onPress: () => setScanned(false) }]); return;
    }
    const booking = bookings.find((b: any) => b.id === bookingId);
    if (!booking) {
      CustomAlert.alert('Erreur', 'Ce ticket ne correspond à aucune réservation.', [{ text: 'OK', onPress: () => setScanned(false) }]); return;
    }
    if (booking.status === 'started') {
      CustomAlert.alert('Info', 'Ce passager a déjà embarqué.', [{ text: 'OK', onPress: () => { setShowScanner(false); setScanned(false); } }]); return;
    }
    CustomAlert.alert('Validation', `Valider l'embarquement de ${passengerName} ?`, [
      { text: 'Annuler', style: 'cancel', onPress: () => setScanned(false) },
      { text: 'Confirmer', onPress: async () => {
        try {
          await authFetch(`/bookings/${bookingId}/board/`, { method: 'POST' });
          CustomAlert.alert('Succès', 'Embarquement validé !');
          setShowScanner(false); await onRefresh();
        } catch (err: any) { CustomAlert.alert('Erreur', err.message || 'Erreur lors de la validation.'); }
        finally { setScanned(false); }
      }},
    ]);
  };

  const handleContactPassengers = () => {
    const active = bookings.filter((b: any) => b.payment_status !== 'pending' && ['confirmed', 'active', 'completed'].includes(b.status));
    if (active.length === 0) return;
    if (active.length === 1) { const pId = active[0].passenger_details?.id; if (pId) handleChatWithPassenger(pId); return; }
    const opts = active.map((b: any) => ({ text: b.passenger_details?.full_name || 'Passager', onPress: () => { const pId = b.passenger_details?.id; if (pId) handleChatWithPassenger(pId); } }));
    opts.push({ text: 'Annuler', style: 'cancel' } as any);
    CustomAlert.alert('Contacter un passager', 'Choisissez le passager :', opts);
  };

  if (loading) return <LoadingScreen />;
  if (!ride) return null;

  const pendingRequests = bookings.filter((b: any) => ['pending', 'pending_driver', 'pending_passenger', 'pending_payment', 'payment_processing'].includes(b.status));
  const activeBookings = bookings.filter((b: any) => ['confirmed', 'active', 'started', 'completed'].includes(b.status));
  const cancelledBookings = bookings.filter((b: any) => ['cancelled', 'rejected', 'payment_failed', 'expired'].includes(b.status));
  const totalRevenue = bookings.filter((b: any) => b.payment_status !== 'pending' && ['confirmed', 'active', 'started', 'completed'].includes(b.status)).reduce((sum: number, b: any) => sum + ((ride.price_per_seat || 0) * (b.seats_booked || 1)), 0);
  const seatsBooked = ride.total_seats - ride.seats_available;

  return (
    <SafeAreaView style={s.screen} edges={['left', 'right']}>

      {/* ── Premium Header ── */}
      <View style={[s.hdr, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity style={s.hdrBackBtn} onPress={() => router.back()} activeOpacity={0.8}>
          <Ionicons name="chevron-back" size={22} color={C.text} />
        </TouchableOpacity>
        <View style={s.hdrCenter}>
          <Text style={s.hdrTitle}>Gestion du trajet</Text>
          <Text style={s.hdrSub}>
            {new Date(ride.departure_date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} • {ride.departure_time?.substring(0, 5)}
          </Text>
        </View>
        <TouchableOpacity style={s.hdrMenuBtn} onPress={() => CustomAlert.alert('Menu', 'Options à venir.')} activeOpacity={0.8}>
          <Ionicons name="ellipsis-vertical" size={20} color={C.text} />
        </TouchableOpacity>
      </View>

      {/* ── Scroll Content ── */}
      <Animated.ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 110 + insets.bottom }}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
      >
        {/* Hero Card */}
        <HeroCard ride={ride} />

        {/* Stats Grid */}
        <StatsGrid ride={ride} totalRevenue={totalRevenue} seatsBooked={seatsBooked} />

        {/* Timeline */}
        <Timeline ride={ride} />

        {/* ── Pending Requests ── */}
        {pendingRequests.length > 0 && (
          <>
            <View style={s.sectionHeader}>
              <View style={[s.sectionDot, { backgroundColor: C.warning }]} />
              <Text style={[s.sectionTitle, { color: C.warning }]}>Demandes ({pendingRequests.length})</Text>
            </View>
            {pendingRequests.map((booking: any) => (
              <PendingBookingCard
                key={booking.id}
                booking={booking}
                ridePrice={ride.price_per_seat}
                onAccept={() => {
                  setEditingBooking(booking);
                  const ip = booking.portion_price ? Math.round(booking.portion_price / booking.seats_booked) : (ride?.price_per_seat || 0);
                  setCustomPriceText(String(ip));
                }}
                onReject={() => handleRejectBooking(booking.id)}
                onMessage={handleChatWithPassenger}
              />
            ))}
          </>
        )}

        {/* ── Active Passengers ── */}
        <View style={s.sectionHeaderRow}>
          <View style={s.sectionHeader}>
            <View style={[s.sectionDot, { backgroundColor: C.success }]} />
            <Text style={s.sectionTitle}>Passagers ({activeBookings.length})</Text>
          </View>
          {activeBookings.some((b: any) => b.status === 'confirmed') && (
            <TouchableOpacity
              style={s.qrScanBtn}
              onPress={async () => {
                if (!cameraPermission || !cameraPermission.granted) {
                  const res = await requestCameraPermission();
                  if (!res?.granted) { CustomAlert.alert('Permission requise', "L'accès à la caméra est nécessaire."); return; }
                }
                setScanned(false); setShowScanner(true);
              }}
              activeOpacity={0.85}
            >
              <Ionicons name="qr-code" size={14} color={C.white} />
              <Text style={s.qrScanBtnTxt}>Scanner QR</Text>
            </TouchableOpacity>
          )}
        </View>

        {activeBookings.length === 0 ? (
          <View style={s.emptyCard}>
            <Ionicons name="people-outline" size={40} color={C.textLight} />
            <Text style={s.emptyTxt}>Aucun passager confirmé pour l'instant</Text>
          </View>
        ) : (
          activeBookings.map((booking: any) => (
            <PassengerCard
              key={booking.id}
              booking={booking}
              onMessage={handleChatWithPassenger}
              onCall={(ph?: string) => { if (!ph) { CustomAlert.alert('Erreur', 'Numéro indisponible.'); return; } Linking.openURL(`tel:${ph}`); }}
              onBoard={() => { setSelectedBookingForCode(booking); setShowCodeModal(true); }}
              onDownloadManifest={handleDownloadManifest}
              downloadingManifestId={downloadingManifestId}
            />
          ))
        )}

        {/* ── Cancelled ── */}
        {cancelledBookings.length > 0 && (
          <>
            <View style={s.sectionHeader}>
              <View style={[s.sectionDot, { backgroundColor: C.textLight }]} />
              <Text style={[s.sectionTitle, { color: C.textSec }]}>Annulées ({cancelledBookings.length})</Text>
            </View>
            {cancelledBookings.map((booking: any) => (
              <PassengerCard
                key={booking.id}
                booking={booking}
                onMessage={handleChatWithPassenger}
                onCall={(ph?: string) => { if (ph) Linking.openURL(`tel:${ph}`); }}
              />
            ))}
          </>
        )}

        {/* ── Vehicle & Preferences ── */}
        <VehicleCard ride={ride} />
      </Animated.ScrollView>

      {/* ── FAB ── */}
      {activeBookings.length > 0 && (
        <Animated.View style={[s.fabWrap, { bottom: Math.max(24, insets.bottom + 12), transform: [{ translateY: fabTranslate }] }]}>
          <TouchableOpacity style={s.fab} onPress={handleContactPassengers} activeOpacity={0.9}>
            <Ionicons name="chatbubbles" size={20} color={C.white} />
            <Text style={s.fabTxt}>Contacter les passagers</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* ── Price Edit Modal ── */}
      <Modal visible={editingBooking !== null} transparent animationType="slide" onRequestClose={() => setEditingBooking(null)}>
        <View style={s.modalBg}>
          <View style={s.bottomSheet}>
            <View style={s.sheetHandle} />
            <Text style={s.sheetTitle}>Ajuster le tarif</Text>
            <Text style={s.sheetSub}>
              Tarif par place pour {editingBooking?.departure_location?.split(',')[0]} → {editingBooking?.arrival_location?.split(',')[0]}
            </Text>
            <View style={s.priceInput}>
              <TextInput
                style={s.priceInputTxt}
                value={customPriceText}
                onChangeText={setCustomPriceText}
                keyboardType="numeric"
                placeholder="Ex: 1500"
                placeholderTextColor={C.textLight}
              />
              <Text style={s.priceInputCur}>FCFA / place</Text>
            </View>
            <TouchableOpacity
              style={s.acceptBtnFull}
              onPress={() => {
                const price = parseInt(customPriceText);
                if (isNaN(price) || price <= 0) { CustomAlert.alert('Erreur', 'Prix invalide.'); return; }
                handleAcceptBooking(editingBooking!.id, price);
              }}
              activeOpacity={0.9}
            >
              <Ionicons name="checkmark-circle" size={19} color={C.white} />
              <Text style={s.acceptBtnFullTxt}>Accepter avec ce prix</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.cancelBtnFull} onPress={() => setEditingBooking(null)} activeOpacity={0.8}>
              <Text style={s.cancelBtnFullTxt}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Code Input Modal ── */}
      <Modal visible={showCodeModal} transparent animationType="slide" onRequestClose={() => { setShowCodeModal(false); setManualCode(''); setSelectedBookingForCode(null); }}>
        <View style={s.modalBg}>
          <View style={s.bottomSheet}>
            <View style={s.sheetHandle} />
            <Text style={s.sheetTitle}>Code du ticket</Text>
            <Text style={s.sheetSub}>
              Saisissez le code de {selectedBookingForCode?.passenger_details?.full_name || 'le passager'} (ex: T-XXXXXXXX)
            </Text>
            <TextInput
              style={s.codeInput}
              placeholder="T-A1B2C3D4"
              placeholderTextColor={C.textLight}
              value={manualCode}
              onChangeText={setManualCode}
              autoCapitalize="characters"
            />
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
              <TouchableOpacity style={[s.cancelBtnFull, { flex: 1 }]} onPress={() => { setShowCodeModal(false); setManualCode(''); setSelectedBookingForCode(null); }} activeOpacity={0.8}>
                <Text style={s.cancelBtnFullTxt}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.acceptBtnFull, { flex: 1, opacity: !manualCode.trim() ? 0.5 : 1 }]}
                disabled={!manualCode.trim()}
                onPress={() => selectedBookingForCode && handleBoardWithCode(selectedBookingForCode.id)}
                activeOpacity={0.9}
              >
                <Text style={s.acceptBtnFullTxt}>Valider</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── QR Scanner ── */}
      <PremiumScanner
        visible={showScanner}
        onClose={() => setShowScanner(false)}
        scanned={scanned}
        onScan={handleBarCodeScanned}
        permission={cameraPermission}
        requestPermission={requestCameraPermission}
      />
    </SafeAreaView>
  );
}

// ─── Styles ────────────────────────────────────────────────────
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },

  // Header
  hdr: { backgroundColor: C.white, paddingHorizontal: 16, paddingBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: C.border, ...SHmd },
  hdrBackBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  hdrMenuBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  hdrCenter: { flex: 1, alignItems: 'center', gap: 2 },
  hdrTitle: { fontSize: 17, fontWeight: '800', color: C.text },
  hdrSub: { fontSize: 12, fontWeight: '500', color: C.textSec },

  // Hero Card
  heroCard: {
    height: 210, borderRadius: 28, overflow: 'hidden',
    padding: 24, justifyContent: 'space-between',
    ...SHlg,
  },
  heroCircle1: { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.07)', top: -60, right: -40 },
  heroCircle2: { position: 'absolute', width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.06)', bottom: -30, left: 20 },
  heroBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, alignSelf: 'flex-start' },
  heroBadgeTxt: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  heroRoute: { flexDirection: 'row', alignItems: 'center', gap: 0 },
  heroRouteCol: { flex: 1, gap: 4 },
  heroDepDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.successLight, borderWidth: 2, borderColor: C.white, marginBottom: 2 },
  heroArrDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#FCA5A5', borderWidth: 2, borderColor: C.white, marginBottom: 2 },
  heroCity: { fontSize: 20, fontWeight: '900', color: C.white },
  heroTime: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.75)' },
  heroConnector: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, gap: 6 },
  heroConnLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.25)' },
  heroConnArrow: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  heroMeta: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.15)', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  heroMetaItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  heroMetaDivider: { width: 1, height: 20, backgroundColor: 'rgba(255,255,255,0.2)' },
  heroMetaTxt: { fontSize: 12, fontWeight: '700', color: C.white },

  // Stats
  statCard: { borderRadius: 20, padding: 18, ...SHsm },
  statVal: { fontSize: 22, fontWeight: '900', marginBottom: 2 },
  statLbl: { fontSize: 12, color: C.textSec, fontWeight: '600' },

  // Card
  card: { backgroundColor: C.white, borderRadius: 24, padding: 20, marginBottom: 16, ...SHsm },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 },
  cardIconWrap: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 16, fontWeight: '800', color: C.text },
  divider: { height: 1, backgroundColor: C.border, marginVertical: 16 },

  // Timeline
  tlDot: { borderRadius: 8, borderWidth: 2, borderColor: C.white, ...SHsm },
  tlLine: { flex: 1, width: 2, backgroundColor: C.borderMid, marginVertical: 4, borderRadius: 1, minHeight: 20 },
  tlCity: { fontSize: 15, fontWeight: '800', color: C.text },
  tlSub: { fontSize: 12, color: C.textSec, marginTop: 1 },
  tlTimePill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, alignSelf: 'flex-start' },
  tlTimeTxt: { fontSize: 12, fontWeight: '700' },
  tlLabel: { fontSize: 11, fontWeight: '600', marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  descBox: { backgroundColor: C.primaryLight, borderRadius: 16, padding: 16, marginTop: 12 },
  descTxt: { fontSize: 14, color: C.text, fontStyle: 'italic', lineHeight: 22 },

  // Section headers
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10, marginTop: 4 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, marginTop: 4 },
  sectionDot: { width: 8, height: 8, borderRadius: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: C.text },

  // Booking cards
  bookCard: { backgroundColor: C.white, borderRadius: 24, padding: 20, marginBottom: 14, ...SHsm },
  paxCard: { backgroundColor: C.white, borderRadius: 24, padding: 20, marginBottom: 14, ...SHsm },
  pendingBadge: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: C.warningLight, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, alignSelf: 'flex-start', marginBottom: 16 },
  pendingDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: C.warning },
  pendingTxt: { fontSize: 11, fontWeight: '700', color: C.warning, textTransform: 'uppercase', letterSpacing: 0.3 },
  paxAvatar: { width: 56, height: 56, borderRadius: 28 },
  paxAvatarPH: { backgroundColor: C.primaryLight, alignItems: 'center', justifyContent: 'center' },
  paxInitials: { fontSize: 20, fontWeight: '800', color: C.primary },
  paxName: { fontSize: 16, fontWeight: '800', color: C.text },
  paxPrice: { fontSize: 18, fontWeight: '900', color: C.primary },
  verifiedBadge: { width: 18, height: 18, borderRadius: 9, backgroundColor: C.success, alignItems: 'center', justifyContent: 'center' },
  miniDot: { width: 7, height: 7, borderRadius: 3.5 },
  statusChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusChipTxt: { fontSize: 11, fontWeight: '700' },

  // Booking action buttons
  bookBtns: { flexDirection: 'row', gap: 12 },
  rejectBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderColor: C.error + '40', backgroundColor: C.errorLight, borderRadius: 16, paddingVertical: 13 },
  rejectTxt: { fontSize: 14, fontWeight: '700', color: C.error },
  acceptBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.success, borderRadius: 16, paddingVertical: 13, ...SHsm },
  acceptTxt: { fontSize: 14, fontWeight: '700', color: C.white },

  // Passenger actions
  paxActions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  paxActBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.bg, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 9 },
  paxActTxt: { fontSize: 12, fontWeight: '700' },

  // QR Scan button
  qrScanBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14 },
  qrScanBtnTxt: { fontSize: 12, fontWeight: '700', color: C.white },

  // Vehicle
  vehicleRow: { flexDirection: 'row', gap: 14, marginBottom: 4 },
  vehicleIconBig: { width: 60, height: 60, borderRadius: 20, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  vehicleModel: { fontSize: 17, fontWeight: '800', color: C.text },
  vehiclePill: { backgroundColor: C.bg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  vehiclePillTxt: { fontSize: 12, fontWeight: '600', color: C.textSec },

  // Chips
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20 },
  chipActive: { backgroundColor: C.primaryLight },
  chipInactive: { backgroundColor: C.bg },
  chipTxt: { fontSize: 12, fontWeight: '600' },

  // Empty state
  emptyCard: { backgroundColor: C.white, borderRadius: 24, padding: 40, alignItems: 'center', gap: 12, marginBottom: 14, ...SHsm },
  emptyTxt: { fontSize: 14, color: C.textSec, textAlign: 'center' },

  // FAB
  fabWrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
  fab: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.primary, paddingVertical: 18, paddingHorizontal: 28, borderRadius: 32, ...SHlg },
  fabTxt: { fontSize: 15, fontWeight: '800', color: C.white },

  // Modals
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  bottomSheet: { backgroundColor: C.white, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, gap: 14 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: C.borderMid, alignSelf: 'center', marginBottom: 4 },
  sheetTitle: { fontSize: 20, fontWeight: '800', color: C.text },
  sheetSub: { fontSize: 14, color: C.textSec, lineHeight: 20 },
  priceInput: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.bg, borderRadius: 16, paddingHorizontal: 18, height: 58 },
  priceInputTxt: { flex: 1, fontSize: 22, fontWeight: '800', color: C.text },
  priceInputCur: { fontSize: 14, fontWeight: '700', color: C.textSec },
  codeInput: { borderWidth: 1.5, borderColor: C.borderMid, borderRadius: 16, padding: 16, fontSize: 18, color: C.text, textAlign: 'center', fontWeight: '700', backgroundColor: C.bg },
  acceptBtnFull: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.success, borderRadius: 18, height: 56, ...SHsm },
  acceptBtnFullTxt: { fontSize: 15, fontWeight: '800', color: C.white },
  cancelBtnFull: { alignItems: 'center', justifyContent: 'center', borderRadius: 18, height: 50, borderWidth: 1.5, borderColor: C.borderMid },
  cancelBtnFullTxt: { fontSize: 14, fontWeight: '600', color: C.textSec },

  // Premium Scanner
  scanHdr: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, backgroundColor: 'rgba(0,0,0,0.6)' },
  scanCloseBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  scanTitle: { color: C.white, fontSize: 18, fontWeight: '700' },
  scanPermBtn: { backgroundColor: C.primary, paddingVertical: 14, paddingHorizontal: 28, borderRadius: 16 },
  scanOverlay: { ...StyleSheet.absoluteFillObject },
  scanOverlayTop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  scanOverlaySide: { width: 40, backgroundColor: 'rgba(0,0,0,0.6)' },
  scanOverlayBottom: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  scanFrame: { width: 240, height: 240, position: 'relative', overflow: 'visible' },
  scanCorner: { position: 'absolute', width: 28, height: 28, borderColor: C.primary },
  laserLine: { position: 'absolute', left: 0, right: 0, height: 2, backgroundColor: C.primary, shadowColor: C.primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 8, elevation: 10 },
  scanInstruction: { position: 'absolute', bottom: 48, left: 0, right: 0, alignItems: 'center' },
  scanInstructionTxt: { color: C.white, fontSize: 14, fontWeight: '600', backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 24 },
});
