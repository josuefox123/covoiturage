/**
 * ==============================================================
 * Fichier :
 * ProfileAvatar.tsx
 *
 * Description :
 * Composant ou logique de l'application Zemy.
 *
 * Projet :
 * Zemy
 * ==============================================================
 */
import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { theme } from '../../theme';

interface ProfileAvatarProps {
  name?: string;
  url?: string | null;
  size?: number;
  showBorder?: boolean;
}

/**
 * Composant ProfileAvatar.
 *
 * Responsabilités :
 * - Affichage et gestion de l'état lié à ProfileAvatar.
 */
export default function ProfileAvatar({ name, url, size = 40, showBorder = false }: ProfileAvatarProps) {
  const initial = name ? name.charAt(0).toUpperCase() : '?';

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
        showBorder && styles.border,
      ]}
    >
      {url ? (
        <Image
          source={{ uri: url }}
          style={{ width: '100%', height: '100%', borderRadius: size / 2 }}
          resizeMode="cover"
        />
      ) : (
        <Text style={[styles.text, { fontSize: size * 0.4 }]}>{initial}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    color: theme.colors.white,
    fontWeight: '700',
  },
  border: {
    borderWidth: 2,
    borderColor: theme.colors.white,
  },
});
