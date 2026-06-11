import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator,
  Modal, Image, Animated, Dimensions, Keyboard,
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

  // Ride form state
  const [departure, setDeparture] = useState('');
  const [arrival, setArrival] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDateObj, setSelectedDateObj] = useState(new Date());
  const [time, setTime] = useState('');
  const [price, setPrice] = useState('');
  const [seats, setSeats] = useState(3);
  const [loading, setLoading] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [timeDate, setTimeDate] = useState(new Date());
  const [pickingLocationFor, setPickingLocationFor] = useState<'departure' | 'arrival' | null>(null);

  // Coordinates for estimation
  const [departureCords, setDepartureCords] = useState<{ lat: number; lon: number } | null>(null);
  const [arrivalCords, setArrivalCords] = useState<{ lat: number; lon: number } | null>(null);

  // Estimation results
  const [estimation, setEstimation] = useState<{ distanceKm: number; durationMin: number; fuelCostFcfa: number } | null>(null);
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

  // ─── Route estimation helpers ──────────────────────────────────────────────
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
    // Use a road-distance factor of 1.25 over straight-line distance
    const straightKm = haversineKm(depCords.lat, depCords.lon, arrCords.lat, arrCords.lon);
    const distanceKm = Math.round(straightKm * 1.25);
    // Average speed 70 km/h on Beninese roads
    const durationMin = Math.round((distanceKm / 70) * 60);
    // Fuel: 7 L/100 km, price 700 FCFA/L
    const fuelCostFcfa = Math.round((distanceKm / 100) * 7 * 700);
    setEstimation({ distanceKm, durationMin, fuelCostFcfa });
    setEstimationLoading(false);
  };

  const formatDuration = (totalMin: number): string => {
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    if (h === 0) return `${m} min`;
    if (m === 0) return `${h}h`;
    return `${h}h${m.toString().padStart(2, '0')}`;
  };

  const getSuggestedPrice = (): string => {
    if (!estimation) return '4 000 - 6 000 FCFA';
    // Base: 15 FCFA/km, range ±20%
    const base = Math.round(estimation.distanceKm * 15);
    const low = Math.round(base * 0.8 / 500) * 500;
    const high = Math.round(base * 1.2 / 500) * 500;
    return `${low.toLocaleString()} - ${high.toLocaleString()} FCFA`;
  };
  // ────────────────────────────────────────────────────────────────────────────

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

      setTime('');
      setPrice('');
      setSeats(3);
    } catch (error: any) {
      CustomAlert.alert('Erreur', error.message || 'Impossible de publier le trajet.');
    } finally {
      setLoading(false);
    }
  };

  const pickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      CustomAlert.alert('Permission refusée', 'Autorisez l\'accès à vos photos.');
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

  const OptionCheckbox = ({ label, value, onChange }: any) => (
    <TouchableOpacity style={styles.optionCheckbox} onPress={() => onChange(!value)} activeOpacity={0.8}>
      <Ionicons name={value ? "checkbox" : "square-outline"} size={24} color={value ? theme.colors.primary : theme.colors.textMuted} />
      <Text style={styles.optionCheckboxLabel}>{label}</Text>
    </TouchableOpacity>
  );

  const PrefCard = ({ label, value, onToggle, icon }: any) => (
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

  const getProfileProgress = () => {
    if (profileStep === 'personal') return 33;
    if (profileStep === 'vehicle') return 66;
    return 100;
  };

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
      </SafeAreaView>
    );
  }

  const showEstimation = departure && arrival;
  const showSummary = departure && arrival && time && price;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
            
            {/* Driver Profile Recap Card */}
            <View style={styles.driverRecapCard}>
              <View style={styles.driverInfoRow}>
                {user.avatar ? (
                  <Image source={{ uri: user.avatar }} style={styles.driverAvatar} />
                ) : (
                  <LinearGradient colors={[theme.colors.primaryLight, theme.colors.primary]} style={styles.driverAvatarPlaceholder}>
                    <Text style={styles.driverAvatarInitials}>{user.full_name?.charAt(0) || '?'}</Text>
                  </LinearGradient>
                )}
                <View style={styles.driverDetails}>
                  <Text style={styles.driverName}>{user.full_name || 'Complétez votre profil'}</Text>
                  <View style={styles.driverBadgesRow}>
                    <View style={styles.driverBadgeRating}>
                      <Ionicons name="star" size={12} color="#F59E0B" />
                      <Text style={styles.driverBadgeRatingText}>{user.rating?.toFixed(1) || '4.8'}</Text>
                    </View>
                    <View style={styles.driverBadgeVerified}>
                      <Ionicons name="checkmark-circle" size={12} color="#10B981" />
                      <Text style={styles.driverBadgeVerifiedText}>Vérifié</Text>
                    </View>
                  </View>
                </View>
              </View>
              <View style={styles.driverVehicleRow}>
                <Ionicons name="car" size={16} color={theme.colors.textLight} />
                <Text style={styles.driverVehicleText}>Toyota Corolla</Text>
              </View>
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
            <LinearGradient colors={[theme.colors.white, theme.colors.background]} style={styles.form} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              
              <Text style={styles.sectionLabel}>Itinéraire 📍</Text>
              
              <View style={styles.timelineContainer}>
                <View style={styles.timelineGraphic}>
                  <View style={[styles.timelineDot, { backgroundColor: '#10B981', borderWidth: 3, borderColor: '#A7F3D0' }]} />
                  <View style={styles.timelineLine} />
                  <View style={[styles.timelineDot, { backgroundColor: '#EF4444', borderWidth: 3, borderColor: '#FECACA' }]} />
                </View>
                
                <View style={styles.timelineContent}>
                  <TouchableOpacity
                    style={styles.locationButtonModern}
                    onPress={() => setPickingLocationFor('departure')}
                    activeOpacity={0.7}
                  >
                    <Text style={departure ? styles.locationButtonText : styles.locationButtonPlaceholder}>
                      {departure || "Lieu de départ (ex: Cotonou)"}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.locationButtonModern}
                    onPress={() => setPickingLocationFor('arrival')}
                    activeOpacity={0.7}
                  >
                    <Text style={arrival ? styles.locationButtonText : styles.locationButtonPlaceholder}>
                      {arrival || "Lieu d'arrivée (ex: Parakou)"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Estimation */}
              {showEstimation && (
                <View style={styles.estimationCard}>
                  {estimationLoading ? (
                    <ActivityIndicator size="small" color="#0369A1" style={{ flex: 1 }} />
                  ) : estimation ? (
                    <>
                      <View style={styles.estItem}>
                        <Text style={styles.estIcon}>📏</Text>
                        <Text style={styles.estText}>{estimation.distanceKm.toLocaleString()} km</Text>
                      </View>
                      <View style={styles.estItem}>
                        <Text style={styles.estIcon}>⏱</Text>
                        <Text style={styles.estText}>{formatDuration(estimation.durationMin)}</Text>
                      </View>
                      <View style={styles.estItem}>
                        <Text style={styles.estIcon}>⛽</Text>
                        <Text style={styles.estText}>{estimation.fuelCostFcfa.toLocaleString()} FCFA</Text>
                      </View>
                    </>
                  ) : (
                    <Text style={[styles.estText, { opacity: 0.5 }]}>Calcul en cours…</Text>
                  )}
                </View>
              )}

              <View style={styles.divider} />

              <Text style={styles.sectionLabel}>Date et Heure ⏰</Text>

              <View style={styles.row}>
                <TouchableOpacity style={[styles.timeButtonModern, { flex: 1 }]} onPress={() => setShowDatePicker(true)} activeOpacity={0.7}>
                  <Ionicons name="calendar" size={20} color={theme.colors.primary} style={{ marginRight: 8 }} />
                  <Text style={styles.timeText}>
                    {selectedDateObj.toLocaleDateString('fr-FR')}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.timeButtonModern, { flex: 0.8 }]} onPress={() => setShowTimePicker(true)} activeOpacity={0.7}>
                  <Ionicons name="time" size={20} color={theme.colors.primary} style={{ marginRight: 8 }} />
                  <Text style={time ? styles.timeText : styles.timePlaceholder}>
                    {time || "10:00"}
                  </Text>
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

              <View style={styles.divider} />

              <Text style={styles.sectionLabel}>Prix et Places 💰</Text>

              {showEstimation && (
                <View style={styles.suggestedPriceBox}>
                  <Ionicons name="information-circle" size={16} color={theme.colors.primary} />
                  <Text style={styles.suggestedPriceText}>Prix conseillé : {getSuggestedPrice()}</Text>
                </View>
              )}

              <View style={styles.priceInputModern}>
                <Ionicons name="cash" size={24} color={theme.colors.textMuted} />
                <TextInput
                  style={styles.priceFieldModern}
                  placeholder="5000"
                  placeholderTextColor={theme.colors.textMuted}
                  value={price}
                  onChangeText={setPrice}
                  keyboardType="numeric"
                />
                <Text style={styles.priceCurrency}>FCFA</Text>
              </View>

              <Text style={[styles.sectionLabel, { marginTop: 16 }]}>Places libres 👥</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.seatChipsContainer}>
                {[1, 2, 3, 4, 5, 6].map(num => (
                  <TouchableOpacity
                    key={num}
                    style={[styles.seatChip, seats === num && styles.seatChipActive]}
                    onPress={() => setSeats(num)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.seatChipText, seats === num && styles.seatChipTextActive]}>{num} place{num > 1 ? 's' : ''}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <View style={styles.divider} />
              
              <Text style={styles.sectionLabel}>Options du trajet ⚙️</Text>
              <View style={styles.optionsContainer}>
                <OptionCheckbox label="Bagages autorisés" value={optLuggage} onChange={setOptLuggage} />
                <OptionCheckbox label="Climatisation" value={optAirCond} onChange={setOptAirCond} />
                <OptionCheckbox label="Recharge téléphone" value={optCharge} onChange={setOptCharge} />
                <OptionCheckbox label="Animaux acceptés" value={optPets} onChange={setOptPets} />
                <OptionCheckbox label="Arrêts intermédiaires" value={optStops} onChange={setOptStops} />
              </View>

              {/* Summary Card */}
              {showSummary && (
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryCardTitle}>Aperçu de l'annonce</Text>
                  <View style={styles.summaryRoute}>
                    <Text style={styles.summaryRouteText}>📍 {departure}</Text>
                    <Ionicons name="arrow-down" size={16} color={theme.colors.textMuted} style={{ marginVertical: 4, marginLeft: 6 }} />
                    <Text style={styles.summaryRouteText}>📍 {arrival}</Text>
                  </View>
                  <View style={styles.summaryDetailsRow}>
                    <Text style={styles.summaryDetailItem}>📅 {selectedDateObj.toLocaleDateString('fr-FR')}</Text>
                    <Text style={styles.summaryDetailItem}>🕐 {time}</Text>
                  </View>
                  <View style={styles.summaryDetailsRow}>
                    <Text style={styles.summaryDetailItemPrice}>💰 {price} FCFA</Text>
                    <Text style={styles.summaryDetailItem}>👥 {seats} place{seats > 1 ? 's' : ''}</Text>
                  </View>
                </View>
              )}

              <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
                <TouchableOpacity
                  style={[styles.publishBtn, loading && styles.publishBtnDisabled]}
                  onPress={handlePublishPress}
                  onPressIn={handlePressIn}
                  onPressOut={handlePressOut}
                  activeOpacity={0.9}
                  disabled={loading}
                >
                  <LinearGradient colors={['#2563EB', '#3B82F6', '#60A5FA']} style={styles.publishGradient}>
                    {loading ? (
                      <ActivityIndicator color={theme.colors.white} size="small" />
                    ) : (
                      <>
                        <Ionicons name="rocket" size={20} color={theme.colors.white} />
                        <Text style={styles.publishBtnText}>Publier mon trajet</Text>
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
                  <PrefCard icon="musical-notes" label="Musique" value={music} onToggle={() => setMusic(!music)} />
                  <PrefCard icon="chatbubbles" label="Bavard(e)" value={chatty} onToggle={() => setChatty(!chatty)} />
                  <PrefCard icon="logo-no-smoking" label="Fumeurs" value={smoking} onToggle={() => setSmoking(!smoking)} />
                  <PrefCard icon="snow" label="Climatisation" value={airCond} onToggle={() => setAirCond(!airCond)} />
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
              // Recompute if arrival is already set
              if (arrivalCords) computeEstimation(cords, arrivalCords);
            } else {
              setArrival(loc.name);
              setArrivalCords(cords);
              // Recompute if departure is already set
              if (departureCords) computeEstimation(departureCords, cords);
            }
            setPickingLocationFor(null);
          }}
          onCancel={() => setPickingLocationFor(null)}
        />
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  scrollContent: { flexGrow: 1, paddingHorizontal: 16, paddingBottom: 32, paddingTop: 16 },
  
  driverRecapCard: {
    backgroundColor: theme.colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  driverInfoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  driverAvatar: { width: 50, height: 50, borderRadius: 25 },
  driverAvatarPlaceholder: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
  driverAvatarInitials: { color: theme.colors.white, fontSize: 18, fontWeight: 'bold' },
  driverDetails: { marginLeft: 12, flex: 1 },
  driverName: { fontSize: 16, fontWeight: '700', color: theme.colors.text, marginBottom: 4 },
  driverBadgesRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  driverBadgeRating: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFBEB', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, gap: 4 },
  driverBadgeRatingText: { fontSize: 11, fontWeight: '700', color: '#B45309' },
  driverBadgeVerified: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ECFDF5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, gap: 4 },
  driverBadgeVerifiedText: { fontSize: 11, fontWeight: '700', color: '#047857' },
  driverVehicleRow: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: theme.colors.border, paddingTop: 12, gap: 8 },
  driverVehicleText: { fontSize: 13, color: theme.colors.textLight, fontWeight: '500' },

  profileWarning: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: theme.colors.warningLight, borderRadius: 12,
    padding: 12, marginBottom: 16,
    borderWidth: 1, borderColor: theme.colors.warning,
  },
  profileWarningText: { flex: 1, color: theme.colors.warningDark, fontWeight: '600', fontSize: 13 },
  
  form: {
    borderRadius: 24,
    padding: 20,
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  sectionLabel: { fontSize: 16, fontWeight: '700', color: theme.colors.text, marginBottom: 16 },
  
  timelineContainer: { flexDirection: 'row', marginBottom: 16 },
  timelineGraphic: { width: 24, alignItems: 'center', marginRight: 12, marginTop: 12 },
  timelineDot: { width: 14, height: 14, borderRadius: 7 },
  timelineLine: { width: 2, height: 44, backgroundColor: theme.colors.border, marginVertical: 4 },
  timelineContent: { flex: 1, gap: 12 },
  
  locationButtonModern: {
    backgroundColor: '#F7F8FA', padding: 16,
    borderRadius: 16, height: 56, justifyContent: 'center'
  },
  locationButtonText: { fontSize: 15, color: theme.colors.text, fontWeight: '600' },
  locationButtonPlaceholder: { fontSize: 15, color: theme.colors.textMuted },
  
  estimationCard: {
    flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#F0F9FF',
    padding: 12, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: '#BAE6FD'
  },
  estItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  estIcon: { fontSize: 14 },
  estText: { fontSize: 13, fontWeight: '600', color: '#0369A1' },

  row: { flexDirection: 'row', gap: 12 },
  timeButtonModern: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F7F8FA', padding: 14,
    borderRadius: 16, height: 56,
  },
  timeText: { fontSize: 15, color: theme.colors.text, fontWeight: '600' },
  timePlaceholder: { fontSize: 15, color: theme.colors.textMuted },

  divider: { height: 1, backgroundColor: theme.colors.grayLight, marginVertical: 20 },
  
  suggestedPriceBox: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.primaryLight,
    padding: 10, borderRadius: 10, marginBottom: 12, gap: 8
  },
  suggestedPriceText: { fontSize: 13, fontWeight: '600', color: theme.colors.primaryDark },
  
  priceInputModern: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#F7F8FA', paddingHorizontal: 16,
    borderRadius: 16, height: 56,
  },
  priceFieldModern: { flex: 1, fontSize: 18, fontWeight: '700', color: theme.colors.text },
  priceCurrency: { fontSize: 15, fontWeight: '600', color: theme.colors.textMuted },

  seatChipsContainer: { gap: 10, paddingBottom: 8 },
  seatChip: {
    paddingHorizontal: 20, paddingVertical: 12, borderRadius: 24,
    backgroundColor: '#F7F8FA', borderWidth: 1, borderColor: 'transparent',
  },
  seatChipActive: { backgroundColor: `${theme.colors.primary}15`, borderColor: theme.colors.primary },
  seatChipText: { fontSize: 14, color: theme.colors.textLight, fontWeight: '600' },
  seatChipTextActive: { color: theme.colors.primary, fontWeight: '700' },

  optionsContainer: { gap: 8, marginBottom: 16 },
  optionCheckbox: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  optionCheckboxLabel: { fontSize: 15, color: theme.colors.text },

  summaryCard: {
    backgroundColor: '#F8FAFC', borderRadius: 16, padding: 16, marginTop: 8, marginBottom: 24,
    borderWidth: 1, borderColor: '#E2E8F0'
  },
  summaryCardTitle: { fontSize: 13, fontWeight: '700', color: theme.colors.textLight, marginBottom: 12, textTransform: 'uppercase' },
  summaryRoute: { marginBottom: 12 },
  summaryRouteText: { fontSize: 15, fontWeight: '700', color: theme.colors.text },
  summaryDetailsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  summaryDetailItem: { fontSize: 14, color: theme.colors.textLight, fontWeight: '500' },
  summaryDetailItemPrice: { fontSize: 16, color: theme.colors.success, fontWeight: '800' },

  publishBtn: { marginTop: 8, overflow: 'hidden', borderRadius: 16, shadowColor: theme.colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
  publishBtnDisabled: { opacity: 0.6 },
  publishGradient: { flexDirection: 'row', height: 56, justifyContent: 'center', alignItems: 'center', gap: 10 },
  publishBtnText: { fontSize: 18, fontWeight: '800', color: theme.colors.white },
  
  notLoggedTitle: { fontSize: 22, fontWeight: '800', color: theme.colors.text, marginTop: 16, marginBottom: 8, textAlign: 'center' },
  notLoggedText: { fontSize: 14, color: theme.colors.textLight, textAlign: 'center', marginBottom: 24 },
  notLoggedButton: { borderRadius: 12, overflow: 'hidden' },
  notLoggedGradient: { paddingHorizontal: 32, paddingVertical: 14, justifyContent: 'center', alignItems: 'center' },
  notLoggedButtonText: { color: theme.colors.white, fontWeight: 'bold', fontSize: 16 },
  
  // Modal styles
  modalOverlay: { flex: 1, backgroundColor: theme.colors.overlay, justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: theme.colors.white, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: 36, maxHeight: '90%',
  },
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
  
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F7F8FA', borderRadius: 16, height: 56,
    paddingHorizontal: 16, marginBottom: 16,
  },
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