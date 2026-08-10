import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface SwitcherRoleProps {
  roleActif: 'passenger' | 'driver';
  nombreReservations: number;
  nombreTrajets: number;
  onChangeRole: (role: 'passenger' | 'driver') => void;
}

/**
 * Sélecteur de rôle — permet de basculer entre la vue Passager et la vue Conducteur.
 */
export function SwitcherRole({
  roleActif,
  nombreReservations,
  nombreTrajets,
  onChangeRole
}: SwitcherRoleProps) {
  return (
    <View style={styles.container}>
      {/* Onglet Passager */}
      <TouchableOpacity
        style={[styles.onglet, roleActif === 'passenger' && styles.ongletPassagerActif]}
        onPress={() => onChangeRole('passenger')}
      >
        <View style={[styles.iconeOnglet, roleActif === 'passenger' && styles.iconePassagerActif]}>
          <Ionicons
            name="person"
            size={15}
            color={roleActif === 'passenger' ? '#FFFFFF' : '#94A3B8'}
          />
        </View>
        <View>
          <Text style={[styles.labelOnglet, roleActif === 'passenger' && styles.labelPassagerActif]}>
            Passager
          </Text>
          <Text style={[styles.compteurOnglet, roleActif === 'passenger' && styles.compteurPassagerActif]}>
            {nombreReservations} réservation{nombreReservations > 1 ? 's' : ''}
          </Text>
        </View>
      </TouchableOpacity>

      {/* Onglet Conducteur */}
      <TouchableOpacity
        style={[styles.onglet, roleActif === 'driver' && styles.ongletConducteurActif]}
        onPress={() => onChangeRole('driver')}
      >
        <View style={[styles.iconeOnglet, roleActif === 'driver' && styles.iconeConducteurActif]}>
          <Ionicons
            name="car-sport"
            size={15}
            color={roleActif === 'driver' ? '#FFFFFF' : '#94A3B8'}
          />
        </View>
        <View>
          <Text style={[styles.labelOnglet, roleActif === 'driver' && styles.labelConducteurActif]}>
            Conducteur
          </Text>
          <Text style={[styles.compteurOnglet, roleActif === 'driver' && styles.compteurConducteurActif]}>
            {nombreTrajets} trajet{nombreTrajets > 1 ? 's' : ''}
          </Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9'
  },
  onglet: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    gap: 10
  },
  ongletPassagerActif: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3
  },
  ongletConducteurActif: {
    backgroundColor: '#FFF7ED',
    borderColor: '#F97316',
    shadowColor: '#F97316',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3
  },
  iconeOnglet: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center'
  },
  iconePassagerActif: { backgroundColor: '#3B82F6' },
  iconeConducteurActif: { backgroundColor: '#F97316' },
  labelOnglet: {
    fontSize: 14,
    fontWeight: '700',
    color: '#94A3B8'
  },
  labelPassagerActif: { color: '#3B82F6' },
  labelConducteurActif: { color: '#F97316' },
  compteurOnglet: {
    fontSize: 11,
    color: '#CBD5E1',
    fontWeight: '500',
    marginTop: 1
  },
  compteurPassagerActif: { color: '#93C5FD' },
  compteurConducteurActif: { color: '#FDBA74' }
});
