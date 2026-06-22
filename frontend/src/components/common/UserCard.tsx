/**
 * ==============================================================
 * Fichier :
 * UserCard.tsx
 *
 * Description :
 * Composant ou logique de l'application Zemy.
 *
 * Projet :
 * Zemy
 * ==============================================================
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ProfileAvatar from './ProfileAvatar';
import { theme } from '../../theme';

interface UserCardProps {
  name: string;
  avatarUrl?: string | null;
  subtitle?: string;
  rating?: number | string;
  reviewsCount?: number;
}

/**
 * Composant UserCard.
 *
 * Responsabilités :
 * - Affichage et gestion de l'état lié à UserCard.
 */
export default function UserCard({ name, avatarUrl, subtitle, rating, reviewsCount }: UserCardProps) {
  return (
    <View style={styles.container}>
      <ProfileAvatar name={name} url={avatarUrl} size={48} />
      <View style={styles.info}>
        <Text style={styles.name}>{name}</Text>
        {subtitle ? (
          <Text style={styles.subtitle}>{subtitle}</Text>
        ) : rating ? (
          <View style={styles.ratingContainer}>
            <Ionicons name="star" size={14} color={theme.colors.warning} />
            <Text style={styles.ratingText}>{rating}</Text>
            {reviewsCount !== undefined && (
              <Text style={styles.reviewsText}>({reviewsCount} avis)</Text>
            )}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  info: {
    justifyContent: 'center',
  },
  name: {
    ...theme.typography.h3,
    color: theme.colors.text,
    marginBottom: 2,
  },
  subtitle: {
    ...theme.typography.bodySmall,
    color: theme.colors.textMuted,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    ...theme.typography.bodyMedium,
    fontWeight: '700',
    color: theme.colors.textLight,
  },
  reviewsText: {
    ...theme.typography.bodySmall,
    color: theme.colors.textMuted,
  },
});
