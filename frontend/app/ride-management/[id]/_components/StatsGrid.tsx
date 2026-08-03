import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ride } from '../../../../src/types';

interface StatsGridProps {
  ride: Ride;
  totalRevenue: number;
  seatsBooked: number;
}

export function StatsGrid({ ride, totalRevenue, seatsBooked }: StatsGridProps) {
  return (
    <View style={styles.statsGrid}>
      <View style={styles.statBox}>
        <Text style={styles.statLabel}>Prix unitaire</Text>
        <Text style={styles.statValue}>{ride.price_per_seat} FCFA</Text>
      </View>
      <View style={styles.statBox}>
        <Text style={styles.statLabel}>Distance</Text>
        <Text style={styles.statValue}>{ride.distance_km || '---'} km</Text>
      </View>
      <View style={styles.statBox}>
        <Text style={styles.statLabel}>Revenu estimé</Text>
        <Text style={[styles.statValue, { color: '#16A34A' }]}>{totalRevenue} FCFA</Text>
      </View>
      <View style={styles.statBox}>
        <Text style={styles.statLabel}>Réservations</Text>
        <Text style={styles.statValue}>{seatsBooked} places</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  statBox: { width: '48%', backgroundColor: '#FFFFFF', padding: 16, borderRadius: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
  statLabel: { fontSize: 12, color: '#6B7280', marginBottom: 4 },
  statValue: { fontSize: 16, fontWeight: '700', color: '#1F2937' }
});
