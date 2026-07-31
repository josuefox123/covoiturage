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
import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import AnimatedSplash from '../src/components/AnimatedSplash';
import { AuthProvider } from '../src/context/AuthContext';
import { theme } from '../src/styles/theme';
import LiveRideModal from '../src/components/LiveRideModal';
import BookingRequestModal from '../src/components/BookingRequestModal';
import { CustomAlertProvider } from '../src/utils/CustomAlert';
import { useNotifications } from '../src/hooks/useNotifications';

/**
 * Composant interne qui initialise les notifications push.
 * Doit être un enfant de <AuthProvider> pour accéder au token JWT.
 */
function NotificationInitializer() {
  // Le hook gère tout : permission, token FCM, envoi au backend, deep links
  useNotifications();
  return null;
}

/**
 * Composant RootLayout.
 *
 * Responsabilités :
 * - Affichage et gestion de l'état lié à RootLayout.
 */
export default function RootLayout() {
  const [splashDone, setSplashDone] = useState(false);
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <AuthProvider>
        <StatusBar style="dark" />

        {/* Initialisation silencieuse des notifications push */}
        <NotificationInitializer />

        {/* Show the animated splash until animation completes */}
        {!splashDone && <AnimatedSplash onFinish={() => setSplashDone(true)} />}

        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: theme.colors.background },
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
          <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
          <Stack.Screen name="ride/[id]" options={{ presentation: 'modal', headerShown: false, animation: 'slide_from_bottom' }} />
          <Stack.Screen name="chat/[id]" options={{ presentation: 'card', headerShown: false }} />
          <Stack.Screen name="support_chat" options={{ presentation: 'modal', headerShown: false, animation: 'slide_from_bottom' }} />
          <Stack.Screen name="weather" options={{ presentation: 'card', headerShown: false, animation: 'slide_from_right' }} />
          <Stack.Screen name="payment" options={{ presentation: 'modal', headerShown: false, animation: 'slide_from_bottom' }} />
        </Stack>
        <LiveRideModal />
        <BookingRequestModal />
        <CustomAlertProvider />
          </AuthProvider>
        </SafeAreaProvider>
    </GestureHandlerRootView>
    </QueryClientProvider>
  );
}