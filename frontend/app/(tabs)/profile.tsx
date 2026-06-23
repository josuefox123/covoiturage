/**
 * ==============================================================
 * Fichier :
 * profile.tsx
 *
 * Description :
 * Composant ou logique de l'application Zemy.
 *
 * Projet :
 * Zemy
 * ==============================================================
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Image,
  RefreshControl,
  Dimensions,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Pressable,
  Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { theme } from '../../src/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import { CustomAlert } from '../../src/utils/CustomAlert';
import { AppBottomSheet } from '../../src/components/AppBottomSheet';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

const { width } = Dimensions.get('window');

/**
 * Composant ProfileScreen.
 *
 * Responsabilités :
 * - Affichage et gestion de l'état lié à ProfileScreen.
 */
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
  const [isSaving, setIsSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Personal info state
  const [editFullName, setEditFullName] = useState(user?.full_name || '');
  const [editPhone, setEditPhone] = useState(user?.phone || '');
  const [emailError, setEmailError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [editEmail, setEditEmail] = useState(user?.email || '');
  const [avatarUri, setAvatarUri] = useState<string | null>(user?.avatar || null);

  // Vehicle state
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [color, setColor] = useState('');
  const [plate, setPlate] = useState('');
  const [vehicleType, setVehicleType] = useState('voiture');
  const [driverLicense, setDriverLicense] = useState('');
  const [licenseExpiration, setLicenseExpiration] = useState('');
  const [licenseExpirationError, setLicenseExpirationError] = useState('');
  const [driverLicensePhoto, setDriverLicensePhoto] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Preferences state
  const [music, setMusic] = useState(true);
  const [smoking, setSmoking] = useState(false);
  const [chatty, setChatty] = useState(true);
  const [airCond, setAirCond] = useState(true);
  const [petsAllowed, setPetsAllowed] = useState(false);
  const [luggageAllowed, setLuggageAllowed] = useState(true);
  const [stopsAllowed, setStopsAllowed] = useState(true);
  const [notes, setNotes] = useState('');
  const [vehicleId, setVehicleId] = useState<string | null>(null);

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

  useFocusEffect(
    useCallback(() => {
      if (user) {
        setEditFullName(user.full_name || '');
        setEditPhone(user.phone || '');
        setEditEmail(user.email || '');
        setAvatarUri(user.avatar || null);
        fetchPreferences();
        fetchVehicle();
        refreshUser();
      }
    }, [user])
  );

  const fetchPreferences = async () => {
    try {
      const data = await authFetch('/preferences/');
      if (data && data.length > 0) {
        const pref = data[0];
        setMusic(pref.music ?? true);
        setSmoking(pref.smoking ?? false);
        setChatty(pref.chatty ?? true);
        setAirCond(pref.air_conditioner ?? true);
        setPetsAllowed(pref.pets_allowed ?? false);
        setLuggageAllowed(pref.luggage_allowed ?? true);
        setStopsAllowed(pref.stops_allowed ?? true);
        setNotes(pref.notes || '');
      }
    } catch (e) {
    }
  };

  const fetchVehicle = async () => {
    try {
      const data = await authFetch('/vehicles/');
      if (data && data.length > 0) {
        const vehicle = data[0];
        setVehicleId(vehicle.id);
        const parts = (vehicle.brand_model || '').split(' ');
        setBrand(parts[0] || '');
        setModel(parts.slice(1).join(' ') || '');
        setColor(vehicle.color || '');
        setPlate(vehicle.license_plate || '');
        setVehicleType(vehicle.vehicle_type || 'voiture');
        setDriverLicense(vehicle.driver_license_number || '');
        setLicenseExpiration(vehicle.license_expiration || '');
        setDriverLicensePhoto(vehicle.driver_license_photo || null);
      }
    } catch (e) {
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchPreferences(), fetchVehicle(), refreshUser()]);
    setRefreshing(false);
  }, []);

  const handleLogout = () => {
    CustomAlert.alert(
      'Déconnexion',
      'Voulez-vous vraiment vous déconnecter ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Se déconnecter', style: 'destructive', onPress: () => {
            logout();
            router.replace('/(auth)/login');
          }
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
      setAvatarUri(finalUri);

      // Auto-upload
      if (user?.id) {
        try {
          const formData = new FormData();
          const filename = finalUri.split('/').pop() || 'avatar.jpg';
          const match = /\.(\w+)$/.exec(filename);
          const type = match ? `image/${match[1]}` : 'image/jpeg';
          formData.append('avatar', {
            uri: finalUri,
            name: filename,
            type
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

  const handleEmailBlur = async () => {
    if (!editEmail) return;
    try {
      const data = await authFetch('/users/check_email/', {
        method: 'POST',
        body: JSON.stringify({ email: editEmail }),
      });
      if (data.exists && data.email !== user?.email) {
        setEmailError('Cet email est déjà utilisé');
      } else {
        setEmailError('');
      }
    } catch (e) { }
  };

  const handlePhoneBlur = async () => {
    if (!editPhone) return;
    try {
      const data = await authFetch('/users/check_phone/', {
        method: 'POST',
        body: JSON.stringify({ phone: editPhone }),
      });
      if (data.exists && data.phone !== user?.phone) {
        setPhoneError('Ce numéro est déjà utilisé');
      } else {
        setPhoneError('');
      }
    } catch (e) { }
  };

  const handleSavePersonalInfo = async () => {
    if (!editFullName.trim()) {
      CustomAlert.alert('Erreur', 'Le nom complet est obligatoire.');
      return;
    }
    if (!editEmail.trim()) {
      CustomAlert.alert('Erreur', 'L\'email est obligatoire.');
      return;
    }
    if (emailError || phoneError) {
      CustomAlert.alert('Erreur', 'Corrigez les champs avant de sauvegarder.');
      return;
    }

    setIsSaving(true);
    try {
      const formData = new FormData();
      formData.append('full_name', editFullName.trim());
      formData.append('phone', editPhone);
      if (editEmail) formData.append('email', editEmail);

      if (avatarUri && avatarUri !== user?.avatar) {
        const filename = avatarUri.split('/').pop() || 'avatar.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : 'image/jpeg';
        formData.append('avatar', {
          uri: avatarUri,
          name: filename,
          type
        } as any);
      }

      await authFetch(`/users/${user!.id}/`, {
        method: 'PATCH',
        body: formData,
      });

      updateUser({
        full_name: editFullName,
        email: editEmail,
        phone: editPhone,
        avatar: avatarUri
      });

      CustomAlert.alert('Succès ✅', 'Informations personnelles mises à jour !');
      setInfoModalVisible(false);
    } catch (e: any) {
      CustomAlert.alert('Erreur', e.message || 'Impossible de mettre à jour.');
    } finally {
      setIsSaving(false);
    }
  };

  const pickLicensePhoto = async () => {
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
      setDriverLicensePhoto(result.assets[0].uri);
    }
  };

  const handleSaveVehicle = async () => {
    if (!brand.trim() || !model.trim() || !color.trim() || !plate.trim()) {
      CustomAlert.alert('Erreur', 'Veuillez remplir tous les champs du véhicule.');
      return;
    }

    if (vehicleType === 'voiture') {
      if (!driverLicense.trim() || !licenseExpiration.trim() || !driverLicensePhoto) {
        CustomAlert.alert('Erreur', 'Les informations du permis de conduire (numéro, date d\'expiration et photo) sont obligatoires pour les voitures.');
        return;
      }
      
      const expDate = new Date(licenseExpiration);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (expDate < today) {
        setLicenseExpirationError('La date de votre permis est déjà expirée.');
        return;
      } else {
        setLicenseExpirationError('');
      }
    }

    setIsSaving(true);
    const brand_model = `${brand.trim()} ${model.trim()}`;
    
    const formData = new FormData();
    formData.append('owner', user!.id);
    formData.append('brand_model', brand_model);
    formData.append('color', color);
    formData.append('license_plate', plate);
    formData.append('vehicle_type', vehicleType);
    
    if (vehicleType === 'voiture') {
      formData.append('driver_license_number', driverLicense);
      formData.append('license_expiration', licenseExpiration);
    }

    // Si on a une image locale (non serveur)
    if (vehicleType === 'voiture' && driverLicensePhoto && !driverLicensePhoto.startsWith('http')) {
      const filename = driverLicensePhoto.split('/').pop() || 'license.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';
      formData.append('driver_license_photo', {
        uri: driverLicensePhoto,
        name: filename,
        type
      } as any);
    }

    try {
      if (vehicleId) {
        await authFetch(`/vehicles/${vehicleId}/`, {
          method: 'PATCH',
          body: formData,
        });
        CustomAlert.alert('Succès ✅', 'Véhicule mis à jour !');
      } else {
        const res = await authFetch('/vehicles/', {
          method: 'POST',
          body: formData,
        });
        if (res && res.id) setVehicleId(res.id);
        CustomAlert.alert('Succès ✅', 'Véhicule ajouté !');
      }
      setVehicleModalVisible(false);
    } catch (e: any) {
      CustomAlert.alert('Erreur', e.message || 'Impossible d\'ajouter le véhicule.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSavePreferences = async () => {
    setIsSaving(true);
    try {
      await authFetch('/preferences/', {
        method: 'POST',
        body: JSON.stringify({
          user: user!.id,
          music,
          smoking,
          chatty,
          air_conditioner: airCond,
          pets_allowed: petsAllowed,
          luggage_allowed: luggageAllowed,
          stops_allowed: stopsAllowed,
          notes: notes.trim(),
        }),
      });
      CustomAlert.alert('Succès ✅', 'Préférences sauvegardées !');
      setPrefsModalVisible(false);
    } catch (e: any) {
      CustomAlert.alert('Erreur', e.message || 'Impossible de sauvegarder les préférences.');
    } finally {
      setIsSaving(false);
    }
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

  interface PrefCardProps {
    label: string;
    value: boolean;
    onToggle: () => void;
    icon: string;
  }

  const PrefCard = ({ label, value, onToggle, icon }: PrefCardProps) => (
    <TouchableOpacity
      style={styles.prefRow}
      onPress={onToggle}
      activeOpacity={0.8}
    >
      <View style={[styles.prefIconContainer, value && { backgroundColor: `${theme.colors.primary}15` }]}>
        <Ionicons name={icon as any} size={20} color={value ? theme.colors.primary : theme.colors.textMuted} />
      </View>
      <Text style={[styles.prefRowLabel, value && { color: theme.colors.text, fontWeight: '600' }]}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: '#E5E7EB', true: `${theme.colors.primary}80` }}
        thumbColor={value ? theme.colors.primary : '#F9FAFB'}
        ios_backgroundColor="#E5E7EB"
      />
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
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarBig} resizeMode="cover" />
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
              <Text style={styles.statNumber}>0</Text>
              <Text style={styles.statLabel}>Trajets</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCol}>
              <Text style={styles.statNumber}>0</Text>
              <Text style={styles.statLabel}>Avis</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCol}>
              <Text style={styles.statNumber}>0</Text>
              <Text style={styles.statLabel}>FCFA Économisés</Text>
            </View>
          </View>

          <Text style={styles.memberSinceText}>Membre depuis Mai 2026</Text>
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
              onPress={() => CustomAlert.alert('Sécurité', 'Fonctionnalité disponible prochainement.')}
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
              subtitle="support@zemy.bj"
              onPress={() => router.push('/contact')}
            />
          </View>
        </View>
        {/* Déconnexion */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={20} color={theme.colors.error} />
          <Text style={styles.logoutBtnText}>Se déconnecter</Text>
        </TouchableOpacity>

        <Text style={styles.versionText}>Version 1.0.0</Text>
      </Animated.ScrollView>

      <AppBottomSheet
        visible={infoModalVisible}
        onClose={() => setInfoModalVisible(false)}
        snapPoints={['75%', '95%']}
      >
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Informations personnelles</Text>
        </View>

        <View>
          <TouchableOpacity style={styles.modernAvatarPicker} onPress={pickAvatar} activeOpacity={0.8}>
            {avatarUri ? (
              <View style={styles.avatarWrapper}>
                <Image source={{ uri: avatarUri }} style={styles.modernAvatar} />
                <View style={styles.modernAvatarEditBadge}>
                  <Ionicons name="camera" size={16} color={theme.colors.white} />
                </View>
              </View>
            ) : (
              <LinearGradient colors={[theme.colors.primaryLight, theme.colors.primary]} style={styles.modernAvatarPlaceholder}>
                <Ionicons name="camera" size={40} color={theme.colors.white} />
                <Text style={styles.modernAvatarText}>Ajouter une photo</Text>
              </LinearGradient>
            )}
          </TouchableOpacity>

          <View style={styles.inputWrapper}>
            <Ionicons name="person-outline" size={20} color={theme.colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.modalInputModern}
              value={editFullName}
              onChangeText={setEditFullName}
              placeholder="Nom complet"
              placeholderTextColor={theme.colors.textMuted}
            />
          </View>

          <View style={styles.inputWrapper}>
            <Ionicons name="mail-outline" size={20} color={theme.colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.modalInputModern}
              value={editEmail}
              onChangeText={setEditEmail}
              placeholder="votre@email.com"
              placeholderTextColor={theme.colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              onBlur={handleEmailBlur}
            />
          </View>
          {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}

          <View style={styles.inputWrapper}>
            <Ionicons name="call-outline" size={20} color={theme.colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={[styles.modalInputModern, phoneError ? { borderColor: theme.colors.error } : null]}
              value={editPhone}
              onChangeText={setEditPhone}
              placeholder="+229 XX XX XX XX"
              placeholderTextColor={theme.colors.textMuted}
              keyboardType="phone-pad"
              onBlur={handlePhoneBlur}
            />
          </View>
          {phoneError ? <Text style={styles.errorText}>{phoneError}</Text> : null}

          <TouchableOpacity onPress={handleSavePersonalInfo} disabled={isSaving} activeOpacity={0.8}>
            <LinearGradient colors={[theme.colors.primary, '#3B82F6']} style={styles.modalBtnGradient}>
              {isSaving ? <ActivityIndicator color={theme.colors.white} /> : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color={theme.colors.white} />
                  <Text style={styles.modalBtnSaveText}>Sauvegarder les modifications</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </AppBottomSheet>

      <AppBottomSheet
        visible={vehicleModalVisible}
        onClose={() => setVehicleModalVisible(false)}
        snapPoints={['75%', '95%']}
      >
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Mon véhicule</Text>
        </View>

        <View>
          <View style={styles.vehicleIconContainer}>
            <LinearGradient colors={[theme.colors.primaryLight, theme.colors.primary]} style={styles.vehicleIcon}>
              <Ionicons name="car-sport" size={48} color={theme.colors.white} />
            </LinearGradient>
          </View>

          <View style={styles.inputWrapper}>
            <Ionicons name="car-outline" size={20} color={theme.colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.modalInputModern}
              value={brand}
              onChangeText={setBrand}
              placeholder="Marque (ex: Toyota)"
              placeholderTextColor={theme.colors.textMuted}
            />
          </View>

          <View style={styles.inputWrapper}>
            <Ionicons name="car-sport-outline" size={20} color={theme.colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.modalInputModern}
              value={model}
              onChangeText={setModel}
              placeholder="Modèle (ex: Corolla)"
              placeholderTextColor={theme.colors.textMuted}
            />
          </View>

          <View style={styles.inputWrapper}>
            <Ionicons name="color-palette-outline" size={20} color={theme.colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.modalInputModern}
              value={color}
              onChangeText={setColor}
              placeholder="Couleur (ex: Gris)"
              placeholderTextColor={theme.colors.textMuted}
            />
          </View>

          <View style={styles.inputWrapper}>
            <Ionicons name="pricetag-outline" size={20} color={theme.colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.modalInputModern}
              value={plate}
              onChangeText={setPlate}
              placeholder="Immatriculation (ex: BJ-1234)"
              placeholderTextColor={theme.colors.textMuted}
              autoCapitalize="characters"
            />
          </View>

          <Text style={styles.vehicleTypeLabel}>Type de véhicule</Text>
          <View style={styles.vehicleTypeContainer}>
            {['Moto', 'Tricycle', 'Voiture'].map(type => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.vehicleTypeBtn,
                  vehicleType === type.toLowerCase() && styles.vehicleTypeBtnActive
                ]}
                onPress={() => setVehicleType(type.toLowerCase())}
              >
                <Text style={[
                  styles.vehicleTypeText,
                  vehicleType === type.toLowerCase() && styles.vehicleTypeTextActive
                ]}>{type}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Section Permis de conduire (Obligatoire pour Voiture) */}
          {vehicleType === 'voiture' && (
            <>
              <Text style={{ fontSize: 15, fontWeight: '600', color: theme.colors.text, marginTop: 12, marginBottom: 8 }}>Permis de conduire</Text>
              
              <View style={styles.inputWrapper}>
                <Ionicons name="id-card-outline" size={20} color={theme.colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.modalInputModern}
                  value={driverLicense}
                  onChangeText={setDriverLicense}
                  placeholder="Numéro de permis (Obligatoire)"
                  placeholderTextColor={theme.colors.textMuted}
                />
              </View>

              <TouchableOpacity style={[styles.inputWrapper, licenseExpirationError ? { borderColor: theme.colors.error } : null]} onPress={() => setShowDatePicker(true)}>
                <Ionicons name="calendar-outline" size={20} color={licenseExpirationError ? theme.colors.error : theme.colors.textMuted} style={styles.inputIcon} />
                <Text style={[styles.modalInputModern, { paddingTop: Platform.OS === 'ios' ? 16 : 14, color: licenseExpiration ? theme.colors.text : theme.colors.textMuted }]}>
                  {licenseExpiration || "Date d'expiration (Obligatoire)"}
                </Text>
              </TouchableOpacity>
              
              {licenseExpirationError ? (
                <Text style={{ color: theme.colors.error, fontSize: 12, marginTop: -8, marginBottom: 12, marginLeft: 4 }}>
                  {licenseExpirationError}
                </Text>
              ) : null}

              {showDatePicker && (
                <DateTimePicker
                  value={licenseExpiration ? new Date(licenseExpiration) : new Date()}
                  mode="date"
                  display="default"
                  onChange={(event, selectedDate) => {
                    setShowDatePicker(Platform.OS === 'ios');
                    if (selectedDate) {
                      const formattedDate = selectedDate.toISOString().split('T')[0];
                      setLicenseExpiration(formattedDate);
                      
                      const expDate = new Date(selectedDate);
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      expDate.setHours(0, 0, 0, 0);
                      
                      if (expDate < today) {
                        setLicenseExpirationError('La date de votre permis est déjà expirée.');
                      } else {
                        setLicenseExpirationError('');
                      }
                    }
                  }}
                />
              )}

              <TouchableOpacity 
                style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 24, gap: 12 }}
                onPress={pickLicensePhoto}
              >
                <Ionicons name="camera-outline" size={24} color={theme.colors.primary} />
                <Text style={{ flex: 1, color: theme.colors.text, fontSize: 14 }}>
                  {driverLicensePhoto ? 'Photo sélectionnée' : 'Ajouter une photo du permis'}
                </Text>
                {driverLicensePhoto && <Ionicons name="checkmark-circle" size={20} color={theme.colors.success} />}
              </TouchableOpacity>
            </>
          )}


          <TouchableOpacity onPress={handleSaveVehicle} disabled={isSaving} activeOpacity={0.8}>
            <LinearGradient colors={[theme.colors.primary, '#3B82F6']} style={styles.modalBtnGradient}>
              {isSaving ? <ActivityIndicator color={theme.colors.white} /> : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color={theme.colors.white} />
                  <Text style={styles.modalBtnSaveText}>{vehicleId ? 'Mettre à jour' : 'Ajouter le véhicule'}</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </AppBottomSheet>

      {/* ========== MODAL: Préférences ========== */}
      <AppBottomSheet
        visible={prefsModalVisible}
        onClose={() => setPrefsModalVisible(false)}
        snapPoints={['75%', '95%']}
      >
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Préférences de voyage</Text>
        </View>

        <View>

          <View style={styles.prefCardsContainer}>
            <PrefCard icon="musical-notes" label="Musique" value={music} onToggle={() => setMusic(!music)} />
            <PrefCard icon="chatbubbles" label="Bavard(e)" value={chatty} onToggle={() => setChatty(!chatty)} />
            <PrefCard icon="logo-no-smoking" label="Fumeurs" value={smoking} onToggle={() => setSmoking(!smoking)} />
            <PrefCard icon="snow" label="Climatisation" value={airCond} onToggle={() => setAirCond(!airCond)} />
            <PrefCard icon="paw" label="Animaux" value={petsAllowed} onToggle={() => setPetsAllowed(!petsAllowed)} />
            <PrefCard icon="briefcase" label="Bagages" value={luggageAllowed} onToggle={() => setLuggageAllowed(!luggageAllowed)} />
            <PrefCard icon="flag" label="Arrêts" value={stopsAllowed} onToggle={() => setStopsAllowed(!stopsAllowed)} />
          </View>

          <View style={{ marginTop: 24 }}>
            <Text style={{ fontSize: 15, fontWeight: '600', color: theme.colors.text, marginBottom: 12 }}>
              Détails supplémentaires
            </Text>
            <View style={[styles.inputWrapper, { height: 100, alignItems: 'flex-start', paddingTop: 16 }]}>
              <Ionicons name="document-text-outline" size={20} color={theme.colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={[styles.modalInputModern, { textAlignVertical: 'top', paddingTop: 0 }]}
                placeholder="Ex: Je voyage avec mon chat, j'aime faire des pauses régulières..."
                value={notes}
                onChangeText={setNotes}
                multiline
                placeholderTextColor={theme.colors.textMuted}
              />
            </View>
          </View>

          <TouchableOpacity style={{ marginTop: 16 }} onPress={handleSavePreferences} disabled={isSaving} activeOpacity={0.8}>
            <LinearGradient colors={[theme.colors.primary, '#3B82F6']} style={styles.modalBtnGradient}>
              {isSaving ? <ActivityIndicator color={theme.colors.white} /> : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color={theme.colors.white} />
                  <Text style={styles.modalBtnSaveText}>Sauvegarder</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </AppBottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  scrollContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
  profileHeaderCard: {
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    paddingBottom: theme.spacing.md,
    marginBottom: theme.spacing.md,
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  profileMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  avatarWrapperSmall: { position: 'relative' },
  avatarBig: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarBigText: { color: theme.colors.white, fontSize: 28, fontWeight: '800' },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.white,
  },
  profileText: { flex: 1 },
  profileName: { fontSize: 20, fontWeight: '800', color: theme.colors.text, marginBottom: 4 },
  premiumTags: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
    flexWrap: 'wrap'
  },
  ratingBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 8, gap: 4,
  },
  ratingText: { fontSize: 11, fontWeight: '700', color: '#B45309' },
  roleBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: `${theme.colors.primary}15`,
    paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 8, gap: 4,
  },
  roleText: { fontSize: 11, fontWeight: '700', color: theme.colors.primary },
  verifiedBadgePremium: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 8, gap: 4,
  },
  verifiedTextPremium: { fontSize: 11, fontWeight: '700', color: '#047857' },
  unverifiedBadgePremium: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 8, gap: 4,
    borderWidth: 1, borderColor: '#FECACA'
  },
  unverifiedTextPremium: { fontSize: 11, fontWeight: '700', color: '#DC2626' },
  profilePhone: { fontSize: 13, color: theme.colors.textLight },
  statsRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderTopWidth: 1, borderTopColor: theme.colors.border, paddingTop: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  statCol: { alignItems: 'center', flex: 1 },
  statNumber: { fontSize: 20, fontWeight: '800', color: theme.colors.text },
  statLabel: { fontSize: 11, color: theme.colors.textLight, fontWeight: '500', marginTop: 2 },
  statDivider: { width: 1, height: 30, backgroundColor: theme.colors.border },
  memberSinceText: {
    textAlign: 'center',
    fontSize: 12,
    color: theme.colors.textMuted,
    fontStyle: 'italic',
  },
  progressContainer: {
    marginBottom: theme.spacing.lg,
    paddingHorizontal: 4,
  },
  progressLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    marginTop: 6,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: 4,
  },
  section: { marginBottom: theme.spacing.lg },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
    paddingLeft: 4,
  },
  menuCard: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row', alignItems: 'center',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.white,
  },
  menuIconContainer: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
    marginRight: theme.spacing.md
  },
  menuTextContainer: { flex: 1 },
  menuTitle: { fontSize: 15, fontWeight: '600', color: theme.colors.text },
  menuSubtitle: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  menuDivider: { height: 1, backgroundColor: theme.colors.border, marginHorizontal: theme.spacing.md },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: theme.colors.errorLight, height: 52,
    borderRadius: theme.borderRadius.lg, marginTop: theme.spacing.sm,
  },
  logoutBtnText: { fontSize: 15, fontWeight: '700', color: theme.colors.error },
  versionText: {
    textAlign: 'center',
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.xl,
  },
  loginButton: {
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
  },
  loginButtonGradient: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginButtonText: {
    color: theme.colors.white,
    fontWeight: 'bold',
    fontSize: 16,
  },
  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: theme.colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: theme.spacing.xl,
    paddingBottom: 40,
    minHeight: '75%',
    maxHeight: '95%',
  },
  modalDragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.border,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.text,
  },
  modernAvatarPicker: {
    alignSelf: 'center',
    marginBottom: theme.spacing.xl,
  },
  avatarWrapper: {
    position: 'relative',
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  modernAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: theme.colors.white,
  },
  modernAvatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: theme.colors.primary,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.white,
  },
  modernAvatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modernAvatarText: {
    fontSize: 11,
    color: theme.colors.white,
    fontWeight: '600',
    marginTop: 4,
  },
  vehicleIconContainer: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  vehicleTypeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 8,
    marginLeft: 4,
  },
  vehicleTypeContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: theme.spacing.lg,
  },
  vehicleTypeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  vehicleTypeBtnActive: {
    backgroundColor: `${theme.colors.primary}15`,
    borderColor: theme.colors.primary,
  },
  vehicleTypeText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textMuted,
  },
  vehicleTypeTextActive: {
    color: theme.colors.primary,
  },
  vehicleIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F7F8FA',
    borderRadius: 16,
    height: 56,
    paddingHorizontal: 16,
    marginBottom: theme.spacing.md,
  },
  inputIcon: {
    marginRight: 12,
  },
  modalInputModern: {
    flex: 1,
    fontSize: 15,
    color: theme.colors.text,
    height: '100%',
  },
  modalBtnGradient: {
    flexDirection: 'row',
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: theme.spacing.sm,
    gap: 8,
  },
  modalBtnSaveText: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.white,
  },
  errorText: {
    color: theme.colors.error,
    fontSize: 12,
    marginBottom: theme.spacing.md,
    marginTop: -8,
    marginLeft: 4,
  },
  // Preferences Cards
  prefCardsContainer: {
    gap: 12,
  },
  prefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F7F8FA',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  prefIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  prefRowLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: theme.colors.textMuted,
  },
});