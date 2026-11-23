/**
 * ==============================================================
 * Fichier :
 * MessageEmptyState.tsx
 *
 * Description :
 * États vides modernes pour la messagerie Zemy (aucune discussion,
 * aucun résultat de recherche, aucun message non lu).
 *
 * Projet :
 * Zemy
 * ==============================================================
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

interface MessageEmptyStateProps {
  type?: 'empty' | 'no-search' | 'no-unread';
  searchQuery?: string;
  onResetSearch?: () => void;
  onResetFilter?: () => void;
}

export default function MessageEmptyState({
  type = 'empty',
  searchQuery = '',
  onResetSearch,
  onResetFilter,
}: MessageEmptyStateProps) {
  const router = useRouter();

  if (type === 'no-search') {
    return (
      <View style={styles.container}>
        <View style={[styles.iconCircle, { backgroundColor: '#F1F5F9' }]}>
          <Ionicons name="search-outline" size={36} color="#64748B" />
        </View>
        <Text style={styles.title}>Aucun résultat trouvé</Text>
        <Text style={styles.subtitle}>
          Aucune conversation ne correspond à « {searchQuery} ».
        </Text>
        {onResetSearch && (
          <TouchableOpacity
            style={styles.actionBtnOutline}
            onPress={onResetSearch}
            activeOpacity={0.8}
          >
            <Ionicons name="close-circle-outline" size={16} color="#2563EB" />
            <Text style={styles.actionBtnOutlineText}>Effacer la recherche</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  if (type === 'no-unread') {
    return (
      <View style={styles.container}>
        <View style={[styles.iconCircle, { backgroundColor: '#ECFDF5' }]}>
          <Ionicons name="checkmark-done-circle-outline" size={38} color="#059669" />
        </View>
        <Text style={styles.title}>Toutes vos discussions sont lues</Text>
        <Text style={styles.subtitle}>
          Vous n'avez aucun message non lu pour le moment.
        </Text>
        {onResetFilter && (
          <TouchableOpacity
            style={styles.actionBtnOutline}
            onPress={onResetFilter}
            activeOpacity={0.8}
          >
            <Text style={styles.actionBtnOutlineText}>Afficher tous les messages</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.iconCircle, { backgroundColor: '#EFF6FF' }]}>
        <Ionicons name="chatbubbles-outline" size={38} color="#2563EB" />
      </View>
      <Text style={styles.title}>Vos discussions</Text>
      <Text style={styles.subtitle}>
        Échangez directement avec vos conducteurs et passagers dès qu'un trajet est planifié ou réservé.
      </Text>
      <TouchableOpacity
        style={styles.actionBtnPrimary}
        onPress={() => router.push('/(tabs)/home')}
        activeOpacity={0.85}
      >
        <Ionicons name="compass-outline" size={18} color="#FFFFFF" />
        <Text style={styles.actionBtnPrimaryText}>Explorer les trajets</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop: 60,
    paddingBottom: 40,
  },
  iconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 20,
    maxWidth: 290,
  },
  actionBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#2563EB',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  actionBtnPrimaryText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  actionBtnOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  actionBtnOutlineText: {
    color: '#2563EB',
    fontWeight: '600',
    fontSize: 13,
  },
});
