import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Mission, ActionMission } from '../types/types-mission';
import { GestionnaireActions } from '../actions/gestionnaire-actions';
import { theme } from '../../../styles/theme';

interface BoutonsActionProps {
  mission: Mission;
  onCancelBooking?: (bookingId: string) => void;
  onAcceptOffer?: (bookingId: string) => void;
  onRejectOffer?: (bookingId: string) => void;
  onRateDriver?: (rideId: string) => void;
  onStartTrip?: (rideId: string) => void;
  onFinishTrip?: (rideId: string) => void;
}

/**
 * Groupe de boutons d'action pour une carte de trajet.
 * Gère les clics et délègue au GestionnaireActions.
 */
export function BoutonsAction({
  mission,
  onCancelBooking,
  onAcceptOffer,
  onRejectOffer,
  onRateDriver,
  onStartTrip,
  onFinishTrip
}: BoutonsActionProps) {
  const router = useRouter();

  if (!mission.actions || mission.actions.length === 0) {
    return null;
  }

  const handlePress = (action: ActionMission) => {
    GestionnaireActions.executer(action.type, mission, router, {
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
        const couleurFond = action.color || (isPrimary ? theme.colors.primary : '#F3F4F6');
        const couleurTexte = isPrimary || action.color ? '#FFFFFF' : theme.colors.text;

        return (
          <TouchableOpacity
            key={`${action.type}-${index}`}
            style={[
              styles.bouton,
              { backgroundColor: couleurFond },
              !isPrimary && !action.color && styles.bordureSecondaire
            ]}
            onPress={() => handlePress(action)}
            activeOpacity={0.8}
          >
            <Text style={[styles.texteBouton, { color: couleurTexte }]}>
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
  bouton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  bordureSecondaire: {
    borderWidth: 1,
    borderColor: '#E5E7EB'
  },
  texteBouton: {
    fontSize: 13,
    fontWeight: '700'
  }
});
