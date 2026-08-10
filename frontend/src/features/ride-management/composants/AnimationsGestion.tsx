import React, { useRef, useEffect } from 'react';
import { View, Animated, Text, StyleSheet } from 'react-native';
import { C } from './theme-gestion';

// ─── Hook d'animation d'entrée ──────────────────────────────────────────
export function useFadeSlide(delay = 0) {
  const op = useRef(new Animated.Value(0)).current;
  const ty = useRef(new Animated.Value(22)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(op, { toValue: 1, duration: 500, delay, useNativeDriver: true }),
      Animated.timing(ty, { toValue: 0, duration: 480, delay, useNativeDriver: true }),
    ]).start();
  }, []);

  return { opacity: op, transform: [{ translateY: ty }] };
}

// ─── Bloc de squelette (Skeleton) pulsant ──────────────────────────────────
interface SkelProps {
  w: number | string;
  h: number;
  r?: number;
  mb?: number;
}

export function Skel({ w, h, r = 10, mb = 0 }: SkelProps) {
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
      style={{
        width: w as any,
        height: h,
        borderRadius: r,
        backgroundColor: '#E5E7EB',
        opacity: p,
        marginBottom: mb
      }}
    />
  );
}

// ─── Écran de chargement complet (Skeleton Screen) ─────────────────────────
import { Dimensions } from 'react-native';
const { width: SW } = Dimensions.get('window');

export function EcranChargement() {
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={[styles.headerSkel, { elevation: 3 }]}>
        <Skel w={36} h={36} r={18} />
        <View style={{ flex: 1, gap: 6 }}>
          <Skel w="60%" h={16} />
          <Skel w="40%" h={12} />
        </View>
        <Skel w={36} h={36} r={18} />
      </View>
      <View style={{ padding: 16, gap: 16 }}>
        <Skel w="100%" h={200} r={24} />
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Skel w={(SW - 44) / 2} h={100} r={20} />
          <Skel w={(SW - 44) / 2} h={100} r={20} />
        </View>
        <Skel w="100%" h={140} r={20} />
        <Skel w="100%" h={140} r={20} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerSkel: {
    height: 64,
    backgroundColor: C.white,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: C.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  }
});
