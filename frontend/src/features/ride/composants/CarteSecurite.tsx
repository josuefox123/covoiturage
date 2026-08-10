import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Dimensions } from 'react-native';
import { TitreSection } from './AnimationsFade';
import { C, SHsm } from './theme-trajet';

const { width: SW } = Dimensions.get('window');

const GARANTIES = [
  { icone: 'card-outline', label: 'Paiement sécurisé', couleur: '#2F80ED' },
  { icone: 'person-circle-outline', label: 'Conducteur vérifié', couleur: '#22C55E' },
  { icone: 'headset-outline', label: 'Assistance 24/7', couleur: '#F59E0B' },
  { icone: 'lock-closed-outline', label: 'Données protégées', couleur: '#EF4444' },
];

/**
 * Carte des garanties de sécurité Zemy.
 */
export function CarteSecurite() {
  return (
    <View style={[styles.carte, { backgroundColor: '#F8FAFC' }]}>
      <TitreSection titre="Votre sécurité" icone="shield-checkmark-outline" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {GARANTIES.map((item, i) => (
          <View key={i} style={{ width: (SW - 32 - 40 - 12) / 2, alignItems: 'center', gap: 8 }}>
            <View style={[styles.sfIcon, { backgroundColor: item.couleur + '18' }]}>
              <Ionicons name={item.icone as any} size={20} color={item.couleur} />
            </View>
            <Text style={{ fontSize: 12, fontWeight: '600', color: C.text, textAlign: 'center', lineHeight: 16 }}>
              {item.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  carte: { borderRadius: 20, padding: 20, ...SHsm },
  sfIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }
});
