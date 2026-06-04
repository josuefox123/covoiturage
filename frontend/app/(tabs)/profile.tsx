import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  Image,
  Switch,
  RefreshControl,
  Dimensions,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { theme } from '../../src/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';
import type { User } from '../../src/context/AuthContext';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';

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
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [emailError, setEmailError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [editEmail, setEditEmail] = useState(user?.email || '');
  const [avatarUri, setAvatarUri] = useState<string | null>(user?.avatar || null);

  // Vehicle state
  const [brandModel, setBrandModel] = useState('');
  const [color, setColor] = useState('');
  const [plate, setPlate] = useState('');

  // Preferences state
  const [music, setMusic] = useState(true);
  const [smoking, setSmoking] = useState(false);
  const [chatty, setChatty] = useState(true);
  const [airCond, setAirCond] = useState(true);
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
        setBrandModel(vehicle.brand_model || '');
        setColor(vehicle.color || '');
        setPlate(vehicle.license_plate || '');
      }
    } catch (e) {
      console.log('Erreur fetch vehicule:', e);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchPreferences(), fetchVehicle()]);
    setRefreshing(false);
  }, []);

  const handleLogout = () => {
    Alert.alert(
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
      Alert.alert('Permission refusée', 'Vous devez autoriser l\'accès à vos photos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: false,
    });
    if (!result.canceled && result.assets[0]) {
      setAvatarUri(result.assets[0].uri);
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
    } catch (e) {
      // ignore network errors
    }
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
    } catch (e) {
      // ignore
    }
  };

  const handleSavePersonalInfo = async () => {
    if (!editFirstName.trim() || !editLastName.trim()) {
      Alert.alert('Erreur', 'Le prénom et le nom sont obligatoires.');
      return;
    }
    if (!editEmail.trim()) {
      Alert.alert('Erreur', 'L\'email est obligatoire.');
      return;
    }
    if (emailError || phoneError) {
      Alert.alert('Erreur', 'Corrigez les champs avant de sauvegarder.');
      return;
    }

    setIsSaving(true);
    try {
      const formData = new FormData();
      formData.append('first_name', editFirstName);
      formData.append('last_name', editLastName);
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
        full_name: `${editFirstName} ${editLastName}`,
        email: editEmail,
        phone: editPhone,
        avatar: avatarUri
      });

      Alert.alert('Succès ✅', 'Informations personnelles mises à jour !');
      setInfoModalVisible(false);
    } catch (e: any) {
      Alert.alert('Erreur', e.message || 'Impossible de mettre à jour.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveVehicle = async () => {
    if (!brandModel.trim() || !color.trim() || !plate.trim()) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs du véhicule.');
      return;
    }

    setIsSaving(true);
    try {
      if (vehicleId) {
        await authFetch(`/vehicles/${vehicleId}/`, {
          method: 'PATCH',
          body: JSON.stringify({ brand_model: brandModel, color, license_plate: plate }),
        });
        Alert.alert('Succès ✅', 'Véhicule mis à jour !');
      } else {
        const res = await authFetch('/vehicles/', {
          method: 'POST',
          body: JSON.stringify({ brand_model: brandModel, color, license_plate: plate, owner: user!.id }),
        });
        if (res && res.id) setVehicleId(res.id);
        Alert.alert('Succès ✅', 'Véhicule ajouté !');
      }
      setVehicleModalVisible(false);
    } catch (e: any) {
      Alert.alert('Erreur', e.message || 'Impossible d\'ajouter le véhicule.');
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
          air_conditioner: airCond
        }),
      });
      Alert.alert('Succès ✅', 'Préférences sauvegardées !');
      setPrefsModalVisible(false);
    } catch (e: any) {
      Alert.alert('Erreur', e.message || 'Impossible de sauvegarder les préférences.');
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

  const PrefRow = ({ label, value, onToggle }: { label: string; value: boolean; onToggle: () => void }) => (
    <View style={styles.prefRow}>
      <Text style={styles.prefLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
        thumbColor="#fff"
      />
    </View>
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

  const fullNameParts = (user.full_name || '').split(' ');
  const firstName = fullNameParts[0] || '';
  const lastName = fullNameParts.slice(1).join(' ') || '';

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
          colors={['#FFFFFF', '#F8FAFC']}
          style={styles.profileHeaderCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.profileMain}>
            <TouchableOpacity onPress={pickAvatar} style={styles.avatarWrapperSmall} activeOpacity={0.8}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarBig} />
              ) : (
                <LinearGradient colors={[theme.colors.primaryLight, theme.colors.primary]} style={styles.avatarBig}>
                  <Text style={styles.avatarBigText}>{initials}</Text>
                </LinearGradient>
              )}
              <View style={styles.avatarEditBadge}>
                <Ionicons name="camera" size={14} color="#fff" />
              </View>
            </TouchableOpacity>

            <View style={styles.profileText}>
              <Text style={styles.profileName}>{user.full_name || 'Profil incomplet'}</Text>
              <Text style={styles.profilePhone}>{user.phone || 'Numéro non renseigné'}</Text>
              <View style={[styles.verifiedBadge, { backgroundColor: user.is_verified ? '#10B981' : '#F59E0B' }]}>
                <Ionicons name={user.is_verified ? "checkmark-circle" : "time"} size={12} color="#fff" />
                <Text style={styles.verifiedText}>{user.is_verified ? "Identité vérifiée" : "Non vérifié"}</Text>
              </View>
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
              <Text style={styles.statNumber}>{user.rating?.toFixed(1) || '0.0'}</Text>
              <View style={styles.ratingInline}>
                <Ionicons name="star" size={12} color="#F59E0B" />
                <Text style={styles.statLabel}> Note</Text>
              </View>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCol}>
              <Text style={styles.statNumber}>0</Text>
              <Text style={styles.statLabel}>FCFA Économisés</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Profile completeness banner */}
        {(!user.full_name || !user.phone) && (
          <TouchableOpacity
            style={styles.completionBanner}
            onPress={() => {
              setEditFirstName(firstName);
              setEditLastName(lastName);
              setEditEmail(user.email || '');
              setEditPhone(user.phone || '');
              setInfoModalVisible(true);
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="alert-circle" size={20} color="#fff" />
            <Text style={styles.completionText}>Complétez votre profil pour publier un trajet</Text>
            <Ionicons name="chevron-forward" size={16} color="#fff" />
          </TouchableOpacity>
        )}

        {/* Paramètres du compte */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Paramètres du compte</Text>
          <View style={styles.menuCard}>
            <MenuItem
              icon="person-outline"
              title="Informations personnelles"
              subtitle={user.full_name || '⚠️ À remplir'}
              onPress={() => {
                setEditFirstName(firstName);
                setEditLastName(lastName);
                setEditEmail(user.email || '');
                setEditPhone(user.phone || '');
                setInfoModalVisible(true);
              }}
            />
            <View style={styles.menuDivider} />
            <MenuItem
              icon="car-outline"
              title="Mon véhicule"
              subtitle={vehicleId ? `${brandModel} - ${plate}` : 'Ajouter un véhicule'}
              onPress={() => setVehicleModalVisible(true)}
            />
            <View style={styles.menuDivider} />
            <MenuItem
              icon="shield-checkmark-outline"
              title="Vérification d'identité"
              subtitle={user.is_verified ? "Identité vérifiée ✅" : "Non vérifié — À compléter"}
              onPress={() => Alert.alert('Vérification', 'Fonctionnalité disponible prochainement.')}
            />
          </View>
        </View>

        {/* Préférences & Sécurité */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Préférences & Sécurité</Text>
          <View style={styles.menuCard}>
            <MenuItem
              icon="options-outline"
              title="Préférences de voyage"
              subtitle="Musique, discussions, bagages..."
              onPress={() => setPrefsModalVisible(true)}
            />
            <View style={styles.menuDivider} />
            <MenuItem
              icon="notifications-outline"
              title="Notifications"
              subtitle="Gérez vos alertes"
              onPress={() => Alert.alert('Notifications', 'Fonctionnalité disponible prochainement.')}
            />
            <View style={styles.menuDivider} />
            <MenuItem
              icon="lock-closed-outline"
              title="Confidentialité"
              subtitle="Gérez vos données personnelles"
              onPress={() => Alert.alert('Confidentialité', 'Fonctionnalité disponible prochainement.')}
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
              onPress={() => Alert.alert('Centre d\'aide', 'Fonctionnalité disponible prochainement.')}
            />
            <View style={styles.menuDivider} />
            <MenuItem
              icon="document-text-outline"
              title="Conditions d'utilisation"
              onPress={() => Alert.alert('Conditions', 'Fonctionnalité disponible prochainement.')}
            />
            <View style={styles.menuDivider} />
            <MenuItem
              icon="mail-outline"
              title="Nous contacter"
              subtitle="support@covoiturage.bj"
              onPress={() => Alert.alert('Contact', 'support@covoiturage.bj')}
            />
          </View>
        </View>

        {/* Déconnexion */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={20} color={theme.colors.error} />
          <Text style={styles.logoutBtnText}>Se déconnecter</Text>
        </TouchableOpacity>

        {/* Version */}
        <Text style={styles.versionText}>Version 1.0.0</Text>
      </Animated.ScrollView>

      {/* ========== MODAL: Informations personnelles ========== */}
      <Modal visible={infoModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Informations personnelles</Text>
              <TouchableOpacity onPress={() => setInfoModalVisible(false)}>
                <Ionicons name="close" size={24} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <TouchableOpacity style={styles.modernAvatarPicker} onPress={pickAvatar} activeOpacity={0.8}>
                {avatarUri ? (
                  <View style={styles.avatarWrapper}>
                    <Image source={{ uri: avatarUri }} style={styles.modernAvatar} />
                    <View style={styles.modernAvatarEditBadge}>
                      <Ionicons name="camera" size={16} color="#fff" />
                    </View>
                  </View>
                ) : (
                  <LinearGradient colors={[theme.colors.primaryLight, theme.colors.primary]} style={styles.modernAvatarPlaceholder}>
                    <Ionicons name="camera" size={40} color="#fff" />
                    <Text style={styles.modernAvatarText}>Ajouter une photo</Text>
                  </LinearGradient>
                )}
              </TouchableOpacity>

              <Text style={styles.modalLabel}>Prénom *</Text>
              <TextInput
                style={styles.modalInput}
                value={editFirstName}
                onChangeText={setEditFirstName}
                placeholder="Votre prénom"
                placeholderTextColor={theme.colors.textMuted}
              />

              <Text style={styles.modalLabel}>Nom *</Text>
              <TextInput
                style={styles.modalInput}
                value={editLastName}
                onChangeText={setEditLastName}
                placeholder="Votre nom"
                placeholderTextColor={theme.colors.textMuted}
              />

              <Text style={styles.modalLabel}>Email *</Text>
              <TextInput
                style={styles.modalInput}
                value={editEmail}
                onChangeText={setEditEmail}
                placeholder="votre@email.com"
                placeholderTextColor={theme.colors.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                onBlur={handleEmailBlur}
              />
              {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}

              <Text style={styles.modalLabel}>Téléphone *</Text>
              <TextInput
                style={styles.modalInput}
                value={editPhone}
                onChangeText={setEditPhone}
                placeholder="+229 XX XX XX XX"
                placeholderTextColor={theme.colors.textMuted}
                keyboardType="phone-pad"
                onBlur={handlePhoneBlur}
              />
              {phoneError ? <Text style={styles.errorText}>{phoneError}</Text> : null}

              <TouchableOpacity style={styles.modalBtnSave} onPress={handleSavePersonalInfo} disabled={isSaving}>
                {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalBtnSaveText}>Enregistrer</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ========== MODAL: Véhicule ========== */}
      <Modal visible={vehicleModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Mon véhicule</Text>
              <TouchableOpacity onPress={() => setVehicleModalVisible(false)}>
                <Ionicons name="close" size={24} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.vehicleIconContainer}>
                <LinearGradient colors={[theme.colors.primaryLight, theme.colors.primary]} style={styles.vehicleIcon}>
                  <Ionicons name="car-outline" size={48} color="#fff" />
                </LinearGradient>
              </View>

              <Text style={styles.modalLabel}>Marque et modèle *</Text>
              <TextInput
                style={styles.modalInput}
                value={brandModel}
                onChangeText={setBrandModel}
                placeholder="Ex: Toyota Corolla"
                placeholderTextColor={theme.colors.textMuted}
              />

              <Text style={styles.modalLabel}>Couleur *</Text>
              <TextInput
                style={styles.modalInput}
                value={color}
                onChangeText={setColor}
                placeholder="Ex: Blanc, Noir, Rouge"
                placeholderTextColor={theme.colors.textMuted}
              />

              <Text style={styles.modalLabel}>Plaque d'immatriculation *</Text>
              <TextInput
                style={styles.modalInput}
                value={plate}
                onChangeText={setPlate}
                placeholder="Ex: AB-1234-CD"
                placeholderTextColor={theme.colors.textMuted}
                autoCapitalize="characters"
              />

              <TouchableOpacity style={styles.modalBtnSave} onPress={handleSaveVehicle} disabled={isSaving}>
                {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalBtnSaveText}>{vehicleId ? 'Mettre à jour' : 'Ajouter le véhicule'}</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ========== MODAL: Préférences ========== */}
      <Modal visible={prefsModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Préférences de voyage</Text>
              <TouchableOpacity onPress={() => setPrefsModalVisible(false)}>
                <Ionicons name="close" size={24} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <PrefRow label="🎵 Musique" value={music} onToggle={() => setMusic(!music)} />
              <View style={styles.prefDivider} />
              <PrefRow label="🚬 Fumeurs acceptés" value={smoking} onToggle={() => setSmoking(!smoking)} />
              <View style={styles.prefDivider} />
              <PrefRow label="💬 Bavard(e)" value={chatty} onToggle={() => setChatty(!chatty)} />
              <View style={styles.prefDivider} />
              <PrefRow label="❄️ Climatisation" value={airCond} onToggle={() => setAirCond(!airCond)} />

              <TouchableOpacity style={[styles.modalBtnSave, { marginTop: 24 }]} onPress={handleSavePreferences} disabled={isSaving}>
                {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalBtnSaveText}>Sauvegarder</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  scrollContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
  profileHeaderCard: {
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    marginBottom: theme.spacing.md,
    shadowColor: '#000',
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
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarBigText: { color: '#fff', fontSize: 28, fontWeight: '800' },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  profileText: { flex: 1 },
  profileName: { fontSize: 20, fontWeight: '800', color: theme.colors.text, marginBottom: 2 },
  profilePhone: { fontSize: 13, color: theme.colors.textLight, marginBottom: 6 },
  verifiedBadge: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 12,
    alignSelf: 'flex-start', gap: 4,
  },
  verifiedText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  statsRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: theme.spacing.md,
  },
  statCol: { alignItems: 'center', flex: 1 },
  statNumber: { fontSize: 20, fontWeight: '800', color: theme.colors.text },
  statLabel: { fontSize: 11, color: theme.colors.textLight, fontWeight: '500', marginTop: 2 },
  ratingInline: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  statDivider: { width: 1, height: 30, backgroundColor: '#E2E8F0' },
  completionBanner: {
    backgroundColor: '#F59E0B',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    gap: 8,
  },
  completionText: { flex: 1, color: '#fff', fontWeight: '600', fontSize: 13 },
  section: { marginBottom: theme.spacing.lg },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
    paddingLeft: 4,
  },
  menuCard: {
    backgroundColor: '#fff',
    borderRadius: theme.borderRadius.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row', alignItems: 'center',
    padding: theme.spacing.md,
    backgroundColor: '#fff',
  },
  menuIconContainer: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
    marginRight: theme.spacing.md
  },
  menuTextContainer: { flex: 1 },
  menuTitle: { fontSize: 15, fontWeight: '600', color: theme.colors.text },
  menuSubtitle: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  menuDivider: { height: 1, backgroundColor: '#E2E8F0', marginHorizontal: theme.spacing.md },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: '#FEE2E2', height: 52,
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
    color: '#fff',
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
    backgroundColor: '#fff',
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
    borderColor: '#fff',
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
    borderColor: '#fff',
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
    color: '#fff',
    fontWeight: '600',
    marginTop: 4,
  },
  vehicleIconContainer: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  vehicleIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textLight,
    marginBottom: 8,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: theme.borderRadius.md,
    padding: 14,
    fontSize: 15,
    marginBottom: theme.spacing.md,
    color: theme.colors.text,
  },
  modalBtnSave: {
    backgroundColor: theme.colors.primary,
    height: 52,
    borderRadius: theme.borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: theme.spacing.sm,
  },
  modalBtnSaveText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  errorText: {
    color: theme.colors.error,
    fontSize: 12,
    marginBottom: theme.spacing.sm,
    marginTop: -8,
  },
  prefRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  prefLabel: {
    fontSize: 15,
    color: theme.colors.text,
  },
  prefDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
  },
});