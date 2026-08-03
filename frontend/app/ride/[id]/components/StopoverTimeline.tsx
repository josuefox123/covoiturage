import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Ride } from '../../../../src/types';

interface StopoverTimelineProps {
  ride: Ride;
}

const formatDuration = (seconds: number): string => {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  if (remainingMins === 0) return `${hours}h`;
  return `${hours}h ${remainingMins}m`;
};

export function StopoverTimeline({ ride }: StopoverTimelineProps) {
  return (
    <View style={styles.card}>
      {/* Départ */}
      <View style={styles.timelineItem}>
        <View style={styles.timelineDotStart} />
        <View style={styles.timelineContent}>
          <Text style={styles.locationText}>{ride.departure_location}</Text>
          <Text style={styles.timeText}>{ride.departure_time?.substring(0, 5) ?? '--:--'}</Text>
        </View>
      </View>

      {/* Villes et points d'arrêt (Stopovers) */}
      {ride.stopovers && Array.isArray(ride.stopovers) && ride.stopovers.length > 0 ? (
        ride.stopovers.map((stop: any, idx: number) => {
          const stopDuration = stop.stopDurationMin || stop.stop_duration_min || 15;
          const legPrice = stop.price || 0;
          return (
            <React.Fragment key={idx}>
              <View style={styles.timelineLink}>
                <View style={styles.timelineLine} />
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={styles.legPriceBadge}>
                    <Ionicons name="card-outline" size={12} color="#0284C7" />
                    <Text style={styles.legPriceBadgeText}>
                      {legPrice > 0 ? `${legPrice.toLocaleString()} FCFA` : 'Prix libre'}
                    </Text>
                  </View>
                  <Text style={styles.distanceText}>Arrêt de {stopDuration} min</Text>
                </View>
              </View>
              <View style={styles.timelineItem}>
                <View style={[styles.timelineDotStart, { backgroundColor: '#F59E0B' }]} />
                <View style={styles.timelineContent}>
                  <Text style={styles.locationText}>{stop.name}</Text>
                </View>
              </View>
            </React.Fragment>
          );
        })
      ) : null}

      {/* Arrivée */}
      <View style={styles.timelineLink}>
        <View style={styles.timelineLine} />
        {ride.stopovers && Array.isArray(ride.stopovers) && ride.stopovers.length > 0 ? (
          (() => {
            const lastStop = ride.stopovers[ride.stopovers.length - 1];
            const lastLegPrice = lastStop?.arrival_price || lastStop?.price || 0;
            return (
              <View style={styles.legPriceBadge}>
                <Ionicons name="card-outline" size={12} color="#0284C7" />
                <Text style={styles.legPriceBadgeText}>
                  {lastLegPrice > 0 ? `${lastLegPrice.toLocaleString()} FCFA` : 'Prix libre'}
                </Text>
              </View>
            );
          })()
        ) : (
          <Text style={styles.distanceText}>
            {ride.distance_km ? `${ride.distance_km} km` : 'Trajet direct'}
            {ride.duration_min ? ` • ${formatDuration(ride.duration_min * 60)}` : ''}
          </Text>
        )}
      </View>

      <View style={styles.timelineItem}>
        <Ionicons name="location" size={20} color="#DC2626" style={styles.timelineIconEnd} />
        <View style={styles.timelineContent}>
          <Text style={styles.locationText}>{ride.arrival_location}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB'
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start'
  },
  timelineDotStart: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#1F2937',
    marginTop: 4,
    marginLeft: 3
  },
  timelineIconEnd: {
    marginLeft: -1,
    marginTop: 2
  },
  timelineContent: {
    marginLeft: 16,
    flex: 1
  },
  locationText: {
    fontSize: 17,
    color: '#1F2937',
    fontWeight: '700'
  },
  timeText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4
  },
  timelineLink: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12
  },
  timelineLine: {
    width: 2,
    height: 40,
    backgroundColor: '#E5E7EB',
    marginLeft: 9
  },
  distanceText: {
    fontSize: 13,
    color: '#6B7280',
    marginLeft: 24,
    fontWeight: '500'
  },
  legPriceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginVertical: 2,
    gap: 4,
    alignSelf: 'flex-start',
    marginLeft: 16
  },
  legPriceBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0369A1'
  }
});
