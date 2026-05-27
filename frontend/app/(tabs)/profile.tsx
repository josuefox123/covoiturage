import React from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { theme } from '../../src/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ProfileScreen() {
  const router = useRouter();

  const handleLogout = () => {
    router.replace('/(auth)/login');
  };

  const MenuItem = ({ icon, title, subtitle, color = theme.colors.text, onPress }: {
    icon: string;
    title: string;
    subtitle?: string;
    color?: string;
    onPress?: () => void;
  }) => (
    <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.menuIconContainer}>
        <Ionicons name={icon as any} size={22} color={color === theme.colors.text ? theme.colors.primary : color} />
      </View>
      <View style={styles.menuTextContainer}>
        <Text style={[styles.menuTitle, { color }]}>{title}</Text>
        {subtitle && <Text style={styles.menuSubtitle}>{subtitle}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header Profile Info */}
        <View style={styles.profileHeaderCard}>
          <View style={styles.profileMain}>
            <View style={styles.avatarBig}>
              <Text style={styles.avatarBigText}>JD</Text>
            </View>
            <View style={styles.profileText}>
              <Text style={styles.profileName}>Jean-Baptiste Degbo</Text>
              <Text style={styles.profileRole}>Conducteur & Passager</Text>
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={14} color="#fff" />
                <Text style={styles.verifiedText}>Identité vérifiée</Text>
              </View>
            </View>
          </View>

          {/* Stats Row */}
          <View style={styles.statsRow}>
            <View style={styles.statCol}>
              <Text style={styles.statNumber}>18</Text>
              <Text style={styles.statLabel}>Trajets</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCol}>
              <Text style={styles.statNumber}>4.9</Text>
              <View style={styles.ratingInline}>
                <Ionicons name="star" size={12} color="#F59E0B" />
                <Text style={styles.statLabel}> Note</Text>
              </View>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCol}>
              <Text style={styles.statNumber}>12k</Text>
              <Text style={styles.statLabel}>FCFA Économisés</Text>
            </View>
          </View>
        </View>

        {/* Menu Sections */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Paramètres du compte</Text>
          <View style={styles.menuCard}>
            <MenuItem 
              icon="person-outline" 
              title="Informations personnelles" 
              subtitle="Modifier vos données personnelles" 
            />
            <View style={styles.menuDivider} />
            <MenuItem 
              icon="car-outline" 
              title="Mon véhicule" 
              subtitle="Toyota Corolla - 4589-RB" 
            />
            <View style={styles.menuDivider} />
            <MenuItem 
              icon="shield-checkmark-outline" 
              title="Vérification d'identité" 
              subtitle="CIP ou Passeport vérifié" 
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Préférences & Sécurité</Text>
          <View style={styles.menuCard}>
            <MenuItem 
              icon="options-outline" 
              title="Préférences de voyage" 
              subtitle="Musique, discussion, bagages" 
            />
            <View style={styles.menuDivider} />
            <MenuItem 
              icon="notifications-outline" 
              title="Notifications" 
            />
            <View style={styles.menuDivider} />
            <MenuItem 
              icon="lock-closed-outline" 
              title="Changer de mot de passe" 
            />
          </View>
        </View>

        {/* Log Out */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={20} color={theme.colors.error} />
          <Text style={styles.logoutBtnText}>Se déconnecter</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
  profileHeaderCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    ...theme.shadows.md,
    marginBottom: theme.spacing.lg,
  },
  profileMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  avatarBig: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: theme.colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarBigText: {
    color: theme.colors.primaryDark,
    fontSize: 24,
    fontWeight: '700',
  },
  profileText: {
    flex: 1,
  },
  profileName: {
    ...theme.typography.h3,
    color: theme.colors.text,
  },
  profileRole: {
    ...theme.typography.bodyMedium,
    color: theme.colors.textLight,
    marginTop: 2,
    marginBottom: 6,
  },
  verifiedBadge: {
    backgroundColor: theme.colors.success,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.borderRadius.xs,
    alignSelf: 'flex-start',
    gap: 4,
  },
  verifiedText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: theme.spacing.md,
  },
  statCol: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    ...theme.typography.h3,
    color: theme.colors.text,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 11,
    color: theme.colors.textLight,
    fontWeight: '500',
    marginTop: 2,
  },
  ratingInline: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: theme.colors.border,
  },
  section: {
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    ...theme.typography.bodyLarge,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
    paddingLeft: 4,
  },
  menuCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg,
    ...theme.shadows.sm,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.card,
  },
  menuIconContainer: {
    marginRight: theme.spacing.md,
  },
  menuTextContainer: {
    flex: 1,
  },
  menuTitle: {
    ...theme.typography.bodyLarge,
    fontWeight: '500',
  },
  menuSubtitle: {
    ...theme.typography.bodySmall,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  menuDivider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginHorizontal: theme.spacing.md,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFF1F2',
    height: 52,
    borderRadius: theme.borderRadius.lg,
    marginTop: theme.spacing.sm,
    borderWidth: 1,
    borderColor: '#FFE4E6',
  },
  logoutBtnText: {
    ...theme.typography.button,
    color: theme.colors.error,
  },
});
