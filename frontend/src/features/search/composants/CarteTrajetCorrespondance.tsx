import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ConnectionRideCardProps {
  item: any;
  onPress: () => void;
}

/**
 * Carte de trajet à une correspondance (2 trajets successifs).
 * Propose une alternative si aucun trajet direct n'est trouvé.
 */
export function CarteTrajetCorrespondance({ item, onPress }: ConnectionRideCardProps) {
  const driver1 = item.ride_1.driver_details?.full_name || 'Conducteur 1';
  const driver2 = item.ride_2.driver_details?.full_name || 'Conducteur 2';

  const depTime1 = item.departure_time_1?.substring(0, 5) || '--:--';
  const arrTime1 = item.arrival_time_1?.substring(0, 5) || '--:--';
  const depTime2 = item.departure_time_2?.substring(0, 5) || '--:--';
  const arrTime2 = item.arrival_time_2?.substring(0, 5) || '--:--';

  return (
    <TouchableOpacity style={styles.connCard} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.connHeader}>
        <View style={styles.connBadge}>
          <Ionicons name="git-branch" size={14} color="#0284C7" />
          <Text style={styles.connBadgeTxt}>1 CORRESPONDANCE</Text>
        </View>
        <Text style={styles.connPrice}>{item.price?.toLocaleString()} FCFA</Text>
      </View>

      <Text style={styles.connEscale}>
        Escale à <Text style={{ fontWeight: '700' }}>{item.connection_point_name}</Text> ({item.waiting_time_min} min d'attente)
      </Text>

      <View style={styles.connTimeline}>
        {/* Tronçon 1 */}
        <View style={styles.connStep}>
          <Ionicons name="time-outline" size={16} color="#6B7280" />
          <Text style={styles.connStepTime}>{depTime1} ➔ {arrTime1}</Text>
          <Text style={styles.connStepDriver} numberOfLines={1}>Conducteur : {driver1}</Text>
        </View>

        {/* Connecteur pointillé */}
        <View style={styles.connDivider} />

        {/* Tronçon 2 */}
        <View style={styles.connStep}>
          <Ionicons name="time-outline" size={16} color="#6B7280" />
          <Text style={styles.connStepTime}>{depTime2} ➔ {arrTime2}</Text>
          <Text style={styles.connStepDriver} numberOfLines={1}>Conducteur : {driver2}</Text>
        </View>
      </View>

      <View style={styles.connFooter}>
        <Text style={styles.connMoreTxt}>Voir les détails de la correspondance</Text>
        <Ionicons name="chevron-forward" size={16} color="#0284C7" />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  connCard: {
    backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, marginBottom: 14,
    borderWidth: 1.5, borderColor: '#BAE6FD',
    shadowColor: '#0284C7', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2
  },
  connHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  connBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E0F2FE', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, gap: 4 },
  connBadgeTxt: { fontSize: 10, fontWeight: '800', color: '#0369A1' },
  connPrice: { fontSize: 18, fontWeight: '800', color: '#111827' },
  connEscale: { fontSize: 13, color: '#374151', marginBottom: 12 },
  connTimeline: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 12, gap: 8 },
  connStep: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  connStepTime: { fontSize: 13, fontWeight: '700', color: '#1F2937' },
  connStepDriver: { fontSize: 12, color: '#6B7280', flex: 1 },
  connDivider: { marginLeft: 7, height: 10, borderLeftWidth: 1.5, borderLeftColor: '#D1D5DB', borderStyle: 'dashed' },
  connFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  connMoreTxt: { fontSize: 12, fontWeight: '700', color: '#0284C7' }
});
