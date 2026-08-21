import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFadeSlide } from './AnimationsGestion';
import { C, SHlg } from './theme-gestion';

interface HeroCardProps {
  ride: any;
}

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

/**
 * Carte Hero principale affichant le statut du trajet, l'itinéraire résumé
 * et les métadonnées (durée, places, prix).
 */
export function HeroCard({ ride }: HeroCardProps) {
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
        style={styles.heroCard}
      >
        {/* Cercles décoratifs */}
        <View style={styles.heroCircle1} pointerEvents="none" />
        <View style={styles.heroCircle2} pointerEvents="none" />

        {/* Badge de Statut */}
        <View style={[styles.heroBadge, { backgroundColor: si.bg }]}>
          <Ionicons name={si.icon as any} size={13} color={si.color} />
          <Text style={[styles.heroBadgeTxt, { color: si.color }]}>{si.label}</Text>
        </View>

        {/* Route (Départ → Arrivée) */}
        <View style={styles.heroRoute}>
          <View style={styles.heroRouteCol}>
            <View style={styles.heroDepDot} />
            <Text style={styles.heroCity}>{depCity}</Text>
            <Text style={styles.heroTime}>{ride.departure_time?.substring(0, 5)}</Text>
          </View>

          <View style={styles.heroConnector}>
            <View style={styles.heroConnLine} />
            <View style={styles.heroConnArrow}>
              <Ionicons name="arrow-forward" size={14} color={C.white} />
            </View>
            <View style={styles.heroConnLine} />
          </View>

          <View style={[styles.heroRouteCol, { alignItems: 'flex-end' }]}>
            <View style={styles.heroArrDot} />
            <Text style={[styles.heroCity, { textAlign: 'right' }]}>{arrCity}</Text>
            <Text style={[styles.heroTime, { textAlign: 'right' }]}>{ride.departure_date}</Text>
          </View>
        </View>

        {/* Infos complémentaires (durée, places, prix) */}
        <View style={styles.heroMeta}>
          <View style={styles.heroMetaItem}>
            <Ionicons name="time-outline" size={15} color="rgba(255,255,255,0.8)" />
            <Text style={styles.heroMetaTxt}>{fmtDuration(ride.duration_min)}</Text>
          </View>
          <View style={styles.heroMetaDivider} />
          <View style={styles.heroMetaItem}>
            <Ionicons name="people-outline" size={15} color="rgba(255,255,255,0.8)" />
            <Text style={styles.heroMetaTxt}>{ride.seats_available} / {ride.total_seats} pl.</Text>
          </View>
          <View style={styles.heroMetaDivider} />
          <View style={styles.heroMetaItem}>
            <Ionicons name="wallet-outline" size={15} color="rgba(255,255,255,0.8)" />
            <Text style={styles.heroMetaTxt}>{(ride.driver_payout || 0).toLocaleString()} F</Text>
          </View>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
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
  heroConnector: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, gap: 6 },
  heroConnLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.25)' },
  heroConnArrow: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  heroMeta: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.15)', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  heroMetaItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  heroMetaDivider: { width: 1, height: 20, backgroundColor: 'rgba(255,255,255,0.2)' },
  heroMetaTxt: { fontSize: 12, fontWeight: '700', color: C.white },
});
