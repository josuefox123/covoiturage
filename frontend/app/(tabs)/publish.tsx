/**
 * ==============================================================
 * Fichier :
 * publish.tsx
 *
 * Description :
 * Formulaire de publication de trajet multi-étapes (style BlaBlaCar).
 * Étapes : 1-Itinéraire | 2-Date & Places | 3-Prix | 4-Préférences
 *
 * Projet :
 * Zemy
 * ==============================================================
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator,
  Modal, Image, Animated, Dimensions, Keyboard, Switch,
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
import { AppBottomSheet } from '../../src/components/AppBottomSheet';
import { LinearGradient } from 'expo-linear-gradient';
import { CustomAlert } from '../../src/utils/CustomAlert';
import { getMediaUrl } from '../../src/utils/media';
import { StepIndicator } from '../../src/components/publish/StepIndicator';

const { width } = Dimensions.get('window');

const PROFILE_STEPS = ['personal', 'vehicle', 'preferences'] as const;
type ProfileStep = typeof PROFILE_STEPS[number];
const DAYS_FR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const DAYS_FULL = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const STEP_LABELS = ['Itinéraire', 'Date', 'Prix', 'Options'];

export default function PublishScreen() {
  const router = useRouter();
  const authCtx = useAuth();
  const user = authCtx?.user ?? null;
  const authFetch = authCtx?.authFetch ?? (async () => ({}));
  const updateUser = authCtx?.updateUser ?? (() => { });

  const now = new Date();

  // ─── Multi-step state ────────────────────────────────────────────
  const [formStep, setFormStep] = useState(1); // 1,2,3,4
  const stepAnim = useRef(new Animated.Value(0)).current;

  const animateStep = () => {
    stepAnim.setValue(40);
    Animated.spring(stepAnim, { toValue: 0, friction: 8, tension: 70, useNativeDriver: true }).start();
  };

  const goToStep = (step: number) => {
    animateStep();
    setFormStep(step);
  };

  // ─── Ride form state ─────────────────────────────────────────────
  const [departure, setDeparture] = useState('');
  const [arrival, setArrival] = useState('');
  const [departureCords, setDepartureCords] = useState<{ lat: number; lon: number } | null>(null);
  const [arrivalCords, setArrivalCords] = useState<{ lat: number; lon: number } | null>(null);
  const [estimation, setEstimation] = useState<{ distanceKm: number; durationMin: number } | null>(null);
  const [estimationLoading, setEstimationLoading] = useState(false);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDateObj, setSelectedDateObj] = useState(now);
  const [timeDate, setTimeDate] = useState(now);
  const [time, setTime] = useState(
    `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
  );
  const [seats, setSeats] = useState(3);
  const [pickingLocationFor, setPickingLocationFor] = useState<'departure' | 'arrival' | null>(null);
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Recurrent rides
  const [isRecurrent, setIsRecurrent] = useState(false);
  const [endDateObj, setEndDateObj] = useState(new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000));
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [repeatType, setRepeatType] = useState<'single_week' | 'weekly'>('single_week');
  const [selectedDays, setSelectedDays] = useState<number[]>([]);

  // Price step
  const [priceSuggestion, setPriceSuggestion] = useState<{
    suggested_price: number; min_price: number; max_price: number;
    price_per_km: number; margin_percent: number;
  } | null>(null);
  const [price, setPrice] = useState('');
  const [priceLoading, setPriceLoading] = useState(false);

  // Preferences step
  const [music, setMusic] = useState(true);
  const [smoking, setSmoking] = useState(false);
  const [chatty, setChatty] = useState(true);
  const [airCond, setAirCond] = useState(true);
  const [petsAllowed, setPetsAllowed] = useState(false);
  const [luggageAllowed, setLuggageAllowed] = useState(true);
  const [stopsAllowed, setStopsAllowed] = useState(true);
  const [description, setDescription] = useState('');

  // Publish
  const [loading, setLoading] = useState(false);
  const [financialSettings, setFinancialSettings] = useState<any>(null);

  // ─── Profile completion modal ────────────────────────────────────
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [profileStep, setProfileStep] = useState<ProfileStep>('personal');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const [editName, setEditName] = useState(user?.full_name || '');
  const [editEmail, setEditEmail] = useState(user?.email || '');
  const [avatarUri, setAvatarUri] = useState<string | null>(user?.avatar || null);
  const [brandModel, setBrandModel] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');
  const [plate, setPlate] = useState('');
  const [vehicleType, setVehicleType] = useState('voiture');
  const [driverLicense, setDriverLicense] = useState('');
  const [licenseExpiration, setLicenseExpiration] = useState('');
  const [licenseExpirationError, setLicenseExpirationError] = useState('');
  const [driverLicensePhoto, setDriverLicensePhoto] = useState<string | null>(null);

  const [hasVehicle, setHasVehicle] = useState(false);
  const [checkingVehicle, setCheckingVehicle] = useState(true);
  const [showVehicleWarning, setShowVehicleWarning] = useState(false);
  const [showExpiredLicenseWarning, setShowExpiredLicenseWarning] = useState(false);

  const buttonScale = useRef(new Animated.Value(1)).current;

  // ─── Lifecycle ───────────────────────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      if (user && user.is_verified) {
        checkVehicle();
      } else {
        setCheckingVehicle(false);
      }
    }, [user])
  );

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const data = await authFetch('/financial-settings/');
        if (data && data.length > 0) setFinancialSettings(data[0]);
      } catch (_) { }
    };
    fetchSettings();
  }, []);

  // ─── Estimation via Valhalla (routes réelles, OpenStreetMap) ────────
  const computeEstimation = async (dep: { lat: number; lon: number }, arr: { lat: number; lon: number }) => {
    setEstimationLoading(true);
    setEstimation(null);

    const haversineFallback = () => {
      const R = 6371;
      const dLat = ((arr.lat - dep.lat) * Math.PI) / 180;
      const dLon = ((arr.lon - dep.lon) * Math.PI) / 180;
      const a = Math.sin(dLat / 2) ** 2 + Math.cos((dep.lat * Math.PI) / 180) * Math.cos((arr.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
      const straightKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distanceKm = Math.round(straightKm * 1.35);
      const durationMin = Math.round((distanceKm / 45) * 60);
      setEstimation({ distanceKm, durationMin });
      fetchPriceSuggestion(distanceKm);
      setEstimationLoading(false);
    };

    try {
      // Valhalla routing — OpenStreetMap Germany (gratuit, sans clé API)
      const body = JSON.stringify({
        locations: [
          { lon: dep.lon, lat: dep.lat },
          { lon: arr.lon, lat: arr.lat },
        ],
        costing: 'auto',
        directions_options: { units: 'kilometers' },
      });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const res = await fetch('https://valhalla1.openstreetmap.de/route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        haversineFallback();
        return;
      }

      const json = await res.json();

      if (json?.trip?.summary) {
        const distanceKm = Math.round(json.trip.summary.length);  // déjà en km
        const durationMin = Math.round(json.trip.summary.time / 60); // secondes → minutes
        setEstimation({ distanceKm, durationMin });
        fetchPriceSuggestion(distanceKm);
        setEstimationLoading(false);
      } else {
        haversineFallback();
      }
    } catch {
      haversineFallback();
    } finally {
      setEstimationLoading(false);
    }
  };



  const formatDuration = (totalMin: number): string => {
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    if (h === 0) return `${m} min`;
    if (m === 0) return `${h}h`;
    return `${h}h${m.toString().padStart(2, '0')}`;
  };

  const getEstimatedRides = () => {
    if (!isRecurrent || selectedDays.length === 0) return 0;
    if (repeatType === 'single_week') return selectedDays.length;
    if (endDateObj < selectedDateObj) return 0;
    let count = 0;
    const current = new Date(selectedDateObj);
    while (current <= endDateObj) {
      const jsDay = current.getDay();
      const myDay = jsDay === 0 ? 6 : jsDay - 1;
      if (selectedDays.includes(myDay)) count++;
      current.setDate(current.getDate() + 1);
    }
    return count;
  };

  const calcCommission = (driverPayout: number) => {
    if (!financialSettings || !financialSettings.is_commission_active) return 0;
    const pct = financialSettings.commission_percentage || 10;
    const minC = financialSettings.min_commission || 100;
    const maxC = financialSettings.max_commission;
    let commission = Math.floor(driverPayout * (pct / 100));
    if (commission < minC) commission = minC;
    if (maxC && commission > maxC) commission = maxC;
    return commission;
  };

  const isProfileComplete = () => !!(user?.full_name && user.full_name.trim() !== '');

  const checkVehicle = async () => {
    if (!user) return;
    try {
      const data = await authFetch(`/vehicles/?owner=${user.id}`);
      const results = Array.isArray(data) ? data : data.results || [];
      if (results.length > 0) {
        const primaryVehicle = results[0];
        if (primaryVehicle.vehicle_type === 'voiture') {
          if (!primaryVehicle.license_expiration || !primaryVehicle.driver_license_number || !primaryVehicle.driver_license_photo) {
            setHasVehicle(false); setShowExpiredLicenseWarning(true); return;
          }
          const expDate = new Date(primaryVehicle.license_expiration);
          const today = new Date(); today.setHours(0, 0, 0, 0);
          if (expDate < today) { setHasVehicle(false); setShowExpiredLicenseWarning(true); return; }
        }
        setHasVehicle(true);
      } else {
        setHasVehicle(false); setShowVehicleWarning(true);
      }
    } catch (e) { console.error(e); }
    finally { setCheckingVehicle(false); }
  };

  const fetchPriceSuggestion = async (distanceKm: number) => {
    if (distanceKm <= 0) return;
    setPriceLoading(true);
    try {
      const data = await authFetch(`/rides/suggest-price/?distance_km=${distanceKm}`);
      if (data && data.suggested_price) {
        setPriceSuggestion(data);
        if (!price) setPrice(String(data.suggested_price));
      }
    } catch (_) { } finally { setPriceLoading(false); }
  };

  // ─── Step validation ─────────────────────────────────────────────
  const validateStep1 = () => {
    if (!departure.trim() || !arrival.trim()) {
      CustomAlert.alert('Champs manquants', 'Veuillez sélectionner un lieu de départ et d\'arrivée.'); return false;
    }
    if (departure === arrival) {
      CustomAlert.alert('Erreur', 'Le départ et l\'arrivée doivent être différents.'); return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (isRecurrent && selectedDays.length === 0) {
      CustomAlert.alert('Jours manquants', 'Veuillez sélectionner au moins un jour pour la récurrence.'); return false;
    }
    if (isRecurrent && repeatType === 'weekly' && endDateObj < selectedDateObj) {
      CustomAlert.alert('Erreur', 'La date de fin doit être postérieure à la date de début.'); return false;
    }
    return true;
  };

  const validateStep3 = () => {
    const priceNum = parseInt(price, 10);
    if (!price || isNaN(priceNum) || priceNum <= 0) {
      CustomAlert.alert('Prix manquant', 'Veuillez entrer un prix valide.'); return false;
    }
    return true;
  };

  const handleNext = () => {
    Keyboard.dismiss();
    if (formStep === 1 && !validateStep1()) return;
    if (formStep === 2 && !validateStep2()) return;
    if (formStep === 3 && !validateStep3()) return;
    if (formStep < 4) {
      if (formStep === 2 && estimation) fetchPriceSuggestion(estimation.distanceKm);
      goToStep(formStep + 1);
    }
  };

  const handleBack = () => { if (formStep > 1) goToStep(formStep - 1); };

  // ─── Publish ─────────────────────────────────────────────────────
  const handlePublishPress = () => {
    Keyboard.dismiss();
    if (!isProfileComplete()) {
      setEditName(user?.full_name || ''); setProfileStep('personal'); setProfileModalVisible(true);
    } else if (!hasVehicle) {
      setShowVehicleWarning(true);
    } else {
      handlePublish();
    }
  };

  const handlePublish = async () => {
    setLoading(true);
    try {
      const dateString = selectedDateObj.toISOString().split('T')[0];
      const priceNum = parseInt(price, 10);
      const payload: any = {
        departure_location: departure,
        arrival_location: arrival,
        departure_date: dateString,
        departure_time: time + ':00',
        driver_payout: priceNum,
        total_seats: seats,
        seats_available: seats,
        vehicle: null,
        accepts_parcels: false,
        description: description.trim() || null,
        // Preferences
        music,
        smoking,
        chatty,
        air_conditioner: airCond,
        pets_allowed: petsAllowed,
        luggage_allowed: luggageAllowed,
        stops_allowed: stopsAllowed,
        // Distance
        distance_km: estimation?.distanceKm ?? null,
        duration_min: estimation?.durationMin ?? null,
      };

      if (departureCords) { payload.departure_latitude = departureCords.lat; payload.departure_longitude = departureCords.lon; }
      if (arrivalCords) { payload.arrival_latitude = arrivalCords.lat; payload.arrival_longitude = arrivalCords.lon; }

      if (isRecurrent) {
        payload.is_recurrent = true;
        payload.start_date = dateString;
        if (repeatType === 'single_week') {
          const end = new Date(selectedDateObj); end.setDate(end.getDate() + 6);
          payload.end_date = end.toISOString().split('T')[0];
        } else {
          payload.end_date = endDateObj.toISOString().split('T')[0];
        }
        payload.repeat_type = 'weekly';
        payload.week_days = selectedDays;
      }

      const res = await authFetch('/rides/', { method: 'POST', body: JSON.stringify(payload) });
      const message = isRecurrent && res.message ? res.message : `Votre trajet de ${departure} vers ${arrival} a été publié !`;

      CustomAlert.alert('Félicitations ! 🎉', message, [
        { text: 'Voir mes trajets', onPress: () => router.push('/(tabs)/home') }
      ]);

      // Reset form
      setDeparture(''); setArrival(''); setDepartureCords(null); setArrivalCords(null);
      setEstimation(null); setPrice(''); setSeats(3); setDescription('');
      setIsRecurrent(false); setSelectedDays([]);
      setPriceSuggestion(null);
      goToStep(1);

    } catch (error: any) {
      CustomAlert.alert('Erreur', error.message || 'Impossible de publier le trajet.');
    } finally { setLoading(false); }
  };

  // ─── Profile methods ──────────────────────────────────────────────
  const pickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { CustomAlert.alert('Permission refusée', 'Autorisez l\'accès à vos photos.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 0.8 });
    if (!result.canceled && result.assets[0]) setAvatarUri(result.assets[0].uri);
  };

  const pickLicensePhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { CustomAlert.alert('Permission refusée', 'Autorisez l\'accès à vos photos.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 0.8 });
    if (!result.canceled && result.assets[0]) setDriverLicensePhoto(result.assets[0].uri);
  };

  const handleSavePersonal = async () => {
    if (!editName.trim()) { CustomAlert.alert('Erreur', 'Le nom complet est obligatoire.'); return; }
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
    } finally { setIsSavingProfile(false); }
  };

  const handleSaveVehicle = async () => {
    if (!brandModel.trim() || !plate.trim()) { CustomAlert.alert('Erreur', 'Veuillez remplir les champs obligatoires du véhicule.'); return; }
    if (vehicleType === 'voiture') {
      if (!driverLicense.trim() || !licenseExpiration.trim() || !driverLicensePhoto) {
        CustomAlert.alert('Erreur', 'Les informations du permis de conduire sont obligatoires pour les voitures.'); return;
      }
      const expDate = new Date(licenseExpiration); const today = new Date(); today.setHours(0, 0, 0, 0);
      if (expDate < today) { setLicenseExpirationError('La date de votre permis est déjà expirée.'); return; }
      else setLicenseExpirationError('');
    }
    setIsSavingProfile(true);
    const formData = new FormData();
    formData.append('owner', user!.id);
    formData.append('brand_model', brandModel);
    formData.append('color', vehicleColor);
    formData.append('license_plate', plate);
    formData.append('vehicle_type', vehicleType);
    if (vehicleType === 'voiture') {
      formData.append('driver_license_number', driverLicense);
      formData.append('license_expiration', licenseExpiration);
    }
    if (vehicleType === 'voiture' && driverLicensePhoto && !driverLicensePhoto.startsWith('http')) {
      const filename = driverLicensePhoto.split('/').pop() || 'license.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';
      formData.append('driver_license_photo', { uri: driverLicensePhoto, name: filename, type } as any);
    }
    try {
      await authFetch('/vehicles/', { method: 'POST', body: formData });
      setHasVehicle(true); setProfileStep('preferences');
    } catch (e: any) {
      CustomAlert.alert('Erreur', e.message || 'Impossible d\'ajouter le véhicule.');
    } finally { setIsSavingProfile(false); }
  };

  const handleSavePrefs = async () => {
    setIsSavingProfile(true);
    try {
      await authFetch('/preferences/', { method: 'POST', body: JSON.stringify({ user: user!.id, music, smoking, chatty, air_conditioner: airCond }) });
    } catch (_) { } finally { setIsSavingProfile(false); }
    setProfileModalVisible(false);
    handlePublish();
  };

  const getProfileProgress = () => {
    if (profileStep === 'personal') return 33;
    if (profileStep === 'vehicle') return 66;
    return 100;
  };

  // ─── Sub-components ───────────────────────────────────────────────
  const PrefToggle = ({ label, icon, value, onToggle }: { label: string; icon: string; value: boolean; onToggle: () => void }) => (
    <TouchableOpacity
      style={[styles.prefToggleRow, value && styles.prefToggleRowActive]}
      onPress={onToggle}
      activeOpacity={0.75}
    >
      <View style={[styles.prefToggleIconBox, value && styles.prefToggleIconBoxActive]}>
        <Ionicons name={icon as any} size={20} color={value ? theme.colors.white : theme.colors.textLight} />
      </View>
      <Text style={[styles.prefToggleLabel, value && styles.prefToggleLabelActive]}>{label}</Text>
      <View style={[styles.prefToggleBadge, value ? styles.prefToggleBadgeOn : styles.prefToggleBadgeOff]}>
        <Text style={[styles.prefToggleBadgeText, value && { color: theme.colors.primary }]}>{value ? 'Oui' : 'Non'}</Text>
      </View>
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
        <Ionicons name={value ? 'checkmark' : 'close'} size={12} color={value ? theme.colors.white : theme.colors.textMuted} />
      </View>
    </TouchableOpacity>
  );

  // ─── Guards ───────────────────────────────────────────────────────
  if (!user) return (
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

  if (!user.is_verified) return (
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

  if (checkingVehicle) return (
    <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
      <ActivityIndicator size="large" color={theme.colors.primary} />
    </SafeAreaView>
  );

  // ─── MAIN RENDER ─────────────────────────────────────────────────
  const priceNum = parseInt(price, 10) || 0;
  const commission = calcCommission(priceNum);
  const totalPassenger = priceNum + commission;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            {formStep > 1 ? (
              <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
                <Ionicons name="chevron-back" size={22} color={theme.colors.text} />
              </TouchableOpacity>
            ) : <View style={{ width: 40 }} />}
            <Text style={styles.headerTitle}>Publier un trajet</Text>
            <View style={{ width: 40 }} />
          </View>
          <StepIndicator currentStep={formStep} totalSteps={4} labels={STEP_LABELS} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View style={{ transform: [{ translateY: stepAnim }] }}>

            {/* ══════════════════════════════════════════════════════
                ÉTAPE 1 — ITINÉRAIRE
            ══════════════════════════════════════════════════════ */}
            {formStep === 1 && (
              <>
                <Text style={styles.stepTitle}>Où allez-vous ?</Text>
                <Text style={styles.stepSubtitle}>Choisissez votre point de départ et votre destination</Text>

                {/* Route card */}
                <View style={styles.routeCard}>
                  {/* Departure */}
                  <TouchableOpacity
                    style={styles.locationRow}
                    onPress={() => setPickingLocationFor('departure')}
                    activeOpacity={0.7}
                  >
                    <View style={styles.dotGreen} />
                    <View style={styles.locationContent}>
                      <Text style={styles.locationLabel}>Départ</Text>
                      <Text style={[styles.locationValue, !departure && styles.locationPlaceholder]}>
                        {departure || 'Choisir le lieu de départ'}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#C4C4C4" />
                  </TouchableOpacity>

                  {/* Divider with dashes */}
                  <View style={styles.routeDivider}>
                    <View style={styles.routeLine} />
                  </View>

                  {/* Arrival */}
                  <TouchableOpacity
                    style={styles.locationRow}
                    onPress={() => setPickingLocationFor('arrival')}
                    activeOpacity={0.7}
                  >
                    <View style={styles.dotRed} />
                    <View style={styles.locationContent}>
                      <Text style={styles.locationLabel}>Arrivée</Text>
                      <Text style={[styles.locationValue, !arrival && styles.locationPlaceholder]}>
                        {arrival || 'Choisir la destination'}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#C4C4C4" />
                  </TouchableOpacity>
                </View>

                {/* Distance / Duration info */}
                {departure && arrival && (
                  <View style={styles.estimationCard}>
                    {estimationLoading ? (
                      <ActivityIndicator size="small" color={theme.colors.primary} style={{ margin: 20 }} />
                    ) : estimation ? (
                      <View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                          <Text style={{ fontSize: 11, color: theme.colors.textMuted, fontStyle: 'italic' }}>
                            📍 Calcul basé sur les routes réelles
                          </Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <View style={styles.estimationItem}>
                            <Ionicons name="navigate-circle-outline" size={22} color={theme.colors.primary} />
                            <View style={{ marginLeft: 10 }}>
                              <Text style={styles.estimationLabel}>Distance</Text>
                              <Text style={styles.estimationValue}>{estimation.distanceKm.toLocaleString()} km</Text>
                            </View>
                          </View>
                          <View style={styles.estimationDivider} />
                          <View style={styles.estimationItem}>
                            <Ionicons name="time-outline" size={22} color={theme.colors.primary} />
                            <View style={{ marginLeft: 10 }}>
                              <Text style={styles.estimationLabel}>Durée</Text>
                              <Text style={styles.estimationValue}>{formatDuration(estimation.durationMin)}</Text>
                            </View>
                          </View>
                        </View>
                        
                        <View style={{ height: 1, backgroundColor: '#E5E7EB', marginVertical: 12 }} />
                        
                        {priceLoading ? (
                           <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8 }}>
                             <ActivityIndicator size="small" color={theme.colors.primary} />
                             <Text style={{ marginLeft: 8, fontSize: 13, color: theme.colors.textLight }}>Calcul du prix conseillé...</Text>
                           </View>
                        ) : priceSuggestion ? (
                           <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                             <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                               <Ionicons name="cash-outline" size={22} color={theme.colors.success} />
                               <Text style={[styles.estimationLabel, { marginLeft: 10, fontSize: 13, color: theme.colors.text }]}>Prix conseillé</Text>
                             </View>
                             <Text style={{ fontSize: 18, fontWeight: '800', color: theme.colors.success }}>
                               {priceSuggestion.suggested_price.toLocaleString()} FCFA
                             </Text>
                           </View>
                        ) : null}
                      </View>
                    ) : null}
                  </View>
                )}
              </>
            )}

            {/* ══════════════════════════════════════════════════════
                ÉTAPE 2 — DATE & PLACES
            ══════════════════════════════════════════════════════ */}
            {formStep === 2 && (
              <>
                <Text style={styles.stepTitle}>Quand partez-vous ?</Text>
                <Text style={styles.stepSubtitle}>Définissez la date, l'heure et le nombre de places</Text>

                {/* Date & Time */}
                {!isRecurrent && (
                  <View style={styles.row}>
                    <TouchableOpacity style={styles.halfCard} onPress={() => setShowDatePicker(true)} activeOpacity={0.7}>
                      <Ionicons name="calendar-outline" size={20} color={theme.colors.primary} />
                      <Text style={styles.halfCardLabel}>Date de départ</Text>
                      <Text style={styles.halfCardValue}>
                        {selectedDateObj.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.halfCard} onPress={() => setShowTimePicker(true)} activeOpacity={0.7}>
                      <Ionicons name="time-outline" size={20} color={theme.colors.primary} />
                      <Text style={styles.halfCardLabel}>Heure de départ</Text>
                      <Text style={styles.halfCardValue}>{time}</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {isRecurrent && (
                  <TouchableOpacity style={[styles.halfCard, { marginBottom: 16 }]} onPress={() => setShowTimePicker(true)} activeOpacity={0.7}>
                    <Ionicons name="time-outline" size={20} color={theme.colors.primary} />
                    <Text style={styles.halfCardLabel}>Heure de départ</Text>
                    <Text style={styles.halfCardValue}>{time}</Text>
                  </TouchableOpacity>
                )}

                {/* Seats */}
                <View style={styles.seatCard}>
                  <Ionicons name="people-outline" size={22} color={theme.colors.primary} />
                  <Text style={styles.seatLabel}>Nombre de places</Text>
                  <View style={styles.seatStepper}>
                    <TouchableOpacity onPress={() => setSeats(Math.max(1, seats - 1))} style={styles.seatBtn}>
                      <Ionicons name="remove" size={20} color={theme.colors.primary} />
                    </TouchableOpacity>
                    <Text style={styles.seatValue}>{seats}</Text>
                    <TouchableOpacity onPress={() => setSeats(Math.min(8, seats + 1))} style={styles.seatBtn}>
                      <Ionicons name="add" size={20} color={theme.colors.primary} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Recurrent toggle */}
                <View style={styles.recurrentCard}>
                  <View style={styles.recurrentHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Ionicons name="repeat-outline" size={20} color={isRecurrent ? theme.colors.primary : theme.colors.textLight} />
                      <Text style={styles.recurrentHeaderText}>Trajet récurrent</Text>
                    </View>
                    <Switch
                      value={isRecurrent} onValueChange={setIsRecurrent}
                      trackColor={{ false: '#E5E7EB', true: theme.colors.primaryLight }}
                      thumbColor={isRecurrent ? theme.colors.primary : '#FFFFFF'}
                    />
                  </View>

                  {isRecurrent && (
                    <View style={styles.recurrentBody}>
                      <View style={styles.repeatTypeContainer}>
                        {(['single_week', 'weekly'] as const).map(type => (
                          <TouchableOpacity
                            key={type}
                            style={[styles.repeatBox, repeatType === type && styles.repeatBoxActive]}
                            onPress={() => setRepeatType(type)}
                          >
                            <Ionicons
                              name={type === 'single_week' ? 'calendar-outline' : 'calendar-number-outline'}
                              size={16} color={repeatType === type ? theme.colors.primary : theme.colors.textLight}
                            />
                            <Text style={[styles.repeatBoxText, repeatType === type && styles.repeatBoxTextActive]}>
                              {type === 'single_week' ? 'Cette semaine' : 'Chaque semaine'}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>

                      {/* Start date */}
                      <Text style={styles.recurrentLabel}>Date de début</Text>
                      <TouchableOpacity style={styles.dateSelector} onPress={() => setShowDatePicker(true)}>
                        <Ionicons name="calendar-outline" size={16} color={theme.colors.primary} style={{ marginRight: 8 }} />
                        <Text style={styles.dateSelectorText}>
                          {selectedDateObj.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </Text>
                      </TouchableOpacity>

                      {/* End date (weekly only) */}
                      {repeatType === 'weekly' && (
                        <>
                          <Text style={[styles.recurrentLabel, { marginTop: 12 }]}>Date de fin</Text>
                          <TouchableOpacity style={styles.dateSelector} onPress={() => setShowEndDatePicker(true)}>
                            <Ionicons name="calendar-outline" size={16} color={theme.colors.primary} style={{ marginRight: 8 }} />
                            <Text style={styles.dateSelectorText}>
                              {endDateObj.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                            </Text>
                          </TouchableOpacity>
                        </>
                      )}

                      {/* Days */}
                      <Text style={[styles.recurrentLabel, { marginTop: 12 }]}>Jours de la semaine</Text>
                      <View style={styles.daysContainer}>
                        {DAYS_FR.map((day, idx) => (
                          <TouchableOpacity
                            key={idx}
                            style={[styles.dayBox, selectedDays.includes(idx) && styles.dayBoxActive]}
                            onPress={() => setSelectedDays(prev => prev.includes(idx) ? prev.filter(d => d !== idx) : [...prev, idx])}
                          >
                            <Text style={[styles.dayBoxText, selectedDays.includes(idx) && styles.dayBoxTextActive]}>{day}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>

                      {selectedDays.length > 0 && (
                        <View style={styles.estimatedRidesBox}>
                          <Ionicons name="checkmark-circle" size={18} color={theme.colors.primary} />
                          <Text style={styles.estimatedRidesText}>{getEstimatedRides()} trajet(s) seront générés</Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>

                {showDatePicker && (
                  <DateTimePicker
                    value={selectedDateObj} mode="date" display="default" minimumDate={new Date()}
                    onChange={(event, selectedDate) => {
                      setShowDatePicker(Platform.OS === 'ios');
                      if (event.type === 'set' && selectedDate) { setShowDatePicker(false); setSelectedDateObj(selectedDate); }
                      else if (event.type === 'dismissed') setShowDatePicker(false);
                    }}
                  />
                )}
                {showEndDatePicker && (
                  <DateTimePicker
                    value={endDateObj} mode="date" display="default" minimumDate={selectedDateObj}
                    onChange={(event, selectedDate) => {
                      setShowEndDatePicker(Platform.OS === 'ios');
                      if (event.type === 'set' && selectedDate) { setShowEndDatePicker(false); setEndDateObj(selectedDate); }
                      else if (event.type === 'dismissed') setShowEndDatePicker(false);
                    }}
                  />
                )}
                {showTimePicker && (
                  <DateTimePicker
                    value={timeDate} mode="time" is24Hour={true} display="default"
                    onChange={(event, selectedDate) => {
                      setShowTimePicker(Platform.OS === 'ios');
                      if (event.type === 'set' && selectedDate) {
                        setShowTimePicker(false); setTimeDate(selectedDate);
                        const h = selectedDate.getHours().toString().padStart(2, '0');
                        const m = selectedDate.getMinutes().toString().padStart(2, '0');
                        setTime(`${h}:${m}`);
                      } else if (event.type === 'dismissed') setShowTimePicker(false);
                    }}
                  />
                )}
              </>
            )}

            {/* ══════════════════════════════════════════════════════
                ÉTAPE 3 — PRIX
            ══════════════════════════════════════════════════════ */}
            {formStep === 3 && (
              <>
                <Text style={styles.stepTitle}>Combien souhaitez-vous gagner ?</Text>
                <Text style={styles.stepSubtitle}>Entrez le montant que vous souhaitez recevoir par place</Text>

                {/* Price suggestion banner */}
                {priceLoading ? (
                  <View style={[styles.suggestCard, { justifyContent: 'center', alignItems: 'center', paddingVertical: 24 }]}>
                    <ActivityIndicator color={theme.colors.primary} />
                    <Text style={{ color: theme.colors.textLight, marginTop: 8 }}>Calcul du prix conseillé...</Text>
                  </View>
                ) : priceSuggestion && (
                  <View style={styles.suggestCard}>
                    <View style={styles.suggestHeader}>
                      <Ionicons name="bulb-outline" size={18} color={theme.colors.primary} />
                      <Text style={styles.suggestHeaderText}>Prix conseillé</Text>
                    </View>
                    <Text style={styles.suggestPrice}>{priceSuggestion.suggested_price.toLocaleString()} FCFA</Text>
                    <Text style={styles.suggestSub}>
                      Basé sur {estimation?.distanceKm} km ({priceSuggestion.price_per_km} FCFA/km)
                    </Text>
                    <View style={styles.suggestRange}>
                      <View style={styles.suggestRangeItem}>
                        <Text style={styles.suggestRangeLabel}>Min</Text>
                        <Text style={styles.suggestRangeValue}>{priceSuggestion.min_price.toLocaleString()}</Text>
                      </View>
                      <View style={styles.suggestRangeBar}>
                        <View style={styles.suggestRangeBarFill} />
                      </View>
                      <View style={styles.suggestRangeItem}>
                        <Text style={styles.suggestRangeLabel}>Max</Text>
                        <Text style={styles.suggestRangeValue}>{priceSuggestion.max_price.toLocaleString()}</Text>
                      </View>
                    </View>
                    <View style={styles.suggestBtnRow}>
                      {[priceSuggestion.min_price, priceSuggestion.suggested_price, priceSuggestion.max_price].map((val, i) => (
                        <TouchableOpacity
                          key={i}
                          style={[styles.suggestPresetBtn, price === String(val) && styles.suggestPresetBtnActive]}
                          onPress={() => setPrice(String(val))}
                        >
                          <Text style={[styles.suggestPresetText, price === String(val) && styles.suggestPresetTextActive]}>
                            {val.toLocaleString()}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                {/* Price input */}
                <View style={styles.priceInputCard}>
                  <Text style={styles.priceInputLabel}>Mon prix (FCFA)</Text>
                  <View style={styles.priceInputRow}>
                    <TextInput
                      style={styles.priceInputField}
                      value={price}
                      onChangeText={setPrice}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor="#C4C4C4"
                      maxLength={7}
                    />
                    <Text style={styles.priceInputCurrency}>FCFA</Text>
                  </View>
                </View>

                {/* Commission preview */}
                {priceNum > 0 && (
                  <View style={styles.commissionCard}>
                    <View style={styles.commissionRow}>
                      <Text style={styles.commissionLabel}>Vous recevrez</Text>
                      <Text style={styles.commissionValue}>{priceNum.toLocaleString()} FCFA</Text>
                    </View>
                    <View style={styles.commissionRow}>
                      <Text style={styles.commissionLabelSub}>Frais de service Zemy ({financialSettings?.commission_percentage || 10}%)</Text>
                      <Text style={styles.commissionValueSub}>+{commission.toLocaleString()} FCFA</Text>
                    </View>
                    <View style={styles.commissionDivider} />
                    <View style={styles.commissionRow}>
                      <Text style={styles.commissionLabelTotal}>Le passager paiera</Text>
                      <Text style={styles.commissionValueTotal}>{totalPassenger.toLocaleString()} FCFA</Text>
                    </View>
                  </View>
                )}
              </>
            )}

            {/* ══════════════════════════════════════════════════════
                ÉTAPE 4 — PRÉFÉRENCES & DESCRIPTION
            ══════════════════════════════════════════════════════ */}
            {formStep === 4 && (
              <>
                <Text style={styles.stepTitle}>Vos préférences</Text>
                <Text style={styles.stepSubtitle}>Partagez vos habitudes pour attirer les bons passagers</Text>

                {/* Summary mini */}
                <View style={styles.miniSummary}>
                  <Ionicons name="navigate" size={14} color={theme.colors.primary} />
                  <Text style={styles.miniSummaryText} numberOfLines={1}>{departure} → {arrival}</Text>
                  <Text style={styles.miniSummaryPrice}>{priceNum.toLocaleString()} FCFA</Text>
                </View>

                {/* Preferences */}
                <View style={styles.prefList}>
                  <PrefToggle label="Musique autorisée" icon="musical-notes-outline" value={music} onToggle={() => setMusic(!music)} />
                  <PrefToggle label="Discussion appréciée" icon="chatbubbles-outline" value={chatty} onToggle={() => setChatty(!chatty)} />
                  <PrefToggle label="Climatisation" icon="snow-outline" value={airCond} onToggle={() => setAirCond(!airCond)} />
                  <PrefToggle label="Bagages autorisés" icon="briefcase-outline" value={luggageAllowed} onToggle={() => setLuggageAllowed(!luggageAllowed)} />
                  <PrefToggle label="Animaux acceptés" icon="paw-outline" value={petsAllowed} onToggle={() => setPetsAllowed(!petsAllowed)} />
                  <PrefToggle label="Non fumeur" icon="ban-outline" value={!smoking} onToggle={() => setSmoking(!smoking)} />
                  <PrefToggle label="Pauses acceptées" icon="pause-circle-outline" value={stopsAllowed} onToggle={() => setStopsAllowed(!stopsAllowed)} />
                </View>

                {/* Description */}
                <Text style={styles.sectionLabel}>Message pour les passagers (optionnel)</Text>
                <View style={styles.descriptionCard}>
                  <TextInput
                    style={styles.descriptionInput}
                    placeholder="Ex : Voyage calme, ponctualité appréciée, pas de gros bagages svp..."
                    placeholderTextColor={theme.colors.textLight}
                    value={description}
                    onChangeText={setDescription}
                    multiline
                    numberOfLines={4}
                    maxLength={300}
                  />
                  <Text style={styles.descriptionCounter}>{description.length}/300</Text>
                </View>

                {/* Publish button */}
                <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
                  <TouchableOpacity
                    style={[styles.publishBtn, loading && styles.publishBtnDisabled]}
                    onPress={handlePublishPress}
                    activeOpacity={0.9}
                    disabled={loading}
                  >
                    <LinearGradient
                      colors={[theme.colors.primary, theme.colors.primaryDark]}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                      style={styles.publishBtnGradient}
                    >
                      {loading ? (
                        <ActivityIndicator color={theme.colors.white} size="small" />
                      ) : (
                        <>
                          <Ionicons name="rocket-outline" size={22} color={theme.colors.white} />
                          <Text style={styles.publishBtnText}>Publier le trajet</Text>
                        </>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </Animated.View>
              </>
            )}

            {/* ── Next button (steps 1-3) ── */}
            {formStep < 4 && (
              <TouchableOpacity style={styles.nextBtn} onPress={handleNext} activeOpacity={0.85}>
                <LinearGradient
                  colors={[theme.colors.primary, theme.colors.primaryDark]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={styles.nextBtnGradient}
                >
                  <Text style={styles.nextBtnText}>
                    {formStep === 3 ? 'Continuer vers les options' : 'Continuer'}
                  </Text>
                  <Ionicons name="arrow-forward" size={20} color={theme.colors.white} />
                </LinearGradient>
              </TouchableOpacity>
            )}

          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Location Picker Modal ── */}
      <Modal visible={pickingLocationFor !== null} animationType="slide" transparent={false} onRequestClose={() => setPickingLocationFor(null)}>
        <LocationPicker
          title={pickingLocationFor === 'departure' ? 'Lieu de départ' : "Lieu d'arrivée"}
          onLocationSelected={(loc) => {
            const cords = { lat: loc.latitude, lon: loc.longitude };
            let newDep = departure;
            let newArr = arrival;
            if (pickingLocationFor === 'departure') {
              setDeparture(loc.name); setDepartureCords(cords);
              newDep = loc.name;
              if (arrivalCords) computeEstimation(cords, arrivalCords);
            } else {
              setArrival(loc.name); setArrivalCords(cords);
              newArr = loc.name;
              if (departureCords) computeEstimation(departureCords, cords);
            }
            if (newDep && newArr && !description) {
              setDescription(`Départ de ${newDep} et arrivée à ${newArr}`);
            }
            setPickingLocationFor(null);
          }}
          onCancel={() => setPickingLocationFor(null)}
        />
      </Modal>

      {/* ── Profile completion BottomSheet ── */}
      <AppBottomSheet visible={profileModalVisible} onClose={() => setProfileModalVisible(false)} snapPoints={['75%', '95%']} initialIndex={0}>
        <View style={styles.modalHeaderModern}>
          <Text style={styles.modalTitle}>Complétion du profil</Text>
        </View>
        <View>
          <View style={styles.progressContainer}>
            <Text style={styles.progressLabel}>Étape {PROFILE_STEPS.indexOf(profileStep) + 1} sur 3 ({Math.round(getProfileProgress())}%)</Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${getProfileProgress()}%` }]} />
            </View>
          </View>

          {profileStep === 'personal' && (
            <>
              <TouchableOpacity style={styles.avatarPicker} onPress={pickAvatar} activeOpacity={0.8}>
                {avatarUri ? (
                  <View style={styles.avatarWrapper}>
                    <Image source={{ uri: getMediaUrl(avatarUri) }} style={styles.avatar} />
                    <View style={styles.avatarBadge}><Ionicons name="camera" size={16} color={theme.colors.white} /></View>
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
                <TextInput style={styles.modalInputModern} value={editName} onChangeText={setEditName} placeholder="Nom complet" placeholderTextColor={theme.colors.textMuted} />
              </View>
              <View style={styles.inputWrapper}>
                <Ionicons name="mail-outline" size={20} color={theme.colors.textMuted} style={styles.inputIcon} />
                <TextInput style={styles.modalInputModern} value={editEmail} onChangeText={setEditEmail} placeholder="votre@email.com" placeholderTextColor={theme.colors.textMuted} keyboardType="email-address" autoCapitalize="none" />
              </View>
              <TouchableOpacity style={styles.modalBtn} onPress={handleSavePersonal} disabled={isSavingProfile}>
                <LinearGradient colors={[theme.colors.primary, '#3B82F6']} style={styles.modalBtnGradient}>
                  {isSavingProfile ? <ActivityIndicator color={theme.colors.white} /> : <Text style={styles.modalBtnText}>Continuer →</Text>}
                </LinearGradient>
              </TouchableOpacity>
            </>
          )}

          {profileStep === 'vehicle' && (
            <>
              <View style={styles.inputWrapper}>
                <Ionicons name="pricetag-outline" size={20} color={theme.colors.textMuted} style={styles.inputIcon} />
                <TextInput style={styles.modalInputModern} value={plate} onChangeText={setPlate} placeholder="Immatriculation (ex: BJ-1234)" placeholderTextColor={theme.colors.textMuted} autoCapitalize="characters" />
              </View>
              <Text style={styles.vehicleTypeLabel}>Type de véhicule</Text>
              <View style={styles.vehicleTypeContainer}>
                {['Moto', 'Tricycle', 'Voiture'].map(type => (
                  <TouchableOpacity key={type} style={[styles.vehicleTypeBtn, vehicleType === type.toLowerCase() && styles.vehicleTypeBtnActive]} onPress={() => setVehicleType(type.toLowerCase())}>
                    <Text style={[styles.vehicleTypeText, vehicleType === type.toLowerCase() && styles.vehicleTypeTextActive]}>{type}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {vehicleType === 'voiture' && (
                <>
                  <Text style={{ fontSize: 15, fontWeight: '600', color: theme.colors.text, marginTop: 12, marginBottom: 8 }}>Permis de conduire</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="id-card-outline" size={20} color={theme.colors.textMuted} style={styles.inputIcon} />
                    <TextInput style={styles.modalInputModern} value={driverLicense} onChangeText={setDriverLicense} placeholder="Numéro de permis (Obligatoire)" placeholderTextColor={theme.colors.textMuted} />
                  </View>
                  <TouchableOpacity style={[styles.inputWrapper, licenseExpirationError ? { borderColor: theme.colors.error } : null]} onPress={() => setShowDatePicker(true)}>
                    <Ionicons name="calendar-outline" size={20} color={licenseExpirationError ? theme.colors.error : theme.colors.textMuted} style={styles.inputIcon} />
                    <Text style={[styles.modalInputModern, { paddingTop: Platform.OS === 'ios' ? 16 : 14, color: licenseExpiration ? theme.colors.text : theme.colors.textMuted }]}>
                      {licenseExpiration || "Date d'expiration (Obligatoire)"}
                    </Text>
                  </TouchableOpacity>
                  {licenseExpirationError ? <Text style={{ color: theme.colors.error, fontSize: 12, marginTop: -8, marginBottom: 12, marginLeft: 4 }}>{licenseExpirationError}</Text> : null}
                  {showDatePicker && (
                    <DateTimePicker
                      value={licenseExpiration ? new Date(licenseExpiration) : new Date()} mode="date" display="default"
                      onChange={(event, selectedDate) => {
                        setShowDatePicker(Platform.OS === 'ios');
                        if (selectedDate) {
                          const formattedDate = selectedDate.toISOString().split('T')[0];
                          setLicenseExpiration(formattedDate);
                          const expDate = new Date(selectedDate); const today = new Date(); today.setHours(0, 0, 0, 0); expDate.setHours(0, 0, 0, 0);
                          if (expDate < today) setLicenseExpirationError('La date de votre permis est déjà expirée.');
                          else setLicenseExpirationError('');
                        }
                      }}
                    />
                  )}
                  <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 24, gap: 12 }} onPress={pickLicensePhoto}>
                    <Ionicons name="camera-outline" size={24} color={theme.colors.primary} />
                    <Text style={{ flex: 1, color: theme.colors.text, fontSize: 14 }}>{driverLicensePhoto ? 'Photo sélectionnée' : 'Ajouter une photo du permis'}</Text>
                    {driverLicensePhoto && <Ionicons name="checkmark-circle" size={20} color={theme.colors.success} />}
                  </TouchableOpacity>
                </>
              )}
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
      </AppBottomSheet>

      {/* ── Vehicle warning ── */}
      <AppBottomSheet visible={showVehicleWarning} onClose={() => setShowVehicleWarning(false)} snapPoints={['40%', '50%']}>
        <View style={{ alignItems: 'center', padding: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 16 }}>
            <Ionicons name="bicycle-outline" size={46} color={theme.colors.primary} />
            <Ionicons name="car-sport-outline" size={46} color={theme.colors.primary} />
            <Ionicons name="car-outline" size={46} color={theme.colors.primary} />
          </View>
          <Text style={styles.modalTitle}>Véhicule requis</Text>
          <Text style={[styles.notLoggedText, { textAlign: 'center', marginTop: 8 }]}>Enregistrez votre véhicule dans votre profil avant de publier.</Text>
          <TouchableOpacity style={[styles.modalBtn, { marginTop: 24, width: '100%' }]} onPress={() => { setShowVehicleWarning(false); router.push('/(tabs)/profile'); }}>
            <LinearGradient colors={[theme.colors.primary, '#3B82F6']} style={styles.modalBtnGradient}>
              <Text style={styles.modalBtnText}>Aller au profil</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </AppBottomSheet>

      {/* ── Expired license warning ── */}
      <AppBottomSheet visible={showExpiredLicenseWarning} onClose={() => setShowExpiredLicenseWarning(false)} snapPoints={['40%', '50%']}>
        <View style={{ alignItems: 'center', padding: 16 }}>
          <Ionicons name="warning-outline" size={60} color={theme.colors.error} style={{ marginBottom: 16 }} />
          <Text style={styles.modalTitle}>Permis invalide</Text>
          <Text style={[styles.notLoggedText, { textAlign: 'center', marginTop: 8 }]}>Les informations de votre permis sont manquantes ou expirées.</Text>
          <TouchableOpacity style={[styles.modalBtn, { marginTop: 24, width: '100%' }]} onPress={() => { setShowExpiredLicenseWarning(false); router.push('/(tabs)/profile'); }}>
            <LinearGradient colors={[theme.colors.primary, '#3B82F6']} style={styles.modalBtnGradient}>
              <Text style={styles.modalBtnText}>Mettre à jour le permis</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </AppBottomSheet>
    </SafeAreaView>
  );
}

// ────────────────────────────────────────────────────────────────────
// STYLES
// ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6FA' },
  scrollContent: { flexGrow: 1, paddingHorizontal: 16, paddingBottom: 48, paddingTop: 8 },

  // Header
  header: { backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#EAEDF2', paddingBottom: 8 },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: theme.colors.text },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },

  // Step header
  stepTitle: { fontSize: 22, fontWeight: '800', color: theme.colors.text, marginTop: 20, marginBottom: 6 },
  stepSubtitle: { fontSize: 14, color: theme.colors.textLight, marginBottom: 20, lineHeight: 20 },

  // Route card (step 1)
  routeCard: {
    backgroundColor: '#FFFFFF', borderRadius: 20, paddingVertical: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.07, shadowRadius: 12, elevation: 4,
    marginBottom: 16,
  },
  locationRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  dotGreen: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#22C55E', borderWidth: 2, borderColor: '#DCFCE7' },
  dotRed: { width: 12, height: 12, borderRadius: 6, backgroundColor: theme.colors.primary, borderWidth: 2, borderColor: `${theme.colors.primary}30` },
  routeDivider: { marginLeft: 28, paddingLeft: 16, borderLeftWidth: 2, borderLeftColor: '#E5E7EB', borderStyle: 'dashed', paddingVertical: 4, marginVertical: 0 },
  routeLine: { height: 12 },
  locationContent: { flex: 1, marginLeft: 14 },
  locationLabel: { fontSize: 11, color: theme.colors.textLight, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  locationValue: { fontSize: 16, fontWeight: '700', color: theme.colors.text },
  locationPlaceholder: { color: '#C4C4C4', fontWeight: '400' },

  // Estimation card (step 1)
  estimationCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
    marginBottom: 16,
  },
  estimationItem: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  estimationLabel: { fontSize: 11, color: theme.colors.textLight, fontWeight: '600' },
  estimationValue: { fontSize: 18, fontWeight: '800', color: theme.colors.text },
  estimationDivider: { width: 1, height: 40, backgroundColor: '#E5E7EB', marginHorizontal: 16 },

  // Step 2 cards
  row: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  halfCard: {
    flex: 1, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, gap: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  halfCardLabel: { fontSize: 12, color: theme.colors.textLight, fontWeight: '600' },
  halfCardValue: { fontSize: 16, fontWeight: '700', color: theme.colors.text },

  seatCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
    marginBottom: 16, gap: 12,
  },
  seatLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: theme.colors.text },
  seatStepper: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  seatBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' },
  seatValue: { fontSize: 22, fontWeight: '800', color: theme.colors.text, minWidth: 30, textAlign: 'center' },

  recurrentCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
    marginBottom: 16,
  },
  recurrentHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: '#FAFBFC' },
  recurrentHeaderText: { fontSize: 15, fontWeight: '700', color: theme.colors.text },
  recurrentBody: { padding: 16, borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  recurrentLabel: { fontSize: 13, fontWeight: '600', color: theme.colors.text, marginBottom: 8 },
  dateSelector: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 4 },
  dateSelectorText: { fontSize: 14, fontWeight: '600', color: theme.colors.text },
  repeatTypeContainer: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  repeatBox: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#F8FAFC', borderRadius: 10, paddingVertical: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  repeatBoxActive: { backgroundColor: '#EFF6FF', borderColor: theme.colors.primary },
  repeatBoxText: { fontSize: 13, fontWeight: '600', color: theme.colors.textLight },
  repeatBoxTextActive: { color: theme.colors.primary },
  daysContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 4 },
  dayBox: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  dayBoxActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  dayBoxText: { fontSize: 11, fontWeight: '700', color: theme.colors.textLight },
  dayBoxTextActive: { color: '#FFFFFF' },
  estimatedRidesBox: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, backgroundColor: '#EFF6FF', borderRadius: 10, padding: 10 },
  estimatedRidesText: { fontSize: 13, fontWeight: '600', color: theme.colors.primary },

  // Step 3 — Price
  suggestCard: {
    backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.07, shadowRadius: 12, elevation: 4,
    marginBottom: 16, borderWidth: 1, borderColor: `${theme.colors.primary}20`,
  },
  suggestHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  suggestHeaderText: { fontSize: 13, fontWeight: '700', color: theme.colors.primary, textTransform: 'uppercase', letterSpacing: 0.5 },
  suggestPrice: { fontSize: 36, fontWeight: '900', color: theme.colors.text, marginBottom: 4 },
  suggestSub: { fontSize: 13, color: theme.colors.textLight, marginBottom: 16 },
  suggestRange: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  suggestRangeItem: { alignItems: 'center' },
  suggestRangeLabel: { fontSize: 11, color: theme.colors.textLight, fontWeight: '600' },
  suggestRangeValue: { fontSize: 14, fontWeight: '700', color: theme.colors.text },
  suggestRangeBar: { flex: 1, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2 },
  suggestRangeBarFill: { width: '50%', height: '100%', backgroundColor: theme.colors.primary, borderRadius: 2 },
  suggestBtnRow: { flexDirection: 'row', gap: 8 },
  suggestPresetBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: '#F5F6FA', alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  suggestPresetBtnActive: { backgroundColor: `${theme.colors.primary}15`, borderColor: theme.colors.primary },
  suggestPresetText: { fontSize: 13, fontWeight: '700', color: theme.colors.textLight },
  suggestPresetTextActive: { color: theme.colors.primary },
  priceInputCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  priceInputLabel: { fontSize: 12, fontWeight: '700', color: theme.colors.textLight, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  priceInputRow: { flexDirection: 'row', alignItems: 'center' },
  priceInputField: { flex: 1, fontSize: 40, fontWeight: '900', color: theme.colors.text },
  priceInputCurrency: { fontSize: 18, fontWeight: '700', color: theme.colors.textLight, marginLeft: 8 },
  commissionCard: { backgroundColor: '#F8FAFC', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 16 },
  commissionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  commissionLabel: { fontSize: 14, fontWeight: '600', color: theme.colors.text },
  commissionValue: { fontSize: 15, fontWeight: '800', color: theme.colors.text },
  commissionLabelSub: { fontSize: 12, color: theme.colors.textLight },
  commissionValueSub: { fontSize: 13, color: theme.colors.textLight, fontWeight: '600' },
  commissionDivider: { height: 1, backgroundColor: '#E2E8F0', marginVertical: 8 },
  commissionLabelTotal: { fontSize: 15, fontWeight: '800', color: theme.colors.primary },
  commissionValueTotal: { fontSize: 18, fontWeight: '900', color: theme.colors.primary },

  // Step 4 — Preferences
  miniSummary: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#EFF6FF', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 20 },
  miniSummaryText: { flex: 1, fontSize: 13, fontWeight: '600', color: theme.colors.primary },
  miniSummaryPrice: { fontSize: 14, fontWeight: '800', color: theme.colors.primary },
  sectionLabel: { fontSize: 14, fontWeight: '700', color: theme.colors.text, marginTop: 16, marginBottom: 8 },
  prefList: { gap: 8, marginBottom: 8 },
  prefToggleRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, gap: 12, borderWidth: 1, borderColor: 'transparent' },
  prefToggleRowActive: { backgroundColor: `${theme.colors.primary}08`, borderColor: `${theme.colors.primary}25` },
  prefToggleIconBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  prefToggleIconBoxActive: { backgroundColor: theme.colors.primary },
  prefToggleLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: theme.colors.text },
  prefToggleLabelActive: { color: theme.colors.primary },
  prefToggleBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  prefToggleBadgeOn: { backgroundColor: `${theme.colors.primary}15` },
  prefToggleBadgeOff: { backgroundColor: '#F3F4F6' },
  prefToggleBadgeText: { fontSize: 12, fontWeight: '700', color: theme.colors.textLight },
  descriptionCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, marginBottom: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  descriptionInput: { fontSize: 14, color: theme.colors.text, minHeight: 90, textAlignVertical: 'top', lineHeight: 22 },
  descriptionCounter: { fontSize: 11, color: theme.colors.textLight, textAlign: 'right', marginTop: 4 },

  // Buttons
  nextBtn: { borderRadius: 18, overflow: 'hidden', marginTop: 8 },
  nextBtnGradient: { flexDirection: 'row', height: 60, justifyContent: 'center', alignItems: 'center', gap: 10 },
  nextBtnText: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  publishBtn: { borderRadius: 18, overflow: 'hidden', marginTop: 8 },
  publishBtnGradient: { flexDirection: 'row', height: 64, justifyContent: 'center', alignItems: 'center', gap: 12 },
  publishBtnText: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
  publishBtnDisabled: { opacity: 0.6 },

  // Not logged / not verified screens
  notLoggedTitle: { fontSize: 22, fontWeight: '800', color: theme.colors.text, marginTop: 16, marginBottom: 8, textAlign: 'center' },
  notLoggedText: { fontSize: 14, color: theme.colors.textLight, textAlign: 'center', marginBottom: 24 },
  notLoggedButton: { borderRadius: 12, overflow: 'hidden' },
  notLoggedGradient: { paddingHorizontal: 32, paddingVertical: 14, justifyContent: 'center', alignItems: 'center' },
  notLoggedButtonText: { color: theme.colors.white, fontWeight: 'bold', fontSize: 16 },

  // Modal / Profile styles
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
  avatarPlaceholderText: { color: theme.colors.white, fontSize: 12, fontWeight: '600', marginTop: 4 },
  vehicleTypeLabel: { fontSize: 14, fontWeight: '600', color: theme.colors.text, marginBottom: 8, marginLeft: 4 },
  vehicleTypeContainer: { flexDirection: 'row', gap: 8, marginBottom: theme.spacing.lg },
  vehicleTypeBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center' },
  vehicleTypeBtnActive: { backgroundColor: `${theme.colors.primary}15`, borderColor: theme.colors.primary },
  vehicleTypeText: { fontSize: 13, fontWeight: '600', color: theme.colors.textMuted },
  vehicleTypeTextActive: { color: theme.colors.primary },
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