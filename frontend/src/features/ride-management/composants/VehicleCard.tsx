import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFadeSlide } from './AnimationsGestion';
import { C, SHsm } from './theme-gestion';

interface PrefChipProps {
  iconName: any;
  label: string;
  active: boolean;
}

function PrefChip({ iconName, label, active }: PrefChipProps) {
  return (
    <View style={[styles.chip, active ? styles.chipActive : styles.chipInactive]}>
      <Ionicons name={iconName} size={15} color={active ? C.primary : C.textSec} />
      <Text style={[styles.chipTxt, { color: active ? C.primary : C.textSec }]}>{label}</Text>
    </View>
  );
}

interface VehicleCardProps {
  ride: any;
}

/**
 * Carte affichant les détails du véhicule (modèle, plaque...)
 * ainsi que les préférences du conducteur (musique, clim, fumeur...)
 */
export function VehicleCard({ ride }: VehicleCardProps) {
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
    <Animated.View style={[styles.card, anim]}>
      <View style={styles.cardHeader}>
        <View style={[styles.cardIconWrap, { backgroundColor: C.warningLight }]}>
          <Ionicons name="car-sport" size={18} color={C.warning} />
        </View>
        <Text style={styles.cardTitle}>Véhicule</Text>
      </View>

      {v ? (
        <View style={styles.vehicleRow}>
          <View style={styles.vehicleIconBig}>
            <Ionicons name="car-sport-outline" size={32} color={C.warning} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.vehicleModel}>{v.brand_model}</Text>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
              {v.color && <View style={styles.vehiclePill}><Text style={styles.vehiclePillTxt}>Couleur : {v.color}</Text></View>}
              {v.license_plate && <View style={styles.vehiclePill}><Text style={styles.vehiclePillTxt}>Immatriculation : {v.license_plate}</Text></View>}
              {v.vehicle_type && <View style={[styles.vehiclePill, { backgroundColor: C.primaryLight }]}><Text style={[styles.vehiclePillTxt, { color: C.primary }]}>{v.vehicle_type.toUpperCase()}</Text></View>}
            </View>
          </View>
        </View>
      ) : (
        <Text style={{ color: C.textSec, fontStyle: 'italic', fontSize: 14 }}>Aucun véhicule enregistré.</Text>
      )}

      <View style={styles.divider} />

      <View style={styles.cardHeader}>
        <View style={[styles.cardIconWrap, { backgroundColor: C.successLight }]}>
          <Ionicons name="options-outline" size={18} color={C.success} />
        </View>
        <Text style={styles.cardTitle}>Préférences</Text>
      </View>
      <View style={styles.chipsRow}>
        {prefs.map((p, i) => <PrefChip key={i} iconName={p.iconName} label={p.label} active={p.active} />)}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: C.white, borderRadius: 24, padding: 20, marginBottom: 16, ...SHsm },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 },
  cardIconWrap: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 16, fontWeight: '800', color: C.text },
  divider: { height: 1, backgroundColor: C.border, marginVertical: 16 },
  vehicleRow: { flexDirection: 'row', gap: 14, marginBottom: 4 },
  vehicleIconBig: { width: 60, height: 60, borderRadius: 20, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  vehicleModel: { fontSize: 17, fontWeight: '800', color: C.text },
  vehiclePill: { backgroundColor: C.bg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  vehiclePillTxt: { fontSize: 12, fontWeight: '600', color: C.textSec },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20 },
  chipActive: { backgroundColor: C.primaryLight },
  chipInactive: { backgroundColor: C.bg },
  chipTxt: { fontSize: 12, fontWeight: '600' }
});
