import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Dimensions } from 'react-native';
import { useFadeSlide } from './AnimationsGestion';
import { C, SHsm } from './theme-gestion';

const { width: SW } = Dimensions.get('window');

interface StatsGridProps {
  ride: any;
  totalRevenue: number;
  seatsBooked: number;
}

/**
 * Grille de 4 cartes de statistiques clés sur le trajet en cours de gestion.
 */
export function StatsGrid({ ride, totalRevenue, seatsBooked }: StatsGridProps) {
  const anim = useFadeSlide(200);

  const items = [
    {
      iconName: 'people' as const,
      value: `${seatsBooked}/${ride.total_seats}`,
      label: 'Places vendues',
      color: C.primary,
      bg: C.primaryLight
    },
    {
      iconName: 'wallet' as const,
      value: `${totalRevenue.toLocaleString()}`,
      label: 'FCFA gagnés',
      color: C.success,
      bg: C.successLight
    },
    {
      iconName: 'car' as const,
      value: ride.driver_details?.vehicles?.[0]?.vehicle_type?.toUpperCase() || '-',
      label: 'Type véhicule',
      color: C.warning,
      bg: C.warningLight
    },
    {
      iconName: 'calendar' as const,
      value: new Date(ride.departure_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
      label: 'Date du trajet',
      color: C.error,
      bg: C.errorLight
    },
  ];

  return (
    <Animated.View style={[styles.container, anim]}>
      {items.map((it, i) => (
        <View key={i} style={[styles.statCard, { backgroundColor: it.bg, width: (SW - 44) / 2 }]}>
          <View style={{ marginBottom: 6 }}>
            <Ionicons name={it.iconName} size={26} color={it.color} />
          </View>
          <Text style={[styles.statVal, { color: it.color }]} numberOfLines={1} adjustsFontSizeToFit>
            {it.value}
          </Text>
          <Text style={styles.statLbl}>{it.label}</Text>
        </View>
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16
  },
  statCard: {
    borderRadius: 20,
    padding: 18,
    ...SHsm
  },
  statVal: {
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 2
  },
  statLbl: {
    fontSize: 12,
    color: C.textSec,
    fontWeight: '600'
  }
});
