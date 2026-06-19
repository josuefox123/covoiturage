import React, { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import { useRouter } from 'expo-router';
import { theme } from '../../src/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { CustomAlert } from '../../src/utils/CustomAlert';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

const { width } = Dimensions.get('window');

export default function ProfileScreen() {
  const router = useRouter();
  const authCtx = useAuth();
  const user = authCtx?.user ?? null;
  const authFetch = authCtx?.authFetch ?? (async () => ({}));
  const logout = authCtx?.logout ?? (() => { });
  const updateUser = authCtx?.updateUser ?? (() => { });

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

  // Preferences state
  const [music, setMusic] = useState(true);
  const [smoking, setSmoking] = useState(false);
  const [chatty, setChatty] = useState(true);
  const [airCond, setAirCond] = useState(true);
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

  useEffect(() => {
    if (user) {
      setEditFullName(user.full_name || '');
      setEditPhone(user.phone || '');
      setEditEmail(user.email || '');
      setAvatarUri(user.avatar || null);
      fetchPreferences();
      fetchVehicle();
    }
  }, [user]);

  const fetchPreferences = async () => {
    try {
      const data = await authFetch('/preferences/');
      if (data && data.length > 0) {
        const pref = data[0];
        setMusic(pref.music ?? true);
        setSmoking(pref.smoking ?? false);
        setChatty(pref.chatty ?? true);
        setAirCond(pref.air_conditioner ?? true);
        setNotes(pref.notes || '');
      }
    } catch (e) {
      console.log('Erreur fetch preferences:', e);
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
      }
    } catch (e) {
      console.log('Erreur fetch vehicule:', e);
    }
  };

  const refreshUser = authCtx?.refreshUser ?? (async () => { });

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

  const handleSaveVehicle = async () => {
    if (!brand.trim() || !model.trim() || !color.trim() || !plate.trim()) {
      CustomAlert.alert('Erreur', 'Veuillez remplir tous les champs du véhicule.');
      return;
    }

    if (vehicleType === 'voiture' && !licenseExpiration.trim()) {
      CustomAlert.alert('Erreur', 'La date d\'expiration du permis est obligatoire pour les voitures.');
      return;
    }

    setIsSaving(true);
    const brand_model = `${brand.trim()} ${model.trim()}`;
    const payload = {
      brand_model,
      color,
      license_plate: plate,
      vehicle_type: vehicleType,
      driver_license_number: driverLicense || null,
      license_expiration: licenseExpiration || null
    };

    try {
      if (vehicleId) {
        await authFetch(`/vehicles/${vehicleId}/`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        CustomAlert.alert('Succès ✅', 'Véhicule mis à jour !');
      } else {
        const res = await authFetch('/vehicles/', {
          method: 'POST',
          body: JSON.stringify({ ...payload, owner: user!.id }),
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
      style={[styles.prefCard, value && styles.prefCardActive]}
      onPress={onToggle}
      activeOpacity={0.8}
    >
      <Ionicons name={icon} size={28} color={value ? theme.colors.primary : theme.colors.textMuted} style={{ marginBottom: 12 }} />
      <Text style={[styles.prefCardLabel, value && styles.prefCardLabelActive]}>{label}</Text>
      <View style={[styles.prefBadge, value ? styles.prefBadgeActive : styles.prefBadgeInactive]}>
        <Ionicons name={value ? "checkmark" : "close"} size={12} color={value ? theme.colors.white : theme.colors.textMuted} />
        <Text style={[styles.prefBadgeText, value ? styles.prefBadgeTextActive : styles.prefBadgeTextInactive]}>
          {value ? 'Activé' : 'Désactivé'}
        </Text>
      </View>
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

      {/* ========== MODAL: Informations personnelles ========== */}
      <Modal visible={infoModalVisible} animationType="slide" transparent onRequestClose={() => setInfoModalVisible(false)}>
          <Pressable style={styles.modalOverlay} onPress={() => setInfoModalVisible(false)}>
            <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Informations personnelles</Text>
                <TouchableOpacity onPress={() => setInfoModalVisible(false)}>
                  <Ionicons name="close" size={24} color={theme.colors.textMuted} />
                </TouchableOpacity>
              </View>

              <KeyboardAwareScrollView 
                showsVerticalScrollIndicator={false}
                enableOnAndroid={true}
                extraScrollHeight={Platform.OS === 'ios' ? 20 : 60}
                keyboardOpeningTime={0}
              >
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
                    placeholder="Votre email"
                    placeholderTextColor={theme.colors.textMuted}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    onBlur={handleEmailBlur}
                  />
                </View>
                {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}

                <View style={styles.inputWrapper}>
                  <Ionicons name="phone-portrait-outline" size={20} color={theme.colors.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={styles.modalInputModern}
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
              </KeyboardAwareScrollView>
            </Pressable>
          </Pressable>
      </Modal>

      {/* ========== MODAL: Mon Véhicule ========== */}
      <Modal visible={vehicleModalVisible} animationType="slide" transparent onRequestClose={() => setVehicleModalVisible(false)}>
          <Pressable style={styles.modalOverlay} onPress={() => setVehicleModalVisible(false)}>
            <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Mon véhicule</Text>
                <TouchableOpacity onPress={() => setVehicleModalVisible(false)}>
                  <Ionicons name="close" size={24} color={theme.colors.textMuted} />
                </TouchableOpacity>
              </View>

              <KeyboardAwareScrollView 
                showsVerticalScrollIndicator={false}
                enableOnAndroid={true}
                extraScrollHeight={Platform.OS === 'ios' ? 20 : 60}
                keyboardOpeningTime={0}
              >
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
                    placeholder="Couleur (ex: Blanc)"
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

                {vehicleType === 'voiture' && (
                  <>
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
                    <View style={styles.inputWrapper}>
                      <Ionicons name="calendar-outline" size={20} color={theme.colors.textMuted} style={styles.inputIcon} />
                      <TextInput
                        style={styles.modalInputModern}
                        value={licenseExpiration}
                        onChangeText={setLicenseExpiration}
                        placeholder="Date d'expiration (YYYY-MM-DD)"
                        placeholderTextColor={theme.colors.textMuted}
                      />
                    </View>
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
              </KeyboardAwareScrollView>
            </Pressable>
          </Pressable>
      </Modal>

      {/* ========== MODAL: Préférences ========== */}
      <Modal visible={prefsModalVisible} animationType="slide" transparent onRequestClose={() => setPrefsModalVisible(false)}>
          <Pressable style={styles.modalOverlay} onPress={() => setPrefsModalVisible(false)}>
            <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Préférences de voyage</Text>
                <TouchableOpacity onPress={() => setPrefsModalVisible(false)}>
                  <Ionicons name="close" size={24} color={theme.colors.textMuted} />
                </TouchableOpacity>
              </View>

              <KeyboardAwareScrollView 
                showsVerticalScrollIndicator={false}
                enableOnAndroid={true}
                extraScrollHeight={Platform.OS === 'ios' ? 20 : 60}
                keyboardOpeningTime={0}
              >

                <View style={styles.prefCardsContainer}>
                  <PrefCard icon="musical-notes" label="Musique" value={music} onToggle={() => setMusic(!music)} />
                  <PrefCard icon="chatbubbles" label="Bavard(e)" value={chatty} onToggle={() => setChatty(!chatty)} />
                  <PrefCard icon="logo-no-smoking" label="Fumeurs" value={smoking} onToggle={() => setSmoking(!smoking)} />
                  <PrefCard icon="snow" label="Climatisation" value={airCond} onToggle={() => setAirCond(!airCond)} />
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
              </KeyboardAwareScrollView>
            </Pressable>
          </Pressable>
      </Modal>
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
    backgroundColor: theme.colors.overlay,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: theme.colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: theme.spacing.xl,
    paddingBottom: 36,
    maxHeight: '90%',
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
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  prefCard: {
    width: '48%',
    backgroundColor: '#F7F8FA',
    padding: 16,
    borderRadius: 16,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  prefCardActive: {
    backgroundColor: `${theme.colors.primary}10`,
    borderColor: `${theme.colors.primary}30`,
  },
  prefCardLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 8,
  },
  prefCardLabelActive: {
    color: theme.colors.primary,
  },
  prefBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  prefBadgeInactive: {
    backgroundColor: '#E5E7EB',
  },
  prefBadgeActive: {
    backgroundColor: theme.colors.primary,
  },
  prefBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  prefBadgeTextInactive: {
    color: theme.colors.textMuted,
  },
  prefBadgeTextActive: {
    color: theme.colors.white,
  },
});