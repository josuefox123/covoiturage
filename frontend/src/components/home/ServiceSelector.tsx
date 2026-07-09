import React, { useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { CustomAlert } from '../../utils/CustomAlert';

const PRIMARY = '#0066FF';

export type VehicleType = 'covoiturage' | 'bus' | 'colis';

interface Vehicle {
  id: VehicleType;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  emoji: string;
  color: string;
  bgColor: string;
}

const VEHICLES: Vehicle[] = [
  {
    id: 'covoiturage',
    label: 'Covoiturage',
    icon: 'car-outline',
    emoji: '🚗',
    color: PRIMARY,
    bgColor: '#EEF3FF',
  },
  {
    id: 'bus',
    label: 'Bus',
    icon: 'bus-outline',
    emoji: '🚌',
    color: PRIMARY,
    bgColor: '#EEF3FF',
  },
  {
    id: 'colis',
    label: 'Colis',
    icon: 'cube-outline',
    emoji: '📦',
    color: PRIMARY,
    bgColor: '#EEF3FF',
  },
];

interface ServiceSelectorProps {
  selected: VehicleType;
  onSelect: (type: VehicleType) => void;
}

export default function ServiceSelector({ selected, onSelect }: ServiceSelectorProps) {
  const scales = useRef(VEHICLES.map(() => new Animated.Value(1))).current;

  const handlePress = (id: VehicleType, index: number) => {
    Animated.sequence([
      Animated.timing(scales[index], {
        toValue: 0.92,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.spring(scales[index], {
        toValue: 1,
        tension: 200,
        friction: 10,
        useNativeDriver: true,
      }),
    ]).start();

    if (id === 'bus') {
      CustomAlert.alert(
        'Bientôt disponible 🚀',
        'Le service de réservation de bus est en cours de développement et sera disponible très prochainement.'
      );
      return;
    }

    if (id === 'colis') {
      CustomAlert.alert(
        'Bientôt disponible 🚀',
        'Le service de livraison de colis est en cours de développement et sera disponible très prochainement.'
      );
      return;
    }

    onSelect(id);
  };

  return (
    <View style={styles.container}>
      {VEHICLES.map((v, index) => {
        const isActive = selected === v.id;
        return (
          <Animated.View
            key={v.id}
            style={{ flex: 1, transform: [{ scale: scales[index] }] }}
          >
            <TouchableOpacity
              style={[
                styles.card,
                isActive
                  ? { backgroundColor: v.color, borderColor: v.color }
                  : { backgroundColor: '#FFFFFF', borderColor: '#E5E7EB' },
              ]}
              onPress={() => handlePress(v.id, index)}
              activeOpacity={0.9}
            >
              <View
                style={[
                  styles.iconWrapper,
                  { backgroundColor: isActive ? 'rgba(255,255,255,0.2)' : v.bgColor },
                ]}
              >
                {v.id === 'covoiturage' ? (
                  <View style={styles.covoiturageIcons}>
                    <Ionicons name="car-outline" size={16} color={isActive ? '#FFFFFF' : v.color} />
                    <View style={styles.covoiturageSubIcons}>
                      <Ionicons name="bicycle" size={9} color={isActive ? '#FFFFFF' : v.color} style={{ marginRight: 2 }} />
                      <Ionicons name="car-sport" size={9} color={isActive ? '#FFFFFF' : v.color} />
                    </View>
                  </View>
                ) : (
                  <Ionicons name={v.icon} size={18} color={isActive ? '#FFFFFF' : v.color} />
                )}
              </View>
              <Text style={[styles.label, isActive && styles.labelActive]}>
                {v.label}
              </Text>
              {isActive && <View style={styles.activeDot} />}
            </TouchableOpacity>
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  card: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 6,
    paddingHorizontal: 6,
    alignItems: 'center',
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    position: 'relative',
  },
  iconWrapper: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  emoji: {
    fontSize: 16,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6B7280',
    textAlign: 'center',
  },
  labelActive: {
    color: '#FFFFFF',
  },
  activeDot: {
    position: 'absolute',
    bottom: 4,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  covoiturageIcons: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 24,
  },
  covoiturageSubIcons: {
    flexDirection: 'row',
    marginTop: -4,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
