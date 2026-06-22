import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../../styles/theme';

export const EmptyState = ({ filter }: { filter: string }) => {
  let iconName: any = 'notifications-off-outline';
  let message = "Aucune notification pour le moment.";

  if (filter === 'Non lues') {
    iconName = 'checkmark-done-circle-outline';
    message = "Vous avez tout lu !";
  } else if (filter === 'Trajets') {
    iconName = 'car-outline';
    message = "Aucune notification de trajet.";
  } else if (filter === 'Paiements') {
    iconName = 'card-outline';
    message = "Aucune notification de paiement.";
  }

  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Ionicons name={iconName} size={48} color={theme.colors.primary} />
      </View>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
    marginTop: 60,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: theme.colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.lg,
  },
  message: {
    fontSize: 16,
    color: theme.colors.textMuted,
    textAlign: 'center',
    fontFamily: 'Inter-Medium',
  },
});
