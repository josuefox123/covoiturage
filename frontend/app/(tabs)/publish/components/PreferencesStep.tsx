import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../../../src/styles/theme';

interface PreferencesStepProps {
  music: boolean;
  setMusic: (val: boolean) => void;
  smoking: boolean;
  setSmoking: (val: boolean) => void;
  chatty: boolean;
  setChatty: (val: boolean) => void;
  airCond: boolean;
  setAirCond: (val: boolean) => void;
  petsAllowed: boolean;
  setPetsAllowed: (val: boolean) => void;
  luggageAllowed: boolean;
  setLuggageAllowed: (val: boolean) => void;
  luggageSize: 'petit' | 'moyen' | 'grand';
  setLuggageSize: (val: 'petit' | 'moyen' | 'grand') => void;
  luggageType: 'per_passenger' | 'total';
  setLuggageType: (val: 'per_passenger' | 'total') => void;
  luggageMaxWeightKg: string;
  setLuggageMaxWeightKg: (val: string) => void;
  drivingRelay: boolean;
  setDrivingRelay: (val: boolean) => void;
  stopsAllowed: boolean;
  setStopsAllowed: (val: boolean) => void;
  description: string;
  setDescription: (val: string) => void;
  departure: string;
  arrival: string;
  price: string;
}

export function PreferencesStep({
  music,
  setMusic,
  smoking,
  setSmoking,
  chatty,
  setChatty,
  airCond,
  setAirCond,
  petsAllowed,
  setPetsAllowed,
  luggageAllowed,
  setLuggageAllowed,
  luggageSize,
  setLuggageSize,
  luggageType,
  setLuggageType,
  luggageMaxWeightKg,
  setLuggageMaxWeightKg,
  drivingRelay,
  setDrivingRelay,
  stopsAllowed,
  setStopsAllowed,
  description,
  setDescription,
  departure,
  arrival,
  price
}: PreferencesStepProps) {
  const priceNum = parseInt(price, 10) || 0;

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

  return (
    <View>
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
        {luggageAllowed && (
          <View style={styles.luggageSubCard}>
            <Text style={styles.luggageSubTitle}>Configuration des bagages</Text>

            {/* Size selector */}
            <Text style={styles.luggageSubLabel}>Taille max acceptée par sac</Text>
            <View style={styles.luggageOptionsRow}>
              {[
                { key: 'petit', label: 'Petit' },
                { key: 'moyen', label: 'Moyen (Cabine)' },
                { key: 'grand', label: 'Grand' },
              ].map((item) => (
                <TouchableOpacity
                  key={item.key}
                  style={[styles.luggageOptBtn, luggageSize === item.key && styles.luggageOptBtnActive]}
                  onPress={() => setLuggageSize(item.key as any)}
                >
                  <Text style={[styles.luggageOptText, luggageSize === item.key && styles.luggageOptTextActive]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Limit mode: Per passenger vs Total */}
            <Text style={styles.luggageSubLabel}>Limite de poids/volume</Text>
            <View style={styles.luggageOptionsRow}>
              {[
                { key: 'per_passenger', label: 'Par passager' },
                { key: 'total', label: 'Au total (coffre)' },
              ].map((item) => (
                <TouchableOpacity
                  key={item.key}
                  style={[styles.luggageOptBtn, luggageType === item.key && styles.luggageOptBtnActive]}
                  onPress={() => setLuggageType(item.key as any)}
                >
                  <Text style={[styles.luggageOptText, luggageType === item.key && styles.luggageOptTextActive]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Weight limit in kg */}
            <View style={styles.weightInputRow}>
              <Text style={styles.luggageSubLabel}>Poids max ({luggageType === 'per_passenger' ? 'par passager' : 'au total'})</Text>
              <View style={styles.weightInputBox}>
                <TextInput
                  style={styles.weightInputField}
                  value={luggageMaxWeightKg}
                  onChangeText={setLuggageMaxWeightKg}
                  keyboardType="numeric"
                  placeholder="15"
                  maxLength={3}
                />
                <Text style={styles.weightInputUnit}>kg</Text>
              </View>
            </View>
          </View>
        )}

        <PrefToggle label="Relais de conduite accepté (si fatigue)" icon="car-sport-outline" value={drivingRelay} onToggle={() => setDrivingRelay(!drivingRelay)} />
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
    </View>
  );
}

const styles = StyleSheet.create({
  stepTitle: { fontSize: 22, fontWeight: '800', color: theme.colors.text, marginTop: 20, marginBottom: 6 },
  stepSubtitle: { fontSize: 14, color: theme.colors.textLight, marginBottom: 20, lineHeight: 20 },
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
  luggageSubCard: { backgroundColor: '#F8FAFC', borderRadius: 14, padding: 12, marginTop: -4, marginBottom: 6, borderWidth: 1, borderColor: '#E2E8F0', gap: 8 },
  luggageSubTitle: { fontSize: 12, fontWeight: '800', color: theme.colors.text, textTransform: 'uppercase' },
  luggageSubLabel: { fontSize: 11, fontWeight: '600', color: theme.colors.textMuted, marginTop: 4 },
  luggageOptionsRow: { flexDirection: 'row', gap: 6 },
  luggageOptBtn: { flex: 1, paddingVertical: 8, paddingHorizontal: 6, borderRadius: 10, backgroundColor: '#FFFFFF', alignItems: 'center', borderWidth: 1, borderColor: '#CBD5E1' },
  luggageOptBtnActive: { backgroundColor: `${theme.colors.primary}15`, borderColor: theme.colors.primary },
  luggageOptText: { fontSize: 11, fontWeight: '700', color: theme.colors.textMuted },
  luggageOptTextActive: { color: theme.colors.primary },
  weightInputRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  weightInputBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 10, borderWidth: 1, borderColor: '#CBD5E1', paddingHorizontal: 10, height: 36 },
  weightInputField: { fontSize: 14, fontWeight: '800', color: theme.colors.text, width: 40, textAlign: 'center' },
  weightInputUnit: { fontSize: 12, fontWeight: '700', color: theme.colors.textMuted, marginLeft: 2 },
  descriptionCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, marginBottom: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  descriptionInput: { fontSize: 14, color: theme.colors.text, minHeight: 90, textAlignVertical: 'top', lineHeight: 22 },
  descriptionCounter: { fontSize: 11, color: theme.colors.textLight, textAlign: 'right', marginTop: 4 }
});
