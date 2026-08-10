import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type FiltreStatut = 'upcoming' | 'live' | 'completed' | 'cancelled';

interface FiltresStatutProps {
  filtreActif: FiltreStatut;
  compteParFiltre: (filtre: FiltreStatut) => number;
  onChangeFiltre: (filtre: FiltreStatut) => void;
}

const FILTRES: {
  cle: FiltreStatut;
  label: string;
  icone: string;
  couleurActive: string;
  fondActif: string;
  fondIconeActif: string;
  fondBadgeActif: string;
  texteBadgeActif: string;
  fondCarte: string;
  bordureCarte: string;
}[] = [
  {
    cle: 'upcoming',
    label: 'À venir',
    icone: 'time-outline',
    couleurActive: '#D97706',
    fondActif: '#FFFBEB',
    fondIconeActif: '#FEF3C7',
    fondBadgeActif: '#FDE68A',
    texteBadgeActif: '#B45309',
    fondCarte: '#FFFBEB',
    bordureCarte: '#FCD34D'
  },
  {
    cle: 'live',
    label: 'En cours',
    icone: 'navigate',
    couleurActive: '#059669',
    fondActif: '#ECFDF5',
    fondIconeActif: '#D1FAE5',
    fondBadgeActif: '#A7F3D0',
    texteBadgeActif: '#065F46',
    fondCarte: '#ECFDF5',
    bordureCarte: '#6EE7B7'
  },
  {
    cle: 'completed',
    label: 'Terminés',
    icone: 'checkmark-done',
    couleurActive: '#7C3AED',
    fondActif: '#F5F3FF',
    fondIconeActif: '#EDE9FE',
    fondBadgeActif: '#DDD6FE',
    texteBadgeActif: '#5B21B6',
    fondCarte: '#F5F3FF',
    bordureCarte: '#C4B5FD'
  },
  {
    cle: 'cancelled',
    label: 'Annulés',
    icone: 'close-circle',
    couleurActive: '#EF4444',
    fondActif: '#FEF2F2',
    fondIconeActif: '#FEE2E2',
    fondBadgeActif: '#FCA5A5',
    texteBadgeActif: '#7F1D1D',
    fondCarte: '#FEF2F2',
    bordureCarte: '#FCA5A5'
  }
];

/**
 * Barre de filtres de statut : À venir / En cours / Terminés / Annulés
 */
export function FiltresStatut({
  filtreActif,
  compteParFiltre,
  onChangeFiltre
}: FiltresStatutProps) {
  return (
    <View style={styles.container}>
      {FILTRES.map((filtre) => {
        const estActif = filtreActif === filtre.cle;
        return (
          <TouchableOpacity
            key={filtre.cle}
            style={[
              styles.carte,
              estActif && {
                backgroundColor: filtre.fondCarte,
                borderColor: filtre.bordureCarte,
                shadowColor: filtre.couleurActive,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.12,
                shadowRadius: 6,
                elevation: 2
              }
            ]}
            onPress={() => onChangeFiltre(filtre.cle)}
          >
            {/* Indicateur live animé */}
            {filtre.cle === 'live' && estActif && (
              <View style={styles.pointVivant} />
            )}

            {/* Icône */}
            <View style={[
              styles.conteneurIcone,
              estActif && { backgroundColor: filtre.fondIconeActif }
            ]}>
              <Ionicons
                name={filtre.icone as any}
                size={18}
                color={estActif ? filtre.couleurActive : '#94A3B8'}
              />
            </View>

            {/* Label */}
            <Text
              style={[
                styles.label,
                estActif && { color: filtre.couleurActive, fontWeight: '800' }
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {filtre.label}
            </Text>

            {/* Badge compteur */}
            <View style={[
              styles.badge,
              estActif && { backgroundColor: filtre.fondBadgeActif }
            ]}>
              <Text style={[
                styles.texteBadge,
                estActif && { color: filtre.texteBadgeActif }
              ]}>
                {compteParFiltre(filtre.cle)}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9'
  },
  carte: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    gap: 6,
    position: 'relative',
    overflow: 'hidden'
  },
  pointVivant: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#10B981'
  },
  conteneurIcone: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center'
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
    textAlign: 'center'
  },
  badge: {
    minWidth: 22,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6
  },
  texteBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B'
  }
});
