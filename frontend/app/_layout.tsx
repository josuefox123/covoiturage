import React, { useState } from 'react';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import AnimatedSplash from '../src/components/AnimatedSplash';
import { AuthProvider } from '../src/context/AuthContext';

export default function RootLayout() {
  const [splashDone, setSplashDone] = useState(false);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />

        {/* Show the animated splash until animation completes */}
        {!splashDone && <AnimatedSplash onFinish={() => setSplashDone(true)} />}

        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: '#F8FAFC' },
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
          <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
          <Stack.Screen name="ride/[id]" options={{ presentation: 'card', headerShown: false }} />
          <Stack.Screen name="chat/[id]" options={{ presentation: 'card', headerShown: false }} />
        </Stack>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
