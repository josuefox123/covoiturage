import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { Ionicons } from '@expo/vector-icons';

interface StatItem {
  value: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const STATS: StatItem[] = [
  { value: '500+', label: 'Conducteurs', icon: 'car-sport-outline' },
  { value: '1 200+', label: 'Trajets', icon: 'map-outline' },
  { value: '98%', label: 'Satisfaction', icon: 'star-outline' },
];

function StatCard({ item, delay }: { item: StatItem; delay: number }) {
  const slideUp = useRef(new Animated.Value(30)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 500,
        delay,
        useNativeDriver: true,
      }),
      Animated.spring(slideUp, {
        toValue: 0,
        tension: 60,
        friction: 10,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[styles.statCard, { opacity: fade, transform: [{ translateY: slideUp }] }]}>
      <View style={styles.iconWrapper}>
        <Ionicons name={item.icon} size={24} color="#0066FF" />
      </View>
      <Text style={styles.value}>{item.value}</Text>
      <Text style={styles.label}>{item.label}</Text>
    </Animated.View>
  );
}

export default function Statistics() {
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#EEF3FF', '#F8FAFF']}
        style={styles.bg}
      >
        <Text style={styles.title}>Zemy en chiffres</Text>
        <View style={styles.row}>
          {STATS.map((stat, i) => (
            <StatCard key={stat.label} item={stat} delay={i * 100} />
          ))}
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    marginBottom: 24,
    borderRadius: 24,
    overflow: 'hidden',
  },
  bg: {
    padding: 22,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E0E7FF',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 18,
    letterSpacing: -0.3,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statCard: {
    alignItems: 'center',
  },
  iconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#0066FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
    marginBottom: 8,
  },
  value: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0066FF',
    letterSpacing: -0.5,
    marginBottom: 3,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
