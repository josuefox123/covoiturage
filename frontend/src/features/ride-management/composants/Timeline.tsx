import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFadeSlide } from './AnimationsGestion';
import { C, SHsm } from './theme-gestion';

interface TimelineProps {
  ride: any;
}

/**
 * Composant de ligne du temps représentant l'itinéraire complet,
 * incluant le départ, les escales prévues et la destination.
 */
export function Timeline({ ride }: TimelineProps) {
  const anim = useFadeSlide(150);
  const stops = ride.stopovers || [];
  const depCity = ride.departure_location?.split(',')[0];
  const arrCity = ride.arrival_location?.split(',')[0];

  const allStops = [
    {
      city: depCity,
      sub: ride.departure_location?.split(',')[1]?.trim() || '',
      time: ride.departure_time?.substring(0, 5),
      label: 'Départ',
      dot: C.primary
    },
    ...stops.map((st: any) => ({
      city: (st.name || st.location || 'Escale').split(',')[0],
      sub: '',
      time: st.arrival_time?.substring(0, 5) || '',
      label: 'Escale',
      dot: C.warning
    })),
    {
      city: arrCity,
      sub: ride.arrival_location?.split(',')[1]?.trim() || '',
      time: '',
      label: 'Arrivée',
      dot: C.error
    },
  ];

  return (
    <Animated.View style={[styles.card, anim]}>
      <View style={styles.cardHeader}>
        <View style={[styles.cardIconWrap, { backgroundColor: C.primaryLight }]}>
          <Ionicons name="map-outline" size={18} color={C.primary} />
        </View>
        <Text style={styles.cardTitle}>Itinéraire</Text>
      </View>

      {allStops.map((st, idx) => (
        <View key={idx} style={{ flexDirection: 'row', gap: 14 }}>
          <View style={{ alignItems: 'center', width: 20 }}>
            <View
              style={[
                styles.tlDot,
                {
                  backgroundColor: st.dot,
                  width: idx === 0 || idx === allStops.length - 1 ? 16 : 12,
                  height: idx === 0 || idx === allStops.length - 1 ? 16 : 12
                }
              ]}
            />
            {idx < allStops.length - 1 && <View style={styles.tlLine} />}
          </View>
          <View style={{ flex: 1, paddingBottom: idx < allStops.length - 1 ? 24 : 0 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.tlCity}>{st.city}</Text>
                {st.sub ? <Text style={styles.tlSub}>{st.sub}</Text> : null}
              </View>
              {st.time ? (
                <View style={[styles.tlTimePill, { backgroundColor: st.dot + '18' }]}>
                  <Text style={[styles.tlTimeTxt, { color: st.dot }]}>{st.time}</Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.tlLabel, { color: st.dot }]}>{st.label}</Text>
          </View>
        </View>
      ))}

      {ride.description ? (
        <View style={styles.descBox}>
          <Text style={styles.guillemets}>"</Text>
          <Text style={styles.descTxt}>{ride.description}</Text>
        </View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: C.white, borderRadius: 24, padding: 20, marginBottom: 16, ...SHsm },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 },
  cardIconWrap: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 16, fontWeight: '800', color: C.text },
  tlDot: { borderRadius: 8, borderWidth: 2, borderColor: C.white, ...SHsm },
  tlLine: { flex: 1, width: 2, backgroundColor: C.borderMid, marginVertical: 4, borderRadius: 1, minHeight: 20 },
  tlCity: { fontSize: 15, fontWeight: '800', color: C.text },
  tlSub: { fontSize: 12, color: C.textSec, marginTop: 1 },
  tlTimePill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, alignSelf: 'flex-start' },
  tlTimeTxt: { fontSize: 12, fontWeight: '700' },
  tlLabel: { fontSize: 11, fontWeight: '600', marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  descBox: { backgroundColor: C.primaryLight, borderRadius: 16, padding: 16, marginTop: 12 },
  guillemets: { fontSize: 36, color: C.primary + '30', lineHeight: 32, fontWeight: '900', marginBottom: -6 },
  descTxt: { fontSize: 14, color: C.text, fontStyle: 'italic', lineHeight: 22 }
});
