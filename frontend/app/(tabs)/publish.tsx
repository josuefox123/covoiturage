/**
 * ==============================================================
 * Fichier :
 * publish.tsx
 *
 * Description :
 * Composant ou logique de l'application Zemy.
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
import { LinearGradient } from 'expo-linear-gradient';
import { CustomAlert } from '../../src/utils/CustomAlert';

const { width } = Dimensions.get('window');

const PROFILE_STEPS = ['personal', 'vehicle', 'preferences'] as const;
type ProfileStep = typeof PROFILE_STEPS[number];

/**
 * Composant PublishScreen.
 *
 * Responsabilités :
 * - Affichage et gestion de l'état lié à PublishScreen.
 */
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

  // Recurrent rides
  const [isRecurrent, setIsRecurrent] = useState(false);
  const [endDateObj, setEndDateObj] = useState(new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000));
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [repeatType, setRepeatType] = useState<'single_week' | 'weekly'>('single_week');
  const [selectedDays, setSelectedDays] = useState<number[]>([]);

  const getEstimatedRides = () => {
    if (!isRecurrent || selectedDays.length === 0) return 0;
    if (repeatType === 'single_week') {
      return selectedDays.length;
    }
    if (endDateObj < selectedDateObj) return 0;
    let count = 0;
    const current = new Date(selectedDateObj);
    const end = new Date(endDateObj);
    while (current <= end) {
      const jsDay = current.getDay();
      const myDay = jsDay === 0 ? 6 : jsDay - 1; // 0=Mon
      if (selectedDays.includes(myDay)) count++;
      current.setDate(current.getDate() + 1);
    }
    return count;
  };

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

  // Parcel state
  const [acceptsParcels, setAcceptsParcels] = useState(false);
  const [maxParcels, setMaxParcels] = useState(1);
  const [maxWeightPerParcel, setMaxWeightPerParcel] = useState('');
  const [maxDimensions, setMaxDimensions] = useState('Petit'); // 'Petit', 'Moyen', 'Grand'
  const [pricePerParcel, setPricePerParcel] = useState('');
  const [allowedParcelTypes, setAllowedParcelTypes] = useState<string[]>([]);
  const ALL_PARCEL_TYPES = ['Documents', 'Colis', 'Alimentation', 'Électronique', 'Autres'];

  // Profile completion modal
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [profileStep, setProfileStep] = useState<ProfileStep>('personal');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [financialSettings, setFinancialSettings] = useState<any>(null);

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
  const [showExpiredLicenseWarning, setShowExpiredLicenseWarning] = useState(false);

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
        const primaryVehicle = results[0];
        
        if (primaryVehicle.vehicle_type === 'voiture') {
          if (!primaryVehicle.license_expiration || !primaryVehicle.driver_license_number || !primaryVehicle.driver_license_photo) {
            setHasVehicle(false);
            setShowExpiredLicenseWarning(true);
            return;
          }
          
          const expDate = new Date(primaryVehicle.license_expiration);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          if (expDate < today) {
            setHasVehicle(false);
            setShowExpiredLicenseWarning(true);
            return;
          }
        }
        
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

    const fetchSettings = async () => {
      try {
        const data = await authFetch('/financial-settings/');
        if (data && data.length > 0) {
          setFinancialSettings(data[0]);
        }
      } catch (e) {
        console.error("Erreur param financiers", e);
      }
    };
    fetchSettings();
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

    if (isRecurrent) {
      if (selectedDays.length === 0) {
        CustomAlert.alert('Erreur', 'Veuillez sélectionner au moins un jour pour la récurrence.');
        return;
      }
      if (repeatType === 'weekly' && endDateObj < selectedDateObj) {
        CustomAlert.alert('Erreur', 'La date de fin doit être postérieure à la date de début.');
        return;
      }
    }

    setLoading(true);
    try {
      const dateString = selectedDateObj.toISOString().split('T')[0];
      const payload: any = {
        departure_location: departure,
        arrival_location: arrival,
        departure_date: dateString,
        departure_time: time + ':00',
        driver_payout: parseInt(price),
        total_seats: seats,
        seats_available: seats,
        vehicle: null,
        accepts_parcels: acceptsParcels,
      };

      if (acceptsParcels) {
        payload.max_parcels = maxParcels;
        payload.max_weight_per_parcel = parseFloat(maxWeightPerParcel || '0');
        payload.max_dimensions = maxDimensions;
        payload.price_per_parcel = parseInt(pricePerParcel || '0');
        payload.allowed_parcel_types = allowedParcelTypes;
      }

      if (isRecurrent) {
        payload.is_recurrent = true;
        payload.start_date = dateString;
        if (repeatType === 'single_week') {
          const end = new Date(selectedDateObj);
          end.setDate(end.getDate() + 6);
          payload.end_date = end.toISOString().split('T')[0];
        } else {
          payload.end_date = endDateObj.toISOString().split('T')[0];
        }
        payload.repeat_type = 'weekly';
        payload.week_days = selectedDays;
      }

      const res = await authFetch('/rides/', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      const message = isRecurrent && res.message ? res.message : `Votre trajet de ${departure} vers ${arrival} a été publié !`;
      
      CustomAlert.alert('Félicitations ! 🎉', message, [
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

            {/* Informations du trajet */}
            <Text style={styles.sectionTitle}>Informations du trajet</Text>
            
            <View style={styles.card}>
              <TouchableOpacity style={styles.locationCard} onPress={() => setPickingLocationFor('departure')} activeOpacity={0.7}>
                <Ionicons name="ellipse-outline" color={theme.colors.primary} size={20} />
                <View style={styles.locationContent}>
                  <Text style={styles.locationLabel}>Lieu de départ</Text>
                  <Text style={styles.locationValue}>{departure || "Choisir le départ"}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
              </TouchableOpacity>

              <View style={styles.dividerLine} />

              <TouchableOpacity style={styles.locationCard} onPress={() => setPickingLocationFor('arrival')} activeOpacity={0.7}>
                <Ionicons name="location-outline" color={theme.colors.primary} size={22} style={{ marginLeft: -1 }} />
                <View style={styles.locationContent}>
                  <Text style={styles.locationLabel}>Destination</Text>
                  <Text style={styles.locationValue}>{arrival || "Choisir la destination"}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            {showEstimation && (
              <View style={styles.estimationRow}>
                {estimationLoading ? (
                  <ActivityIndicator size="small" color={theme.colors.primary} />
                ) : estimation ? (
                  <>
                    <Ionicons name="analytics-outline" size={16} color={theme.colors.textLight} />
                    <Text style={styles.estText}>{estimation.distanceKm.toLocaleString()} km</Text>
                    <Ionicons name="time-outline" size={16} color={theme.colors.textLight} />
                    <Text style={styles.estText}>{formatDuration(estimation.durationMin)}</Text>
                  </>
                ) : null}
              </View>
            )}

            {!isRecurrent ? (
              <View style={styles.row}>
                <TouchableOpacity style={styles.halfCard} onPress={() => setShowDatePicker(true)} activeOpacity={0.7}>
                  <Text style={styles.halfCardLabel}>Date de départ</Text>
                  <Text style={styles.halfCardValue}>{selectedDateObj.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.halfCard} onPress={() => setShowTimePicker(true)} activeOpacity={0.7}>
                  <Text style={styles.halfCardLabel}>Heure de départ</Text>
                  <Text style={styles.halfCardValue}>{time}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.row}>
                <TouchableOpacity style={[styles.halfCard, { flex: 1 }]} onPress={() => setShowTimePicker(true)} activeOpacity={0.7}>
                  <Text style={styles.halfCardLabel}>Heure de départ</Text>
                  <Text style={styles.halfCardValue}>{time}</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.row}>
              <View style={[styles.halfCard, { paddingVertical: 12 }]}>
                <Text style={styles.halfCardLabel}>Nombre de places</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                  <TouchableOpacity onPress={() => setSeats(Math.max(1, seats - 1))} style={styles.seatStepperBtn}>
                    <Ionicons name="remove" size={20} color={theme.colors.primary} />
                  </TouchableOpacity>
                  <Text style={styles.halfCardValue}>{seats}</Text>
                  <TouchableOpacity onPress={() => setSeats(Math.min(6, seats + 1))} style={styles.seatStepperBtn}>
                    <Ionicons name="add" size={20} color={theme.colors.primary} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={[styles.halfCard, { paddingVertical: 12 }]}>
                <Text style={styles.halfCardLabel}>Montant souhaité (FCFA)</Text>
                <TextInput
                  style={[styles.halfCardValue, { borderBottomWidth: 1, borderBottomColor: '#E5E7EB', padding: 0, paddingBottom: 4, marginTop: 4 }]}
                  placeholder="Ex: 1000"
                  placeholderTextColor={theme.colors.textLight}
                  value={price}
                  onChangeText={setPrice}
                  keyboardType="numeric"
                  maxLength={6}
                />
              </View>
            </View>

            {price ? (
              <View style={styles.commissionBox}>
                <View style={styles.commissionRow}>
                  <Text style={styles.commissionLabel}>Vous recevrez :</Text>
                  <Text style={styles.commissionValue}>{parseInt(price)} FCFA</Text>
                </View>
                <View style={styles.commissionRow}>
                  <Text style={styles.commissionLabelSub}>Commission Zemy ({financialSettings?.commission_percentage || 10}%) :</Text>
                  <Text style={styles.commissionValueSub}>{Math.max(financialSettings?.min_commission || 100, Math.floor(parseInt(price) * ((financialSettings?.commission_percentage || 10) / 100)))} FCFA</Text>
                </View>
                <View style={[styles.commissionRow, { borderTopWidth: 1, borderTopColor: '#E5E7EB', paddingTop: 8, marginTop: 4 }]}>
                  <Text style={styles.commissionLabelTotal}>Le passager paiera :</Text>
                  <Text style={styles.commissionValueTotal}>{parseInt(price) + Math.max(financialSettings?.min_commission || 100, Math.floor(parseInt(price) * ((financialSettings?.commission_percentage || 10) / 100)))} FCFA</Text>
                </View>
              </View>
            ) : null}

            {/* OPTIONS SECTION */}
            <Text style={styles.sectionTitle}>Services à bord</Text>
            <View style={styles.optionsList}>
              <OptionCard label="Bagages autorisés" icon={<Ionicons name="briefcase-outline" size={20} color={theme.colors.text} />} value={optLuggage} onChange={setOptLuggage} />
              <OptionCard label="Climatisation" icon={<Ionicons name="snow-outline" size={20} color={theme.colors.text} />} value={optAirCond} onChange={setOptAirCond} />
              <OptionCard label="Recharge téléphone" icon={<Ionicons name="battery-charging-outline" size={20} color={theme.colors.text} />} value={optCharge} onChange={setOptCharge} />
              <OptionCard label="Animaux acceptés" icon={<Ionicons name="paw-outline" size={20} color={theme.colors.text} />} value={optPets} onChange={setOptPets} />
            </View>

            {/* PARCELS SECTION */}
            <Text style={styles.sectionTitle}>Transport de colis</Text>
            <View style={styles.recurrentWrapper}>
              <View style={styles.recurrentHeader}>
                <Text style={styles.recurrentHeaderText}>J'accepte de transporter des colis</Text>
                <Switch
                  value={acceptsParcels}
                  onValueChange={setAcceptsParcels}
                  trackColor={{ false: '#E5E7EB', true: theme.colors.primaryLight }}
                  thumbColor={acceptsParcels ? theme.colors.primary : '#FFFFFF'}
                />
              </View>

              {acceptsParcels && (
                <View style={styles.recurrentBody}>
                  <View style={styles.row}>
                    <View style={[styles.halfCard, { paddingVertical: 12, elevation: 0, shadowOpacity: 0, borderWidth: 1, borderColor: '#E2E8F0' }]}>
                      <Text style={styles.halfCardLabel}>Max colis</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                        <TouchableOpacity onPress={() => setMaxParcels(Math.max(1, maxParcels - 1))} style={styles.seatStepperBtn}>
                          <Ionicons name="remove" size={20} color={theme.colors.primary} />
                        </TouchableOpacity>
                        <Text style={styles.halfCardValue}>{maxParcels}</Text>
                        <TouchableOpacity onPress={() => setMaxParcels(Math.min(10, maxParcels + 1))} style={styles.seatStepperBtn}>
                          <Ionicons name="add" size={20} color={theme.colors.primary} />
                        </TouchableOpacity>
                      </View>
                    </View>

                    <View style={[styles.halfCard, { paddingVertical: 12, elevation: 0, shadowOpacity: 0, borderWidth: 1, borderColor: '#E2E8F0' }]}>
                      <Text style={styles.halfCardLabel}>Poids max/colis (kg)</Text>
                      <TextInput
                        style={[styles.halfCardValue, { borderBottomWidth: 1, borderBottomColor: '#E5E7EB', padding: 0, paddingBottom: 4, marginTop: 4 }]}
                        placeholder="Ex: 5"
                        placeholderTextColor={theme.colors.textLight}
                        value={maxWeightPerParcel}
                        onChangeText={setMaxWeightPerParcel}
                        keyboardType="numeric"
                        maxLength={4}
                      />
                    </View>
                  </View>

                  <View style={styles.row}>
                    <View style={[styles.halfCard, { paddingVertical: 12, elevation: 0, shadowOpacity: 0, borderWidth: 1, borderColor: '#E2E8F0' }]}>
                      <Text style={styles.halfCardLabel}>Taille max</Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, gap: 8 }}>
                        {['Petit', 'Moyen', 'Grand'].map(dim => (
                          <TouchableOpacity
                            key={dim}
                            style={[styles.dayBox, maxDimensions === dim && styles.dayBoxActive, { width: 'auto', paddingHorizontal: 12 }]}
                            onPress={() => setMaxDimensions(dim)}
                          >
                            <Text style={[styles.dayBoxText, maxDimensions === dim && styles.dayBoxTextActive]}>{dim}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>

                    <View style={[styles.halfCard, { paddingVertical: 12, elevation: 0, shadowOpacity: 0, borderWidth: 1, borderColor: '#E2E8F0' }]}>
                      <Text style={styles.halfCardLabel}>Prix/colis (FCFA)</Text>
                      <TextInput
                        style={[styles.halfCardValue, { borderBottomWidth: 1, borderBottomColor: '#E5E7EB', padding: 0, paddingBottom: 4, marginTop: 4 }]}
                        placeholder="Ex: 1000"
                        placeholderTextColor={theme.colors.textLight}
                        value={pricePerParcel}
                        onChangeText={setPricePerParcel}
                        keyboardType="numeric"
                        maxLength={6}
                      />
                    </View>
                  </View>

                  {pricePerParcel ? (
                        <View style={[styles.commissionBox, { marginTop: 8 }]}>
                          <View style={styles.commissionRow}>
                            <Text style={styles.commissionLabel}>Prix conducteur :</Text>
                            <Text style={styles.commissionValue}>{parseInt(pricePerParcel)} FCFA</Text>
                          </View>
                          <View style={styles.commissionRow}>
                            <Text style={styles.commissionLabelSub}>Commission Zemy ({financialSettings?.parcel_commission_percentage || 8}%) :</Text>
                            <Text style={styles.commissionValueSub}>{Math.max(financialSettings?.min_parcel_commission || 100, Math.floor(parseInt(pricePerParcel) * ((financialSettings?.parcel_commission_percentage || 8) / 100)))} FCFA</Text>
                          </View>
                          <View style={[styles.commissionRow, { borderTopWidth: 1, borderTopColor: '#E5E7EB', paddingTop: 8, marginTop: 4 }]}>
                            <Text style={styles.commissionLabelTotal}>L'expéditeur paiera :</Text>
                            <Text style={styles.commissionValueTotal}>{parseInt(pricePerParcel) + Math.max(financialSettings?.min_parcel_commission || 100, Math.floor(parseInt(pricePerParcel) * ((financialSettings?.parcel_commission_percentage || 8) / 100)))} FCFA</Text>
                          </View>
                        </View>
                      ) : null}

                      <Text style={[styles.halfCardLabel, { marginTop: 16, marginBottom: 8 }]}>Types de colis autorisés</Text>
                  <View style={[styles.daysContainer, { justifyContent: 'flex-start' }]}>
                    {ALL_PARCEL_TYPES.map(type => {
                      const isSelected = allowedParcelTypes.includes(type);
                      return (
                        <TouchableOpacity
                          key={type}
                          style={[styles.dayBox, isSelected && styles.dayBoxActive, { width: 'auto', paddingHorizontal: 12, marginBottom: 8 }]}
                          onPress={() => {
                            if (isSelected) {
                              setAllowedParcelTypes(prev => prev.filter(t => t !== type));
                            } else {
                              setAllowedParcelTypes(prev => [...prev, type]);
                            }
                          }}
                        >
                          <Text style={[styles.dayBoxText, isSelected && styles.dayBoxTextActive]}>{type}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}
            </View>

            {/* Répétition */}
            <Text style={styles.sectionTitle}>Répétition</Text>
            <View style={styles.recurrentWrapper}>
              <View style={styles.recurrentHeader}>
                <Text style={styles.recurrentHeaderText}>Trajet récurrent</Text>
                <Switch
                  value={isRecurrent}
                  onValueChange={setIsRecurrent}
                  trackColor={{ false: '#E5E7EB', true: theme.colors.primaryLight }}
                  thumbColor={isRecurrent ? theme.colors.primary : '#FFFFFF'}
                />
              </View>

              {isRecurrent && (
                <View style={styles.recurrentBody}>
                  <View style={styles.repeatTypeContainer}>
                    <TouchableOpacity
                      style={[styles.repeatBox, repeatType === 'single_week' && styles.repeatBoxActive]}
                      onPress={() => setRepeatType('single_week')}
                    >
                      <Ionicons name="calendar-outline" size={18} color={repeatType === 'single_week' ? theme.colors.primary : theme.colors.textLight} />
                      <Text style={[styles.repeatBoxText, repeatType === 'single_week' && styles.repeatBoxTextActive]}>Une seule semaine</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.repeatBox, repeatType === 'weekly' && styles.repeatBoxActive]}
                      onPress={() => setRepeatType('weekly')}
                    >
                      <Ionicons name="calendar-number-outline" size={18} color={repeatType === 'weekly' ? theme.colors.primary : theme.colors.textLight} />
                      <Text style={[styles.repeatBoxText, repeatType === 'weekly' && styles.repeatBoxTextActive]}>Toutes les semaines</Text>
                    </TouchableOpacity>
                  </View>

                  {repeatType === 'single_week' && (
                    <View style={styles.dateBlock}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.recurrentLabel}>Date de début</Text>
                        <TouchableOpacity style={styles.dateSelector} onPress={() => setShowDatePicker(true)}>
                          <Text style={styles.dateSelectorText}>
                            {selectedDateObj.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                          </Text>
                        </TouchableOpacity>
                      </View>
                      <View style={{ flex: 1 }} />
                    </View>
                  )}

                  {repeatType === 'weekly' && (
                    <View style={styles.dateBlock}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.recurrentLabel}>Date de début</Text>
                        <TouchableOpacity style={styles.dateSelector} onPress={() => setShowDatePicker(true)}>
                          <Text style={styles.dateSelectorText}>
                            {selectedDateObj.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                          </Text>
                        </TouchableOpacity>
                      </View>
                      <View style={{ width: 12 }} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.recurrentLabel}>Date de fin</Text>
                        <TouchableOpacity style={styles.dateSelector} onPress={() => setShowEndDatePicker(true)}>
                          <Text style={styles.dateSelectorText}>
                            {endDateObj.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                  <Text style={styles.recurrentLabel}>Sélectionnez les jours</Text>
                  <View style={styles.daysContainer}>
                    {['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di'].map((day, idx) => {
                      const isSelected = selectedDays.includes(idx);
                      return (
                        <TouchableOpacity
                          key={day}
                          style={[styles.dayBox, isSelected && styles.dayBoxActive]}
                          onPress={() => {
                            if (isSelected) {
                              setSelectedDays(prev => prev.filter(d => d !== idx));
                            } else {
                              setSelectedDays(prev => [...prev, idx]);
                            }
                          }}
                        >
                          <Text style={[styles.dayBoxText, isSelected && styles.dayBoxTextActive]}>{day}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}
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

            {showEndDatePicker && (
              <DateTimePicker
                value={endDateObj}
                mode="date"
                display="default"
                minimumDate={selectedDateObj}
                onChange={(event, selectedDate) => {
                  setShowEndDatePicker(Platform.OS === 'ios');
                  if (event.type === 'set' && selectedDate) {
                    setShowEndDatePicker(false);
                    setEndDateObj(selectedDate);
                  } else if (event.type === 'dismissed') {
                    setShowEndDatePicker(false);
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

            {/* SUMMARY SECTION */}
            {showSummary && (
              <View style={styles.summaryBox}>
                <Text style={styles.summaryTitle}>Résumé</Text>
                
                <View style={styles.summaryGridItem}>
                  <Text style={styles.summaryTextBold}>Départ :</Text>
                  <Text style={styles.summaryTextValue}>{departure}</Text>
                </View>
                <View style={styles.summaryGridItem}>
                  <Text style={styles.summaryTextBold}>Destination :</Text>
                  <Text style={styles.summaryTextValue}>{arrival}</Text>
                </View>
                <View style={styles.summaryGridItem}>
                  <Text style={styles.summaryTextBold}>Date :</Text>
                  <Text style={styles.summaryTextValue}>{selectedDateObj.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</Text>
                </View>
                <View style={styles.summaryGridItem}>
                  <Text style={styles.summaryTextBold}>Heure :</Text>
                  <Text style={styles.summaryTextValue}>{time}</Text>
                </View>

                {isRecurrent && (
                  <>
                    <View style={styles.summaryGridItem}>
                      <Text style={styles.summaryTextBold}>Récurrence :</Text>
                      <Text style={styles.summaryTextValue}>{repeatType === 'single_week' ? 'Une seule semaine' : 'Toutes les semaines'}</Text>
                    </View>
                    <View style={styles.summaryGridItem}>
                      <Text style={styles.summaryTextBold}>Jours :</Text>
                      <Text style={styles.summaryTextValue}>
                        {selectedDays.map(d => ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'][d]).join(', ')}
                      </Text>
                    </View>
                    {repeatType === 'weekly' && (
                      <View style={styles.summaryGridItem}>
                        <Text style={styles.summaryTextBold}>Fin :</Text>
                        <Text style={styles.summaryTextValue}>{endDateObj.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</Text>
                      </View>
                    )}
                    <View style={[styles.summaryGridItem, { marginTop: 8, borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 8 }]}>
                      <Text style={[styles.summaryTextBold, { color: theme.colors.primary }]}>Nombre estimé de trajets :</Text>
                      <Text style={[styles.summaryTextBold, { color: theme.colors.primary, fontWeight: '800' }]}>{getEstimatedRides()}</Text>
                    </View>
                  </>
                )}
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
                  <Text style={styles.publishBigBtnText}>Publier le trajet</Text>
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

      {/* Expired License Warning Modal */}
      <Modal visible={showExpiredLicenseWarning} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TouchableOpacity style={{ alignSelf: 'flex-end', padding: 8 }} onPress={() => setShowExpiredLicenseWarning(false)}>
              <Ionicons name="close" size={24} color={theme.colors.textMuted} />
            </TouchableOpacity>

            <View style={{ alignItems: 'center', padding: 16 }}>
              <Ionicons name="warning-outline" size={60} color={theme.colors.error} style={{ marginBottom: 16 }} />
              <Text style={styles.modalTitle}>Permis invalide</Text>
              <Text style={[styles.notLoggedText, { textAlign: 'center', marginTop: 8 }]}>
                Les informations de votre permis de conduire sont manquantes ou expirées. Veuillez les mettre à jour pour pouvoir publier un trajet.
              </Text>

              <TouchableOpacity style={[styles.modalBtn, { marginTop: 24, width: '100%' }]} onPress={() => {
                setShowExpiredLicenseWarning(false);
                router.push('/(tabs)/profile');
              }}>
                <LinearGradient colors={[theme.colors.primary, '#3B82F6']} style={styles.modalBtnGradient}>
                  <Text style={styles.modalBtnText}>Mettre à jour le permis</Text>
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

  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2, marginBottom: 16 },
  locationCard: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  locationContent: { flex: 1, marginLeft: 12 },
  locationLabel: { fontSize: 13, color: theme.colors.textLight, marginBottom: 2 },
  locationValue: { fontSize: 16, fontWeight: '600', color: theme.colors.text },
  dividerLine: { height: 1, backgroundColor: '#F3F4F6', marginHorizontal: 40 },

  estimationRow: { flexDirection: 'row', gap: 16, paddingHorizontal: 8, marginTop: 8, marginBottom: 16 },
  estText: { fontSize: 14, fontWeight: '600', color: theme.colors.textLight },

  row: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  halfCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  halfCardLabel: { fontSize: 13, color: theme.colors.textLight, marginBottom: 4 },
  halfCardValue: { fontSize: 16, fontWeight: '700', color: theme.colors.text },

  // Styles for Recurrent Rides
  recurrentWrapper: { backgroundColor: '#FFFFFF', borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2, marginBottom: 16 },
  recurrentHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: '#F8FAFC' },
  recurrentHeaderText: { fontSize: 16, fontWeight: '700', color: theme.colors.text },
  recurrentBody: { padding: 16, borderTopWidth: 1, borderTopColor: '#E2E8F0' },
  
  dateBlock: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  recurrentLabel: { fontSize: 14, fontWeight: '600', color: theme.colors.text, marginBottom: 8 },
  dateSelector: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#E2E8F0' },
  dateSelectorText: { fontSize: 14, fontWeight: '600', color: theme.colors.text },
  
  repeatTypeContainer: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  repeatBox: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 10, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  repeatBoxActive: { backgroundColor: '#EFF6FF', borderColor: theme.colors.primary },
  repeatBoxText: { fontSize: 13, fontWeight: '600', color: theme.colors.textLight },
  repeatBoxTextActive: { color: theme.colors.primary },

  daysContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  dayBox: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  dayBoxActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  dayBoxText: { fontSize: 13, fontWeight: '600', color: theme.colors.textLight },
  dayBoxTextActive: { color: theme.colors.white },

  priceCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  priceInput: { fontSize: 32, fontWeight: '800', color: theme.colors.text, textAlign: 'center', minWidth: 120 },
  priceCurrency: { fontSize: 18, fontWeight: '700', color: theme.colors.textLight, marginLeft: 8 },

  seatStepperBtn: { padding: 8, backgroundColor: '#EFF6FF', borderRadius: 8 },
  optionsList: { gap: 8, marginBottom: 16 },
  optionCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 16, borderRadius: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  optionIcon: { fontSize: 20, marginRight: 12 },
  optionLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: theme.colors.text },

  summaryBox: { backgroundColor: '#EFF6FF', borderRadius: 16, padding: 16, marginTop: 24, borderWidth: 1, borderColor: '#BFDBFE' },
  
  commissionBox: { backgroundColor: '#F8FAFC', borderRadius: 16, padding: 16, marginTop: 16, marginBottom: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  commissionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  commissionLabel: { fontSize: 14, fontWeight: '600', color: theme.colors.text },
  commissionValue: { fontSize: 14, fontWeight: '700', color: theme.colors.text },
  commissionLabelSub: { fontSize: 13, color: theme.colors.textLight },
  commissionValueSub: { fontSize: 13, color: theme.colors.textLight },
  commissionLabelTotal: { fontSize: 15, fontWeight: '800', color: theme.colors.primary },
  commissionValueTotal: { fontSize: 16, fontWeight: '800', color: theme.colors.primary },
  summaryTitle: { fontSize: 14, fontWeight: '700', color: theme.colors.primary, marginBottom: 12, textTransform: 'uppercase' },
  summaryGridItem: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  summaryTextBold: { fontSize: 14, fontWeight: '600', color: theme.colors.textLight },
  summaryTextValue: { fontSize: 14, fontWeight: '700', color: theme.colors.text },

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