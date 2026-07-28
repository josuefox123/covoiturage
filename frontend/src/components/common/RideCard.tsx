/**
 * ==============================================================
 * Fichier :
 * RideCard.tsx
 *
 * Description :
 * Composant ou logique de l'application Zemy.
 *
 * Projet :
 * Zemy
 * ==============================================================
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../theme';
import ProfileAvatar from './ProfileAvatar';

export interface RideCardProps {
  ride: any;
  role?: string;
  bookingStatus?: string;
  paymentStatus?: string;
  isActiveRightNow?: boolean;
  onPressPrimary?: () => void;
  primaryActionLabel?: string;
  isPrimaryLoading?: boolean;
  onPressSecondary?: () => void;
  secondaryActionLabel?: string;
  onPressCard?: () => void;
}

/**
 * Composant RideCard.
 *
 * Responsabilités :
 * - Affichage et gestion de l'état lié à RideCard.
 */
export default function RideCard({
  ride,
  role = 'search',
  bookingStatus,
  paymentStatus,
  isActiveRightNow = false,
  onPressPrimary,
  primaryActionLabel,
  isPrimaryLoading = false,
  onPressSecondary,
  secondaryActionLabel,
  onPressCard,
}: RideCardProps) {
  if (!ride) return null;

  const driver = ride.driver_details;
  const passengersCount = ride.total_seats - ride.seats_available;

  const getStatusBadge = () => {
    const status = bookingStatus || ride.status;
    if (!status) return null;

    let bg = theme.colors.grayLight;
    let text = theme.colors.textLight;
    let label = status;

    if (paymentStatus === 'pending' || status === 'pending_payment') {
      return (
        <View style={[styles.statusBadge, { backgroundColor: theme.colors.warningLight }]}>
          <Text style={[styles.statusText, { color: theme.colors.warningDark }]}>Paiement en attente</Text>
        </View>
      );
    }

    if (status === 'started') {
      bg = theme.colors.successLight;
      text = theme.colors.success;
      label = 'En cours';
    } else if (status === 'active') {
      bg = theme.colors.warningLight;
      text = theme.colors.warningDark;
      label = 'En attente';
    } else if (status === 'confirmed') {
      bg = theme.colors.successLight;
      text = theme.colors.success;
      label = 'Confirmé';
    } else if (status === 'pending') {
      bg = theme.colors.warningLight;
      text = theme.colors.warningDark;
      label = 'En attente';
    } else if (status === 'completed') {
      bg = theme.colors.primaryLight;
      text = theme.colors.primary;
      label = 'Terminé';
    } else if (status === 'cancelled') {
      bg = theme.colors.errorLight;
      text = theme.colors.error;
      label = 'Annulé';
    }

    return (
      <View style={[styles.statusBadge, { backgroundColor: bg }]}>
        <Text style={[styles.statusText, { color: text }]}>{label}</Text>
      </View>
    );
  };

  const CardComponent = onPressCard ? TouchableOpacity : View;

  return (
    <CardComponent
      style={[styles.card, isActiveRightNow && styles.activeCard]}
      onPress={onPressCard}
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        {role === 'driver' ? (
          <View style={styles.driverInfo}>
            <Ionicons name="people" size={24} color={theme.colors.primary} />
            <Text style={styles.driverName}>
              {passengersCount} passager{passengersCount > 1 ? 's' : ''}
            </Text>
          </View>
        ) : (
          <View style={styles.driverInfo}>
            <ProfileAvatar name={driver?.full_name} url={driver?.photo} size={40} />
            <View style={{ flex: 1 }}>
              <Text style={styles.driverName} numberOfLines={1} ellipsizeMode="tail">
                {driver?.full_name || driver?.phone || 'Inconnu'}
              </Text>
              <View style={styles.ratingContainer}>
                <Ionicons name="star" size={14} color={theme.colors.warning} />
                <Text style={styles.ratingText}>{driver?.rating || '4.0'}</Text>
              </View>
            </View>
          </View>
        )}
        
        {getStatusBadge()}
      </View>

      <View style={styles.tripDetails}>
        <View style={styles.detailRow}>
          <Ionicons name="location-outline" size={20} color={theme.colors.primary} />
          <Text style={styles.detailText}>
            {ride.departure_location} → {ride.arrival_location}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="calendar-outline" size={20} color={theme.colors.textMuted} />
          <Text style={styles.detailText}>
            {new Date(ride.departure_date).toLocaleDateString('fr-FR', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}{' '}
            à {ride.departure_time}
          </Text>
        </View>
        {role === 'driver' && (
          <View style={styles.detailRow}>
            <Ionicons name="people-outline" size={20} color={theme.colors.textMuted} />
            <Text style={styles.detailText}>{ride.seats_available} places restantes</Text>
          </View>
        )}
      </View>

      {(primaryActionLabel || secondaryActionLabel) && (
        <View style={styles.cardActions}>
          {primaryActionLabel && (
            <TouchableOpacity
              style={[styles.primaryButton, isPrimaryLoading && { opacity: 0.6 }]}
              onPress={onPressPrimary}
              disabled={isPrimaryLoading}
            >
              {isPrimaryLoading ? (
                <ActivityIndicator size="small" color={theme.colors.white} />
              ) : (
                <Text style={styles.primaryButtonText}>{primaryActionLabel}</Text>
              )}
            </TouchableOpacity>
          )}
          {secondaryActionLabel && (
            <TouchableOpacity
              style={[
                styles.secondaryButton,
                !primaryActionLabel && { flex: 1 },
                secondaryActionLabel.toLowerCase() === 'annuler' && { backgroundColor: theme.colors.errorLight },
              ]}
              onPress={onPressSecondary}
            >
              <Text
                style={[
                  styles.secondaryButtonText,
                  secondaryActionLabel.toLowerCase() === 'annuler' && { color: theme.colors.error },
                ]}
              >
                {secondaryActionLabel}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </CardComponent>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    ...theme.shadows.sm,
    borderColor: theme.colors.border,
    borderWidth: 1,
    marginBottom: theme.spacing.md,
  },
  activeCard: {
    borderColor: theme.colors.success,
    borderWidth: 2,
    backgroundColor: theme.colors.successLightest,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  driverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    flex: 1,
    marginRight: 8,
  },
  driverName: {
    ...theme.typography.h3,
    color: theme.colors.text,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    ...theme.typography.bodySmall,
    color: theme.colors.warningDark,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.full,
  },
  statusText: {
    ...theme.typography.caption,
  },
  tripDetails: {
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  detailText: {
    ...theme.typography.bodyMedium,
    color: theme.colors.textLight,
  },
  cardActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  primaryButtonText: {
    ...theme.typography.button,
    color: theme.colors.white,
  },
  secondaryButton: {
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.grayLight,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    ...theme.typography.button,
    color: theme.colors.textLight,
  },
});
