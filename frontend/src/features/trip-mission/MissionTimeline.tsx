import React from 'react';
import { View, StyleSheet } from 'react-native';
import { theme } from '../../styles/theme';

interface MissionTimelineProps {
  progress: number;
}

export function MissionTimeline({ progress }: MissionTimelineProps) {
  const clamped = Math.max(0, Math.min(100, progress));

  return (
    <View style={styles.track}>
      <View
        style={[
          styles.fill,
          { width: `${clamped}%`, backgroundColor: theme.colors.primary }
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    overflow: 'hidden',
    width: '100%',
    marginVertical: 8
  },
  fill: {
    height: '100%',
    borderRadius: 2
  }
});
