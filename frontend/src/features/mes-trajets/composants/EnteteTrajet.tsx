import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../../styles/theme';

interface EnteteTrajetProps {
  roleActif: 'passenger' | 'driver';
  nombreReservations: number;
  nombreTrajets: number;
  onRefresh: () => void;
}

/**
 * En-tête de l'onglet Mes Trajets.
 * Affiche le titre, le sous-titre dynamique et le bouton de rafraîchissement.
 */
export function EnteteTrajet({
  roleActif,
  nombreReservations,
  nombreTrajets,
  onRefresh
}: EnteteTrajetProps) {
  const sousTexte = roleActif === 'passenger'
    ? `${nombreReservations} réservation${nombreReservations > 1 ? 's' : ''}`
    : `${nombreTrajets} trajet${nombreTrajets > 1 ? 's' : ''} publié${nombreTrajets > 1 ? 's' : ''}`;

  return (
    <View style={styles.container}>
      <View style={styles.gauche}>
        <Text style={styles.titre}>Mes Trajets</Text>
        <Text style={styles.sousTitre}>{sousTexte}</Text>
      </View>
      <TouchableOpacity style={styles.boutonRefresh} onPress={onRefresh}>
        <Ionicons name="refresh-outline" size={20} color={theme.colors.primary} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9'
  },
  gauche: {
    flex: 1
  },
  titre: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3
  },
  sousTitre: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
    fontWeight: '500'
  },
  boutonRefresh: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center'
  }
});
