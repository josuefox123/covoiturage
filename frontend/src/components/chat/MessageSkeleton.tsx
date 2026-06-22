/**
 * ==============================================================
 * Fichier :
 * MessageSkeleton.tsx
 *
 * Description :
 * Composant ou logique de l'application Zemy.
 *
 * Projet :
 * Zemy
 * ==============================================================
 */
import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { theme } from '../../styles/theme';

/**
 * Composant MessageSkeleton.
 *
 * Responsabilités :
 * - Affichage et gestion de l'état lié à MessageSkeleton.
 */
export default function MessageSkeleton() {
  const opacity = useSharedValue(0.5);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 800 }),
        withTiming(0.5, { duration: 800 })
      ),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.card, animatedStyle]}>
      <View style={styles.avatar} />
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.name} />
          <View style={styles.time} />
        </View>
        <View style={styles.subtitle} />
        <View style={styles.message} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.md,
    alignItems: 'center',
    ...theme.shadows.sm,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.border,
    marginRight: theme.spacing.md,
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  name: {
    width: 120,
    height: 16,
    backgroundColor: theme.colors.border,
    borderRadius: 4,
  },
  time: {
    width: 40,
    height: 12,
    backgroundColor: theme.colors.border,
    borderRadius: 4,
  },
  subtitle: {
    width: 180,
    height: 12,
    backgroundColor: theme.colors.border,
    borderRadius: 4,
    marginBottom: 8,
  },
  message: {
    width: '80%',
    height: 14,
    backgroundColor: theme.colors.border,
    borderRadius: 4,
  },
});
