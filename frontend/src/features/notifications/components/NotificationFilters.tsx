import React, { useRef, useEffect } from 'react';
import { ScrollView, TouchableOpacity, Text, StyleSheet, Animated } from 'react-native';
import { theme } from '../../../styles/theme';
import { NotificationFilterType } from '../types/notification';

interface Props {
  filters: NotificationFilterType[];
  selectedFilter: NotificationFilterType;
  onSelect: (filter: NotificationFilterType) => void;
}

export const NotificationFilters = ({ filters, selectedFilter, onSelect }: Props) => {
  const scrollViewRef = useRef<ScrollView>(null);

  return (
    <ScrollView 
      ref={scrollViewRef}
      horizontal 
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {filters.map((filter) => {
        const isSelected = selectedFilter === filter;
        return (
          <TouchableOpacity
            key={filter}
            onPress={() => onSelect(filter)}
            style={[
              styles.pill,
              isSelected ? styles.pillSelected : styles.pillUnselected
            ]}
          >
            <Text style={[
              styles.pillText,
              isSelected ? styles.pillTextSelected : styles.pillTextUnselected
            ]}>
              {filter}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    paddingBottom: theme.spacing.md,
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
  },
  pillSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  pillUnselected: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
  },
  pillText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
  },
  pillTextSelected: {
    color: '#FFFFFF',
  },
  pillTextUnselected: {
    color: theme.colors.textMuted,
  },
});
