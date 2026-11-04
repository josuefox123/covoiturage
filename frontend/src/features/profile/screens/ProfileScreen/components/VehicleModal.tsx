import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Image,
  Animated,
  ScrollView,
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
import { styles } from '../styles';
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

/**
 * VehicleModal - Gestion multi-véhicules (Voiture, Moto, Tricycle)
 */
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

  // Champs de saisie
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
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [insuranceNumber, setInsuranceNumber] = useState('');
  const [insuranceExpiration, setInsuranceExpiration] = useState('');
  const [insuranceExpirationError, setInsuranceExpirationError] = useState('');
  const [insurancePhoto, setInsurancePhoto] = useState<string | null>(null);
  const [showInsuranceDatePicker, setShowInsuranceDatePicker] = useState(false);
  const initialLicenseRef = useRef<{
    number: string;
    expiration: string;
    photo: string | null;
    insuranceNumber: string;
    insuranceExpiration: string;
    insurancePhoto: string | null;
  }>({
    number: '',
    expiration: '',
    photo: null,
    insuranceNumber: '',
    insuranceExpiration: '',
    insurancePhoto: null,
  });

  // Remplit les champs à partir d'un objet véhicule
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
        number: vehicle.driver_license_number || '',
        expiration: vehicle.license_expiration || '',
        photo: vehicle.driver_license_photo || null,
        insuranceNumber: vehicle.insurance_number || '',
        insuranceExpiration: vehicle.insurance_expiration || '',
        insurancePhoto: vehicle.insurance_photo || null,
      };
    } else {
      setActiveVehicleId(null);
      setBrand('');
      setModel('');
      setColor('');
      setPlate('');
      if (defaultType) setVehicleType(defaultType);
      setDriverLicense('');
      setLicenseExpiration('');
      setDriverLicensePhoto(null);
      setInsuranceNumber('');
      setInsuranceExpiration('');
      setInsurancePhoto(null);
      setInsuranceExpirationError('');
      initialLicenseRef.current = {
        number: '',
        expiration: '',
        photo: null,
        insuranceNumber: '',
        insuranceExpiration: '',
        insurancePhoto: null,
      };
    }
    setLicenseExpirationError('');
  };

  // Chargement des véhicules de l'utilisateur
  const fetchVehicles = async (selectId?: string | null) => {
    setIsLoading(true);
    try {
      const data = await authFetch('/vehicles/');
      const list = Array.isArray(data) ? data : (data?.results || []);
      setVehiclesList(list);

      if (list.length > 0) {
        let target = null;
        if (selectId) {
          target = list.find((v: any) => v.id === selectId);
        } else if (vehicleId) {
          target = list.find((v: any) => v.id === vehicleId);
        }
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

  // Changement de type (Voiture / Moto / Tricycle)
  const handleTypeSelect = (type: 'voiture' | 'moto' | 'tricycle') => {
    setVehicleType(type);
    const ofType = vehiclesList.filter((v: any) => (v.vehicle_type || 'voiture') === type);
    if (ofType.length > 0) {
      populateFields(ofType[0]);
    } else {
      // Aucun véhicule de ce type : formulaire vierge pour créer
      populateFields(null, type);
    }
  };

  // Sélection d'un véhicule spécifique de ce type
  const handleSelectSpecificVehicle = (v: any) => {
    populateFields(v);
  };

  // Passer en mode ajout d'un nouveau véhicule pour le type actuel
  const handleAddNew = () => {
    populateFields(null, vehicleType);
  };

  const pickInsurancePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      CustomAlert.alert('Permission refusée', "Vous devez autoriser l'accès à votre caméra.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setInsurancePhoto(result.assets[0].uri);
    }
  };

  const pickLicensePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      CustomAlert.alert('Permission refusée', "Vous devez autoriser l'accès à votre caméra.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setDriverLicensePhoto(result.assets[0].uri);
    }
  };

  // Suppression d'un véhicule
  const handleDeleteVehicle = () => {
    if (!activeVehicleId) return;
    CustomAlert.alert(
      'Supprimer le véhicule',
      `Êtes-vous sûr de vouloir supprimer ${brand} ${model} ?`,
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

  // Enregistrement
  const handleSaveVehicle = async () => {
    if (!brand.trim() || !model.trim() || !color.trim() || !plate.trim()) {
      CustomAlert.alert('Erreur', 'Veuillez remplir tous les champs du véhicule (marque, modèle, couleur, plaque).');
      return;
    }

    if (vehicleType === 'voiture') {
      if (!driverLicense.trim() || !licenseExpiration.trim() || !driverLicensePhoto) {
        CustomAlert.alert('Erreur', "Les informations du permis (numéro, date d'expiration et photo) sont obligatoires pour les voitures.");
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

      if (!insuranceExpiration.trim() || !insurancePhoto) {
        CustomAlert.alert('Erreur', "L'attestation d'assurance (date d'expiration et photo) est obligatoire pour les voitures.");
        return;
      }

      const insExpDate = new Date(insuranceExpiration);
      insExpDate.setHours(0, 0, 0, 0);
      if (insExpDate < today) {
        setInsuranceExpirationError("L'attestation d'assurance est déjà expirée.");
        return;
      } else {
        setInsuranceExpirationError('');
      }
    }

    setIsSaving(true);
    try {
      const token = await SecureStore.getItemAsync('zemy_access_token');
      if (!token) throw new Error('Session expirée. Veuillez vous reconnecter.');

      const brand_model = `${brand.trim()} ${model.trim()}`;
      const formData = new FormData();
      formData.append('brand_model', brand_model);
      formData.append('color', color.trim());
      formData.append('license_plate', plate.trim());
      formData.append('vehicle_type', vehicleType);

      if (vehicleType === 'voiture') {
        formData.append('driver_license_number', driverLicense.trim());
        formData.append('license_expiration', licenseExpiration.trim());

        if (driverLicensePhoto && !driverLicensePhoto.startsWith('http')) {
          let cleanUri = driverLicensePhoto;
          if (cleanUri.startsWith('/')) cleanUri = `file://${cleanUri}`;
          (formData as any).append('driver_license_photo', {
            uri: cleanUri,
            name: 'license.jpg',
            type: 'image/jpeg',
          });
        }

        formData.append('insurance_number', insuranceNumber.trim());
        formData.append('insurance_expiration', insuranceExpiration.trim());

        if (insurancePhoto && !insurancePhoto.startsWith('http')) {
          let cleanInsUri = insurancePhoto;
          if (cleanInsUri.startsWith('/')) cleanInsUri = `file://${cleanInsUri}`;
          (formData as any).append('insurance_photo', {
            uri: cleanInsUri,
            name: 'insurance.jpg',
            type: 'image/jpeg',
          });
        }
      }

      // Si activeVehicleId est présent, mise à jour (PATCH). Sinon, création (POST).
      const endpoint = activeVehicleId ? `/vehicles/${activeVehicleId}/` : '/vehicles/';
      const method = activeVehicleId ? 'PATCH' : 'POST';

      const res = await new Promise<any>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open(method, `${API_URL}${endpoint}`);
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.timeout = 60000;

        xhr.onload = () => {
          try {
            const response = JSON.parse(xhr.responseText);
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve(response);
            } else {
              reject(new Error(response.error || response.detail || (typeof response === 'object' ? JSON.stringify(response) : `Erreur (${xhr.status})`)));
            }
          } catch {
            if (xhr.status >= 200 && xhr.status < 300) resolve({});
            else reject(new Error(`Erreur serveur (${xhr.status})`));
          }
        };

        xhr.onerror = () => reject(new Error('Connexion impossible. Vérifiez votre réseau.'));
        xhr.ontimeout = () => reject(new Error('La requête a expiré.'));

        xhr.send(formData);
      });

      const savedId = activeVehicleId || res?.id;
      CustomAlert.alert('Succès', activeVehicleId ? 'Véhicule mis à jour !' : 'Nouveau véhicule enregistré !');
      onSaveSuccess({
        id: savedId,
        brand: brand.trim(),
        model: model.trim(),
        plate: plate.trim(),
        vehicleType,
      });
      await fetchVehicles(savedId);
      onClose();
    } catch (e: any) {
      CustomAlert.alert('Erreur', e.message || "Impossible d'enregistrer le véhicule.");
    } finally {
      setIsSaving(false);
    }
  };

  const currentTypeVehicles = vehiclesList.filter((v: any) => (v.vehicle_type || 'voiture') === vehicleType);

  return (
    <AppBottomSheet
      visible={visible}
      onClose={onClose}
      snapPoints={['75%', '95%']}
    >
      <View style={styles.modalHeader}>
        <Text style={styles.modalTitle}>Mes véhicules</Text>
        {isLoading && (
          <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginLeft: 8 }} />
        )}
      </View>

      <View style={{ paddingBottom: 60 }}>
        {/* Icône selon type */}
        <View style={styles.vehicleIconContainer}>
          <LinearGradient colors={[theme.colors.primaryLight, theme.colors.primary]} style={styles.vehicleIcon}>
            <Ionicons
              name={vehicleType === 'moto' ? 'bicycle' : vehicleType === 'tricycle' ? 'car' : 'car-sport'}
              size={44}
              color={theme.colors.white}
            />
          </LinearGradient>
        </View>

        {/* 1. Sélecteur de type d'engin */}
        <Text style={styles.vehicleTypeLabel}>Type d'engin</Text>
        <View style={styles.vehicleTypeContainer}>
          <TouchableOpacity 
            style={[styles.vehicleTypeBtn, vehicleType === 'voiture' && styles.vehicleTypeBtnActive]}
            onPress={() => handleTypeSelect('voiture')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="car-sport"
              size={16}
              color={vehicleType === 'voiture' ? theme.colors.primary : theme.colors.textMuted}
              style={{ marginBottom: 2 }}
            />
            <Text style={[styles.vehicleTypeText, vehicleType === 'voiture' && styles.vehicleTypeTextActive]}>Voiture</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.vehicleTypeBtn, vehicleType === 'moto' && styles.vehicleTypeBtnActive]}
            onPress={() => handleTypeSelect('moto')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="bicycle"
              size={16}
              color={vehicleType === 'moto' ? theme.colors.primary : theme.colors.textMuted}
              style={{ marginBottom: 2 }}
            />
            <Text style={[styles.vehicleTypeText, vehicleType === 'moto' && styles.vehicleTypeTextActive]}>Moto</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.vehicleTypeBtn, vehicleType === 'tricycle' && styles.vehicleTypeBtnActive]}
            onPress={() => handleTypeSelect('tricycle')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="car"
              size={16}
              color={vehicleType === 'tricycle' ? theme.colors.primary : theme.colors.textMuted}
              style={{ marginBottom: 2 }}
            />
            <Text style={[styles.vehicleTypeText, vehicleType === 'tricycle' && styles.vehicleTypeTextActive]}>Tricycle</Text>
          </TouchableOpacity>
        </View>

        {/* 2. Liste des véhicules enregistrés pour ce type (s'il y en a) */}
        {currentTypeVehicles.length > 0 && (
          <View style={{ marginBottom: 14 }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: theme.colors.textMuted, marginBottom: 8, textTransform: 'uppercase' }}>
              Vos {vehicleType === 'voiture' ? 'voitures' : vehicleType === 'moto' ? 'motos' : 'tricycles'} ({currentTypeVehicles.length})
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {currentTypeVehicles.map((v: any) => {
                const isSelected = activeVehicleId === v.id;
                return (
                  <TouchableOpacity
                    key={v.id}
                    onPress={() => handleSelectSpecificVehicle(v)}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 12,
                      borderWidth: 1.5,
                      borderColor: isSelected ? theme.colors.primary : theme.colors.border,
                      backgroundColor: isSelected ? `${theme.colors.primary}15` : theme.colors.card,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                    }}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name={isSelected ? 'checkmark-circle' : 'radio-button-off'}
                      size={16}
                      color={isSelected ? theme.colors.primary : theme.colors.textMuted}
                    />
                    <Text style={{ fontSize: 13, fontWeight: isSelected ? '700' : '500', color: isSelected ? theme.colors.primary : theme.colors.text }}>
                      {v.brand_model} ({v.license_plate})
                    </Text>
                  </TouchableOpacity>
                );
              })}

              <TouchableOpacity
                onPress={handleAddNew}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 12,
                  borderWidth: 1.5,
                  borderColor: activeVehicleId === null ? theme.colors.success : theme.colors.border,
                  backgroundColor: activeVehicleId === null ? '#ECFDF5' : theme.colors.card,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                }}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="add-circle-outline"
                  size={16}
                  color={activeVehicleId === null ? theme.colors.success : theme.colors.textMuted}
                />
                <Text style={{ fontSize: 13, fontWeight: '700', color: activeVehicleId === null ? '#047857' : theme.colors.text }}>
                  + Nouveau
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        )}

        {/* Bannière d'état */}
        <View style={{
          backgroundColor: activeVehicleId ? '#EFF6FF' : '#F0FDF4',
          borderColor: activeVehicleId ? '#BFDBFE' : '#BBF7D0',
          borderWidth: 1,
          borderRadius: 12,
          paddingHorizontal: 12,
          paddingVertical: 8,
          marginBottom: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        }}>
          <Ionicons
            name={activeVehicleId ? 'create-outline' : 'add-circle-outline'}
            size={18}
            color={activeVehicleId ? '#1D4ED8' : '#047857'}
          />
          <Text style={{ fontSize: 12, fontWeight: '600', color: activeVehicleId ? '#1E40AF' : '#065F46', flex: 1 }}>
            {activeVehicleId
              ? `Modification de : ${brand} ${model}`
              : `Enregistrement d'un nouveau véhicule (${vehicleType})`}
          </Text>
        </View>

        {/* 3. Formulaire des caractéristiques */}
        <View style={styles.inputWrapper}>
          <Ionicons name="car-outline" size={20} color={theme.colors.textMuted} style={styles.inputIcon} />
          <TextInput
            style={styles.modalInputModern}
            value={brand}
            onChangeText={setBrand}
            placeholder={vehicleType === 'moto' ? "Marque (ex: Yamaha, Honda, Bajaj)" : "Marque (ex: Toyota, Renault)"}
            placeholderTextColor={theme.colors.textMuted}
            autoCapitalize="words"
            autoCorrect={false}
            keyboardType="default"
          />
        </View>

        <View style={styles.inputWrapper}>
          <Ionicons name="car-sport-outline" size={20} color={theme.colors.textMuted} style={styles.inputIcon} />
          <TextInput
            style={styles.modalInputModern}
            value={model}
            onChangeText={setModel}
            placeholder={vehicleType === 'moto' ? "Modèle (ex: 125, Boxer, Wave)" : "Modèle (ex: Corolla, Clio 3)"}
            placeholderTextColor={theme.colors.textMuted}
            autoCapitalize="words"
            autoCorrect={false}
            keyboardType="default"
          />
        </View>

        <View style={styles.inputWrapper}>
          <Ionicons name="color-palette-outline" size={20} color={theme.colors.textMuted} style={styles.inputIcon} />
          <TextInput
            style={styles.modalInputModern}
            value={color}
            onChangeText={setColor}
            placeholder="Couleur (ex: Noir, Gris, Rouge)"
            placeholderTextColor={theme.colors.textMuted}
            autoCapitalize="words"
            autoCorrect={false}
            keyboardType="default"
          />
        </View>

        <View style={styles.inputWrapper}>
          <Ionicons name="barcode-outline" size={20} color={theme.colors.textMuted} style={styles.inputIcon} />
          <TextInput
            style={styles.modalInputModern}
            value={plate}
            onChangeText={(val) => setPlate(formatBeninLicensePlate(val))}
            placeholder="Immatriculation (ex: AQ 1234 RB)"
            placeholderTextColor={theme.colors.textMuted}
            autoCapitalize="characters"
            autoCorrect={false}
            keyboardType="default"
          />
        </View>

        {/* Permis de conduire et Assurance (obligatoires pour voiture) */}
        {vehicleType === 'voiture' && (
          <>
            <View style={{ marginTop: 10, padding: 16, backgroundColor: theme.colors.grayLight, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.border }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: theme.colors.text, marginBottom: 12 }}>Informations du Permis de Conduire</Text>
            
            <View style={[styles.inputWrapper, { backgroundColor: theme.colors.white, position: 'relative' }]}>
              <Ionicons name="card-outline" size={20} color={theme.colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={[styles.modalInputModern, { zIndex: 2 }]}
                value={driverLicense}
                onChangeText={(val) => setDriverLicense(val.toUpperCase())}
                onBlur={() => {
                  if (
                    initialLicenseRef.current.number &&
                    driverLicense.trim() !== initialLicenseRef.current.number.trim() &&
                    driverLicensePhoto &&
                    driverLicensePhoto === initialLicenseRef.current.photo
                  ) {
                    setDriverLicensePhoto(null);
                    CustomAlert.alert(
                      'Nouvelle photo requise',
                      "Le numéro de permis a été modifié. Vous devez ajouter une nouvelle photo correspondant à ce permis.",
                      [
                        { text: 'Prendre la photo', onPress: () => pickLicensePhoto() },
                        { text: 'Plus tard', style: 'cancel' }
                      ]
                    );
                  }
                }}
                autoCapitalize="characters"
                autoCorrect={false}
                keyboardType="default"
              />
              {!driverLicense && (
                <View pointerEvents="none" style={{ position: 'absolute', left: 48, top: 0, bottom: 0, justifyContent: 'center', zIndex: 1 }}>
                  <Text style={{ fontSize: 15, color: theme.colors.textMuted }}>
                    Numéro du Permis <Text style={{ color: theme.colors.error, fontWeight: 'bold' }}>*</Text>
                  </Text>
                </View>
              )}
            </View>

            <TouchableOpacity style={[styles.inputWrapper, { backgroundColor: theme.colors.white }, licenseExpirationError ? { borderColor: theme.colors.error } : null]} onPress={() => setShowDatePicker(true)}>
              <Ionicons name="calendar-outline" size={20} color={licenseExpirationError ? theme.colors.error : theme.colors.textMuted} style={styles.inputIcon} />
              <Text style={[styles.modalInputModern, { paddingTop: Platform.OS === 'ios' ? 16 : 14, color: licenseExpiration ? theme.colors.text : theme.colors.textMuted }]}>
                {licenseExpiration ? (
                  licenseExpiration
                ) : (
                  <>
                    Date d'expiration <Text style={{ color: theme.colors.error, fontWeight: 'bold' }}>*</Text>
                  </>
                )}
              </Text>
            </TouchableOpacity>

            {licenseExpirationError ? (
              <Text style={{ color: theme.colors.error, fontSize: 12, marginTop: -4, marginBottom: 8, marginLeft: 4 }}>
                {licenseExpirationError}
              </Text>
            ) : null}

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
                    const hasDateChanged = formatted !== licenseExpiration;
                    setLicenseExpiration(formatted);
                    setLicenseExpirationError('');

                    if (hasDateChanged && driverLicensePhoto) {
                      setDriverLicensePhoto(null);
                      CustomAlert.alert(
                        'Nouvelle photo requise',
                        "La date d'expiration a été modifiée. Vous devez ajouter une nouvelle photo de votre permis de conduire à jour.",
                        [
                          { text: 'Prendre la photo', onPress: () => pickLicensePhoto() },
                          { text: 'Plus tard', style: 'cancel' }
                        ]
                      );
                    }
                  } else if (event.type === 'dismissed') {
                    setShowDatePicker(false);
                  }
                }}
              />
            )}

            <TouchableOpacity style={[styles.imagePickerBtn, { backgroundColor: theme.colors.white, height: driverLicensePhoto ? 160 : 54, padding: 0, overflow: 'hidden' }]} onPress={pickLicensePhoto}>
              {driverLicensePhoto ? (
                <View style={{ width: '100%', height: '100%', position: 'relative' }}>
                  <Image
                    source={{ uri: getMediaUrl(driverLicensePhoto) }}
                    style={{ width: '100%', height: '100%' }}
                    resizeMode="cover"
                  />
                  <View style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    backgroundColor: 'rgba(0,0,0,0.6)',
                    paddingVertical: 6,
                    alignItems: 'center'
                  }}>
                    <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700' }}>
                      Modifier la photo du permis
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: '100%', width: '100%' }}>
                  <Ionicons name="camera-outline" size={24} color={theme.colors.primary} />
                  <Text style={styles.imagePickerText}>
                    Ajouter la photo du permis <Text style={{ color: theme.colors.error, fontWeight: 'bold' }}>*</Text>
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Attestation d'Assurance Automobile */}
          <View style={{ marginTop: 14, padding: 16, backgroundColor: theme.colors.grayLight, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: theme.colors.text }}>Attestation d'Assurance</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#EFF6FF', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
                <Ionicons name="shield-checkmark" size={13} color={theme.colors.primary} />
                <Text style={{ fontSize: 11, fontWeight: '700', color: theme.colors.primary }}>Sécurité passagers</Text>
              </View>
            </View>
            
            <View style={[styles.inputWrapper, { backgroundColor: theme.colors.white, position: 'relative' }]}>
              <Ionicons name="document-text-outline" size={20} color={theme.colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={[styles.modalInputModern, { zIndex: 2 }]}
                value={insuranceNumber}
                onChangeText={(val) => setInsuranceNumber(val.toUpperCase())}
                autoCapitalize="characters"
                autoCorrect={false}
                keyboardType="default"
              />
              {!insuranceNumber && (
                <View pointerEvents="none" style={{ position: 'absolute', left: 48, top: 0, bottom: 0, justifyContent: 'center', zIndex: 1 }}>
                  <Text style={{ fontSize: 15, color: theme.colors.textMuted }}>
                    Numéro de police (Optionnel)
                  </Text>
                </View>
              )}
            </View>

            <TouchableOpacity style={[styles.inputWrapper, { backgroundColor: theme.colors.white }, insuranceExpirationError ? { borderColor: theme.colors.error } : null]} onPress={() => setShowInsuranceDatePicker(true)}>
              <Ionicons name="calendar-outline" size={20} color={insuranceExpirationError ? theme.colors.error : theme.colors.textMuted} style={styles.inputIcon} />
              <Text style={[styles.modalInputModern, { paddingTop: Platform.OS === 'ios' ? 16 : 14, color: insuranceExpiration ? theme.colors.text : theme.colors.textMuted }]}>
                {insuranceExpiration ? (
                  insuranceExpiration
                ) : (
                  <>
                    Date d'expiration assurance <Text style={{ color: theme.colors.error, fontWeight: 'bold' }}>*</Text>
                  </>
                )}
              </Text>
            </TouchableOpacity>

            {insuranceExpirationError ? (
              <Text style={{ color: theme.colors.error, fontSize: 12, marginTop: -4, marginBottom: 8, marginLeft: 4 }}>
                {insuranceExpirationError}
              </Text>
            ) : null}

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
                    const hasDateChanged = formatted !== insuranceExpiration;
                    setInsuranceExpiration(formatted);
                    setInsuranceExpirationError('');

                    if (hasDateChanged && insurancePhoto) {
                      setInsurancePhoto(null);
                      CustomAlert.alert(
                        'Nouvelle photo requise',
                        "La date d'expiration de l'assurance a été modifiée. Vous devez ajouter une nouvelle photo de votre attestation d'assurance à jour.",
                        [
                          { text: 'Prendre la photo', onPress: () => pickInsurancePhoto() },
                          { text: 'Plus tard', style: 'cancel' }
                        ]
                      );
                    }
                  } else if (event.type === 'dismissed') {
                    setShowInsuranceDatePicker(false);
                  }
                }}
              />
            )}

            <TouchableOpacity style={[styles.imagePickerBtn, { backgroundColor: theme.colors.white, height: insurancePhoto ? 160 : 54, padding: 0, overflow: 'hidden' }]} onPress={pickInsurancePhoto}>
              {insurancePhoto ? (
                <View style={{ width: '100%', height: '100%', position: 'relative' }}>
                  <Image
                    source={{ uri: getMediaUrl(insurancePhoto) }}
                    style={{ width: '100%', height: '100%' }}
                    resizeMode="cover"
                  />
                  <View style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    backgroundColor: 'rgba(0,0,0,0.6)',
                    paddingVertical: 6,
                    alignItems: 'center'
                  }}>
                    <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700' }}>
                      Modifier l'attestation d'assurance
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: '100%', width: '100%' }}>
                  <Ionicons name="camera-outline" size={24} color={theme.colors.primary} />
                  <Text style={styles.imagePickerText}>
                    Ajouter l'attestation d'assurance <Text style={{ color: theme.colors.error, fontWeight: 'bold' }}>*</Text>
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </>
        )}

        {/* Bouton Enregistrer / Mettre à jour */}
        <TouchableOpacity onPress={handleSaveVehicle} disabled={isSaving || isDeleting} activeOpacity={0.8} style={{ marginTop: 16 }}>
          <LinearGradient colors={[theme.colors.primary, '#3B82F6']} style={styles.modalBtnGradient}>
            {isSaving ? <ActivityIndicator color={theme.colors.white} /> : (
              <>
                <Ionicons name="checkmark-circle" size={20} color={theme.colors.white} />
                <Text style={styles.modalBtnSaveText}>
                  {activeVehicleId ? 'Mettre à jour ce véhicule' : 'Enregistrer ce véhicule'}
                </Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>

        {/* Bouton Supprimer (si véhicule existant sélectionné) */}
        {activeVehicleId && (
          <TouchableOpacity
            onPress={handleDeleteVehicle}
            disabled={isSaving || isDeleting}
            style={{
              marginTop: 10,
              paddingVertical: 12,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: '#FCA5A5',
              backgroundColor: '#FEF2F2',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
            activeOpacity={0.7}
          >
            {isDeleting ? (
              <ActivityIndicator color={theme.colors.error} size="small" />
            ) : (
              <>
                <Ionicons name="trash-outline" size={18} color={theme.colors.error} />
                <Text style={{ fontSize: 14, fontWeight: '700', color: theme.colors.error }}>
                  Supprimer ce véhicule
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </AppBottomSheet>
  );
}
