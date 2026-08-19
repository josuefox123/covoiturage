import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Ride } from '../../../../src/types';

interface RideTimelineProps {
  ride: Ride;
  bookings?: any[];
}

const isLocationMatch = (loc1?: string, loc2?: string) => {
  if (!loc1 || !loc2) return false;
  
  const clean = (s: string) => 
    s.toLowerCase()
     .normalize("NFD")
     .replace(/[\u0300-\u036f]/g, "") // Enlever les accents
     .split(',')[0] // Prendre seulement le nom de la ville/lieu avant la première virgule
     .replace(/[^a-z0-9]/g, "") // Garder uniquement alphanumérique
     .trim();
  
  const c1 = clean(loc1);
  const c2 = clean(loc2);
  
  return c1.includes(c2) || c2.includes(c1);
};

export function RideTimeline({ ride, bookings = [] }: RideTimelineProps) {
  // Inclure toutes les réservations actives et en attente (exclure uniquement les annulées/rejetées/échouées)
  const activeBookings = bookings.filter((b: any) => 
    !['cancelled', 'rejected', 'payment_failed', 'expired'].includes(b.status)
  );

  const stopoversLength = ride.stopovers && Array.isArray(ride.stopovers) ? ride.stopovers.length : 0;

  const getStatusLabel = (status: string) => {
    if (['confirmed', 'active', 'started', 'completed'].includes(status)) {
      return '';
    }
    if (status === 'pending_payment' || status === 'payment_processing') {
      return ' (Règlement en cours)';
    }
    return ' (À valider)';
  };

  const renderLocationPassengers = (locationName: string, orderIndex: number) => {
    // Priorité absolue à la comparaison par index de waypoint résolu par le backend
    const boarding = activeBookings.filter(b => {
      if (b.departure_waypoint_order !== undefined && b.departure_waypoint_order !== null) {
        return b.departure_waypoint_order === orderIndex;
      }
      return isLocationMatch(b.departure_location, locationName);
    });

    const alighting = activeBookings.filter(b => {
      if (b.arrival_waypoint_order !== undefined && b.arrival_waypoint_order !== null) {
        return b.arrival_waypoint_order === orderIndex;
      }
      return isLocationMatch(b.arrival_location, locationName);
    });

    if (boarding.length === 0 && alighting.length === 0) return null;

    return (
      <View style={styles.passengersContainer}>
        {boarding.map((b: any, idx: number) => {
          const isPending = !['confirmed', 'active', 'started', 'completed'].includes(b.status);
          return (
            <View key={`b-${idx}`} style={styles.passengerRow}>
              <Ionicons name="enter" size={16} color={isPending ? '#F59E0B' : '#16A34A'} style={{ marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.boardingText, isPending && { color: '#F59E0B' }]}>
                  Prendre : <Text style={styles.passengerName}>{b.passenger_details?.full_name || 'Passager'}</Text> ({b.seats_booked} pl.){getStatusLabel(b.status)}
                </Text>
                {b.departure_location ? (
                  <Text style={styles.addressText} numberOfLines={2}>
                    ➔ {b.departure_location}
                  </Text>
                ) : null}
              </View>
            </View>
          );
        })}
        {alighting.map((b: any, idx: number) => {
          const isPending = !['confirmed', 'active', 'started', 'completed'].includes(b.status);
          return (
            <View key={`a-${idx}`} style={styles.passengerRow}>
              <Ionicons name="exit" size={16} color={isPending ? '#F59E0B' : '#DC2626'} style={{ marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.alightingText, isPending && { color: '#F59E0B' }]}>
                  Déposer : <Text style={styles.passengerName}>{b.passenger_details?.full_name || 'Passager'}</Text> ({b.seats_booked} pl.){getStatusLabel(b.status)}
                </Text>
                {b.arrival_location ? (
                  <Text style={styles.addressText} numberOfLines={2}>
                    ➔ {b.arrival_location}
                  </Text>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <View style={styles.timeline}>
      {/* Départ */}
      <View style={styles.timelineItem}>
        <View style={[styles.timelineDot, { borderColor: '#2D9CDB' }]} />
        <View style={styles.timelineLine} />
        <View style={styles.timelineContent}>
          <Text style={styles.locationText}>{ride.departure_location}</Text>
          <Text style={styles.timeText}>{ride.departure_time?.substring(0, 5)}</Text>
          {renderLocationPassengers(ride.departure_location, 0)}
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
                {renderLocationPassengers(stop.name, idx + 1)}
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
          <Text style={styles.timeText}>{ride.distance_km ? ride.distance_km + ' km' : 'Distance non définie'}</Text>
          {renderLocationPassengers(ride.arrival_location, stopoversLength + 1)}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  timeline: { paddingLeft: 8, marginBottom: 16 },
  timelineItem: { flexDirection: 'row', marginBottom: 16, position: 'relative' },
  timelineDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 3, backgroundColor: '#FFFFFF', zIndex: 2, marginTop: 4 },
  timelineLine: { position: 'absolute', top: 18, left: 6, width: 2, bottom: -16, backgroundColor: '#E5E7EB', zIndex: 1 },
  timelineContent: { marginLeft: 16, flex: 1 },
  locationText: { fontSize: 16, fontWeight: '700', color: '#1F2937' },
  timeText: { fontSize: 14, color: '#6B7280', marginTop: 2 },
  
  passengersContainer: {
    marginTop: 8,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 8,
    gap: 10,
    borderWidth: 1,
    borderColor: '#F3F4F6'
  },
  passengerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8
  },
  passengerName: {
    fontWeight: '700',
    color: '#1F2937'
  },
  boardingText: {
    fontSize: 13,
    color: '#16A34A',
    fontWeight: '700'
  },
  alightingText: {
    fontSize: 13,
    color: '#DC2626',
    fontWeight: '700'
  },
  addressText: {
    fontSize: 12,
    color: '#4B5563',
    marginTop: 2,
    lineHeight: 16,
    fontWeight: '500'
  }
});
