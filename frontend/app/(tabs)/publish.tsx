import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView,
  Alert, KeyboardAvoidingView, Platform, ActivityIndicator,
  Modal, Image, Switch, Animated, Dimensions, Keyboard,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { theme } from '../../src/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';
import LocationPicker from '../../src/components/LocationPicker';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

const BENIN_CITIES = ['Cotonou', 'Porto-Novo', 'Parakou', 'Bohicon', 'Abomey-Calavi', 'Ouidah', 'Natitingou', 'Djougou'];
const DATES = ["Aujourd'hui", 'Demain', 'Dans 2 jours', 'Autre'];
const PROFILE_STEPS = ['personal', 'vehicle', 'preferences'] as const;
type ProfileStep = typeof PROFILE_STEPS[number];

export default function PublishScreen() {
  const router = useRouter();
  const authCtx = useAuth();
  const user = authCtx?.user ?? null;
  const authFetch = authCtx?.authFetch ?? (async () => ({}));
  const updateUser = authCtx?.updateUser ?? (() => { });

  // Ride form state
  const [departure, setDeparture] = useState('');
  const [arrival, setArrival] = useState('');
  const [date, setDate] = useState("Aujourd'hui");
  const [time, setTime] = useState('');
  const [price, setPrice] = useState('');
  const [seats, setSeats] = useState(3);
  const [loading, setLoading] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [timeDate, setTimeDate] = useState(new Date());
  const [pickingLocationFor, setPickingLocationFor] = useState<'departure' | 'arrival' | null>(null);

  // Profile completion modal
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [profileStep, setProfileStep] = useState<ProfileStep>('personal');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Profile fields
  const [editName, setEditName] = useState(user?.full_name || '');
  const [editEmail, setEditEmail] = useState(user?.email || '');
  const [avatarUri, setAvatarUri] = useState<string | null>(user?.avatar || null);
  const [brandModel, setBrandModel] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');
  const [plate, setPlate] = useState('');
  const [music, setMusic] = useState(true);
  const [smoking, setSmoking] = useState(false);
  const [chatty, setChatty] = useState(true);
  const [airCond, setAirCond] = useState(true);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;

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

  const handlePressIn = () => {
    Animated.spring(buttonScale, {
      toValue: 0.97,
      friction: 5,
      tension: 100,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(buttonScale, {
      toValue: 1,
      friction: 5,
      tension: 100,
      useNativeDriver: true,
    }).start();
  };

  const isProfileComplete = () => !!(user?.full_name && user.full_name.trim() !== '');

  const handlePublishPress = () => {
    Keyboard.dismiss();
    if (!isProfileComplete()) {
      setEditName(user?.full_name || '');
      setProfileStep('personal');
      setProfileModalVisible(true);
    } else {
      handlePublish();
    }
  };

  const handlePublish = async () => {
    if (!departure || !arrival || !date || !time || !price) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs obligatoires.');
      return;
    }
    if (departure === arrival) {
      Alert.alert('Erreur', "Le lieu de départ et d'arrivée doivent être différents.");
      return;
    }

    setLoading(true);
    try {
      let dateString = new Date().toISOString().split('T')[0];
      if (date === 'Demain') {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        dateString = tomorrow.toISOString().split('T')[0];
      } else if (date === 'Dans 2 jours') {
        const d2 = new Date();
        d2.setDate(d2.getDate() + 2);
        dateString = d2.toISOString().split('T')[0];
      }

      await authFetch('/rides/', {
        method: 'POST',
        body: JSON.stringify({
          departure_location: departure,
          arrival_location: arrival,
          departure_date: dateString,
          departure_time: time + ':00',
          price_per_seat: parseInt(price),
          total_seats: seats,
          seats_available: seats,
          vehicle: null,
        }),
      });

      Alert.alert('Félicitations ! 🎉', `Votre trajet de ${departure} vers ${arrival} a été publié !`, [
        { text: 'Voir mes trajets', onPress: () => router.push('/(tabs)/home') }
      ]);

      setTime('');
      setPrice('');
      setSeats(3);
    } catch (error: any) {
      Alert.alert('Erreur', error.message || 'Impossible de publier le trajet.');
    } finally {
      setLoading(false);
    }
  };

  const pickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission refusée', 'Autorisez l\'accès à vos photos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) setAvatarUri(result.assets[0].uri);
  };

  const handleSavePersonal = async () => {
    if (!editName.trim()) {
      Alert.alert('Erreur', 'Le nom complet est obligatoire.');
      return;
    }
    setIsSavingProfile(true);
    try {
      const formData = new FormData();
      formData.append('full_name', editName);
      if (editEmail) formData.append('email', editEmail);

      if (avatarUri && avatarUri !== user?.avatar) {
        const filename = avatarUri.split('/').pop() || 'avatar.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : 'image/jpeg';
        formData.append('avatar', { uri: avatarUri, name: filename, type } as any);
      }

      await authFetch(`/users/${user!.id}/`, { method: 'PATCH', body: formData });
      updateUser({ full_name: editName, avatar: avatarUri, email: editEmail });
      setProfileStep('vehicle');
    } catch (e: any) {
      Alert.alert('Erreur', e.message || 'Impossible de sauvegarder.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSaveVehicle = async () => {
    if (brandModel.trim() && plate.trim()) {
      setIsSavingProfile(true);
      try {
        await authFetch('/vehicles/', {
          method: 'POST',
          body: JSON.stringify({
            brand_model: brandModel,
            color: vehicleColor,
            license_plate: plate,
            owner: user!.id
          }),
        });
      } catch (_) { }
      finally { setIsSavingProfile(false); }
    }
    setProfileStep('preferences');
  };

  const handleSavePrefs = async () => {
    setIsSavingProfile(true);
    try {
      await authFetch('/preferences/', {
        method: 'POST',
        body: JSON.stringify({
          user: user!.id, music, smoking, chatty, air_conditioner: airCond
        }),
      });
    } catch (_) { }
    finally { setIsSavingProfile(false); }
    setProfileModalVisible(false);
    handlePublish();
  };

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
        <Ionicons name="add-circle-outline" size={80} color={theme.colors.textMuted} />
        <Text style={styles.notLoggedTitle}>Publier un trajet</Text>
        <Text style={styles.notLoggedText}>Connectez-vous pour proposer un trajet.</Text>
        <TouchableOpacity style={styles.notLoggedButton} onPress={() => router.push('/(auth)/login')}>
          <LinearGradient colors={[theme.colors.primary, theme.colors.primaryDark]} style={styles.notLoggedGradient}>
            <Text style={styles.notLoggedButtonText}>Se connecter</Text>
          </LinearGradient>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>Publier un trajet 🚗</Text>
              <Text style={styles.subtitle}>Voyagez à travers le Bénin et partagez vos frais.</Text>
            </View>

            {/* Profile incomplete warning */}
            {!isProfileComplete() && (
              <TouchableOpacity
                style={styles.profileWarning}
                onPress={() => { setEditName(''); setProfileStep('personal'); setProfileModalVisible(true); }}
                activeOpacity={0.8}
              >
                <Ionicons name="alert-circle-outline" size={18} color={theme.colors.warningDark} />
                <Text style={styles.profileWarningText}>Complétez votre profil avant de publier</Text>
                <Ionicons name="chevron-forward" size={14} color={theme.colors.warningDark} />
              </TouchableOpacity>
            )}

            {/* Form */}
            <LinearGradient colors={['#FFFFFF', '#F8FAFC']} style={styles.form} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <Text style={styles.sectionLabel}>Itinéraire 📍</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Départ</Text>
                <TouchableOpacity
                  style={styles.locationButton}
                  onPress={() => setPickingLocationFor('departure')}
                  activeOpacity={0.7}
                >
                  <View style={[styles.locationIcon, { backgroundColor: `${theme.colors.primary}15` }]}>
                    <Ionicons name="location" size={22} color={theme.colors.primary} />
                  </View>
                  <Text style={departure ? styles.locationButtonText : styles.locationButtonPlaceholder}>
                    {departure || "Choisir le point de départ"}
                  </Text>
                  <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
                </TouchableOpacity>
              </View>

              <View style={styles.routeLineContainer}>
                <View style={styles.routeDotStart} />
                <View style={styles.routeLine} />
                <View style={styles.routeDotEnd} />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Arrivée</Text>
                <TouchableOpacity
                  style={styles.locationButton}
                  onPress={() => setPickingLocationFor('arrival')}
                  activeOpacity={0.7}
                >
                  <View style={[styles.locationIcon, { backgroundColor: `${theme.colors.secondary}15` }]}>
                    <Ionicons name="flag" size={22} color={theme.colors.secondary} />
                  </View>
                  <Text style={arrival ? styles.locationButtonText : styles.locationButtonPlaceholder}>
                    {arrival || "Choisir le point d'arrivée"}
                  </Text>
                  <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
                </TouchableOpacity>
              </View>

              <View style={styles.divider} />

              <Text style={styles.sectionLabel}>Date et Heure ⏰</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Date du trajet</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillsContainer}>
                  {DATES.map((item) => (
                    <TouchableOpacity
                      key={item}
                      style={[styles.pill, date === item && styles.pillSelected]}
                      onPress={() => setDate(item)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.pillText, date === item && styles.pillTextSelected]}>{item}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Heure de départ</Text>
                <TouchableOpacity style={styles.timeButton} onPress={() => setShowTimePicker(true)} activeOpacity={0.7}>
                  <Ionicons name="time-outline" size={20} color={theme.colors.primary} />
                  <Text style={time ? styles.timeText : styles.timePlaceholder}>
                    {time || "Choisir l'heure"}
                  </Text>
                </TouchableOpacity>
              </View>

              {showTimePicker && (
                <DateTimePicker
                  value={timeDate}
                  mode="time"
                  is24Hour={true}
                  display="default"
                  onChange={(event, selectedDate) => {
                    setShowTimePicker(Platform.OS === 'ios');
                    if (event.type === 'set' && selectedDate) {
                      setShowTimePicker(false);
                      setTimeDate(selectedDate);
                      const h = selectedDate.getHours().toString().padStart(2, '0');
                      const m = selectedDate.getMinutes().toString().padStart(2, '0');
                      setTime(`${h}:${m}`);
                    } else if (event.type === 'dismissed') {
                      setShowTimePicker(false);
                    }
                  }}
                />
              )}

              <View style={styles.divider} />

              <Text style={styles.sectionLabel}>Prix et Places 💰</Text>

              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Prix par place (FCFA)</Text>
                  <View style={styles.priceInput}>
                    <Ionicons name="cash-outline" size={20} color={theme.colors.primary} />
                    <TextInput
                      style={styles.priceField}
                      placeholder="5000"
                      placeholderTextColor={theme.colors.textMuted}
                      value={price}
                      onChangeText={setPrice}
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                <View style={[styles.inputGroup, { flex: 0.8 }]}>
                  <Text style={styles.label}>Places libres</Text>
                  <View style={styles.counter}>
                    <TouchableOpacity
                      style={styles.counterBtn}
                      onPress={() => seats > 1 && setSeats(seats - 1)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="remove" size={18} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.counterText}>{seats}</Text>
                    <TouchableOpacity
                      style={styles.counterBtn}
                      onPress={() => seats < 8 && setSeats(seats + 1)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="add" size={18} color="#fff" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
                <TouchableOpacity
                  style={[styles.publishBtn, loading && styles.publishBtnDisabled]}
                  onPress={handlePublishPress}
                  onPressIn={handlePressIn}
                  onPressOut={handlePressOut}
                  activeOpacity={0.9}
                  disabled={loading}
                >
                  <LinearGradient colors={[theme.colors.primary, theme.colors.primaryDark]} style={styles.publishGradient}>
                    {loading ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <>
                        <Ionicons name="send-outline" size={20} color="#fff" />
                        <Text style={styles.publishBtnText}>Publier mon annonce</Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>
            </LinearGradient>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Profile Completion Modal */}
      <Modal visible={profileModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Step indicator */}
            <View style={styles.stepIndicator}>
              {PROFILE_STEPS.map((step, i) => (
                <View key={step} style={styles.stepWrapper}>
                  <View style={[
                    styles.stepDot,
                    profileStep === step && styles.stepDotActive,
                    PROFILE_STEPS.indexOf(profileStep) > i && styles.stepDotDone
                  ]}>
                    {PROFILE_STEPS.indexOf(profileStep) > i ? (
                      <Ionicons name="checkmark" size={12} color="#fff" />
                    ) : (
                      <Text style={[styles.stepDotText, profileStep === step && { color: '#fff' }]}>{i + 1}</Text>
                    )}
                  </View>
                  {i < 2 && <View style={[styles.stepLine, PROFILE_STEPS.indexOf(profileStep) > i && styles.stepLineDone]} />}
                </View>
              ))}
            </View>

            {/* Step 1: Personal Info */}
            {profileStep === 'personal' && (
              <>
                <Text style={styles.modalTitle}>👤 Informations personnelles</Text>
                <Text style={styles.modalSubtitle}>Complétez votre profil pour publier un trajet.</Text>

                <TouchableOpacity style={styles.avatarPicker} onPress={pickAvatar} activeOpacity={0.8}>
                  {avatarUri ? (
                    <View style={styles.avatarWrapper}>
                      <Image source={{ uri: avatarUri }} style={styles.avatar} />
                      <View style={styles.avatarBadge}>
                        <Ionicons name="camera" size={16} color="#fff" />
                      </View>
                    </View>
                  ) : (
                    <LinearGradient colors={[theme.colors.primaryLight, theme.colors.primary]} style={styles.avatarPlaceholder}>
                      <Ionicons name="camera" size={40} color="#fff" />
                      <Text style={styles.avatarPlaceholderText}>Ajouter une photo</Text>
                    </LinearGradient>
                  )}
                </TouchableOpacity>

                <Text style={styles.modalLabel}>Nom complet *</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Ex: Jean Dupont"
                  placeholderTextColor={theme.colors.textMuted}
                />

                <Text style={styles.modalLabel}>Email (optionnel)</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editEmail}
                  onChangeText={setEditEmail}
                  placeholder="votre@email.com"
                  placeholderTextColor={theme.colors.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />

                <TouchableOpacity style={styles.modalBtn} onPress={handleSavePersonal} disabled={isSavingProfile}>
                  {isSavingProfile ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalBtnText}>Continuer →</Text>}
                </TouchableOpacity>
              </>
            )}

            {/* Step 2: Vehicle */}
            {profileStep === 'vehicle' && (
              <>
                <Text style={styles.modalTitle}>🚗 Mon véhicule</Text>
                <Text style={styles.modalSubtitle}>Ajoutez votre véhicule (optionnel).</Text>

                <Text style={styles.modalLabel}>Marque et modèle</Text>
                <TextInput
                  style={styles.modalInput}
                  value={brandModel}
                  onChangeText={setBrandModel}
                  placeholder="Ex: Toyota Corolla"
                  placeholderTextColor={theme.colors.textMuted}
                />

                <Text style={styles.modalLabel}>Couleur</Text>
                <TextInput
                  style={styles.modalInput}
                  value={vehicleColor}
                  onChangeText={setVehicleColor}
                  placeholder="Ex: Blanc"
                  placeholderTextColor={theme.colors.textMuted}
                />

                <Text style={styles.modalLabel}>Plaque d'immatriculation</Text>
                <TextInput
                  style={styles.modalInput}
                  value={plate}
                  onChangeText={setPlate}
                  placeholder="Ex: AB-1234-CD"
                  placeholderTextColor={theme.colors.textMuted}
                  autoCapitalize="characters"
                />

                <View style={styles.modalBtnRow}>
                  <TouchableOpacity style={styles.modalBtnSkip} onPress={() => setProfileStep('preferences')}>
                    <Text style={styles.modalBtnSkipText}>Passer</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.modalBtn, { flex: 1 }]} onPress={handleSaveVehicle} disabled={isSavingProfile}>
                    {isSavingProfile ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalBtnText}>Continuer →</Text>}
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* Step 3: Preferences */}
            {profileStep === 'preferences' && (
              <>
                <Text style={styles.modalTitle}>⚙️ Préférences de voyage</Text>
                <Text style={styles.modalSubtitle}>Dites-en plus aux passagers.</Text>

                <View style={styles.prefCard}>
                  <PrefRow label="🎵 Musique" value={music} onToggle={() => setMusic(!music)} />
                  <PrefRow label="🚬 Fumeurs acceptés" value={smoking} onToggle={() => setSmoking(!smoking)} />
                  <PrefRow label="💬 Bavard(e)" value={chatty} onToggle={() => setChatty(!chatty)} />
                  <PrefRow label="❄️ Climatisation" value={airCond} onToggle={() => setAirCond(!airCond)} />
                </View>

                <View style={styles.modalBtnRow}>
                  <TouchableOpacity style={styles.modalBtnSkip} onPress={() => { setProfileModalVisible(false); handlePublish(); }}>
                    <Text style={styles.modalBtnSkipText}>Passer</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.modalBtn, { flex: 1 }]} onPress={handleSavePrefs} disabled={isSavingProfile}>
                    {isSavingProfile ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalBtnText}>Terminer 🚀</Text>}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Location Picker Modal */}
      <Modal visible={pickingLocationFor !== null} animationType="slide">
        <LocationPicker
          title={pickingLocationFor === 'departure' ? 'Lieu de départ' : "Lieu d'arrivée"}
          onLocationSelected={(loc) => {
            if (pickingLocationFor === 'departure') setDeparture(loc.name);
            else setArrival(loc.name);
            setPickingLocationFor(null);
          }}
          onCancel={() => setPickingLocationFor(null)}
        />
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  scrollContent: { flexGrow: 1, paddingHorizontal: 16, paddingBottom: 32 },
  header: { marginVertical: 20 },
  title: { fontSize: 28, fontWeight: '800', color: '#1F2937', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#6B7280' },
  profileWarning: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FEF3C7', borderRadius: 12,
    padding: 12, marginBottom: 16,
    borderWidth: 1, borderColor: '#F59E0B',
  },
  profileWarningText: { flex: 1, color: '#B45309', fontWeight: '600', fontSize: 13 },
  form: {
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  sectionLabel: { fontSize: 16, fontWeight: '700', color: '#1F2937', marginBottom: 16 },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#6B7280', marginBottom: 8 },
  locationButton: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', padding: 12,
    borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB',
  },
  locationIcon: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  locationButtonText: { flex: 1, fontSize: 15, color: '#1F2937', fontWeight: '500' },
  locationButtonPlaceholder: { flex: 1, fontSize: 15, color: '#9CA3AF' },
  routeLineContainer: { alignItems: 'center', marginBottom: 8, marginLeft: 16 },
  routeDotStart: { width: 10, height: 10, borderRadius: 5, backgroundColor: theme.colors.primary },
  routeDotEnd: { width: 10, height: 10, borderRadius: 5, backgroundColor: theme.colors.secondary },
  routeLine: { width: 2, height: 24, backgroundColor: '#D1D5DB', marginVertical: 4 },
  divider: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 16 },
  pillsContainer: { gap: 8, paddingVertical: 4 },
  pill: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20,
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB',
  },
  pillSelected: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  pillText: { fontSize: 13, color: '#6B7280', fontWeight: '500' },
  pillTextSelected: { color: '#fff', fontWeight: '700' },
  timeButton: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', padding: 14,
    borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB',
  },
  timeText: { flex: 1, fontSize: 15, color: '#1F2937', fontWeight: '500' },
  timePlaceholder: { flex: 1, fontSize: 15, color: '#9CA3AF' },
  row: { flexDirection: 'row', gap: 12 },
  priceInput: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', paddingHorizontal: 14,
    borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', height: 50,
  },
  priceField: { flex: 1, fontSize: 15, color: '#1F2937' },
  counter: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', paddingHorizontal: 8,
    borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', height: 50,
  },
  counterBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: theme.colors.primary, justifyContent: 'center', alignItems: 'center' },
  counterText: { fontSize: 18, fontWeight: '700', color: '#1F2937', minWidth: 30, textAlign: 'center' },
  publishBtn: { marginTop: 24, overflow: 'hidden', borderRadius: 12 },
  publishBtnDisabled: { opacity: 0.6 },
  publishGradient: { flexDirection: 'row', height: 52, justifyContent: 'center', alignItems: 'center', gap: 8 },
  publishBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  notLoggedTitle: { fontSize: 22, fontWeight: '800', color: '#1F2937', marginTop: 16, marginBottom: 8, textAlign: 'center' },
  notLoggedText: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 24 },
  notLoggedButton: { borderRadius: 12, overflow: 'hidden' },
  notLoggedGradient: { paddingHorizontal: 32, paddingVertical: 14, justifyContent: 'center', alignItems: 'center' },
  notLoggedButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  // Modal styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: 36, maxHeight: '90%',
  },
  stepIndicator: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  stepWrapper: { flexDirection: 'row', alignItems: 'center' },
  stepDot: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F3F4F6', borderWidth: 2, borderColor: '#E5E7EB', justifyContent: 'center', alignItems: 'center' },
  stepDotActive: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary },
  stepDotDone: { borderColor: '#10B981', backgroundColor: '#10B981' },
  stepDotText: { fontSize: 14, fontWeight: '700', color: '#9CA3AF' },
  stepLine: { width: 40, height: 2, backgroundColor: '#E5E7EB' },
  stepLineDone: { backgroundColor: '#10B981' },
  modalTitle: { fontSize: 22, fontWeight: '800', color: '#1F2937', marginBottom: 4 },
  modalSubtitle: { fontSize: 14, color: '#6B7280', marginBottom: 20 },
  avatarPicker: { alignSelf: 'center', marginBottom: 24 },
  avatarWrapper: { position: 'relative' },
  avatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: '#fff' },
  avatarBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: theme.colors.primary, width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
  avatarPlaceholder: { width: 100, height: 100, borderRadius: 50, justifyContent: 'center', alignItems: 'center' },
  avatarPlaceholderText: { fontSize: 11, color: '#fff', fontWeight: '600', marginTop: 4 },
  modalLabel: { fontSize: 14, fontWeight: '600', color: '#6B7280', marginBottom: 8 },
  modalInput: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 14, fontSize: 15, marginBottom: 16, color: '#1F2937' },
  modalBtn: { backgroundColor: theme.colors.primary, height: 50, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  modalBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  modalBtnRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  modalBtnSkip: { height: 50, paddingHorizontal: 20, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  modalBtnSkipText: { fontSize: 15, fontWeight: '600', color: '#6B7280' },
  prefCard: { backgroundColor: '#F9FAFB', borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#E5E7EB' },
  prefRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  prefLabel: { fontSize: 15, color: '#1F2937' },
});