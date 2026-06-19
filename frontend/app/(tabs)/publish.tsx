import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator,
  Modal, Image, Animated, Dimensions, Keyboard,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { theme } from '../../src/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';
import LocationPicker from '../../src/components/LocationPicker';
import { LinearGradient } from 'expo-linear-gradient';
import { CustomAlert } from '../../src/utils/CustomAlert';

const { width } = Dimensions.get('window');

const PROFILE_STEPS = ['personal', 'vehicle', 'preferences'] as const;
type ProfileStep = typeof PROFILE_STEPS[number];

export default function PublishScreen() {
  const router = useRouter();
  const authCtx = useAuth();
  const user = authCtx?.user ?? null;
  const authFetch = authCtx?.authFetch ?? (async () => ({}));
  const updateUser = authCtx?.updateUser ?? (() => { });

  const now = new Date();

  // Ride form state
  const [departure, setDeparture] = useState('');
  const [arrival, setArrival] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDateObj, setSelectedDateObj] = useState(now);
  const [timeDate, setTimeDate] = useState(now);
  const [time, setTime] = useState(
    `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
  );
  const [price, setPrice] = useState('');
  const [seats, setSeats] = useState(3);
  const [loading, setLoading] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [pickingLocationFor, setPickingLocationFor] = useState<'departure' | 'arrival' | null>(null);

  // Coordinates for estimation
  const [departureCords, setDepartureCords] = useState<{ lat: number; lon: number } | null>(null);
  const [arrivalCords, setArrivalCords] = useState<{ lat: number; lon: number } | null>(null);

  // Estimation results
  const [estimation, setEstimation] = useState<{ distanceKm: number; durationMin: number } | null>(null);
  const [estimationLoading, setEstimationLoading] = useState(false);

  // Ride Options state
  const [optLuggage, setOptLuggage] = useState(true);
  const [optAirCond, setOptAirCond] = useState(true);
  const [optCharge, setOptCharge] = useState(false);
  const [optPets, setOptPets] = useState(false);
  const [optStops, setOptStops] = useState(false);

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

  // Prefs state
  const [music, setMusic] = useState(true);
  const [smoking, setSmoking] = useState(false);
  const [chatty, setChatty] = useState(true);
  const [airCond, setAirCond] = useState(true);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;

  const [hasVehicle, setHasVehicle] = useState(false);
  const [checkingVehicle, setCheckingVehicle] = useState(true);
  const [showVehicleWarning, setShowVehicleWarning] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (user && user.is_verified) {
        checkVehicle();
      } else {
        setCheckingVehicle(false);
      }
    }, [user])
  );

  const checkVehicle = async () => {
    if (!user) return;
    try {
      const data = await authFetch(`/vehicles/?owner=${user.id}`);
      const results = Array.isArray(data) ? data : data.results || [];
      if (results.length > 0) {
        setHasVehicle(true);
      } else {
        setHasVehicle(false);
        setShowVehicleWarning(true);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setCheckingVehicle(false);
    }
  };

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
      toValue: 0.95,
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

  const haversineKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const computeEstimation = (
    depCords: { lat: number; lon: number },
    arrCords: { lat: number; lon: number }
  ) => {
    setEstimationLoading(true);
    const straightKm = haversineKm(depCords.lat, depCords.lon, arrCords.lat, arrCords.lon);
    const distanceKm = Math.round(straightKm * 1.25);
    const durationMin = Math.round((distanceKm / 70) * 60);
    setEstimation({ distanceKm, durationMin });
    setEstimationLoading(false);
  };

  const formatDuration = (totalMin: number): string => {
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    if (h === 0) return `${m} min`;
    if (m === 0) return `${h}h`;
    return `${h}h${m.toString().padStart(2, '0')}`;
  };

  const isProfileComplete = () => !!(user?.full_name && user.full_name.trim() !== '');

  const handlePublishPress = () => {
    Keyboard.dismiss();
    if (!isProfileComplete()) {
      setEditName(user?.full_name || '');
      setProfileStep('personal');
      setProfileModalVisible(true);
    } else if (!hasVehicle) {
      setShowVehicleWarning(true);
    } else {
      handlePublish();
    }
  };

  const handlePublish = async () => {
    if (!departure || !arrival || !time || !price) {
      CustomAlert.alert('Erreur', 'Veuillez remplir tous les champs obligatoires.');
      return;
    }
    if (departure === arrival) {
      CustomAlert.alert('Erreur', "Le lieu de départ et d'arrivée doivent être différents.");
      return;
    }

    setLoading(true);
    try {
      const dateString = selectedDateObj.toISOString().split('T')[0];

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

      CustomAlert.alert('Félicitations ! 🎉', `Votre trajet de ${departure} vers ${arrival} a été publié !`, [
        { text: 'Voir mes trajets', onPress: () => router.push('/(tabs)/home') }
      ]);

      setPrice('');
      setSeats(3);
    } catch (error: any) {
      CustomAlert.alert('Erreur', error.message || 'Impossible de publier le trajet.');
    } finally {
      setLoading(false);
    }
  };

  // --- Profile methods ... ---
  const pickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      CustomAlert.alert('Permission refusée', 'Autorisez l\'accès à vos photos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setAvatarUri(result.assets[0].uri);
    }
  };

  const handleSavePersonal = async () => {
    if (!editName.trim()) {
      CustomAlert.alert('Erreur', 'Le nom complet est obligatoire.');
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
      CustomAlert.alert('Erreur', e.message || 'Impossible de sauvegarder.');
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
        setHasVehicle(true);
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

  const getProfileProgress = () => {
    if (profileStep === 'personal') return 33;
    if (profileStep === 'vehicle') return 66;
    return 100;
  };

  const OptionCard = ({ label, icon, value, onChange }: any) => (
    <TouchableOpacity style={styles.optionCard} onPress={() => onChange(!value)} activeOpacity={0.8}>
      <Text style={styles.optionIcon}>{icon}</Text>
      <Text style={styles.optionLabel}>{label}</Text>
      {value ? (
        <Ionicons name="checkmark-circle" size={24} color={theme.colors.success} />
      ) : (
        <Ionicons name="ellipse-outline" size={24} color={theme.colors.border} />
      )}
    </TouchableOpacity>
  );

  const PrefCardModal = ({ label, value, onToggle, icon }: any) => (
    <TouchableOpacity
      style={[styles.prefCard, value && styles.prefCardActive]}
      onPress={onToggle}
      activeOpacity={0.8}
    >
      <Ionicons name={icon} size={28} color={value ? theme.colors.primary : theme.colors.textMuted} style={{ marginBottom: 12 }} />
      <Text style={[styles.prefCardLabel, value && styles.prefCardLabelActive]}>{label}</Text>
      <View style={[styles.prefBadge, value ? styles.prefBadgeActive : styles.prefBadgeInactive]}>
        <Ionicons name={value ? "checkmark" : "close"} size={12} color={value ? theme.colors.white : theme.colors.textMuted} />
      </View>
    </TouchableOpacity>
  );

  // --- Render checks ---
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

  if (!user.is_verified) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: theme.spacing.xl }]}>
        <Ionicons name="shield-checkmark-outline" size={80} color={theme.colors.textMuted} />
        <Text style={styles.notLoggedTitle}>Compte non vérifié</Text>
        <Text style={styles.notLoggedText}>Votre compte doit être vérifié pour proposer un trajet.</Text>
        <TouchableOpacity style={styles.notLoggedButton} onPress={() => router.push('/verify-identity')}>
          <LinearGradient colors={[theme.colors.primary, theme.colors.primaryDark]} style={styles.notLoggedGradient}>
            <Text style={styles.notLoggedButtonText}>Se faire vérifier</Text>
          </LinearGradient>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (checkingVehicle) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </SafeAreaView>
    );
  }

  const showEstimation = departure && arrival;
  const showSummary = departure && arrival && time && price;

  const currentStep = departure ? (arrival ? (price ? 3 : 2) : 1) : 0;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        
        {/* Modern Header Progress */}
        <View style={styles.headerProgress}>
          <Text style={styles.headerTitle}>Créer un trajet</Text>
          <View style={styles.progressDots}>
            <View style={[styles.dot, currentStep >= 0 && styles.dotActive]} />
            <View style={[styles.dot, currentStep >= 1 && styles.dotActive]} />
            <View style={[styles.dot, currentStep >= 2 && styles.dotActive]} />
            <View style={[styles.dot, currentStep >= 3 && styles.dotActive]} />
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

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

            {/* ITINERAIRE SECTION */}
            <Text style={styles.sectionTitle}>📍 Itinéraire</Text>
            
            <View style={styles.card}>
              <TouchableOpacity style={styles.locationCard} onPress={() => setPickingLocationFor('departure')} activeOpacity={0.7}>
                <Ionicons name="ellipse" color="#22C55E" size={16} />
                <View style={styles.locationContent}>
                  <Text style={styles.locationLabel}>Départ</Text>
                  <Text style={styles.locationValue}>{departure || "Choisir le lieu de départ"}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
              </TouchableOpacity>

              <View style={styles.dividerLine} />

              <TouchableOpacity style={styles.locationCard} onPress={() => setPickingLocationFor('arrival')} activeOpacity={0.7}>
                <Ionicons name="location" color="#EF4444" size={18} style={{ marginLeft: -1 }} />
                <View style={styles.locationContent}>
                  <Text style={styles.locationLabel}>Arrivée</Text>
                  <Text style={styles.locationValue}>{arrival || "Choisir la destination"}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            {/* Estimation */}
            {showEstimation && (
              <View style={styles.estimationRow}>
                {estimationLoading ? (
                  <ActivityIndicator size="small" color={theme.colors.primary} />
                ) : estimation ? (
                  <>
                    <Text style={styles.estText}>📏 {estimation.distanceKm.toLocaleString()} km</Text>
                    <Text style={styles.estText}>⏱ {formatDuration(estimation.durationMin)}</Text>
                  </>
                ) : null}
              </View>
            )}

            {/* DATE & HEURE SECTION */}
            <Text style={styles.sectionTitle}>📅 Date et Heure</Text>
            <View style={styles.row}>
              <TouchableOpacity style={styles.halfCard} onPress={() => setShowDatePicker(true)} activeOpacity={0.7}>
                <Text style={styles.halfCardLabel}>Date</Text>
                <Text style={styles.halfCardValue}>{selectedDateObj.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.halfCard} onPress={() => setShowTimePicker(true)} activeOpacity={0.7}>
                <Text style={styles.halfCardLabel}>Heure</Text>
                <Text style={styles.halfCardValue}>{time}</Text>
              </TouchableOpacity>
            </View>

            {showDatePicker && (
              <DateTimePicker
                value={selectedDateObj}
                mode="date"
                display="default"
                minimumDate={new Date()}
                onChange={(event, selectedDate) => {
                  setShowDatePicker(Platform.OS === 'ios');
                  if (event.type === 'set' && selectedDate) {
                    setShowDatePicker(false);
                    setSelectedDateObj(selectedDate);
                  } else if (event.type === 'dismissed') {
                    setShowDatePicker(false);
                  }
                }}
              />
            )}

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

            {/* PRIX SECTION */}
            <Text style={styles.sectionTitle}>💰 Prix par place</Text>
            <View style={styles.priceCard}>
              <TextInput
                style={styles.priceInput}
                placeholder="5 000"
                placeholderTextColor={theme.colors.textLight}
                value={price}
                onChangeText={setPrice}
                keyboardType="numeric"
                maxLength={6}
              />
              <Text style={styles.priceCurrency}>FCFA</Text>
            </View>

            {/* PLACES SECTION */}
            <Text style={styles.sectionTitle}>👥 Nombre de places</Text>
            <View style={styles.seatsContainer}>
              {[1, 2, 3, 4, 5, 6].map(num => (
                <TouchableOpacity
                  key={num}
                  style={[styles.seatBox, seats === num && styles.seatBoxActive]}
                  onPress={() => setSeats(num)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.seatBoxText, seats === num && styles.seatBoxTextActive]}>{num}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* OPTIONS SECTION */}
            <Text style={styles.sectionTitle}>⚙️ Services à bord</Text>
            <View style={styles.optionsList}>
              <OptionCard label="Bagages autorisés" icon="🧳" value={optLuggage} onChange={setOptLuggage} />
              <OptionCard label="Climatisation" icon="❄️" value={optAirCond} onChange={setOptAirCond} />
              <OptionCard label="Recharge téléphone" icon="🔌" value={optCharge} onChange={setOptCharge} />
              <OptionCard label="Animaux acceptés" icon="🐶" value={optPets} onChange={setOptPets} />
            </View>

            {/* SUMMARY SECTION */}
            {showSummary && (
              <View style={styles.summaryBox}>
                <Text style={styles.summaryTitle}>Aperçu de l'annonce</Text>
                
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryTextBold}>📍 {departure}</Text>
                  <Ionicons name="arrow-down" size={16} color={theme.colors.textMuted} />
                  <Text style={styles.summaryTextBold}>📍 {arrival}</Text>
                </View>

                <View style={styles.summaryGrid}>
                  <Text style={styles.summaryText}>📅 {selectedDateObj.toLocaleDateString('fr-FR')} • {time}</Text>
                  <Text style={styles.summaryText}>👥 {seats} place{seats > 1 ? 's' : ''}</Text>
                </View>
                
                <Text style={styles.summaryPrice}>💰 {parseInt(price).toLocaleString()} FCFA</Text>
              </View>
            )}

            {/* SUBMIT BUTTON */}
            <Animated.View style={{ transform: [{ scale: buttonScale }], marginTop: 16 }}>
              <TouchableOpacity
                style={[styles.publishBigBtn, loading && styles.publishBigBtnDisabled]}
                onPress={handlePublishPress}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                activeOpacity={0.9}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={theme.colors.white} size="small" />
                ) : (
                  <Text style={styles.publishBigBtnText}>🚗 Publier le trajet</Text>
                )}
              </TouchableOpacity>
            </Animated.View>

          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Profile Completion Modal */}
      <Modal visible={profileModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>

            <View style={styles.modalHeaderModern}>
              <Text style={styles.modalTitle}>Complétion du profil</Text>
            </View>

            <View style={styles.progressContainer}>
              <Text style={styles.progressLabel}>Étape {PROFILE_STEPS.indexOf(profileStep) + 1} sur 3 ({Math.round(getProfileProgress())}%)</Text>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${getProfileProgress()}%` }]} />
              </View>
            </View>

            {/* Step 1: Personal Info */}
            {profileStep === 'personal' && (
              <>
                <TouchableOpacity style={styles.avatarPicker} onPress={pickAvatar} activeOpacity={0.8}>
                  {avatarUri ? (
                    <View style={styles.avatarWrapper}>
                      <Image source={{ uri: avatarUri }} style={styles.avatar} />
                      <View style={styles.avatarBadge}>
                        <Ionicons name="camera" size={16} color={theme.colors.white} />
                      </View>
                    </View>
                  ) : (
                    <LinearGradient colors={[theme.colors.primaryLight, theme.colors.primary]} style={styles.avatarPlaceholder}>
                      <Ionicons name="camera" size={40} color={theme.colors.white} />
                      <Text style={styles.avatarPlaceholderText}>Ajouter une photo</Text>
                    </LinearGradient>
                  )}
                </TouchableOpacity>

                <View style={styles.inputWrapper}>
                  <Ionicons name="person-outline" size={20} color={theme.colors.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={styles.modalInputModern}
                    value={editName}
                    onChangeText={setEditName}
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
                  />
                </View>

                <TouchableOpacity style={styles.modalBtn} onPress={handleSavePersonal} disabled={isSavingProfile}>
                  <LinearGradient colors={[theme.colors.primary, '#3B82F6']} style={styles.modalBtnGradient}>
                    {isSavingProfile ? <ActivityIndicator color={theme.colors.white} /> : <Text style={styles.modalBtnText}>Continuer →</Text>}
                  </LinearGradient>
                </TouchableOpacity>
              </>
            )}

            {/* Step 2: Vehicle */}
            {profileStep === 'vehicle' && (
              <>
                <View style={styles.inputWrapper}>
                  <Ionicons name="car-outline" size={20} color={theme.colors.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={styles.modalInputModern}
                    value={brandModel}
                    onChangeText={setBrandModel}
                    placeholder="Marque et Modèle"
                    placeholderTextColor={theme.colors.textMuted}
                  />
                </View>

                <View style={styles.inputWrapper}>
                  <Ionicons name="color-palette-outline" size={20} color={theme.colors.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={styles.modalInputModern}
                    value={vehicleColor}
                    onChangeText={setVehicleColor}
                    placeholder="Couleur"
                    placeholderTextColor={theme.colors.textMuted}
                  />
                </View>

                <View style={styles.inputWrapper}>
                  <Ionicons name="pricetag-outline" size={20} color={theme.colors.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={styles.modalInputModern}
                    value={plate}
                    onChangeText={setPlate}
                    placeholder="Immatriculation"
                    placeholderTextColor={theme.colors.textMuted}
                    autoCapitalize="characters"
                  />
                </View>

                <View style={styles.modalBtnRow}>
                  <TouchableOpacity style={styles.modalBtnSkip} onPress={() => setProfileStep('preferences')}>
                    <Text style={styles.modalBtnSkipText}>Passer</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.modalBtn, { flex: 1 }]} onPress={handleSaveVehicle} disabled={isSavingProfile}>
                    <LinearGradient colors={[theme.colors.primary, '#3B82F6']} style={styles.modalBtnGradient}>
                      {isSavingProfile ? <ActivityIndicator color={theme.colors.white} /> : <Text style={styles.modalBtnText}>Continuer →</Text>}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* Step 3: Preferences */}
            {profileStep === 'preferences' && (
              <>
                <View style={styles.prefCardsContainer}>
                  <PrefCardModal icon="musical-notes" label="Musique" value={music} onToggle={() => setMusic(!music)} />
                  <PrefCardModal icon="chatbubbles" label="Bavard(e)" value={chatty} onToggle={() => setChatty(!chatty)} />
                  <PrefCardModal icon="logo-no-smoking" label="Fumeurs" value={smoking} onToggle={() => setSmoking(!smoking)} />
                  <PrefCardModal icon="snow" label="Climatisation" value={airCond} onToggle={() => setAirCond(!airCond)} />
                </View>

                <View style={styles.modalBtnRow}>
                  <TouchableOpacity style={styles.modalBtnSkip} onPress={() => { setProfileModalVisible(false); handlePublish(); }}>
                    <Text style={styles.modalBtnSkipText}>Passer</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.modalBtn, { flex: 1 }]} onPress={handleSavePrefs} disabled={isSavingProfile}>
                    <LinearGradient colors={[theme.colors.primary, '#3B82F6']} style={styles.modalBtnGradient}>
                      {isSavingProfile ? <ActivityIndicator color={theme.colors.white} /> : <Text style={styles.modalBtnText}>Terminer 🚀</Text>}
                    </LinearGradient>
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
            const cords = { lat: loc.latitude, lon: loc.longitude };
            if (pickingLocationFor === 'departure') {
              setDeparture(loc.name);
              setDepartureCords(cords);
              if (arrivalCords) computeEstimation(cords, arrivalCords);
            } else {
              setArrival(loc.name);
              setArrivalCords(cords);
              if (departureCords) computeEstimation(departureCords, cords);
            }
            setPickingLocationFor(null);
          }}
          onCancel={() => setPickingLocationFor(null)}
        />
      </Modal>

      {/* Vehicle Warning Modal */}
      <Modal visible={showVehicleWarning} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TouchableOpacity style={{ alignSelf: 'flex-end', padding: 8 }} onPress={() => setShowVehicleWarning(false)}>
              <Ionicons name="close" size={24} color={theme.colors.textMuted} />
            </TouchableOpacity>

            <View style={{ alignItems: 'center', padding: 16 }}>
              <Ionicons name="car-outline" size={60} color={theme.colors.primary} style={{ marginBottom: 16 }} />
              <Text style={styles.modalTitle}>Véhicule requis</Text>
              <Text style={[styles.notLoggedText, { textAlign: 'center', marginTop: 8 }]}>
                Vous devez enregistrer votre véhicule et votre permis de conduire dans votre profil avant de publier.
              </Text>

              <TouchableOpacity style={[styles.modalBtn, { marginTop: 24, width: '100%' }]} onPress={() => {
                setShowVehicleWarning(false);
                router.push('/(tabs)/profile');
              }}>
                <LinearGradient colors={[theme.colors.primary, '#3B82F6']} style={styles.modalBtnGradient}>
                  <Text style={styles.modalBtnText}>Aller au profil</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  scrollContent: { flexGrow: 1, paddingHorizontal: 16, paddingBottom: 40, paddingTop: 16 },

  headerProgress: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8, backgroundColor: '#F3F4F6' },
  headerTitle: { fontSize: 22, fontWeight: '800', color: theme.colors.text, marginBottom: 12 },
  progressDots: { flexDirection: 'row', gap: 8 },
  dot: { flex: 1, height: 6, borderRadius: 3, backgroundColor: '#E5E7EB' },
  dotActive: { backgroundColor: theme.colors.primary },

  profileWarning: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: theme.colors.warningLight, borderRadius: 12,
    padding: 12, marginBottom: 16,
    borderWidth: 1, borderColor: theme.colors.warning,
  },
  profileWarningText: { flex: 1, color: theme.colors.warningDark, fontWeight: '600', fontSize: 13 },

  sectionTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.text, marginTop: 16, marginBottom: 12 },

  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  locationCard: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  locationContent: { flex: 1, marginLeft: 12 },
  locationLabel: { fontSize: 13, color: theme.colors.textLight, marginBottom: 2 },
  locationValue: { fontSize: 16, fontWeight: '600', color: theme.colors.text },
  dividerLine: { height: 1, backgroundColor: '#F3F4F6', marginHorizontal: 40 },

  estimationRow: { flexDirection: 'row', gap: 16, paddingHorizontal: 8, marginTop: 8 },
  estText: { fontSize: 14, fontWeight: '600', color: theme.colors.textLight },

  row: { flexDirection: 'row', gap: 12 },
  halfCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  halfCardLabel: { fontSize: 13, color: theme.colors.textLight, marginBottom: 4 },
  halfCardValue: { fontSize: 16, fontWeight: '700', color: theme.colors.text },

  priceCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  priceInput: { fontSize: 32, fontWeight: '800', color: theme.colors.text, textAlign: 'center', minWidth: 120 },
  priceCurrency: { fontSize: 18, fontWeight: '700', color: theme.colors.textLight, marginLeft: 8 },

  seatsContainer: { flexDirection: 'row', justifyContent: 'space-between' },
  seatBox: { flex: 1, aspectRatio: 1, marginHorizontal: 4, backgroundColor: '#FFFFFF', borderRadius: 12, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  seatBoxActive: { backgroundColor: theme.colors.primary },
  seatBoxText: { fontSize: 18, fontWeight: '700', color: theme.colors.text },
  seatBoxTextActive: { color: theme.colors.white },

  optionsList: { gap: 8 },
  optionCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 16, borderRadius: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  optionIcon: { fontSize: 20, marginRight: 12 },
  optionLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: theme.colors.text },

  summaryBox: { backgroundColor: '#EFF6FF', borderRadius: 16, padding: 16, marginTop: 24, borderWidth: 1, borderColor: '#BFDBFE' },
  summaryTitle: { fontSize: 14, fontWeight: '700', color: theme.colors.primary, marginBottom: 12, textTransform: 'uppercase' },
  summaryRow: { flexDirection: 'column', gap: 4, marginBottom: 12 },
  summaryTextBold: { fontSize: 16, fontWeight: '700', color: theme.colors.text },
  summaryGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  summaryText: { fontSize: 14, fontWeight: '500', color: theme.colors.text },
  summaryPrice: { fontSize: 20, fontWeight: '800', color: theme.colors.primaryDark, textAlign: 'right' },

  publishBigBtn: { backgroundColor: theme.colors.primary, height: 62, borderRadius: 18, justifyContent: 'center', alignItems: 'center', shadowColor: theme.colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
  publishBigBtnDisabled: { opacity: 0.6 },
  publishBigBtnText: { fontSize: 18, fontWeight: '800', color: theme.colors.white },

  notLoggedTitle: { fontSize: 22, fontWeight: '800', color: theme.colors.text, marginTop: 16, marginBottom: 8, textAlign: 'center' },
  notLoggedText: { fontSize: 14, color: theme.colors.textLight, textAlign: 'center', marginBottom: 24 },
  notLoggedButton: { borderRadius: 12, overflow: 'hidden' },
  notLoggedGradient: { paddingHorizontal: 32, paddingVertical: 14, justifyContent: 'center', alignItems: 'center' },
  notLoggedButtonText: { color: theme.colors.white, fontWeight: 'bold', fontSize: 16 },

  // Modal styles
  modalOverlay: { flex: 1, backgroundColor: theme.colors.overlay, justifyContent: 'flex-end' },
  modalContent: { backgroundColor: theme.colors.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 36, maxHeight: '90%' },
  modalHeaderModern: { marginBottom: 20 },
  progressContainer: { marginBottom: 24 },
  progressLabel: { fontSize: 13, fontWeight: '700', color: theme.colors.textLight, marginBottom: 8, textAlign: 'right' },
  progressBar: { height: 8, backgroundColor: '#E5E7EB', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: theme.colors.primary, borderRadius: 4 },
  modalTitle: { fontSize: 22, fontWeight: '800', color: theme.colors.text },

  avatarPicker: { alignSelf: 'center', marginBottom: 24 },
  avatarWrapper: { position: 'relative' },
  avatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: theme.colors.white },
  avatarBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: theme.colors.primary, width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: theme.colors.white },
  avatarPlaceholder: { width: 100, height: 100, borderRadius: 50, justifyContent: 'center', alignItems: 'center' },
  avatarPlaceholderText: { fontSize: 11, color: theme.colors.white, fontWeight: '600', marginTop: 4 },

  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F7F8FA', borderRadius: 16, height: 56, paddingHorizontal: 16, marginBottom: 16 },
  inputIcon: { marginRight: 12 },
  modalInputModern: { flex: 1, fontSize: 15, color: theme.colors.text },

  modalBtn: { marginTop: 8, overflow: 'hidden', borderRadius: 16 },
  modalBtnGradient: { flexDirection: 'row', height: 56, justifyContent: 'center', alignItems: 'center', gap: 8 },
  modalBtnText: { fontSize: 16, fontWeight: '700', color: theme.colors.white },

  modalBtnRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  modalBtnSkip: { flex: 0.5, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F1F5F9' },
  modalBtnSkipText: { fontSize: 15, fontWeight: '600', color: theme.colors.textLight },

  prefCardsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', marginBottom: 20 },
  prefCard: { width: '48%', backgroundColor: '#F7F8FA', padding: 16, borderRadius: 16, alignItems: 'flex-start', borderWidth: 1, borderColor: 'transparent' },
  prefCardActive: { backgroundColor: `${theme.colors.primary}10`, borderColor: `${theme.colors.primary}30` },
  prefCardLabel: { fontSize: 14, fontWeight: '600', color: theme.colors.text, marginBottom: 8 },
  prefCardLabelActive: { color: theme.colors.primary },
  prefBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 4, borderRadius: 8 },
  prefBadgeInactive: { backgroundColor: '#E5E7EB' },
  prefBadgeActive: { backgroundColor: theme.colors.primary },
});