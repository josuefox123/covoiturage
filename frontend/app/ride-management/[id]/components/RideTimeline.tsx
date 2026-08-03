import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ride } from '../../../../src/types';

interface RideTimelineProps {
  ride: Ride;
}

export function RideTimeline({ ride }: RideTimelineProps) {
  return (
    <View style={styles.timeline}>
      {/* Départ */}
      <View style={styles.timelineItem}>
        <View style={[styles.timelineDot, { borderColor: '#2D9CDB' }]} />
        <View style={styles.timelineLine} />
        <View style={styles.timelineContent}>
          <Text style={styles.locationText}>{ride.departure_location}</Text>
          <Text style={styles.timeText}>{ride.departure_time?.substring(0, 5)}</Text>
        </View>
      </View>

      {/* Villes et points d'arrêt (Stopovers) */}
      {ride.stopovers && Array.isArray(ride.stopovers) && ride.stopovers.length > 0 ? (
        ride.stopovers.map((stop: any, idx: number) => {
          const stopDuration = stop.stopDurationMin || stop.stop_duration_min || 15;
          return (
            <View key={idx} style={styles.timelineItem}>
              <View style={[styles.timelineDot, { borderColor: '#F59E0B', backgroundColor: '#F59E0B' }]} />
              <View style={styles.timelineLine} />
              <View style={styles.timelineContent}>
                <Text style={styles.locationText}>{stop.name}</Text>
                <Text style={styles.timeText}>Arrêt de {stopDuration} min</Text>
              </View>
            </View>
          );
        })
      ) : null}
      
      {/* Arrivée */}
      <View style={styles.timelineItem}>
        <View style={[styles.timelineDot, { borderColor: '#16A34A', backgroundColor: '#16A34A' }]} />
        <View style={styles.timelineContent}>
          <Text style={styles.locationText}>{ride.arrival_location}</Text>
          <Text style={styles.timeText}>Estimation {ride.distance_km ? '~' + Math.round(ride.distance_km / 60) + 'h' : '--:--'}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  timeline: { paddingLeft: 8, marginBottom: 16 },
  timelineItem: { flexDirection: 'row', marginBottom: 16, position: 'relative' },
  timelineDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 3, backgroundColor: '#FFFFFF', zIndex: 2, marginTop: 4 },
  timelineLine: { position: 'absolute', top: 18, left: 6, width: 2, height: 36, backgroundColor: '#E5E7EB', zIndex: 1 },
  timelineContent: { marginLeft: 16, flex: 1 },
  locationText: { fontSize: 16, fontWeight: '700', color: '#1F2937' },
  timeText: { fontSize: 14, color: '#6B7280', marginTop: 2 }
});
