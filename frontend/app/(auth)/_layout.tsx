/**
 * ==============================================================
 * Fichier :
 * _layout.tsx
 *
 * Description :
 * Composant ou logique de l'application Zemy.
 *
 * Projet :
 * Zemy
 * ==============================================================
 */
import { Stack } from 'expo-router';
import { theme } from '../../src/styles/theme';

/**
 * Composant AuthLayout.
 *
 * Responsabilités :
 * - Affichage et gestion de l'état lié à AuthLayout.
 */
export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
    </Stack>
  );
}
