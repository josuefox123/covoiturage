import React, { useRef, useEffect } from 'react';
import { View, Animated } from 'react-native';

// ─── Animation d'entrée en fondu + glissement ─────────────────────────────

interface FadeInCardProps {
  children: React.ReactNode;
  delay?: number;
  style?: any;
}

export function FadeInCard({ children, delay = 0, style }: FadeInCardProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const ty = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 500, delay, useNativeDriver: true }),
      Animated.timing(ty, { toValue: 0, duration: 500, delay, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[{ opacity, transform: [{ translateY: ty }] }, style]}>
      {children}
    </Animated.View>
  );
}

// ─── Bloc skeleton pulsant pour l'état de chargement ──────────────────────

interface SkeletonBlockProps {
  width: number | string;
  height: number;
  radius?: number;
  style?: any;
}

export function SkeletonBlock({ width, height, radius = 10, style }: SkeletonBlockProps) {
  const p = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(p, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(p, { toValue: 0.4, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View
      style={[{ width, height, borderRadius: radius, backgroundColor: '#E2E8F0', opacity: p }, style]}
    />
  );
}

// ─── Écran de chargement skeleton complet ─────────────────────────────────

export function EcranChargement() {
  return (
    <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      <SkeletonBlock width="100%" height={340} radius={0} />
      <View style={{ padding: 20, gap: 16 }}>
        <SkeletonBlock width="70%" height={24} />
        <SkeletonBlock width="50%" height={16} />
        <View style={{ height: 16 }} />
        <SkeletonBlock width="100%" height={120} radius={20} />
        <SkeletonBlock width="100%" height={90} radius={20} />
        <SkeletonBlock width="100%" height={90} radius={20} />
      </View>
    </View>
  );
}

// ─── Titre de section avec icône ──────────────────────────────────────────

import { Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C } from './theme-trajet';

interface TitreSection {
  titre: string;
  icone: string;
}

export function TitreSection({ titre, icone }: TitreSection) {
  return (
    <View style={styles.rangee}>
      <Ionicons name={icone as any} size={16} color={C.primary} />
      <Text style={styles.texte}>{titre}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  rangee: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 16 },
  texte: { fontSize: 15, fontWeight: '800', color: '#0F172A' }
});
