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
import { Tabs } from 'expo-router';
import { theme } from '../../src/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { Platform, View, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SupportBubble from '../../src/components/SupportBubble';
import { useEffect } from 'react';
import { useAuth } from '../../src/context/AuthContext';

/**
 * Composant TabsLayout.
 *
 * Responsabilités :
 * - Affichage et gestion de l'état lié à TabsLayout.
 */
export default function TabsLayout() {
  const { authFetch, user } = useAuth();
  const insets = useSafeAreaInsets();

  const bottomPadding = insets.bottom > 0 ? insets.bottom : (Platform.OS === 'ios' ? 20 : 16);
  const tabBarHeight = 56 + bottomPadding;

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: theme.colors.primary,
          tabBarInactiveTintColor: theme.colors.textMuted,
          tabBarStyle: {
            backgroundColor: theme.colors.card,
            borderTopWidth: 1,
            borderTopColor: theme.colors.border,
            height: tabBarHeight,
            paddingBottom: bottomPadding,
            paddingTop: 10,
            ...theme.shadows.md,
          },
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '500',
          },
        }}
      >
        <Tabs.Screen
          name="home"
          options={{
            title: 'Accueil',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'home' : 'home-outline'} size={24} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="publish"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="trips"
          options={{
            title: 'Trajets',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'car' : 'car-outline'} size={24} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="earnings"
          options={{
            title: 'Revenus',
            tabBarLabel: () => null,
            tabBarButton: (props) => (
              <TouchableOpacity
                {...props}
                style={{
                  top: -16,
                  justifyContent: 'center',
                  alignItems: 'center',
                  height: 64,
                }}
                activeOpacity={0.85}
              >
                <View
                  style={{
                    width: 58,
                    height: 58,
                    borderRadius: 29,
                    backgroundColor: theme.colors.primary,
                    justifyContent: 'center',
                    alignItems: 'center',
                    shadowColor: theme.colors.primary,
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.35,
                    shadowRadius: 8,
                    elevation: 5,
                  }}
                >
                  <Ionicons name="cash" size={25} color="white" />
                </View>
              </TouchableOpacity>
            ),
          }}
        />
        <Tabs.Screen
          name="messages"
          options={{
            title: 'Messages',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'chatbubbles' : 'chatbubbles-outline'} size={24} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profil',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'person' : 'person-outline'} size={24} color={color} />
            ),
          }}
        />
      </Tabs>
      {/* Floating support chat bubble */}
      <SupportBubble />
    </View>
  );
}
