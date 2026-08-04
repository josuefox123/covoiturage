import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Mission } from './MissionTypes';

interface MissionBadgeProps {
  mission: Mission;
}

export function MissionBadge({ mission }: MissionBadgeProps) {
  return (
    <View
      style={[
        styles.container,
        { backgroundColor: mission.badgeBgColor }
      ]}
    >
      <Ionicons name={mission.iconName} size={14} color={mission.badgeTextColor} style={styles.icon} />
      <Text style={[styles.text, { color: mission.badgeTextColor }]}>
        {mission.badgeText}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 4
  },
  icon: {
    marginRight: 2
  },
  text: {
    fontSize: 12,
    fontWeight: '700'
  }
});
