import React, { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Image,
  RefreshControl,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { theme } from '../../../../styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { getMediaUrl } from '../../../../utils/media';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../../../context/AuthContext';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { CustomAlert } from '../../../../utils/CustomAlert';

import { styles } from './styles';
import { PersonalInfoModal } from './components/PersonalInfoModal';
import { VehicleModal } from './components/VehicleModal';
import { PreferencesModal } from './components/PreferencesModal';
import { ChangePasswordModal } from './components/ChangePasswordModal';

export default function ProfileScreen() {
  const router = useRouter();
  const authCtx = useAuth();
  const user = authCtx?.user ?? null;
  const authFetch = authCtx?.authFetch ?? (async () => ({}));
  const logout = authCtx?.logout ?? (() => { });
  const updateUser = authCtx?.updateUser ?? (() => { });
  const refreshUser = authCtx?.refreshUser ?? (async () => {});

  // Modals visibility
  const [infoModalVisible, setInfoModalVisible] = useState(false);
  const [vehicleModalVisible, setVehicleModalVisible] = useState(false);
  const [prefsModalVisible, setPrefsModalVisible] = useState(false);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Parent state for vehicle summary to display in menu subtitle
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [plate, setPlate] = useState('');

  // Animations
  const fadeAnim = useState(new Animated.Value(0))[0];
  const slideAnim = useState(new Animated.Value(30))[0];

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const fetchVehicle = async () => {
    try {
      const data = await authFetch('/vehicles/');
      if (data && data.length > 0) {
        const vehicle = data[0];
        setVehicleId(vehicle.id);
        const parts = (vehicle.brand_model || '').split(' ');
        setBrand(parts[0] || '');
        setModel(parts.slice(1).join(' ') || '');
        setPlate(vehicle.license_plate || '');
      } else {
        setVehicleId(null);
        setBrand('');
        setModel('');
        setPlate('');
      }
    } catch (e) {}
  };

  useFocusEffect(
    useCallback(() => {
      if (user) {
        fetchVehicle();
        refreshUser();
      }
    }, [user])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchVehicle(), refreshUser()]);
    setRefreshing(false);
  }, []);

  const handleLogout = () => {
    CustomAlert.alert(
      'Déconnexion',
      'Voulez-vous vraiment vous déconnecter ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Se déconnecter',
          style: 'destructive',
          onPress: () => {
            logout();
            router.replace('/(auth)/login');
          },
        },
      ]
    );
  };

  const pickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      CustomAlert.alert('Permission refusée', 'Vous devez autoriser l\'accès à vos photos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      const finalUri = result.assets[0].uri;

      if (user?.id) {
        try {
          const formData = new FormData();
          const filename = finalUri.split('/').pop() || 'avatar.jpg';
          const match = /\.(\w+)$/.exec(filename);
          const type = match ? `image/${match[1]}` : 'image/jpeg';
          formData.append('avatar', {
            uri: finalUri,
            name: filename,
            type,
          } as any);

          const res = await authFetch(`/users/${user.id}/`, {
            method: 'PATCH',
            body: formData,
          });
          if (res.avatar) {
            updateUser({ avatar: res.avatar });
            CustomAlert.alert('Succès', 'Avatar mis à jour.');
          }
        } catch (e: any) {
          CustomAlert.alert('Erreur', e?.message || 'Échec de la mise à jour.');
        }
      }
    }
  };

  const handleVehicleSaveSuccess = (updatedData: { id: string; brand: string; model: string; plate: string }) => {
    setVehicleId(updatedData.id);
    setBrand(updatedData.brand);
    setModel(updatedData.model);
    setPlate(updatedData.plate);
  };

  const MenuItem = ({ icon, title, subtitle, iconColor = theme.colors.primary, onPress, isDestructive = false }: {
    icon: string; title: string; subtitle?: string; iconColor?: string; onPress?: () => void; isDestructive?: boolean;
  }) => (
    <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.menuIconContainer, { backgroundColor: `${iconColor}15` }]}>
        <Ionicons name={icon as any} size={22} color={iconColor} />
      </View>
      <View style={styles.menuTextContainer}>
        <Text style={[styles.menuTitle, isDestructive && { color: theme.colors.error }]}>{title}</Text>
        {subtitle && <Text style={styles.menuSubtitle}>{subtitle}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
    </TouchableOpacity>
  );

  if (!user) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: theme.spacing.xl }]}>
        <Ionicons name="person-circle-outline" size={80} color={theme.colors.textMuted} />
        <Text style={{ ...theme.typography.h3, marginTop: 16, marginBottom: 8, textAlign: 'center' }}>Connectez-vous</Text>
        <Text style={{ ...theme.typography.bodyMedium, color: theme.colors.textLight, textAlign: 'center', marginBottom: 24 }}>
          Vous devez être connecté pour voir votre profil.
        </Text>
        <TouchableOpacity
          style={styles.loginButton}
          onPress={() => router.push('/(auth)/login')}
          activeOpacity={0.8}
        >
          <LinearGradient colors={[theme.colors.primary, theme.colors.primaryDark]} style={styles.loginButtonGradient}>
            <Text style={styles.loginButtonText}>Se connecter</Text>
          </LinearGradient>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const initials = user.full_name
    ? user.full_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
    : '?';

  const isProfileComplete = Boolean(
    user.full_name && user.email && user.phone && user.avatar && user.is_verified
  );

  return (
    <SafeAreaView style={styles.container}>
      <Animated.ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} colors={[theme.colors.primary]} />
        }
        style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
      >
        {/* Profile Header Card */}
        <LinearGradient
          colors={[theme.colors.white, theme.colors.background]}
          style={styles.profileHeaderCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.profileMain}>
            <TouchableOpacity onPress={pickAvatar} style={styles.avatarWrapperSmall} activeOpacity={0.8}>
              {user.avatar ? (
                <Image source={{ uri: getMediaUrl(user.avatar) }} style={styles.avatarBig} resizeMode="cover" />
              ) : (
                <LinearGradient colors={[theme.colors.primaryLight, theme.colors.primary]} style={styles.avatarBig}>
                  <Text style={styles.avatarBigText}>{initials}</Text>
                </LinearGradient>
              )}
              <View style={styles.avatarEditBadge}>
                <Ionicons name="camera" size={14} color={theme.colors.white} />
              </View>
            </TouchableOpacity>

            <View style={styles.profileText}>
              <Text style={styles.profileName}>{user.full_name || 'Profil incomplet'}</Text>

              <View style={styles.premiumTags}>
                <View style={[styles.roleBadge, { backgroundColor: isProfileComplete ? '#ECFDF5' : '#FFFBEB' }]}>
                  <Text style={[styles.roleText, { color: isProfileComplete ? '#047857' : '#B45309' }]}>
                    {isProfileComplete ? ' Profil complet' : ' Profil incomplet'}
                  </Text>
                </View>

                <View style={styles.ratingBadge}>
                  <Ionicons name="star" size={12} color="#F59E0B" />
                  <Text style={styles.ratingText}>{user.rating?.toFixed(1) || '4.8'}</Text>
                </View>

                {user.is_verified ? (
                  <View style={styles.verifiedBadgePremium}>
                    <Ionicons name="checkmark-circle" size={12} color="#10B981" />
                    <Text style={styles.verifiedTextPremium}>Vérifié</Text>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.unverifiedBadgePremium} onPress={() => router.push('/verify-identity')}>
                    <Ionicons name="warning-outline" size={12} color="#EF4444" />
                    <Text style={styles.unverifiedTextPremium}>Non vérifié</Text>
                  </TouchableOpacity>
                )}
              </View>

              <Text style={styles.profilePhone}>{user.phone || 'Numéro non renseigné'}</Text>
            </View>
          </View>

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={styles.statCol}>
              <Text style={styles.statNumber}>
                {(user?.rides_count ?? 0) + (user?.reviews_count ?? 0)}
              </Text>
              <Text style={styles.statLabel}>Trajets</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCol}>
              <Text style={styles.statNumber}>
                {user?.rating != null && user.rating > 0
                  ? user.rating.toFixed(1)
                  : '–'}
              </Text>
              <Text style={styles.statLabel}>Note ⭐</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCol}>
              <Text style={styles.statNumber}>
                {(() => {
                  const spent = user?.total_spent ?? 0;
                  return spent >= 1000
                    ? `${(spent / 1000).toFixed(1)}k`
                    : `${spent}`;
                })()}
              </Text>
              <Text style={styles.statLabel}>FCFA Dépensés</Text>
            </View>
          </View>

          <Text style={styles.memberSinceText}>
            {user?.created_at
              ? `Membre depuis ${new Date(user.created_at).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`
              : 'Membre Zemy'}
          </Text>
        </LinearGradient>

        {/* Paramètres du compte */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Paramètres du compte</Text>
          <View style={styles.menuCard}>
            <MenuItem
              icon="person-outline"
              title="Informations personnelles"
              subtitle={user.full_name || '⚠️ À remplir'}
              onPress={() => setInfoModalVisible(true)}
            />
            <View style={styles.menuDivider} />
            <MenuItem
              icon="car-outline"
              title="Mon véhicule"
              subtitle={vehicleId ? `${brand} ${model} - ${plate}` : 'Ajouter un véhicule'}
              onPress={() => setVehicleModalVisible(true)}
            />
            <View style={styles.menuDivider} />
            <MenuItem
              icon="options-outline"
              title="Préférences de voyage"
              subtitle="Musique, discussions, bagages..."
              onPress={() => setPrefsModalVisible(true)}
            />
            <View style={styles.menuDivider} />
            <MenuItem
              icon="wallet-outline"
              title="Portefeuille & Transactions"
              subtitle="Historique de vos paiements"
              onPress={() => router.push('/transactions')}
            />
          </View>
        </View>

        {/* Sécurité */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sécurité</Text>
          <View style={styles.menuCard}>
            <MenuItem
              icon="key-outline"
              title="Changer le mot de passe"
              onPress={() => setPasswordModalVisible(true)}
            />
            <View style={styles.menuDivider} />
            <MenuItem
              icon="phone-portrait-outline"
              title="Vérifier le téléphone"
              subtitle={user.phone ? "Téléphone vérifié" : "Non vérifié"}
              onPress={() => CustomAlert.alert('Sécurité', 'Fonctionnalité disponible prochainement.')}
            />
            <View style={styles.menuDivider} />
            <MenuItem
              icon="mail-outline"
              title="Vérifier l'email"
              subtitle={user.email ? "Email vérifié" : "Non vérifié"}
              onPress={() => CustomAlert.alert('Sécurité', 'Fonctionnalité disponible prochainement.')}
            />
            <View style={styles.menuDivider} />
            <MenuItem
              icon="shield-checkmark-outline"
              title="Vérification d'identité"
              subtitle={user.is_verified ? "Identité vérifiée ✅" : "Non vérifié — À compléter"}
              iconColor={user.is_verified ? '#10B981' : theme.colors.primary}
              onPress={() => {
                if (user.is_verified) {
                  CustomAlert.alert(
                    '✅ Compte vérifié',
                    'Votre identité a été vérifiée avec succès. Vous pouvez utiliser toutes les fonctionnalités de l\'application, notamment publier des trajets.',
                    [{ text: 'Super !' }]
                  );
                } else {
                  router.push('/verify-identity');
                }
              }}
            />
          </View>
        </View>

        {/* Support */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support</Text>
          <View style={styles.menuCard}>
            <MenuItem
              icon="help-circle-outline"
              title="Centre d'aide"
              subtitle="FAQ et assistance"
              onPress={() => router.push('/help-center')}
            />
            <View style={styles.menuDivider} />
            <MenuItem
              icon="document-text-outline"
              title="Conditions d'utilisation"
              onPress={() => router.push('/terms')}
            />
            <View style={styles.menuDivider} />
            <MenuItem
              icon="mail-outline"
              title="Nous contacter"
              subtitle="zemy@sinustic.com"
              onPress={() => router.push('/contact')}
            />
          </View>
        </View>

        {/* Support/Déconnexion */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={20} color={theme.colors.error} />
          <Text style={styles.logoutBtnText}>Se déconnecter</Text>
        </TouchableOpacity>

        <Text style={styles.versionText}>Version 1.0.0</Text>
      </Animated.ScrollView>

      <PersonalInfoModal
        visible={infoModalVisible}
        onClose={() => setInfoModalVisible(false)}
        user={user}
        authFetch={authFetch}
        updateUser={updateUser}
      />

      <VehicleModal
        visible={vehicleModalVisible}
        onClose={() => setVehicleModalVisible(false)}
        user={user}
        authFetch={authFetch}
        vehicleId={vehicleId}
        onSaveSuccess={handleVehicleSaveSuccess}
      />

      <PreferencesModal
        visible={prefsModalVisible}
        onClose={() => setPrefsModalVisible(false)}
        user={user}
        authFetch={authFetch}
      />

      <ChangePasswordModal
        visible={passwordModalVisible}
        onClose={() => setPasswordModalVisible(false)}
        user={user}
      />
    </SafeAreaView>
  );
}
