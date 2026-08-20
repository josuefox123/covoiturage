import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
} from 'react-native';
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

type PrefToggleProps = {
  label: string;
  description?: string;
  icon: string;
  value: boolean;
  onToggle: () => void;
};

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
  price,
}: PreferencesStepProps) {
  const priceNum = Number(price) || 0;

  /**
   * Nettoyage du poids des bagages.
   */
  const handleWeightChange = (value: string) => {
    const cleaned = value.replace(/[^0-9]/g, '');

    // Maximum raisonnable : 100 kg
    const numericValue = Number(cleaned);

    if (cleaned === '') {
      setLuggageMaxWeightKg('');
      return;
    }

    if (numericValue <= 100) {
      setLuggageMaxWeightKg(cleaned);
    }
  };

  /**
   * Composant générique pour les préférences.
   */
  const PrefToggle = ({
    label,
    description,
    icon,
    value,
    onToggle,
  }: PrefToggleProps) => (
    <TouchableOpacity
      style={[
        styles.prefToggleRow,
        value && styles.prefToggleRowActive,
      ]}
      onPress={onToggle}
      activeOpacity={0.8}
    >
      <View
        style={[
          styles.prefToggleIconBox,
          value && styles.prefToggleIconBoxActive,
        ]}
      >
        <Ionicons
          name={icon as any}
          size={20}
          color={
            value
              ? theme.colors.white
              : theme.colors.textLight
          }
        />
      </View>

      <View style={styles.prefToggleContent}>
        <Text
          style={[
            styles.prefToggleLabel,
            value && styles.prefToggleLabelActive,
          ]}
        >
          {label}
        </Text>

        {description && (
          <Text style={styles.prefToggleDescription}>
            {description}
          </Text>
        )}
      </View>

      <View
        style={[
          styles.prefToggleBadge,
          value
            ? styles.prefToggleBadgeOn
            : styles.prefToggleBadgeOff,
        ]}
      >
        <Text
          style={[
            styles.prefToggleBadgeText,
            value && styles.prefToggleBadgeTextOn,
          ]}
        >
          {value ? 'Oui' : 'Non'}
        </Text>
      </View>
    </TouchableOpacity>
  );

  /**
   * Bouton de sélection générique.
   */
  const OptionButton = ({
    active,
    label,
    onPress,
    flex = 1,
  }: {
    active: boolean;
    label: string;
    onPress: () => void;
    flex?: number;
  }) => (
    <TouchableOpacity
      style={[
        styles.optionButton,
        { flex },
        active && styles.optionButtonActive,
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {active && (
        <Ionicons
          name="checkmark-circle"
          size={15}
          color={theme.colors.primary}
        />
      )}

      <Text
        style={[
          styles.optionButtonText,
          active && styles.optionButtonTextActive,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View>
      {/* Header */}
      <Text style={styles.stepTitle}>
        Vos préférences
      </Text>

      <Text style={styles.stepSubtitle}>
        Indiquez vos habitudes pour permettre aux passagers
        de choisir un trajet qui leur correspond.
      </Text>

      {/* Trajet résumé */}
      <View style={styles.tripSummary}>
        <View style={styles.tripSummaryIcon}>
          <Ionicons
            name="navigate-outline"
            size={18}
            color={theme.colors.primary}
          />
        </View>

        <View style={styles.tripSummaryContent}>
          <Text style={styles.tripSummaryLabel}>
            VOTRE TRAJET
          </Text>

          <Text
            style={styles.tripSummaryRoute}
            numberOfLines={2}
          >
            {departure || 'Départ'} → {arrival || 'Arrivée'}
          </Text>
        </View>

        {priceNum > 0 && (
          <View style={styles.tripSummaryPriceBox}>
            <Text style={styles.tripSummaryPrice}>
              {priceNum.toLocaleString()}
            </Text>

            <Text style={styles.tripSummaryCurrency}>
              FCFA / place
            </Text>
          </View>
        )}
      </View>

      {/* Section habitudes */}
      <Text style={styles.sectionTitle}>
        Ambiance à bord
      </Text>

      <View style={styles.prefList}>
        <PrefToggle
          label="Musique autorisée"
          description="Les passagers peuvent écouter de la musique."
          icon="musical-notes-outline"
          value={music}
          onToggle={() => setMusic(!music)}
        />

        <PrefToggle
          label="Discussion appréciée"
          description="Vous aimez échanger avec les passagers."
          icon="chatbubbles-outline"
          value={chatty}
          onToggle={() => setChatty(!chatty)}
        />

        <PrefToggle
          label="Climatisation"
          description="La climatisation sera disponible pendant le trajet."
          icon="snow-outline"
          value={airCond}
          onToggle={() => setAirCond(!airCond)}
        />

        <PrefToggle
          label="Animaux acceptés"
          description="Les animaux peuvent voyager à bord."
          icon="paw-outline"
          value={petsAllowed}
          onToggle={() => setPetsAllowed(!petsAllowed)}
        />

        <PrefToggle
          label="Trajet non-fumeur"
          description="Il est interdit de fumer dans le véhicule."
          icon="ban-outline"
          value={!smoking}
          onToggle={() => setSmoking(!smoking)}
        />

        <PrefToggle
          label="Pauses acceptées"
          description="Possibilité de prévoir des pauses supplémentaires."
          icon="pause-circle-outline"
          value={stopsAllowed}
          onToggle={() => setStopsAllowed(!stopsAllowed)}
        />
      </View>

      {/* Bagages */}
      <Text style={styles.sectionTitle}>
        Bagages
      </Text>

      <PrefToggle
        label="Bagages autorisés"
        description="Les passagers peuvent emporter des bagages."
        icon="briefcase-outline"
        value={luggageAllowed}
        onToggle={() => setLuggageAllowed(!luggageAllowed)}
      />

      {luggageAllowed && (
        <View style={styles.luggageCard}>
          <View style={styles.subSectionHeader}>
            <View style={styles.subSectionIcon}>
              <Ionicons
                name="briefcase"
                size={16}
                color={theme.colors.primary}
              />
            </View>

            <View>
              <Text style={styles.subSectionTitle}>
                Conditions des bagages
              </Text>

              <Text style={styles.subSectionDescription}>
                Définissez ce que les passagers peuvent apporter.
              </Text>
            </View>
          </View>

          {/* Taille */}
          <Text style={styles.inputLabel}>
            Taille maximale par bagage
          </Text>

          <View style={styles.optionsRow}>
            <OptionButton
              label="Petit"
              active={luggageSize === 'petit'}
              onPress={() => setLuggageSize('petit')}
            />

            <OptionButton
              label="Cabine"
              active={luggageSize === 'moyen'}
              onPress={() => setLuggageSize('moyen')}
            />

            <OptionButton
              label="Grand"
              active={luggageSize === 'grand'}
              onPress={() => setLuggageSize('grand')}
            />
          </View>

          {/* Type de limite */}
          <Text style={styles.inputLabel}>
            Limite applicable
          </Text>

          <View style={styles.optionsColumn}>
            <OptionButton
              label="Par passager"
              active={luggageType === 'per_passenger'}
              onPress={() =>
                setLuggageType('per_passenger')
              }
            />

            <OptionButton
              label="Total disponible dans le coffre"
              active={luggageType === 'total'}
              onPress={() =>
                setLuggageType('total')
              }
            />
          </View>

          {/* Poids */}
          <View style={styles.weightHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.inputLabel}>
                Poids maximum
              </Text>

              <Text style={styles.weightDescription}>
                {luggageType === 'per_passenger'
                  ? 'Limite par passager'
                  : 'Limite totale pour le véhicule'}
              </Text>
            </View>

            <View style={styles.weightInputBox}>
              <TextInput
                style={styles.weightInput}
                value={luggageMaxWeightKg}
                onChangeText={handleWeightChange}
                keyboardType="numeric"
                placeholder="15"
                placeholderTextColor="#94A3B8"
                maxLength={3}
              />

              <Text style={styles.weightUnit}>
                kg
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Relais de conduite */}
      <Text style={styles.sectionTitle}>
        Conduite
      </Text>

      <PrefToggle
        label="Relais de conduite"
        description="Un autre conducteur peut prendre le relais si nécessaire."
        icon="car-sport-outline"
        value={drivingRelay}
        onToggle={() => setDrivingRelay(!drivingRelay)}
      />

      {/* Description */}
      <Text style={styles.sectionTitle}>
        Message aux passagers
        <Text style={styles.optionalText}>
          {' '}• Optionnel
        </Text>
      </Text>

      <View style={styles.descriptionCard}>
        <View style={styles.descriptionHeader}>
          <Ionicons
            name="create-outline"
            size={18}
            color={theme.colors.primary}
          />

          <Text style={styles.descriptionHint}>
            Ajoutez quelques informations utiles
          </Text>
        </View>

        <TextInput
          style={styles.descriptionInput}
          placeholder="Ex. Voyage calme, ponctualité appréciée..."
          placeholderTextColor="#94A3B8"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={5}
          maxLength={300}
          textAlignVertical="top"
        />

        <View style={styles.descriptionFooter}>
          <Text style={styles.descriptionFooterText}>
            Soyez clair et respectueux.
          </Text>

          <Text style={styles.descriptionCounter}>
            {description.length}/300
          </Text>
        </View>
      </View>

      {/* Conseil */}
      <View style={styles.tipCard}>
        <View style={styles.tipIcon}>
          <Ionicons
            name="information-circle"
            size={19}
            color={theme.colors.primary}
          />
        </View>

        <Text style={styles.tipText}>
          Ces informations seront visibles par les passagers
          avant leur réservation. Elles peuvent les aider à
          choisir le trajet qui leur convient.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stepTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: theme.colors.text,
    marginTop: 20,
    marginBottom: 7,
    letterSpacing: -0.4,
  },

  stepSubtitle: {
    fontSize: 14,
    color: theme.colors.textLight,
    marginBottom: 20,
    lineHeight: 21,
  },

  /* =========================
     TRAJET
  ========================= */

  tripSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderRadius: 16,
    padding: 13,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },

  tripSummaryIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },

  tripSummaryContent: {
    flex: 1,
  },

  tripSummaryLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: theme.colors.textLight,
    letterSpacing: 0.8,
    marginBottom: 2,
  },

  tripSummaryRoute: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.primary,
  },

  tripSummaryPriceBox: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },

  tripSummaryPrice: {
    fontSize: 15,
    fontWeight: '900',
    color: theme.colors.primary,
  },

  tripSummaryCurrency: {
    fontSize: 9,
    color: theme.colors.textLight,
    marginTop: 1,
  },

  /* =========================
     SECTIONS
  ========================= */

  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 10,
    marginTop: 4,
  },

  optionalText: {
    fontSize: 11,
    fontWeight: '500',
    color: theme.colors.textLight,
  },

  prefList: {
    gap: 8,
    marginBottom: 22,
  },

  /* =========================
     TOGGLES
  ========================= */

  prefToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 13,
    gap: 11,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },

  prefToggleRowActive: {
    backgroundColor: `${theme.colors.primary}08`,
    borderColor: `${theme.colors.primary}35`,
  },

  prefToggleIconBox: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },

  prefToggleIconBoxActive: {
    backgroundColor: theme.colors.primary,
  },

  prefToggleContent: {
    flex: 1,
  },

  prefToggleLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.text,
  },

  prefToggleLabelActive: {
    color: theme.colors.primary,
  },

  prefToggleDescription: {
    fontSize: 11,
    color: theme.colors.textLight,
    marginTop: 3,
    lineHeight: 15,
  },

  prefToggleBadge: {
    minWidth: 42,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 12,
    alignItems: 'center',
  },

  prefToggleBadgeOn: {
    backgroundColor: `${theme.colors.primary}15`,
  },

  prefToggleBadgeOff: {
    backgroundColor: '#F1F5F9',
  },

  prefToggleBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: theme.colors.textLight,
  },

  prefToggleBadgeTextOn: {
    color: theme.colors.primary,
  },

  /* =========================
     BAGAGES
  ========================= */

  luggageCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    padding: 15,
    marginTop: 8,
    marginBottom: 22,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },

  subSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },

  subSectionIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: `${theme.colors.primary}12`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 9,
  },

  subSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.text,
  },

  subSectionDescription: {
    fontSize: 10,
    color: theme.colors.textLight,
    marginTop: 2,
  },

  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },

  optionsRow: {
    flexDirection: 'row',
    gap: 7,
    marginBottom: 16,
  },

  optionsColumn: {
    gap: 7,
    marginBottom: 16,
  },

  optionButton: {
    minHeight: 42,
    paddingHorizontal: 10,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 5,
  },

  optionButtonActive: {
    backgroundColor: `${theme.colors.primary}10`,
    borderColor: theme.colors.primary,
  },

  optionButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.textLight,
    textAlign: 'center',
  },

  optionButtonTextActive: {
    color: theme.colors.primary,
  },

  weightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },

  weightDescription: {
    fontSize: 10,
    color: theme.colors.textLight,
    marginTop: -3,
  },

  weightInputBox: {
    height: 44,
    minWidth: 90,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 8,
  },

  weightInput: {
    width: 48,
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.text,
    textAlign: 'center',
  },

  weightUnit: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.textLight,
  },

  /* =========================
     DESCRIPTION
  ========================= */

  descriptionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 17,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },

  descriptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 8,
  },

  descriptionHint: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.textLight,
  },

  descriptionInput: {
    minHeight: 95,
    fontSize: 14,
    color: theme.colors.text,
    lineHeight: 21,
    paddingTop: 8,
  },

  descriptionFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 5,
  },

  descriptionFooterText: {
    fontSize: 10,
    color: '#94A3B8',
  },

  descriptionCounter: {
    fontSize: 10,
    color: theme.colors.textLight,
    fontWeight: '600',
  },

  /* =========================
     CONSEIL
  ========================= */

  tipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },

  tipIcon: {
    marginRight: 9,
    marginTop: 1,
  },

  tipText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 17,
    color: theme.colors.textLight,
  },
});
