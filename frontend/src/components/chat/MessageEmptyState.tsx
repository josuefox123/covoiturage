/**
 * ==============================================================
 * Fichier :
 * MessageEmptyState.tsx
 *
 * Description :
 * Composant ou logique de l'application Zemy.
 *
 * Projet :
 * Zemy
 * ==============================================================
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';
import { useRouter } from 'expo-router';

/**
 * Composant MessageEmptyState.
 *
 * Responsabilités :
 * - Affichage et gestion de l'état lié à MessageEmptyState.
 */
export default function MessageEmptyState() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Ionicons name="chatbubbles-outline" size={64} color={theme.colors.primary} />
      </View>
      <Text style={styles.title}>Aucune conversation</Text>
      <Text style={styles.subtitle}>
        Réservez un trajet ou acceptez une réservation pour commencer à discuter avec les membres de la communauté.
      </Text>
      <TouchableOpacity 
        style={styles.button}
        onPress={() => router.push('/(tabs)/home')}
        activeOpacity={0.8}
      >
        <Text style={styles.buttonText}>Découvrir les trajets</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
    marginTop: 60,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.xl,
  },
  title: {
    ...theme.typography.h2,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    ...theme.typography.bodyLarge,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
    lineHeight: 24,
  },
  button: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: theme.borderRadius.full,
    ...theme.shadows.md,
  },
  buttonText: {
    color: theme.colors.white,
    fontWeight: '700',
    fontSize: 16,
  },
});
