import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function BottomSpacing() {
  return (
    <View style={styles.container}>
      <View style={styles.divider} />
      <View style={styles.row}>
        <Ionicons name="car-outline" size={15} color="#9CA3AF" style={styles.carIcon} />
        <Text style={styles.text}>Voyagez sereinement avec Zemy.</Text>
      </View>
      <View style={styles.spacer} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingBottom: 40,
  },
  divider: {
    width: 40,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  carIcon: {
    marginRight: 6,
  },
  text: {
    fontSize: 13,
    color: '#9CA3AF',
    fontWeight: '500',
    textAlign: 'center',
  },
  spacer: {
    height: 20,
  },
});
