import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Image,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { getMediaUrl } from '../../../../../utils/media';
import { BottomSheetTextInput as TextInput } from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as SecureStore from 'expo-secure-store';
import { API_URL } from '../../../../../services/api';
import DateTimePicker from '@react-native-community/datetimepicker';
import { theme } from '../../../../../styles/theme';
import { AppBottomSheet } from '../../../../../components/AppBottomSheet';
import { CustomAlert } from '../../../../../utils/CustomAlert';
import { formatBeninLicensePlate } from '../../../../../utils/vehicleFormatter';

interface VehicleModalProps {
  visible: boolean;
  onClose: () => void;
  user: any;
  authFetch: any;
  vehicleId: string | null;
  onSaveSuccess: (updatedData: { id: string; brand: string; model: string; plate: string; vehicleType?: string }) => void;
}

const VEHICLE_TYPES: { key: 'voiture' | 'moto' | 'tricycle'; label: string; icon: string; activeColor: string }[] = [
  { key: 'voiture',  label: 'Voiture',  icon: 'car-sport-outline',  activeColor: '#2563EB' },
  { key: 'moto',     label: 'Moto',     icon: 'bicycle-outline',    activeColor: '#7C3AED' },
  { key: 'tricycle', label: 'Tricycle', icon: 'car-outline',        activeColor: '#D97706' },
];

/** Champ texte stylisé moderne */
function ModernFieldInput({
  label,
  value,
  onChange,
  icon,
  placeholder,
  required,
  capitalize,
  keyboard,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  icon: string;
  placeholder?: string;
  required?: boolean;
  capitalize?: 'none' | 'sentences' | 'words' | 'characters';
  keyboard?: 'default' | 'email-address' | 'numeric';
}) {
  const hasValue = value.length > 0;
  return (
    <View style={vs.fieldWrapper}>
      <View style={vs.fieldIconBox}>
        <Ionicons name={icon as any} size={18} color={hasValue ? '#2563EB' : '#94A3B8'} />
      </View>
      <View style={vs.fieldContent}>
        <Text style={[vs.fieldLabel, hasValue && vs.fieldLabelActive]} numberOfLines={1}>
          {label}{required && <Text style={vs.required}> *</Text>}
        </Text>
        <TextInput
          style={vs.fieldInput}
          value={value}
          onChangeText={onChange}
          placeholder={hasValue ? '' : (placeholder || '')}
          placeholderTextColor="#94A3B8"
          autoCapitalize={capitalize || 'sentences'}
          autoCorrect={false}
          keyboardType={keyboard || 'default'}
        />
      </View>
    </View>
  );
}

/** Champ date avec sélecteur */
function ModernDateField({
  label,
  value,
  onPress,
  error,
  required,
}: {
  label: string;
  value: string;
  onPress: () => void;
  error?: string;
  required?: boolean;
}) {
  const hasVal = !!value;
  return (
    <View style={{ marginBottom: 10 }}>
      <TouchableOpacity
        style={[vs.fieldWrapper, { marginBottom: 0 }, error ? vs.fieldError : null]}
        onPress={onPress}
        activeOpacity={0.8}
      >
        <View style={vs.fieldIconBox}>
          <Ionicons
            name="calendar-outline"
            size={18}
            color={error ? '#EF4444' : hasVal ? '#2563EB' : '#94A3B8'}
          />
        </View>
        <View style={vs.fieldContent}>
          <Text style={[vs.fieldLabel, hasVal && vs.fieldLabelActive, !!error && { color: '#EF4444' }]} numberOfLines={1}>
            {label}{required && <Text style={vs.required}> *</Text>}
          </Text>
          <Text
            style={[vs.fieldInput, { paddingTop: 2, color: hasVal ? '#0F172A' : '#94A3B8' }]}
            numberOfLines={1}
          >
            {hasVal ? value : 'Sélectionner une date'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color="#94A3B8" style={{ marginRight: 10 }} />
      </TouchableOpacity>
      {error ? (
        <View style={vs.errorRow}>
          <Ionicons name="alert-circle" size={13} color="#EF4444" />
          <Text style={vs.errorText}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
}

/** Composant Photo/Document moderne avec prévisualisation */
function ModernPhotoField({
  label,
  uri,
  onPress,
  required,
}: {
  label: string;
  uri: string | null;
  onPress: () => void;
  required?: boolean;
}) {
  return (
    <View style={vs.photoContainer}>
      <View style={vs.photoHeaderRow}>
        <Text style={vs.photoSectionLabel} numberOfLines={1}>
          {label}{required && <Text style={vs.required}> *</Text>}
        </Text>
        {uri ? (
          <View style={vs.photoReadyBadge}>
            <Ionicons name="checkmark-circle" size={12} color="#059669" />
            <Text style={vs.photoReadyText}>Document joint</Text>
          </View>
        ) : (
          <Text style={vs.photoMissingText}>Requis</Text>
        )}
      </View>

      <TouchableOpacity style={vs.photoCard} onPress={onPress} activeOpacity={0.85}>
        {uri ? (
          <View style={vs.photoPreviewWrapper}>
            <Image
              source={{ uri: getMediaUrl(uri) }}
              style={vs.photoPreviewImage}
              resizeMode="cover"
            />
            <LinearGradient
              colors={['transparent', 'rgba(15, 23, 42, 0.75)']}
              style={vs.photoOverlayGradient}
            >
              <View style={vs.photoOverlayContent}>
                <Ionicons name="camera-reverse" size={16} color="#fff" />
                <Text style={vs.photoOverlayText}>Changer de photo</Text>
              </View>
            </LinearGradient>
          </View>
        ) : (
          <View style={vs.photoEmptyBox}>
            <View style={vs.photoEmptyIconWrap}>
              <Ionicons name="camera-outline" size={22} color="#2563EB" />
            </View>
            <View style={vs.photoEmptyTextBox}>
              <Text style={vs.photoEmptyTitle}>Prendre une photo du document</Text>
              <Text style={vs.photoEmptySubtitle}>Assurez-vous que les informations soient bien lisibles</Text>
            </View>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

export function VehicleModal({
  visible,
  onClose,
  user,
  authFetch,
  vehicleId,
  onSaveSuccess,
}: VehicleModalProps) {
  const [vehiclesList, setVehiclesList] = useState<any[]>([]);
  const [activeVehicleId, setActiveVehicleId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [color, setColor] = useState('');
  const [plate, setPlate] = useState('');
  const [vehicleType, setVehicleType] = useState<'voiture' | 'moto' | 'tricycle'>('voiture');
  const [driverLicense, setDriverLicense] = useState('');
  const [licenseExpiration, setLicenseExpiration] = useState('');
  const [licenseExpirationError, setLicenseExpirationError] = useState('');
  const [driverLicensePhoto, setDriverLicensePhoto] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [insuranceNumber, setInsuranceNumber] = useState('');
  const [insuranceExpiration, setInsuranceExpiration] = useState('');
  const [insuranceExpirationError, setInsuranceExpirationError] = useState('');
  const [insurancePhoto, setInsurancePhoto] = useState<string | null>(null);
  const [showInsuranceDatePicker, setShowInsuranceDatePicker] = useState(false);

  const initialLicenseRef = useRef<{
    number: string; expiration: string; photo: string | null;
    insuranceNumber: string; insuranceExpiration: string; insurancePhoto: string | null;
  }>({ number: '', expiration: '', photo: null, insuranceNumber: '', insuranceExpiration: '', insurancePhoto: null });

  const populateFields = (vehicle: any | null, defaultType?: 'voiture' | 'moto' | 'tricycle') => {
    if (vehicle) {
      setActiveVehicleId(vehicle.id);
      const parts = (vehicle.brand_model || '').split(' ');
      setBrand(parts[0] || '');
      setModel(parts.slice(1).join(' ') || '');
      setColor(vehicle.color || '');
      setPlate(vehicle.license_plate || '');
      setVehicleType(vehicle.vehicle_type || 'voiture');
      setDriverLicense(vehicle.driver_license_number || '');
      setLicenseExpiration(vehicle.license_expiration || '');
      setDriverLicensePhoto(vehicle.driver_license_photo || null);
      setInsuranceNumber(vehicle.insurance_number || '');
      setInsuranceExpiration(vehicle.insurance_expiration || '');
      setInsurancePhoto(vehicle.insurance_photo || null);
      setInsuranceExpirationError('');
      initialLicenseRef.current = {
        number: vehicle.driver_license_number || '', expiration: vehicle.license_expiration || '',
        photo: vehicle.driver_license_photo || null, insuranceNumber: vehicle.insurance_number || '',
        insuranceExpiration: vehicle.insurance_expiration || '', insurancePhoto: vehicle.insurance_photo || null,
      };
    } else {
      setActiveVehicleId(null);
      setBrand(''); setModel(''); setColor(''); setPlate('');
      if (defaultType) setVehicleType(defaultType);
      setDriverLicense(''); setLicenseExpiration(''); setDriverLicensePhoto(null);
      setInsuranceNumber(''); setInsuranceExpiration(''); setInsurancePhoto(null);
      setInsuranceExpirationError('');
      initialLicenseRef.current = { number: '', expiration: '', photo: null, insuranceNumber: '', insuranceExpiration: '', insurancePhoto: null };
    }
    setLicenseExpirationError('');
  };

  const fetchVehicles = async (selectId?: string | null) => {
    setIsLoading(true);
    try {
      const data = await authFetch('/vehicles/');
      const list = Array.isArray(data) ? data : (data?.results || []);
      setVehiclesList(list);
      if (list.length > 0) {
        let target = null;
        if (selectId) target = list.find((v: any) => v.id === selectId);
        else if (vehicleId) target = list.find((v: any) => v.id === vehicleId);
        if (!target) target = list[0];
        populateFields(target);
      } else {
        populateFields(null, 'voiture');
      }
    } catch (e) {
      console.warn('[VehicleModal] Erreur fetchVehicles:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!visible) return;
    fetchVehicles(vehicleId);
  }, [visible, user]);

  const handleTypeSelect = (type: 'voiture' | 'moto' | 'tricycle') => {
    setVehicleType(type);
    const ofType = vehiclesList.filter((v: any) => (v.vehicle_type || 'voiture') === type);
    if (ofType.length > 0) populateFields(ofType[0]);
    else populateFields(null, type);
  };

  const pickPhoto = async (setter: (uri: string) => void) => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      CustomAlert.alert('Permission refusée', "Autorisez l'accès à la caméra pour photographier le document.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: false, quality: 0.8 });
    if (!result.canceled && result.assets[0]) setter(result.assets[0].uri);
  };

  const handleDeleteVehicle = () => {
    if (!activeVehicleId) return;
    CustomAlert.alert(
      'Supprimer ce véhicule',
      `Voulez-vous vraiment supprimer ${brand} ${model} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            try {
              await authFetch(`/vehicles/${activeVehicleId}/`, { method: 'DELETE' });
              CustomAlert.alert('Succès', 'Véhicule supprimé.');
              await fetchVehicles(null);
              onSaveSuccess({ id: '', brand: '', model: '', plate: '', vehicleType });
            } catch (e: any) {
              CustomAlert.alert('Erreur', e.message || 'Impossible de supprimer.');
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  };

  const handleSaveVehicle = async () => {
    if (!brand.trim() || !model.trim() || !color.trim() || !plate.trim()) {
      CustomAlert.alert('Champs requis', 'Veuillez renseigner la marque, le modèle, la couleur et le numéro de plaque.');
      return;
    }
    if (vehicleType === 'voiture') {
      if (!driverLicense.trim() || !licenseExpiration.trim() || !driverLicensePhoto) {
        CustomAlert.alert('Permis obligatoire', 'Le numéro, la date d\'expiration et la photo du permis de conduire sont obligatoires.');
        return;
      }
      const expDate = new Date(licenseExpiration);
      const today = new Date(); today.setHours(0, 0, 0, 0);
      if (expDate < today) { setLicenseExpirationError('Ce permis est expiré.'); return; }
      else setLicenseExpirationError('');

      if (!insuranceExpiration.trim() || !insurancePhoto) {
        CustomAlert.alert('Assurance obligatoire', 'La date d\'expiration et la photo de l\'attestation d\'assurance sont obligatoires.');
        return;
      }
      const insExpDate = new Date(insuranceExpiration); insExpDate.setHours(0, 0, 0, 0);
      if (insExpDate < today) { setInsuranceExpirationError('Cette assurance est expirée.'); return; }
      else setInsuranceExpirationError('');
    }

    setIsSaving(true);
    try {
      const token = await SecureStore.getItemAsync('zemy_access_token');
      if (!token) throw new Error('Session expirée. Veuillez vous reconnecter.');
      const formData = new FormData();
      formData.append('brand_model', `${brand.trim()} ${model.trim()}`);
      formData.append('color', color.trim());
      formData.append('license_plate', plate.trim());
      formData.append('vehicle_type', vehicleType);
      if (vehicleType === 'voiture') {
        formData.append('driver_license_number', driverLicense.trim());
        formData.append('license_expiration', licenseExpiration.trim());
        if (driverLicensePhoto && !driverLicensePhoto.startsWith('http')) {
          let uri = driverLicensePhoto;
          if (uri.startsWith('/')) uri = `file://${uri}`;
          (formData as any).append('driver_license_photo', { uri, name: 'license.jpg', type: 'image/jpeg' });
        }
        formData.append('insurance_number', insuranceNumber.trim());
        formData.append('insurance_expiration', insuranceExpiration.trim());
        if (insurancePhoto && !insurancePhoto.startsWith('http')) {
          let uri = insurancePhoto;
          if (uri.startsWith('/')) uri = `file://${uri}`;
          (formData as any).append('insurance_photo', { uri, name: 'insurance.jpg', type: 'image/jpeg' });
        }
      }
      const endpoint = activeVehicleId ? `/vehicles/${activeVehicleId}/` : '/vehicles/';
      const method = activeVehicleId ? 'PATCH' : 'POST';
      const res = await new Promise<any>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open(method, `${API_URL}${endpoint}`);
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.timeout = 60000;
        xhr.onload = () => {
          try {
            const r = JSON.parse(xhr.responseText);
            if (xhr.status >= 200 && xhr.status < 300) resolve(r);
            else reject(new Error(r.error || r.detail || `Erreur (${xhr.status})`));
          } catch { if (xhr.status >= 200 && xhr.status < 300) resolve({}); else reject(new Error(`Erreur serveur (${xhr.status})`)); }
        };
        xhr.onerror = () => reject(new Error('Connexion réseau impossible.'));
        xhr.ontimeout = () => reject(new Error('Requête expirée.'));
        xhr.send(formData);
      });
      const savedId = activeVehicleId || res?.id;
      CustomAlert.alert('Succès', activeVehicleId ? 'Véhicule mis à jour !' : 'Véhicule enregistré avec succès !');
      onSaveSuccess({ id: savedId, brand: brand.trim(), model: model.trim(), plate: plate.trim(), vehicleType });
      await fetchVehicles(savedId);
      onClose();
    } catch (e: any) {
      CustomAlert.alert('Erreur', e.message || "Impossible d'enregistrer le véhicule.");
    } finally {
      setIsSaving(false);
    }
  };

  const currentTypeVehicles = vehiclesList.filter((v: any) => (v.vehicle_type || 'voiture') === vehicleType);
  const activeType = VEHICLE_TYPES.find(t => t.key === vehicleType)!;
  const isEditing = !!activeVehicleId;

  return (
    <AppBottomSheet visible={visible} onClose={onClose} snapPoints={['88%', '95%']}>
      
      {/* ── Header épuré & accessible ── */}
      <View style={vs.header}>
        <View style={vs.headerLeft}>
          <View style={vs.headerIconPill}>
            <Ionicons name="car-sport" size={20} color="#2563EB" />
          </View>
          <View style={vs.headerTextWrap}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={vs.headerTitle}>Mes véhicules</Text>
              {isLoading && <ActivityIndicator size="small" color="#2563EB" style={{ marginLeft: 4 }} />}
            </View>
            <Text style={vs.headerSub}>Gérez vos véhicules de trajet</Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={onClose}
          style={vs.closeBtn}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close" size={18} color="#475569" />
        </TouchableOpacity>
      </View>

      {/* ── Sélecteur de type compact (Segmented Control) ── */}
      <View style={vs.typeSegmentContainer}>
        {VEHICLE_TYPES.map(t => {
          const isActive = vehicleType === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              style={[vs.typeSegmentBtn, isActive && vs.typeSegmentBtnActive]}
              onPress={() => handleTypeSelect(t.key)}
              activeOpacity={0.8}
            >
              <Ionicons
                name={t.icon as any}
                size={18}
                color={isActive ? '#2563EB' : '#64748B'}
              />
              <Text style={[vs.typeSegmentText, isActive && vs.typeSegmentTextActive]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Sélecteur / Gestion des véhicules existants ── */}
      <View style={vs.sectionContainer}>
        <View style={vs.sectionHeaderRow}>
          <View style={vs.sectionTitleBox}>
            <Text style={vs.sectionTitle}>
              {activeType.label}s enregistrées ({currentTypeVehicles.length})
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => populateFields(null, vehicleType)}
            style={[vs.addChipBtn, !activeVehicleId && vs.addChipBtnSelected]}
            activeOpacity={0.7}
          >
            <Ionicons name="add" size={14} color={!activeVehicleId ? '#2563EB' : '#475569'} />
            <Text style={[vs.addChipText, !activeVehicleId && vs.addChipTextSelected]}>
              Nouveau
            </Text>
          </TouchableOpacity>
        </View>

        {currentTypeVehicles.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={vs.vehicleScrollContent}
          >
            {currentTypeVehicles.map((v: any) => {
              const isSelected = activeVehicleId === v.id;
              return (
                <TouchableOpacity
                  key={v.id}
                  onPress={() => populateFields(v)}
                  style={[vs.vehicleCard, isSelected && vs.vehicleCardSelected]}
                  activeOpacity={0.8}
                >
                  <View style={vs.vehicleCardHeader}>
                    <Ionicons
                      name={isSelected ? 'checkmark-circle' : 'radio-button-off'}
                      size={15}
                      color={isSelected ? '#2563EB' : '#94A3B8'}
                    />
                    <Text
                      style={[vs.vehicleCardName, isSelected && vs.vehicleCardNameSelected]}
                      numberOfLines={1}
                    >
                      {v.brand_model}
                    </Text>
                  </View>
                  <View style={[vs.vehiclePlatePill, isSelected && vs.vehiclePlatePillSelected]}>
                    <Text
                      style={[vs.vehiclePlateText, isSelected && vs.vehiclePlateTextSelected]}
                      numberOfLines={1}
                    >
                      {v.license_plate}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        ) : (
          <View style={vs.emptyVehiclesBox}>
            <Ionicons name="information-circle-outline" size={16} color="#64748B" />
            <Text style={vs.emptyVehiclesText}>
              Aucune {activeType.label.toLowerCase()} enregistrée. Remplissez le formulaire ci-dessous.
            </Text>
          </View>
        )}

        {/* État courant (Mode création vs modification) */}
        <View style={vs.statusIndicatorRow}>
          <View style={[vs.statusDot, isEditing ? { backgroundColor: '#2563EB' } : { backgroundColor: '#10B981' }]} />
          <Text style={vs.statusIndicatorText} numberOfLines={1}>
            {isEditing
              ? `Modification en cours : ${brand || 'Véhicule'} ${model}`
              : `Nouveau véhicule : ${activeType.label}`}
          </Text>
        </View>
      </View>

      {/* ── Formulaire des informations du véhicule ── */}
      <View style={vs.cardSection}>
        <View style={vs.cardSectionHeader}>
          <Ionicons name="document-text-outline" size={17} color="#2563EB" />
          <Text style={vs.cardSectionTitle}>Informations du véhicule</Text>
        </View>

        <ModernFieldInput
          label="Marque"
          icon="car-outline"
          value={brand}
          onChange={setBrand}
          placeholder={vehicleType === 'moto' ? 'ex : Yamaha, Honda' : 'ex : Toyota, Peugeot'}
          required
          capitalize="words"
        />

        <ModernFieldInput
          label="Modèle"
          icon="car-sport-outline"
          value={model}
          onChange={setModel}
          placeholder={vehicleType === 'moto' ? 'ex : 125, Boxer' : 'ex : Corolla, 208'}
          required
          capitalize="words"
        />

        <ModernFieldInput
          label="Couleur"
          icon="color-palette-outline"
          value={color}
          onChange={setColor}
          placeholder="ex : Gris, Noir, Blanc"
          required
          capitalize="words"
        />

        <ModernFieldInput
          label="Immatriculation"
          icon="barcode-outline"
          value={plate}
          onChange={(v) => setPlate(formatBeninLicensePlate(v))}
          placeholder="ex : AQ 1234 RB"
          required
          capitalize="characters"
        />
      </View>

      {/* ── Documents obligatoires (Voiture uniquement) ── */}
      {vehicleType === 'voiture' && (
        <View style={{ gap: 14, marginBottom: 14 }}>
          {/* Permis de conduire */}
          <View style={vs.cardSection}>
            <View style={vs.cardSectionHeaderBetween}>
              <View style={vs.cardHeaderLeft}>
                <View style={[vs.cardIconCircle, { backgroundColor: '#EFF6FF' }]}>
                  <Ionicons name="card" size={16} color="#2563EB" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={vs.cardSectionTitle} numberOfLines={1}>Permis de conduire</Text>
                  <Text style={vs.cardSectionSub}>Requis pour être conducteur sur Zemy</Text>
                </View>
              </View>
              <View style={vs.badgeRequiredBlue}>
                <Text style={vs.badgeRequiredBlueText}>Obligatoire</Text>
              </View>
            </View>

            <ModernFieldInput
              label="Numéro du permis"
              icon="card-outline"
              value={driverLicense}
              onChange={(v) => setDriverLicense(v.toUpperCase())}
              required
              capitalize="characters"
              placeholder="ex : 1458902B"
            />

            <ModernDateField
              label="Date d'expiration du permis"
              value={licenseExpiration}
              onPress={() => setShowDatePicker(true)}
              error={licenseExpirationError}
              required
            />

            {showDatePicker && (
              <DateTimePicker
                value={licenseExpiration ? new Date(licenseExpiration) : new Date()}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                minimumDate={new Date()}
                onChange={(event, selectedDate) => {
                  setShowDatePicker(Platform.OS === 'ios');
                  if (event.type === 'set' && selectedDate) {
                    setShowDatePicker(false);
                    const formatted = selectedDate.toISOString().split('T')[0];
                    const changed = formatted !== licenseExpiration;
                    setLicenseExpiration(formatted);
                    setLicenseExpirationError('');
                    if (changed && driverLicensePhoto) {
                      setDriverLicensePhoto(null);
                      CustomAlert.alert(
                        'Photo requise',
                        'La date a changé. Veuillez reprendre une photo actualisée de votre permis.',
                        [
                          { text: 'Prendre la photo', onPress: () => pickPhoto(setDriverLicensePhoto) },
                          { text: 'Plus tard', style: 'cancel' },
                        ]
                      );
                    }
                  } else if (event.type === 'dismissed') {
                    setShowDatePicker(false);
                  }
                }}
              />
            )}

            <ModernPhotoField
              label="Photo du permis de conduire"
              uri={driverLicensePhoto}
              onPress={() => pickPhoto(setDriverLicensePhoto)}
              required
            />
          </View>

          {/* Attestation d'assurance */}
          <View style={vs.cardSection}>
            <View style={vs.cardSectionHeaderBetween}>
              <View style={vs.cardHeaderLeft}>
                <View style={[vs.cardIconCircle, { backgroundColor: '#ECFDF5' }]}>
                  <Ionicons name="shield-checkmark" size={16} color="#059669" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={vs.cardSectionTitle} numberOfLines={1}>Attestation d'assurance</Text>
                  <Text style={vs.cardSectionSub}>Sécurité et couverture des passagers</Text>
                </View>
              </View>
              <View style={vs.badgeRequiredGreen}>
                <Text style={vs.badgeRequiredGreenText}>Obligatoire</Text>
              </View>
            </View>

            <ModernFieldInput
              label="Numéro de police (optionnel)"
              icon="document-text-outline"
              value={insuranceNumber}
              onChange={(v) => setInsuranceNumber(v.toUpperCase())}
              capitalize="characters"
              placeholder="ex : POL-892134"
            />

            <ModernDateField
              label="Date d'expiration de l'assurance"
              value={insuranceExpiration}
              onPress={() => setShowInsuranceDatePicker(true)}
              error={insuranceExpirationError}
              required
            />

            {showInsuranceDatePicker && (
              <DateTimePicker
                value={insuranceExpiration ? new Date(insuranceExpiration) : new Date()}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                minimumDate={new Date()}
                onChange={(event, selectedDate) => {
                  setShowInsuranceDatePicker(Platform.OS === 'ios');
                  if (event.type === 'set' && selectedDate) {
                    setShowInsuranceDatePicker(false);
                    const formatted = selectedDate.toISOString().split('T')[0];
                    const changed = formatted !== insuranceExpiration;
                    setInsuranceExpiration(formatted);
                    setInsuranceExpirationError('');
                    if (changed && insurancePhoto) {
                      setInsurancePhoto(null);
                      CustomAlert.alert(
                        'Photo requise',
                        "La date a changé. Veuillez reprendre une photo actualisée de l'attestation.",
                        [
                          { text: 'Prendre la photo', onPress: () => pickPhoto(setInsurancePhoto) },
                          { text: 'Plus tard', style: 'cancel' },
                        ]
                      );
                    }
                  } else if (event.type === 'dismissed') {
                    setShowInsuranceDatePicker(false);
                  }
                }}
              />
            )}

            <ModernPhotoField
              label="Photo de l'attestation d'assurance"
              uri={insurancePhoto}
              onPress={() => pickPhoto(setInsurancePhoto)}
              required
            />
          </View>
        </View>
      )}

      {/* ── Boutons d'actions épurés ── */}
      <View style={vs.footerActions}>
        <TouchableOpacity
          onPress={handleSaveVehicle}
          disabled={isSaving || isDeleting}
          activeOpacity={0.85}
          style={vs.primaryBtnWrap}
        >
          <LinearGradient colors={['#2563EB', '#1D4ED8']} style={vs.primaryBtn}>
            {isSaving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={19} color="#fff" />
                <Text style={vs.primaryBtnText}>
                  {isEditing ? 'Mettre à jour le véhicule' : 'Enregistrer le véhicule'}
                </Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>

        {isEditing && (
          <TouchableOpacity
            onPress={handleDeleteVehicle}
            disabled={isSaving || isDeleting}
            style={vs.deleteBtn}
            activeOpacity={0.8}
          >
            {isDeleting ? (
              <ActivityIndicator color="#DC2626" size="small" />
            ) : (
              <>
                <Ionicons name="trash-outline" size={17} color="#DC2626" />
                <Text style={vs.deleteBtnText}>Supprimer ce véhicule</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>

    </AppBottomSheet>
  );
}

/* ─────────────── Styles Modernes & Épurés ─────────────── */
const vs = StyleSheet.create({
  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  headerIconPill: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTextWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* Sélecteur de type segmenté */
  typeSegmentContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 4,
    gap: 4,
    marginTop: 12,
    marginBottom: 14,
  },
  typeSegmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 9,
    gap: 6,
  },
  typeSegmentBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  typeSegmentText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  typeSegmentTextActive: {
    color: '#2563EB',
    fontWeight: '700',
  },

  /* Multi-véhicules & Chips */
  sectionContainer: {
    marginBottom: 14,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitleBox: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  addChipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  addChipBtnSelected: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  addChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  addChipTextSelected: {
    color: '#2563EB',
    fontWeight: '700',
  },
  vehicleScrollContent: {
    gap: 8,
    paddingVertical: 2,
  },
  vehicleCard: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    gap: 4,
    minWidth: 125,
  },
  vehicleCardSelected: {
    borderColor: '#2563EB',
    backgroundColor: '#F8FAFC',
  },
  vehicleCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  vehicleCardName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    maxWidth: 110,
  },
  vehicleCardNameSelected: {
    color: '#0F172A',
    fontWeight: '700',
  },
  vehiclePlatePill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  vehiclePlatePillSelected: {
    backgroundColor: '#DBEAFE',
  },
  vehiclePlateText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  vehiclePlateTextSelected: {
    color: '#1D4ED8',
    fontWeight: '700',
  },
  emptyVehiclesBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  emptyVehiclesText: {
    fontSize: 12,
    color: '#64748B',
    flex: 1,
  },
  statusIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusIndicatorText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },

  /* Section Cartes modernes */
  cardSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
    marginBottom: 14,
  },
  cardSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  cardSectionHeaderBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 8,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  cardIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  cardSectionSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },

  /* Badges */
  badgeRequiredBlue: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    flexShrink: 0,
  },
  badgeRequiredBlueText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#2563EB',
    textTransform: 'uppercase',
  },
  badgeRequiredGreen: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    flexShrink: 0,
  },
  badgeRequiredGreenText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
    textTransform: 'uppercase',
  },

  /* Champs modernes */
  fieldWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
    minHeight: 54,
    paddingHorizontal: 4,
  },
  fieldError: {
    borderColor: '#EF4444',
  },
  fieldIconBox: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldContent: {
    flex: 1,
    paddingRight: 10,
    paddingVertical: 6,
    justifyContent: 'center',
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  fieldLabelActive: {
    color: '#2563EB',
  },
  fieldInput: {
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '600',
    paddingVertical: 0,
  },
  required: {
    color: '#EF4444',
    fontWeight: '700',
  },

  /* Photo Field */
  photoContainer: {
    marginTop: 4,
    marginBottom: 4,
  },
  photoHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  photoSectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    flex: 1,
  },
  photoReadyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  photoReadyText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
  },
  photoMissingText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#EF4444',
    textTransform: 'uppercase',
  },
  photoCard: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  photoPreviewWrapper: {
    width: '100%',
    height: 115,
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#0F172A',
  },
  photoPreviewImage: {
    width: '100%',
    height: '100%',
  },
  photoOverlayGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoOverlayContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  photoOverlayText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  photoEmptyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
  },
  photoEmptyIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoEmptyTextBox: {
    flex: 1,
  },
  photoEmptyTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  photoEmptySubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },

  /* Erreurs */
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    paddingHorizontal: 4,
  },
  errorText: {
    fontSize: 11,
    color: '#EF4444',
    fontWeight: '500',
    flex: 1,
  },

  /* Footer Actions */
  footerActions: {
    marginTop: 6,
    marginBottom: 50,
    gap: 10,
  },
  primaryBtnWrap: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  deleteBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#DC2626',
  },
});
