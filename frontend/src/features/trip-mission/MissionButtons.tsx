import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Mission, MissionAction } from './MissionTypes';
import { MissionActionsHandler } from './MissionActions';
import { theme } from '../../styles/theme';

interface MissionButtonsProps {
  mission: Mission;
  onCancelBooking?: (bookingId: string) => void;
  onAcceptOffer?: (bookingId: string) => void;
  onRejectOffer?: (bookingId: string) => void;
  onRateDriver?: (rideId: string) => void;
  onStartTrip?: (rideId: string) => void;
  onFinishTrip?: (rideId: string) => void;
}

export function MissionButtons({
  mission,
  onCancelBooking,
  onAcceptOffer,
  onRejectOffer,
  onRateDriver,
  onStartTrip,
  onFinishTrip
}: MissionButtonsProps) {
  const router = useRouter();

  if (!mission.actions || mission.actions.length === 0) {
    return null;
  }

  const handlePress = (action: MissionAction) => {
    MissionActionsHandler.handleAction(action.type, mission, router, {
      onCancelBooking,
      onAcceptOffer,
      onRejectOffer,
      onRateDriver,
      onStartTrip,
      onFinishTrip
    });
  };

  return (
    <View style={styles.container}>
      {mission.actions.map((action, index) => {
        const isPrimary = action.isPrimary;
        const btnBgColor = action.color || (isPrimary ? theme.colors.primary : '#F3F4F6');
        const btnTextColor = isPrimary || action.color ? '#FFFFFF' : theme.colors.textDark;

        return (
          <TouchableOpacity
            key={`${action.type}-${index}`}
            style={[
              styles.button,
              { backgroundColor: btnBgColor },
              !isPrimary && !action.color && styles.secondaryBorder
            ]}
            onPress={() => handlePress(action)}
            activeOpacity={0.8}
          >
            <Text style={[styles.buttonText, { color: btnTextColor }]}>
              {action.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12
  },
  button: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  secondaryBorder: {
    borderWidth: 1,
    borderColor: '#E5E7EB'
  },
  buttonText: {
    fontSize: 13,
    fontWeight: '700'
  }
});
