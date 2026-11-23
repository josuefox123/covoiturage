/**
 * ==============================================================
 * Fichier :
 * MessageSkeleton.tsx
 *
 * Description :
 * Squelette de chargement épuré et moderne pour la liste de conversations.
 *
 * Projet :
 * Zemy
 * ==============================================================
 */
import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

export default function MessageSkeleton() {
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.85, { duration: 750 }),
        withTiming(0.4, { duration: 750 })
      ),
      -1,
      true
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.itemContainer, animatedStyle]}>
      {/* Avatar circulaire */}
      <View style={styles.avatar} />

      {/* Contenu textuel */}
      <View style={styles.content}>
        {/* Ligne 1 : Nom & Heure */}
        <View style={styles.headerRow}>
          <View style={styles.nameBar} />
          <View style={styles.timeBar} />
        </View>

        {/* Ligne 2 : Trajet / Contexte */}
        <View style={styles.routeBar} />

        {/* Ligne 3 : Dernier message */}
        <View style={styles.messageBar} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#E2E8F0',
    marginRight: 12,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    gap: 7,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  nameBar: {
    width: 120,
    height: 14,
    borderRadius: 4,
    backgroundColor: '#E2E8F0',
  },
  timeBar: {
    width: 42,
    height: 11,
    borderRadius: 4,
    backgroundColor: '#EEF2F6',
  },
  routeBar: {
    width: 150,
    height: 11,
    borderRadius: 4,
    backgroundColor: '#F1F5F9',
  },
  messageBar: {
    width: '75%',
    height: 12,
    borderRadius: 4,
    backgroundColor: '#EEF2F6',
  },
});
