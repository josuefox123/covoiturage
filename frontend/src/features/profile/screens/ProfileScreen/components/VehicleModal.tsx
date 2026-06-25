import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { theme } from '../../../../../styles/theme';
import { styles } from '../styles';
import { AppBottomSheet } from '../../../../../components/AppBottomSheet';
import { CustomAlert } from '../../../../../utils/CustomAlert';

interface VehicleModalProps {
  visible: boolean;
  onClose: () => void;
  user: any;
  authFetch: any;
  vehicleId: string | null;
  onSaveSuccess: (updatedData: { id: string; brand: string; model: string; plate: string }) => void;
}

export function VehicleModal({
  visible,
  onClose,
  user,
  authFetch,
  vehicleId,
  onSaveSuccess,
}: VehicleModalProps) {
  const [isSaving, setIsSaving] = useState(false);
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

  // Fetch current vehicle info if modal becomes visible
  useEffect(() => {
    const fetchVehicle = async () => {
      if (!visible || !user) return;
      try {
        const data = await authFetch('/vehicles/');
        if (data && data.length > 0) {
          const vehicle = data[0];
          const parts = (vehicle.brand_model || '').split(' ');
          setBrand(parts[0] || '');
          setModel(parts.slice(1).join(' ') || '');
          setColor(vehicle.color || '');
          setPlate(vehicle.license_plate || '');
          setVehicleType(vehicle.vehicle_type || 'voiture');
          setDriverLicense(vehicle.driver_license_number || '');
          setLicenseExpiration(vehicle.license_expiration || '');
          setDriverLicensePhoto(vehicle.driver_license_photo || null);
        } else {
          // Reset fields
          setBrand('');
          setModel('');
          setColor('');
          setPlate('');
          setVehicleType('voiture');
          setDriverLicense('');
          setLicenseExpiration('');
          setDriverLicensePhoto(null);
        }
        setLicenseExpirationError('');
      } catch (e) {}
    };

    fetchVehicle();
  }, [visible, user]);

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

    if (vehicleType === 'voiture' && driverLicensePhoto && !driverLicensePhoto.startsWith('http')) {
      const filename = driverLicensePhoto.split('/').pop() || 'license.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';
      formData.append('driver_license_photo', {
        uri: driverLicensePhoto,
        name: filename,
        type,
      } as any);
    }

    try {
      if (vehicleId) {
        await authFetch(`/vehicles/${vehicleId}/`, {
          method: 'PATCH',
          body: formData,
        });
        CustomAlert.alert('Succès ✅', 'Véhicule mis à jour !');
        onSaveSuccess({ id: vehicleId, brand: brand.trim(), model: model.trim(), plate: plate.trim() });
      } else {
        const res = await authFetch('/vehicles/', {
          method: 'POST',
          body: formData,
        });
        CustomAlert.alert('Succès ✅', 'Véhicule ajouté !');
        onSaveSuccess({ id: res.id, brand: brand.trim(), model: model.trim(), plate: plate.trim() });
      }
      onClose();
    } catch (e: any) {
      CustomAlert.alert('Erreur', e.message || 'Impossible d\'enregistrer le véhicule.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AppBottomSheet
      visible={visible}
      onClose={onClose}
      snapPoints={['75%', '95%']}
    >
      <View style={styles.modalHeader}>
        <Text style={styles.modalTitle}>Mon véhicule</Text>
      </View>

      <View style={{ flex: 1 }}>
        <View style={styles.vehicleIconContainer}>
          <LinearGradient colors={[theme.colors.primaryLight, theme.colors.primary]} style={styles.vehicleIcon}>
            <Ionicons name="car-sport" size={48} color={theme.colors.white} />
          </LinearGradient>
        </View>

        <Text style={styles.vehicleTypeLabel}>Type de véhicule</Text>
        <View style={styles.vehicleTypeContainer}>
          <TouchableOpacity 
            style={[styles.vehicleTypeBtn, vehicleType === 'voiture' && styles.vehicleTypeBtnActive]}
            onPress={() => setVehicleType('voiture')}
          >
            <Text style={[styles.vehicleTypeText, vehicleType === 'voiture' && styles.vehicleTypeTextActive]}>Voiture</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.vehicleTypeBtn, vehicleType === 'moto' && styles.vehicleTypeBtnActive]}
            onPress={() => setVehicleType('moto')}
          >
            <Text style={[styles.vehicleTypeText, vehicleType === 'moto' && styles.vehicleTypeTextActive]}>Moto</Text>
          </TouchableOpacity>
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
          <Ionicons name="barcode-outline" size={20} color={theme.colors.textMuted} style={styles.inputIcon} />
          <TextInput
            style={styles.modalInputModern}
            value={plate}
            onChangeText={setPlate}
            placeholder="Plaque d'immatriculation"
            placeholderTextColor={theme.colors.textMuted}
            autoCapitalize="characters"
          />
        </View>

        {vehicleType === 'voiture' && (
          <>
            <View style={styles.inputWrapper}>
              <Ionicons name="card-outline" size={20} color={theme.colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.modalInputModern}
                value={driverLicense}
                onChangeText={setDriverLicense}
                placeholder="Numéro de permis de conduire"
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
              <Text style={styles.errorText}>
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
  );
}
