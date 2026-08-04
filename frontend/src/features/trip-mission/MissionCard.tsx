import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { MissionResolver } from './MissionResolver';
import { MissionBadge } from './MissionBadge';
import { MissionButtons } from './MissionButtons';
import { MissionTimeline } from './MissionTimeline';
import { theme } from '../../styles/theme';

interface MissionCardProps {
  item: any;
  role?: 'passenger' | 'driver';
  onPressCard?: () => void;
  onCancelBooking?: (bookingId: string) => void;
  onAcceptOffer?: (bookingId: string) => void;
  onRejectOffer?: (bookingId: string) => void;
  onRateDriver?: (rideId: string) => void;
  onStartTrip?: (rideId: string) => void;
  onFinishTrip?: (rideId: string) => void;
}

export function MissionCard({
  item,
  role = 'passenger',
  onPressCard,
  onCancelBooking,
  onAcceptOffer,
  onRejectOffer,
  onRateDriver,
  onStartTrip,
  onFinishTrip
}: MissionCardProps) {
  const router = useRouter();
  const mission = MissionResolver.resolveMission(item, role);
  const { data } = mission;

  const handleCardClick = () => {
    if (onPressCard) {
      onPressCard();
    } else if (data.rideId) {
      router.push(`/ride/${data.rideId}`);
    }
  };

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.9}
      onPress={handleCardClick}
    >
      {/* Header Banner */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Ionicons name={mission.iconName} size={18} color={mission.iconColor} />
          <Text style={styles.title} numberOfLines={1}>
            {mission.title}
          </Text>
        </View>
        <MissionBadge mission={mission} />
      </View>

      {/* Description */}
      <Text style={styles.description} numberOfLines={2}>
        {mission.description}
      </Text>

      {/* Route & Times */}
      <View style={styles.routeContainer}>
        <View style={styles.routeRow}>
          <Ionicons name="location-outline" size={16} color={theme.colors.primary} />
          <Text style={styles.routeText} numberOfLines={1}>
            {data.departureLocation}
          </Text>
          <Ionicons name="arrow-forward-outline" size={14} color={theme.colors.grayDark} style={{ marginHorizontal: 6 }} />
          <Text style={styles.routeText} numberOfLines={1}>
            {data.arrivalLocation}
          </Text>
        </View>

        <View style={styles.timeRow}>
          <Ionicons name="calendar-outline" size={14} color={theme.colors.grayDark} />
          <Text style={styles.timeText}>
            {data.departureDate} • {data.departureTime}
          </Text>
        </View>
      </View>

      {/* Price & OTP details */}
      <View style={styles.infoRow}>
        {data.amount ? (
          <View style={styles.priceChip}>
            <Text style={styles.priceLabel}>Montant : </Text>
            <Text style={styles.priceValue}>{data.amount.toLocaleString()} FCFA</Text>
          </View>
        ) : null}

        {data.otpCode ? (
          <View style={styles.otpChip}>
            <Ionicons name="key-outline" size={14} color={theme.colors.primary} />
            <Text style={styles.otpLabel}>Code OTP : </Text>
            <Text style={styles.otpValue}>{data.otpCode}</Text>
          </View>
        ) : null}
      </View>

      {/* Progress */}
      {mission.progress > 0 && mission.progress < 100 ? (
        <MissionTimeline progress={mission.progress} />
      ) : null}

      {/* Actions */}
      <MissionButtons
        mission={mission}
        onCancelBooking={onCancelBooking}
        onAcceptOffer={onAcceptOffer}
        onRejectOffer={onRejectOffer}
        onRateDriver={onRateDriver}
        onStartTrip={onStartTrip}
        onFinishTrip={onFinishTrip}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    marginRight: 8
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text,
    flex: 1
  },
  description: {
    fontSize: 13,
    color: theme.colors.textLight,
    marginBottom: 12,
    lineHeight: 18
  },
  routeContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
    gap: 6
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  routeText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.text,
    flexShrink: 1
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  timeText: {
    fontSize: 12,
    color: theme.colors.textLight
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
    flexWrap: 'wrap',
    gap: 8
  },
  priceChip: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  priceLabel: {
    fontSize: 12,
    color: theme.colors.textLight
  },
  priceValue: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.primary
  },
  otpChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 4
  },
  otpLabel: {
    fontSize: 12,
    color: theme.colors.primary,
    fontWeight: '500'
  },
  otpValue: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.primary
  }
});
