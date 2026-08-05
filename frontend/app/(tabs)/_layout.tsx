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
import { Platform, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SupportBubble from '../../src/components/SupportBubble';
import { useAuth } from '../../src/context/AuthContext';
import { useBadges } from '../../src/context/BadgeContext';

/**
 * Badge rouge flottant affiché sur une icône de tab.
 * - Si count <= 0 → rien
 * - Si count > 99 → affiche "99+"
 * - Sinon → affiche le chiffre dans un pastille
 */
function TabBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  const label = count > 99 ? '99+' : String(count);
  const isSmall = count <= 9;

  return (
    <View
      style={[
        styles.badge,
        isSmall ? styles.badgeDot : styles.badgeCount,
      ]}
    >
      {!isSmall && (
        <Text style={styles.badgeText}>{label}</Text>
      )}
    </View>
  );
}

/**
 * Composant TabsLayout.
 *
 * Responsabilités :
 * - Affichage et gestion de l'état lié à TabsLayout.
 */
export default function TabsLayout() {
  const { authFetch, user } = useAuth();
  const insets = useSafeAreaInsets();
  const { notifCount, tripCount, messageCount } = useBadges();

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
        {/* 1 - Accueil */}
        <Tabs.Screen
          name="home"
          options={{
            title: 'Accueil',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'home' : 'home-outline'} size={24} color={color} />
            ),
          }}
        />
        {/* 2 - Publier */}
        <Tabs.Screen
          name="publish"
          options={{
            title: 'Publier',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'add-circle' : 'add-circle-outline'} size={24} color={color} />
            ),
          }}
        />
        {/* 3 - Revenus (centre, bouton circulaire mis en évidence) */}
        <Tabs.Screen
          name="earnings"
          options={{
            title: 'Revenus',
            tabBarLabel: () => null,
            tabBarButton: (props) => (
              <TouchableOpacity
                {...(props as any)}
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
                  <Ionicons name="wallet" size={25} color="white" />
                </View>
              </TouchableOpacity>
            ),
          }}
        />
        {/* 4 - Trajets (badge = actions requises) */}
        <Tabs.Screen
          name="trips"
          options={{
            title: 'Trajets',
            tabBarIcon: ({ color, focused }) => (
              <View style={styles.iconWrapper}>
                <Ionicons name={focused ? 'car' : 'car-outline'} size={24} color={color} />
                <TabBadge count={tripCount} />
              </View>
            ),
          }}
        />
        {/* 5 - Messages (badge = messages non lus) */}
        <Tabs.Screen
          name="messages"
          options={{
            title: 'Messages',
            tabBarIcon: ({ color, focused }) => (
              <View style={styles.iconWrapper}>
                <Ionicons name={focused ? 'chatbubbles' : 'chatbubbles-outline'} size={24} color={color} />
                <TabBadge count={messageCount} />
              </View>
            ),
          }}
        />
        {/* Profil - caché de la barre, accessible via l'accueil */}
        <Tabs.Screen
          name="profile"
          options={{
            href: null,
          }}
        />
      </Tabs>
      {/* Floating support chat bubble */}
      <SupportBubble />
    </View>
  );
}

const styles = StyleSheet.create({
  iconWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: '#EF4444',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  // Pastille simple (1-9) : petit rond
  badgeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  // Pastille numérotée (10+)
  badgeCount: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: 11,
  },
});

