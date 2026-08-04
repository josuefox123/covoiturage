import React from 'react';
import { MissionCard } from '../../features/trip-mission/MissionCard';

export interface RideCardProps {
  ride: any;
  role?: 'passenger' | 'driver' | string;
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

export default function RideCard(props: RideCardProps) {
  const role = props.role === 'driver' ? 'driver' : 'passenger';
  return (
    <MissionCard
      item={props.ride}
      role={role}
      onPressCard={props.onPressCard || props.onPressPrimary}
    />
  );
}
