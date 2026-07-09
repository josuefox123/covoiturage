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

export type VehicleType = 'moto' | 'tricycle' | 'voiture' | 'bus';

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
    id: 'moto',
    label: 'Moto',
    icon: 'bicycle',
    emoji: '🏍️',
    color: PRIMARY,
    bgColor: '#EEF3FF',
  },
  {
    id: 'tricycle',
    label: 'Tricycle',
    icon: 'car-sport',
    emoji: '🛺',
    color: PRIMARY,
    bgColor: '#EEF3FF',
  },
  {
    id: 'voiture',
    label: 'Voiture',
    icon: 'car',
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
                <Ionicons name={v.icon} size={24} color={isActive ? '#FFFFFF' : v.color} />
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
    gap: 10,
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  card: {
    flex: 1,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 3,
    position: 'relative',
  },
  iconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  emoji: {
    fontSize: 24,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    textAlign: 'center',
  },
  labelActive: {
    color: '#FFFFFF',
  },
  activeDot: {
    position: 'absolute',
    bottom: 7,
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
});
