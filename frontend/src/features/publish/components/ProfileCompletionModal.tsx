import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Image, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import { AppBottomSheet } from '../../../../src/components/AppBottomSheet';
import { getMediaUrl } from '../../../../src/utils/media';
import { theme } from '../../../../src/styles/theme';

interface ProfileCompletionModalProps {
  visible: boolean;
  onClose: () => void;
  profileStep: 'personal' | 'vehicle' | 'preferences';
  getProfileProgress: () => number;
  pickAvatar: () => void;
  avatarUri: string | null;
  editName: string;
  setEditName: (val: string) => void;
  editEmail: string;
  setEditEmail: (val: string) => void;
  isSavingProfile: boolean;
  handleSavePersonal: () => void;
  plate: string;
  setPlate: (val: string) => void;
  vehicleType: string;
  setVehicleType: (val: string) => void;
  driverLicense: string;
  setDriverLicense: (val: string) => void;
  licenseExpiration: string;
  setLicenseExpiration: (val: string) => void;
  licenseExpirationError: string;
  pickLicensePhoto: () => void;
  driverLicensePhoto: string | null;
  setProfileStep: (step: 'personal' | 'vehicle' | 'preferences') => void;
  handleSaveVehicle: () => void;
  music: boolean;
  setMusic: (val: boolean) => void;
  chatty: boolean;
  setChatty: (val: boolean) => void;
  smoking: boolean;
  setSmoking: (val: boolean) => void;
  airCond: boolean;
  setAirCond: (val: boolean) => void;
  handleSavePrefs: () => void;
  user: any;
  brandModel: string;
  setBrandModel: (val: string) => void;
}

export function ProfileCompletionModal({
  visible,
  onClose,
  profileStep,
  getProfileProgress,
  pickAvatar,
  avatarUri,
  editName,
  setEditName,
  editEmail,
  setEditEmail,
  isSavingProfile,
  handleSavePersonal,
  plate,
  setPlate,
  vehicleType,
  setVehicleType,
  driverLicense,
  setDriverLicense,
  licenseExpiration,
  setLicenseExpiration,
  licenseExpirationError,
  pickLicensePhoto,
  driverLicensePhoto,
  setProfileStep,
  handleSaveVehicle,
  music,
  setMusic,
  chatty,
  setChatty,
  smoking,
  setSmoking,
  airCond,
  setAirCond,
  handleSavePrefs,
  user,
  brandModel,
  setBrandModel
}: ProfileCompletionModalProps) {
  const [showDatePicker, setShowDatePicker] = React.useState(false);

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

  return (
    <AppBottomSheet visible={visible} onClose={onClose} snapPoints={['75%', '95%']} initialIndex={0}>
      <View style={styles.modalHeaderModern}>
        <Text style={styles.modalTitle}>Complétion du profil</Text>
      </View>
      <View>
        <View style={styles.progressContainer}>
          <Text style={styles.progressLabel}>Étape {profileStep === 'personal' ? 1 : profileStep === 'vehicle' ? 2 : 3} sur 3 ({Math.round(getProfileProgress())}%)</Text>
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
              <Ionicons name="car-sport-outline" size={20} color={theme.colors.textMuted} style={styles.inputIcon} />
              <TextInput style={styles.modalInputModern} value={brandModel} onChangeText={setBrandModel} placeholder="Marque & Modèle (ex: Toyota Corolla)" placeholderTextColor={theme.colors.textMuted} />
            </View>
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
              <TouchableOpacity style={styles.modalBtnSkip} onPress={onClose}>
                <Text style={styles.modalBtnSkipText}>Passer</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { flex: 1 }]} onPress={handleSavePrefs} disabled={isSavingProfile}>
                <LinearGradient colors={[theme.colors.primary, '#3B82F6']} style={styles.modalBtnGradient}>
                  {isSavingProfile ? <ActivityIndicator color={theme.colors.white} /> : <Text style={styles.modalBtnText}>Terminer</Text>}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </AppBottomSheet>
  );
}

const styles = StyleSheet.create({
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
  prefBadgeActive: { backgroundColor: theme.colors.primary }
});
