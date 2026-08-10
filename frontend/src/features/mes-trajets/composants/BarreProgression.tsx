import React from 'react';
import { View, StyleSheet } from 'react-native';
import { theme } from '../../../styles/theme';

interface BarreProgressionProps {
  progression: number; // 0 à 100
}

/**
 * Barre de progression horizontale indiquant l'avancement d'une mission.
 */
export function BarreProgression({ progression }: BarreProgressionProps) {
  const valeur = Math.max(0, Math.min(100, progression));

  return (
    <View style={styles.piste}>
      <View
        style={[
          styles.remplissage,
          { width: `${valeur}%`, backgroundColor: theme.colors.primary }
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  piste: {
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    overflow: 'hidden',
    width: '100%',
    marginVertical: 8
  },
  remplissage: {
    height: '100%',
    borderRadius: 2
  }
});
