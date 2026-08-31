/**
 * ==============================================================
 * Fichier :
 * register.tsx
 *
 * Description :
 * Écran d'inscription de l'application Zemy.
 * Inclut un sélecteur de pays international (drapeau + indicatif)
 * avec détection automatique via GPS – style Yango / Bolt / InDrive.
 * Prend en charge les pays africains : BJ, TG, CI, SN, BF, NE, CM, GA.
 * Vérification en temps réel de la disponibilité de l'email et du numéro.
 *
 * Projet :
 * Zemy
 * ==============================================================
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { theme } from '../../src/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';
import CustomAlert from '../../src/components/CustomAlert';
import CountryPicker, { Country, CountryCode } from 'react-native-country-picker-modal';
import * as Location from 'expo-location';
import { API_URL } from '../../src/services/api';

// ─────────────────────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────────────────────

/** Longueurs minimales de chiffres locaux (sans indicatif) par pays africain */
const COUNTRY_MIN_DIGITS: Record<string, number> = {
  BJ: 8,  // Bénin         +229
  TG: 8,  // Togo          +228
  CI: 8,  // Côte d'Ivoire +225
  SN: 9,  // Sénégal       +221
  BF: 8,  // Burkina Faso  +226
  NE: 8,  // Niger         +227
  CM: 9,  // Cameroun      +237
  GA: 8,  // Gabon         +241
};

/**
 * Placeholder du numéro local selon le pays.
 * Bénin → "01 95 95 95 95" (format avec 0 initial + séparateurs)
 */
const COUNTRY_PHONE_PLACEHOLDER: Record<string, string> = {
  BJ: '01 95 95 95 95',
  TG: '90 12 34 56',
  CI: '01 23 45 67',
  SN: '77 123 45 67',
  BF: '70 12 34 56',
  NE: '90 12 34 56',
  CM: '6 70 12 34 56',
  GA: '07 12 34 56',
};

/** Délai debounce avant appel API de vérification (ms) */
const DEBOUNCE_DELAY = 600;

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

type AvailabilityState = 'idle' | 'checking' | 'available' | 'taken' | 'error';

// ─────────────────────────────────────────────────────────────
// Composant
// ─────────────────────────────────────────────────────────────

/**
 * Composant RegisterScreen.
 *
 * Responsabilités :
 * - Formulaire d'inscription complet avec validation locale et distante.
 * - Sélection du pays via drapeau + indicatif international.
 * - Détection automatique du pays via expo-location.
 * - Vérification en temps réel (debounce) de la disponibilité de l'email et du téléphone.
 */
export default function RegisterScreen() {
  const router = useRouter();
  const { registerWithPassword } = useAuth();

  // ── Champs du formulaire ──────────────────────────────────────
  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // ── Téléphone international ───────────────────────────────────
  /** Code ISO du pays sélectionné (ex: 'BJ', 'TG', 'CI') */
  const [countryCode, setCountryCode] = useState<CountryCode>('BJ');
  /** Indicatif téléphonique sans le '+' (ex: '229') */
  const [callingCode, setCallingCode] = useState('229');
  /** Numéro local sans indicatif */
  const [phoneLocal, setPhoneLocal] = useState('');
  /** Affiche/masque la modal de sélection de pays */
  const [showCountryPicker, setShowCountryPicker] = useState(false);

  // ── Disponibilité en temps réel ───────────────────────────────
  const [emailAvailability, setEmailAvailability] = useState<AvailabilityState>('idle');
  const [phoneAvailability, setPhoneAvailability] = useState<AvailabilityState>('idle');

  // ── UI ────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    visible: false,
    title: '',
    message: '',
    type: 'error' as any,
  });
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  // Refs pour les timers debounce
  const emailDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phoneDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─────────────────────────────────────────────────────────────
  // Géodétection automatique du pays au montage
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    detectCountryFromGPS();
  }, []);

  /**
   * Tente de détecter le pays via GPS.
   * Silencieux en cas d'échec → reste sur BJ par défaut.
   */
  const detectCountryFromGPS = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Low,
      });
      const geo = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      if (geo.length > 0 && geo[0].isoCountryCode) {
        const detected = geo[0].isoCountryCode as CountryCode;
        if (detected && detected.length === 2) {
          setCountryCode(detected);
        }
      }
    } catch {
      // Erreur silencieuse – l'utilisateur choisit manuellement
    }
  };

  // ─────────────────────────────────────────────────────────────
  // Vérification de disponibilité – API avec debounce
  // ─────────────────────────────────────────────────────────────

  /**
   * Appelle l'endpoint /auth/check-availability/ pour vérifier
   * si l'email ou le numéro est déjà enregistré.
   */
  const checkAvailability = useCallback(
    async (params: { email?: string; phone?: string }) => {
      try {
        const query = new URLSearchParams();
        if (params.email) query.append('email', params.email);
        if (params.phone) query.append('phone', params.phone);

        const response = await fetch(`${API_URL}/auth/check-availability/?${query.toString()}`);
        if (!response.ok) throw new Error('network');
        return await response.json();
      } catch {
        return null;
      }
    },
    []
  );

  /**
   * Appelé à chaque changement du champ email.
   * Lance la vérification debounce après 600ms.
   */
  const handleEmailChange = (value: string) => {
    setEmail(value);
    setEmailAvailability('idle');

    if (emailDebounceRef.current) clearTimeout(emailDebounceRef.current);

    // Validation basique du format email avant d'appeler l'API
    const isValidFormat = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
    if (!value.trim() || !isValidFormat) return;

    setEmailAvailability('checking');
    emailDebounceRef.current = setTimeout(async () => {
      const result = await checkAvailability({ email: value.trim() });
      if (result === null) {
        setEmailAvailability('error');
      } else {
        setEmailAvailability(result?.available ? 'available' : 'taken');
      }
    }, DEBOUNCE_DELAY);
  };

  /**
   * Appelé à chaque changement du numéro local.
   * Lance la vérification debounce après 600ms si le numéro est assez long.
   */
  const handlePhoneChange = (value: string) => {
    setPhoneLocal(value);
    setPhoneAvailability('idle');

    if (phoneDebounceRef.current) clearTimeout(phoneDebounceRef.current);

    const digits = value.replace(/\D/g, '');
    const minDigits = COUNTRY_MIN_DIGITS[countryCode] ?? 6;
    if (digits.length < minDigits) return;

    const fullPhone = `+${callingCode}${digits}`;
    setPhoneAvailability('checking');
    phoneDebounceRef.current = setTimeout(async () => {
      const result = await checkAvailability({ phone: fullPhone });
      if (result === null) {
        setPhoneAvailability('error');
      } else {
        setPhoneAvailability(result?.available ? 'available' : 'taken');
      }
    }, DEBOUNCE_DELAY);
  };

  // Reset la vérification du téléphone si le pays change
  useEffect(() => {
    setPhoneAvailability('idle');
    if (phoneDebounceRef.current) clearTimeout(phoneDebounceRef.current);
    // Relance si le numéro est déjà assez long
    if (phoneLocal) handlePhoneChange(phoneLocal);
  }, [callingCode]);

  // Nettoyage des timers au démontage
  useEffect(() => {
    return () => {
      if (emailDebounceRef.current) clearTimeout(emailDebounceRef.current);
      if (phoneDebounceRef.current) clearTimeout(phoneDebounceRef.current);
    };
  }, []);

  // ─────────────────────────────────────────────────────────────
  // Gestion du sélecteur de pays
  // ─────────────────────────────────────────────────────────────

  const handleCountrySelect = (country: Country) => {
    setCountryCode(country.cca2);
    if (country.callingCode && country.callingCode.length > 0) {
      setCallingCode(country.callingCode[0]);
    }
    setShowCountryPicker(false);
  };

  // ─────────────────────────────────────────────────────────────
  // Validation et soumission
  // ─────────────────────────────────────────────────────────────

  const isPhoneValid = (): boolean => {
    const digits = phoneLocal.replace(/\D/g, '');
    return digits.length >= (COUNTRY_MIN_DIGITS[countryCode] ?? 6);
  };

  const isPasswordLengthValid = password.length >= 6;
  const hasPasswordLetter = /[a-zA-Z]/.test(password);
  const hasPasswordNumber = /[0-9]/.test(password);
  const isPasswordValid = isPasswordLengthValid && hasPasswordLetter && hasPasswordNumber;

  const isFormValid =
    !!(lastName && firstName && email && phoneLocal && isPasswordValid && confirmPassword === password && acceptedTerms);

  const handleRegister = async () => {
    if (!lastName || !firstName || !email || !phoneLocal || !password) {
      setAlertConfig({
        visible: true,
        title: 'Attention',
        message: 'Veuillez remplir tous les champs obligatoires.',
        type: 'warning',
      });
      return;
    }

    if (password !== confirmPassword) {
      setAlertConfig({
        visible: true,
        title: 'Erreur',
        message: 'Les mots de passe ne correspondent pas.',
        type: 'error',
      });
      return;
    }

    if (!isPhoneValid()) {
      setAlertConfig({
        visible: true,
        title: 'Numéro invalide',
        message: `Le numéro doit contenir au moins ${COUNTRY_MIN_DIGITS[countryCode] ?? 6} chiffres.`,
        type: 'warning',
      });
      return;
    }

    // Bloquer si email ou téléphone déjà pris (selon la vérification en temps réel)
    if (emailAvailability === 'checking' || emailAvailability === 'idle') {
      setAlertConfig({ visible: true, title: "Vérification en cours", message: "Attendez la fin de vérification de l'email.", type: "warning" });
      return;
    }
    if (emailAvailability === 'taken') {
      setAlertConfig({
        visible: true,
        title: 'Email déjà utilisé',
        message: 'Cette adresse email est déjà associée à un compte. Connectez-vous ou utilisez un autre email.',
        type: 'error',
      });
      return;
    }

    if (phoneAvailability === 'checking' || phoneAvailability === 'idle') {
      setAlertConfig({ visible: true, title: "Vérification en cours", message: "Attendez la fin de vérification du numéro.", type: "warning" });
      return;
    }
    if (phoneAvailability === 'taken') {
      setAlertConfig({
        visible: true,
        title: 'Numéro déjà utilisé',
        message: 'Ce numéro de téléphone est déjà associé à un compte. Connectez-vous ou utilisez un autre numéro.',
        type: 'error',
      });
      return;
    }

    setLoading(true);
    try {
      // Formatage E.164 : +{indicatif}{chiffres locaux}
      const digits = phoneLocal.replace(/\D/g, '');
      const formattedPhone = `+${callingCode}${digits}`;

      await registerWithPassword({
        full_name: `${firstName} ${lastName}`,
        email: email.trim(),
        phone: formattedPhone,
        country: countryCode,
        password: password,
      });

      router.replace('/(tabs)/home');
    } catch {
      setAlertConfig({
        visible: true,
        title: 'Erreur',
        message:
          "Impossible de créer le compte. Vérifiez si ce numéro ou cet email n'est pas déjà utilisé.",
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // Helpers UI – icône et message de disponibilité
  // ─────────────────────────────────────────────────────────────

  /**
   * Retourne l'icône Ionicons et la couleur correspondant à l'état de disponibilité.
   */
  const getAvailabilityIcon = (state: AvailabilityState) => {
    switch (state) {
      case 'checking':
        return <ActivityIndicator size={14} color={theme.colors.textMuted} style={{ marginLeft: 6 }} />;
      case 'available':
        return <Ionicons name="checkmark-circle" size={16} color={theme.colors.success} style={{ marginLeft: 6 }} />;
      case 'taken':
        return <Ionicons name="close-circle" size={16} color={theme.colors.error} style={{ marginLeft: 6 }} />;
      case 'error':
        return <Ionicons name="alert-circle" size={16} color={theme.colors.warning} style={{ marginLeft: 6 }} />;
      default:
        return null;
    }
  };

  /**
   * Retourne le message texte de disponibilité.
   */
  const getAvailabilityText = (state: AvailabilityState, type: 'email' | 'phone') => {
    const label = type === 'email' ? 'Email' : 'Numéro';
    switch (state) {
      case 'checking':
        return { text: 'Vérification...', color: theme.colors.textMuted };
      case 'available':
        return { text: `${label} disponible ✓`, color: theme.colors.success };
      case 'taken':
        return {
          text: type === 'email'
            ? 'Email déjà utilisé – connectez-vous ou choisissez-en un autre'
            : 'Numéro déjà utilisé – connectez-vous ou utilisez un autre numéro',
          color: theme.colors.error,
        };
      case 'error':
        return { text: 'Impossible de vérifier', color: theme.colors.warning };
      default:
        return null;
    }
  };

  // ─────────────────────────────────────────────────────────────
  // Rendu
  // ─────────────────────────────────────────────────────────────

  const phonePlaceholder = COUNTRY_PHONE_PLACEHOLDER[countryCode] ?? '01 95 95 95 95';

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Bouton retour ── */}
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>

          {/* ── En-tête ── */}
          <View style={styles.header}>
            <Text style={styles.title}>Créer un compte </Text>
            <Text style={styles.subtitle}>
              Rejoignez Zemy pour vous déplacer facilement.
            </Text>
          </View>

          {/* ── Formulaire ── */}
          <View style={styles.form}>

            {/* Nom */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Nom</Text>
              <View style={styles.inputWrapper}>
                <Ionicons
                  name="person-outline"
                  size={20}
                  color={theme.colors.textMuted}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="ex: Koffi"
                  placeholderTextColor={theme.colors.textMuted}
                  value={lastName}
                  onChangeText={setLastName}
                />
              </View>
            </View>

            {/* Prénom */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Prénom</Text>
              <View style={styles.inputWrapper}>
                <Ionicons
                  name="person-outline"
                  size={20}
                  color={theme.colors.textMuted}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="ex: Jean"
                  placeholderTextColor={theme.colors.textMuted}
                  value={firstName}
                  onChangeText={setFirstName}
                />
              </View>
            </View>

            {/* ── Email avec vérification ── */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Email</Text>
              <View style={[
                styles.inputWrapper,
                emailAvailability === 'taken' && styles.inputWrapperError,
                emailAvailability === 'available' && styles.inputWrapperSuccess,
              ]}>
                <Ionicons
                  name="mail-outline"
                  size={20}
                  color={
                    emailAvailability === 'taken'
                      ? theme.colors.error
                      : emailAvailability === 'available'
                        ? theme.colors.success
                        : theme.colors.textMuted
                  }
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="ex: jean@mail.com"
                  placeholderTextColor={theme.colors.textMuted}
                  value={email}
                  onChangeText={handleEmailChange}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
                {/* Icône de statut à droite */}
                {getAvailabilityIcon(emailAvailability)}
              </View>

              {/* Message de disponibilité email */}
              {emailAvailability !== 'idle' && (() => {
                const info = getAvailabilityText(emailAvailability, 'email');
                return info ? (
                  <Text style={[styles.availabilityText, { color: info.color }]}>
                    {info.text}
                  </Text>
                ) : null;
              })()}
            </View>

            {/* ── Numéro de téléphone international ── */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Numéro de téléphone</Text>

              {/*
               * Structure : [ 🇧🇯 ▾ ] | +229 | 01 95 95 95 95
               */}
              <View style={[
                styles.phoneContainer,
                phoneAvailability === 'taken' && styles.inputWrapperError,
                phoneAvailability === 'available' && styles.inputWrapperSuccess,
              ]}>

                {/* Sélecteur de pays */}
                <TouchableOpacity
                  style={styles.countryPickerButton}
                  onPress={() => setShowCountryPicker(true)}
                  activeOpacity={0.7}
                  accessibilityLabel="Choisir le pays"
                  accessibilityRole="button"
                >
                  <CountryPicker
                    countryCode={countryCode}
                    withFlag
                    withCallingCode
                    withFilter
                    withAlphaFilter
                    withEmoji
                    onSelect={handleCountrySelect}
                    visible={showCountryPicker}
                    onClose={() => setShowCountryPicker(false)}
                    preferredCountries={['BJ', 'TG', 'CI', 'SN', 'BF', 'NE', 'CM', 'GA']}
                    containerButtonStyle={styles.countryPickerContainer}
                  />
                  <Ionicons
                    name="chevron-down"
                    size={12}
                    color={theme.colors.textMuted}
                    style={{ marginLeft: 2 }}
                  />
                </TouchableOpacity>

                {/* Séparateur */}
                <View style={styles.phoneDivider} />

                {/* Indicatif international */}
                <Text style={styles.callingCodeText}>+{callingCode}</Text>

                {/* Séparateur */}
                <View style={styles.phoneDivider} />

                {/* Saisie numéro local */}
                <TextInput
                  style={styles.phoneInput}
                  placeholder={phonePlaceholder}
                  placeholderTextColor={theme.colors.textMuted}
                  value={phoneLocal}
                  onChangeText={handlePhoneChange}
                  keyboardType="phone-pad"
                  maxLength={15}
                  accessibilityLabel="Numéro de téléphone"
                />

                {/* Icône de statut disponibilité téléphone */}
                {phoneAvailability !== 'idle' && (
                  <View style={{ paddingRight: 10 }}>
                    {getAvailabilityIcon(phoneAvailability)}
                  </View>
                )}
              </View>

              {/* Message de disponibilité téléphone */}
              {phoneAvailability !== 'idle' && (() => {
                const info = getAvailabilityText(phoneAvailability, 'phone');
                return info ? (
                  <Text style={[styles.availabilityText, { color: info.color }]}>
                    {info.text}
                  </Text>
                ) : null;
              })()}
            </View>

            {/* Mot de passe */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Mot de passe</Text>
              <View style={styles.inputWrapper}>
                <Ionicons
                  name="lock-closed-outline"
                  size={20}
                  color={theme.colors.textMuted}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Créer un mot de passe"
                  placeholderTextColor={theme.colors.textMuted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={theme.colors.textMuted}
                  />
                </TouchableOpacity>
              </View>
              {password.length > 0 && (
                <View style={styles.passwordRulesContainer}>
                  <View style={styles.ruleItem}>
                    <Ionicons
                      name={isPasswordLengthValid ? "checkmark-circle" : "ellipse-outline"}
                      size={14}
                      color={isPasswordLengthValid ? theme.colors.success : theme.colors.textMuted}
                    />
                    <Text style={[styles.ruleText, isPasswordLengthValid && styles.ruleTextValid]}>
                      Au moins 6 caractères
                    </Text>
                  </View>
                  <View style={styles.ruleItem}>
                    <Ionicons
                      name={hasPasswordLetter ? "checkmark-circle" : "ellipse-outline"}
                      size={14}
                      color={hasPasswordLetter ? theme.colors.success : theme.colors.textMuted}
                    />
                    <Text style={[styles.ruleText, hasPasswordLetter && styles.ruleTextValid]}>
                      Au moins une lettre (a-z, A-Z)
                    </Text>
                  </View>
                  <View style={styles.ruleItem}>
                    <Ionicons
                      name={hasPasswordNumber ? "checkmark-circle" : "ellipse-outline"}
                      size={14}
                      color={hasPasswordNumber ? theme.colors.success : theme.colors.textMuted}
                    />
                    <Text style={[styles.ruleText, hasPasswordNumber && styles.ruleTextValid]}>
                      Au moins un chiffre (0-9)
                    </Text>
                  </View>
                </View>
              )}
            </View>

            {/* Confirmer le mot de passe */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Confirmer le mot de passe</Text>
              <View style={[
                styles.inputWrapper,
                confirmPassword.length > 0 && password !== confirmPassword && styles.inputWrapperError,
                confirmPassword.length > 0 && password === confirmPassword && styles.inputWrapperSuccess,
              ]}>
                <Ionicons
                  name="checkmark-circle-outline"
                  size={20}
                  color={
                    confirmPassword.length > 0
                      ? password === confirmPassword
                        ? theme.colors.success
                        : theme.colors.error
                      : theme.colors.textMuted
                  }
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Répétez le mot de passe"
                  placeholderTextColor={theme.colors.textMuted}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showPassword}
                />
                {confirmPassword.length > 0 && (
                  <Ionicons
                    name={password === confirmPassword ? 'checkmark-circle' : 'close-circle'}
                    size={18}
                    color={password === confirmPassword ? theme.colors.success : theme.colors.error}
                  />
                )}
              </View>
              {confirmPassword.length > 0 && password !== confirmPassword && (
                <Text style={[styles.availabilityText, { color: theme.colors.error }]}>
                  Les mots de passe ne correspondent pas
                </Text>
              )}
            </View>

            {/* Checkbox Conditions d'utilisation */}
            <TouchableOpacity 
              style={{ flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.xl, marginTop: theme.spacing.sm }}
              onPress={() => setAcceptedTerms(!acceptedTerms)}
              activeOpacity={0.7}
            >
              <Ionicons 
                name={acceptedTerms ? 'checkbox' : 'square-outline'} 
                size={24} 
                color={acceptedTerms ? theme.colors.primary : theme.colors.textMuted} 
              />
              <Text style={{ marginLeft: 10, color: theme.colors.text, flex: 1, fontSize: 14 }}>
                J'accepte les <Text style={{ color: theme.colors.primary, fontWeight: '600' }} onPress={() => router.push('/terms')}>Conditions d'utilisation</Text> de Zemy.
              </Text>
            </TouchableOpacity>

            {/* Bouton d'inscription */}
            <TouchableOpacity
              style={[
                styles.registerButton,
                (!isFormValid || loading || emailAvailability === 'checking' || emailAvailability === 'taken' || phoneAvailability === 'checking' || phoneAvailability === 'taken') && styles.disabledButton,
              ]}
              onPress={handleRegister}
              disabled={loading || !isFormValid || emailAvailability === 'checking' || emailAvailability === 'taken' || phoneAvailability === 'checking' || phoneAvailability === 'taken'}
              activeOpacity={0.8}
            >
              {loading ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <ActivityIndicator color={theme.colors.white} size="small" />
                  <Text style={styles.registerButtonText}>Veuillez patienter...</Text>
                </View>
              ) : (
                <Text style={styles.registerButtonText}>S'inscrire</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* ── Lien vers login ── */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Déjà membre ? </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
              <Text style={styles.loginLink}>Se connecter</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Alerte personnalisée */}
      <CustomAlert
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onClose={() => setAlertConfig({ ...alertConfig, visible: false })}
      />
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.md,
    ...theme.shadows.sm,
  },
  header: {
    marginBottom: theme.spacing.xl,
  },
  title: {
    ...theme.typography.h2,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    ...theme.typography.bodyLarge,
    color: theme.colors.textLight,
  },
  form: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    ...theme.shadows.md,
    marginBottom: theme.spacing.xl,
  },
  inputContainer: {
    marginBottom: theme.spacing.md,
  },
  label: {
    ...theme.typography.bodyMedium,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  // Champ générique
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    height: 52,
    backgroundColor: theme.colors.background,
  },
  inputWrapperError: {
    borderColor: theme.colors.error,
    backgroundColor: theme.colors.errorLight + '20',
  },
  inputWrapperSuccess: {
    borderColor: theme.colors.success,
    backgroundColor: theme.colors.successLight + '20',
  },
  inputIcon: {
    marginRight: theme.spacing.sm,
  },
  input: {
    flex: 1,
    color: theme.colors.text,
    ...theme.typography.bodyMedium,
    height: '100%',
  },

  // ── Champ téléphone international ──────────────────────────
  phoneContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    height: 52,
    backgroundColor: theme.colors.background,
    overflow: 'hidden',
  },
  countryPickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    height: '100%',
    backgroundColor: theme.colors.grayLighter,
  },
  countryPickerContainer: {
    // Neutralise les styles par défaut de la librairie
  },
  phoneDivider: {
    width: 1,
    height: 28,
    backgroundColor: theme.colors.border,
  },
  callingCodeText: {
    ...theme.typography.bodyMedium,
    color: theme.colors.text,
    fontWeight: '600',
    paddingHorizontal: 10,
    minWidth: 52,
  },
  phoneInput: {
    flex: 1,
    height: '100%',
    color: theme.colors.text,
    ...theme.typography.bodyMedium,
    paddingHorizontal: theme.spacing.sm,
  },

  // ── Messages de disponibilité ──────────────────────────────
  availabilityText: {
    ...theme.typography.bodySmall,
    marginTop: 4,
    paddingHorizontal: 2,
  },

  // ── Bouton d'inscription ───────────────────────────────────
  registerButton: {
    backgroundColor: theme.colors.primary,
    height: 52,
    borderRadius: theme.borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: theme.spacing.sm,
    ...theme.shadows.sm,
  },
  disabledButton: {
    opacity: 0.6,
  },
  registerButtonText: {
    ...theme.typography.button,
    color: theme.colors.white,
  },

  // ── Pied de page ───────────────────────────────────────────
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 'auto',
  },
  footerText: {
    ...theme.typography.bodyMedium,
    color: theme.colors.textLight,
  },
  loginLink: {
    ...theme.typography.bodyMedium,
    color: theme.colors.primary,
    fontWeight: '700',
  },
  passwordRulesContainer: {
    marginTop: 8,
    paddingHorizontal: 4,
    gap: 6,
  },
  ruleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ruleText: {
    ...theme.typography.bodySmall,
    color: theme.colors.textMuted,
  },
  ruleTextValid: {
    color: theme.colors.success,
  },
});
