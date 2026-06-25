/**
 * ==============================================================
 * Fichier :
 * login.tsx
 *
 * Description :
 * Écran de connexion premium de l'application Zemy.
 * Design inspiré de Bolt, Uber, Revolut – style moderne africain.
 * Fonctionnalités :
 *   - Sélecteur de pays (drapeau + indicatif) pour les numéros locaux
 *   - Détection automatique du pays via expo-location
 *   - Formatage automatique de l'identifiant avant envoi
 *   - Validation email / numéro selon le pays
 *   - Animations premium (fade, slide, spring, shimmer logo)
 *
 * Projet :
 * Zemy
 * ==============================================================
 */
import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
  ActivityIndicator,
  Dimensions,
  Animated,
  ScrollView,
  Image,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../../src/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';
import CustomAlert from '../../src/components/CustomAlert';
import { fetchApi } from '../../src/services/api';
import CountryPicker, {
  Country,
  CountryCode,
} from 'react-native-country-picker-modal';
import * as Location from 'expo-location';

// ─────────────────────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────────────────────

const { width, height } = Dimensions.get('window');
const IS_SMALL_SCREEN = height < 700;

/** Longueurs minimales de chiffres locaux par pays africain */
const COUNTRY_MIN_DIGITS: Record<string, number> = {
  BJ: 8,  // Bénin         +229
  TG: 8,  // Togo          +228
  CI: 8,  // Côte d'Ivoire +225
  SN: 9,  // Sénégal       +221
  BF: 8,  // Burkina Faso  +226
  NE: 8,  // Niger         +227
  CM: 9,  // Cameroun      +237
  GA: 8,  // Gabon         +241
  NG: 10, // Nigeria       +234
};

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

const isEmail = (value: string): boolean => value.includes('@');
const isInternational = (value: string): boolean => value.trim().startsWith('+');

// ─────────────────────────────────────────────────────────────
// Composant
// ─────────────────────────────────────────────────────────────

export default function LoginScreen() {
  const router = useRouter();
  const { loginWithPassword } = useAuth();

  // Refs
  const phoneInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  // ── État formulaire ───────────────────────────────────────
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [identifierFocused, setIdentifierFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    visible: false,
    title: '',
    message: '',
    type: 'error' as any,
  });

  // ── Forgot Password Modal States ─────────────────────────
  const [isResetModalVisible, setIsResetModalVisible] = useState(false);
  const [resetStep, setResetStep] = useState(1);
  const [resetEmail, setResetEmail] = useState('');
  const [resetOtp, setResetOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  // Refs for OTP hidden input
  const otpInputRef = useRef<TextInput>(null);

  // Animations inside modal
  const stepOpacity = useRef(new Animated.Value(1)).current;
  const stepTranslateX = useRef(new Animated.Value(0)).current;

  // ── Pays ─────────────────────────────────────────────────
  const [countryCode, setCountryCode] = useState<CountryCode>('BJ');
  const [callingCode, setCallingCode] = useState('229');
  const [showCountryPicker, setShowCountryPicker] = useState(false);

  // ── Animations ───────────────────────────────────────────
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const formSlideAnim = useRef(new Animated.Value(50)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const waveAnim = useRef(new Animated.Value(0)).current;

  // ─────────────────────────────────────────────────────────
  // Init
  // ─────────────────────────────────────────────────────────

  useEffect(() => {
    // Animations échelonnées : logo → titre → formulaire
    Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScale, {
          toValue: 1,
          friction: 6,
          tension: 80,
          useNativeDriver: true,
        }),
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 450,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(formSlideAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(waveAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
          Animated.timing(waveAnim, { toValue: -1, duration: 250, useNativeDriver: true }),
          Animated.timing(waveAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
          Animated.timing(waveAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
          Animated.delay(1500),
        ])
      ).start();
    });

    detectCountryFromGPS();
  }, []);

  // ─────────────────────────────────────────────────────────
  // GPS
  // ─────────────────────────────────────────────────────────

  const detectCountryFromGPS = useCallback(async () => {
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
        if (detected && detected.length === 2) setCountryCode(detected);
      }
    } catch { /* silencieux */ }
  }, []);

  // ─────────────────────────────────────────────────────────
  // Pays
  // ─────────────────────────────────────────────────────────

  const handleCountrySelect = useCallback((country: Country) => {
    setCountryCode(country.cca2);
    if (country.callingCode?.length > 0) setCallingCode(country.callingCode[0]);
    setShowCountryPicker(false);
  }, []);

  // ─────────────────────────────────────────────────────────
  // Formatage & validation
  // ─────────────────────────────────────────────────────────

  const formatIdentifier = useCallback((): string => {
    const value = identifier.trim();
    if (isEmail(value)) return value.toLowerCase();
    if (isInternational(value)) return value;
    return `+${callingCode}${value.replace(/\D/g, '')}`;
  }, [identifier, callingCode]);

  const getIdentifierError = useCallback((): string | null => {
    const value = identifier.trim();
    if (!value) return 'Veuillez saisir votre email ou numéro.';
    if (isEmail(value)) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? null : 'Adresse email invalide.';
    }
    if (isInternational(value)) {
      return value.replace(/\D/g, '').length < 7 ? 'Numéro international trop court.' : null;
    }
    const digits = value.replace(/\D/g, '');
    const min = COUNTRY_MIN_DIGITS[countryCode] ?? 6;
    return digits.length < min ? `Numéro trop court (min. ${min} chiffres).` : null;
  }, [identifier, countryCode]);

  const isPhoneInput = useMemo(() => {
    if (!identifier.trim()) return false;
    return !identifier.includes('@') && !isInternational(identifier);
  }, [identifier]);

  const phoneFormatHint = useMemo((): string | null => {
    if (!identifier.trim() || isEmail(identifier) || isInternational(identifier)) return null;
    const digits = identifier.replace(/\D/g, '');
    if (digits.length < 3) return null;
    return `→ +${callingCode}${digits}`;
  }, [identifier, callingCode]);

  // ─────────────────────────────────────────────────────────
  // Handlers
  // ─────────────────────────────────────────────────────────

  const handleIdentifierFocus = useCallback(() => {
    setIdentifierFocused(true);
    setTimeout(() => scrollViewRef.current?.scrollTo({ y: 180, animated: true }), 150);
  }, []);

  const handlePasswordFocus = useCallback(() => {
    setPasswordFocused(true);
    setTimeout(() => scrollViewRef.current?.scrollTo({ y: 320, animated: true }), 150);
  }, []);

  const handlePressIn = useCallback(() => {
    Animated.spring(buttonScale, { toValue: 0.96, friction: 5, tension: 120, useNativeDriver: true }).start();
  }, [buttonScale]);

  const handlePressOut = useCallback(() => {
    Animated.spring(buttonScale, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }).start();
  }, [buttonScale]);

  const dismissKeyboard = useCallback(() => {
    Keyboard.dismiss();
    setIdentifierFocused(false);
    setPasswordFocused(false);
  }, []);

  const handleIdentifierChange = useCallback((text: string) => setIdentifier(text), []);

  const handleLogin = useCallback(async () => {
    Keyboard.dismiss();
    if (!identifier || !password) {
      setAlertConfig({ visible: true, title: 'Champs manquants', message: 'Veuillez remplir tous les champs.', type: 'error' });
      return;
    }
    const err = getIdentifierError();
    if (err) {
      setAlertConfig({ visible: true, title: 'Identifiant invalide', message: err, type: 'warning' });
      return;
    }
    setLoading(true);
    try {
      await loginWithPassword(formatIdentifier(), password);
      router.replace('/(tabs)/home');
    } catch (error: any) {
      setAlertConfig({
        visible: true,
        title: 'Erreur de connexion',
        message: error?.message || 'Identifiants invalides ou problème de réseau.',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [identifier, password, getIdentifierError, formatIdentifier, loginWithPassword, router]);

  // ── Forgot Password Logic & Callbacks ────────────────────
  useEffect(() => {
    let interval: any;
    if (isResetModalVisible && resetStep === 2 && resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isResetModalVisible, resetStep, resendTimer]);

  useEffect(() => {
    if (resetStep === 2 && isResetModalVisible) {
      setTimeout(() => {
        otpInputRef.current?.focus();
      }, 300);
    }
  }, [resetStep, isResetModalVisible]);

  const animateStepTransition = useCallback((nextStep: number) => {
    Animated.parallel([
      Animated.timing(stepOpacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(stepTranslateX, {
        toValue: -20,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setResetStep(nextStep);
      stepTranslateX.setValue(20);
      Animated.parallel([
        Animated.timing(stepOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(stepTranslateX, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    });
  }, [stepOpacity, stepTranslateX]);

  const getResetEmailError = useCallback((): string | null => {
    const value = resetEmail.trim();
    if (!value) return 'Veuillez saisir votre adresse email.';
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? null : 'Adresse email invalide.';
  }, [resetEmail]);

  const handleSendResetCode = useCallback(async () => {
    Keyboard.dismiss();
    const err = getResetEmailError();
    if (err) {
      setAlertConfig({
        visible: true,
        title: 'Format incorrect',
        message: err,
        type: 'warning',
      });
      return;
    }

    setResetLoading(true);
    try {
      const email = resetEmail.trim().toLowerCase();
      await fetchApi('/auth/send-reset-code/', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setResendTimer(60);
      animateStepTransition(2);
    } catch (error: any) {
      setAlertConfig({
        visible: true,
        title: 'Erreur',
        message: error?.message || "Impossible d'envoyer le code. Veuillez réessayer.",
        type: 'error',
      });
    } finally {
      setResetLoading(false);
    }
  }, [getResetEmailError, resetEmail, animateStepTransition]);

  const handleResendResetCode = useCallback(async () => {
    if (resendTimer > 0) return;
    setResetLoading(true);
    try {
      const email = resetEmail.trim().toLowerCase();
      await fetchApi('/auth/send-reset-code/', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setResendTimer(60);
      setAlertConfig({
        visible: true,
        title: 'Code renvoyé',
        message: 'Un nouveau code de validation a été envoyé.',
        type: 'success',
      });
    } catch (error: any) {
      setAlertConfig({
        visible: true,
        title: 'Erreur',
        message: error?.message || 'Impossible de renvoyer le code.',
        type: 'error',
      });
    } finally {
      setResetLoading(false);
    }
  }, [resendTimer, resetEmail]);

  const handleVerifyResetCode = useCallback(async () => {
    Keyboard.dismiss();
    if (resetOtp.length !== 6) {
      setAlertConfig({
        visible: true,
        title: 'Saisie incomplète',
        message: 'Veuillez saisir le code OTP à 6 chiffres.',
        type: 'warning',
      });
      return;
    }

    setResetLoading(true);
    try {
      const email = resetEmail.trim().toLowerCase();
      await fetchApi('/auth/verify-reset-code/', {
        method: 'POST',
        body: JSON.stringify({ email, code: resetOtp }),
      });
      animateStepTransition(3);
    } catch (error: any) {
      setAlertConfig({
        visible: true,
        title: 'Code invalide',
        message: error?.message || 'Le code saisi est incorrect ou a expiré.',
        type: 'error',
      });
    } finally {
      setResetLoading(false);
    }
  }, [resetOtp, resetEmail, animateStepTransition]);

  const handleResetPassword = useCallback(async () => {
    Keyboard.dismiss();
    if (!newPassword || !confirmPassword) {
      setAlertConfig({
        visible: true,
        title: 'Champs requis',
        message: 'Veuillez renseigner et confirmer le mot de passe.',
        type: 'warning',
      });
      return;
    }
    if (newPassword.length < 6) {
      setAlertConfig({
        visible: true,
        title: 'Sécurité faible',
        message: 'Le mot de passe doit contenir au moins 6 caractères.',
        type: 'warning',
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      setAlertConfig({
        visible: true,
        title: 'Mots de passe différents',
        message: 'Les mots de passe saisis ne correspondent pas.',
        type: 'warning',
      });
      return;
    }

    setResetLoading(true);
    try {
      const email = resetEmail.trim().toLowerCase();
      await fetchApi('/auth/reset-password/', {
        method: 'POST',
        body: JSON.stringify({
          email,
          code: resetOtp,
          password: newPassword,
        }),
      });
      animateStepTransition(4);
    } catch (error: any) {
      setAlertConfig({
        visible: true,
        title: 'Erreur',
        message: error?.message || 'Impossible de réinitialiser le mot de passe.',
        type: 'error',
      });
    } finally {
      setResetLoading(false);
    }
  }, [newPassword, confirmPassword, resetOtp, resetEmail, animateStepTransition]);

  const handleForgotPassword = useCallback(() => {
    Keyboard.dismiss();
    if (identifier.trim() && identifier.includes('@')) {
      setResetEmail(identifier.trim());
    } else {
      setResetEmail('');
    }
    setResetStep(1);
    setResetOtp('');
    setNewPassword('');
    setConfirmPassword('');
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setIsResetModalVisible(true);
  }, [identifier]);

  const renderOtpBoxes = useCallback(() => {
    const boxes = [];
    for (let i = 0; i < 6; i++) {
      const char = resetOtp[i] || '';
      const isFocused = resetOtp.length === i;
      boxes.push(
        <View
          key={i}
          style={[
            styles.otpBox,
            isFocused && styles.otpBoxFocused,
            char !== '' && styles.otpBoxFilled,
          ]}
        >
          <Text style={styles.otpText}>{char}</Text>
        </View>
      );
    }
    return (
      <TouchableOpacity
        style={styles.otpRow}
        activeOpacity={1}
        onPress={() => otpInputRef.current?.focus()}
      >
        {boxes}
      </TouchableOpacity>
    );
  }, [resetOtp]);

  const renderStep1 = () => (
    <View style={styles.stepWrapper}>
      <Text style={styles.modalTitle}>Mot de passe oublié</Text>
      <Text style={styles.modalSubtitle}>
        Saisissez votre adresse email. Nous vous enverrons un code de validation OTP à 6 chiffres.
      </Text>

      <View style={styles.modalFieldGroup}>
        <Text style={styles.fieldLabel}>Adresse email</Text>
        <View style={[styles.inputBox, styles.modalInputBox]}>
          <View style={styles.inputLeadingIcon}>
            <Ionicons
              name="mail-outline"
              size={18}
              color={theme.colors.primary}
            />
          </View>

          <TextInput
            style={styles.textInput}
            placeholder="Votre adresse email"
            placeholderTextColor={theme.colors.textMuted}
            value={resetEmail}
            onChangeText={setResetEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          {resetEmail.length > 0 && (
            <TouchableOpacity onPress={() => setResetEmail('')} style={styles.clearBtn}>
              <Ionicons name="close-circle" size={16} color={theme.colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <TouchableOpacity
        style={[styles.modalButton, resetLoading && styles.disabledButton]}
        onPress={handleSendResetCode}
        disabled={resetLoading || !resetEmail.trim()}
        activeOpacity={0.9}
      >
        <LinearGradient
          colors={[theme.colors.primary, theme.colors.primaryDark || '#1A4FC8']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.modalGradientButton}
        >
          {resetLoading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.modalButtonText}>Envoyer le code</Text>
          )}
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );

  const renderStep2 = () => {
    return (
      <View style={styles.stepWrapper}>
        <Text style={styles.modalTitle}>Vérification</Text>
        <Text style={styles.modalSubtitle}>
          Entrez le code OTP à 6 chiffres envoyé à{' '}
          <Text style={styles.modalHighlightText}>{resetEmail.trim().toLowerCase()}</Text>.
        </Text>

        <View style={styles.otpContainer}>
          {renderOtpBoxes()}
          <TextInput
            ref={otpInputRef}
            style={styles.hiddenInput}
            value={resetOtp}
            onChangeText={(text) => setResetOtp(text.replace(/\D/g, '').slice(0, 6))}
            keyboardType="number-pad"
            maxLength={6}
            caretHidden
          />
        </View>

        <View style={styles.resendContainer}>
          {resendTimer > 0 ? (
            <Text style={styles.resendText}>
              Renvoyer le code dans <Text style={styles.timerText}>{resendTimer}s</Text>
            </Text>
          ) : (
            <TouchableOpacity onPress={handleResendResetCode} activeOpacity={0.7}>
              <Text style={styles.resendLinkText}>Renvoyer le code</Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={[styles.modalButton, (resetLoading || resetOtp.length !== 6) && styles.disabledButton]}
          onPress={handleVerifyResetCode}
          disabled={resetLoading || resetOtp.length !== 6}
          activeOpacity={0.9}
        >
          <LinearGradient
            colors={
              resetOtp.length !== 6
                ? [theme.colors.grayLight, theme.colors.grayLight]
                : [theme.colors.primary, theme.colors.primaryDark || '#1A4FC8']
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.modalGradientButton}
          >
            {resetLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text
                style={[
                  styles.modalButtonText,
                  resetOtp.length !== 6 && { color: theme.colors.textMuted },
                ]}
              >
                Vérifier
              </Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    );
  };

  const renderStep3 = () => (
    <View style={styles.stepWrapper}>
      <Text style={styles.modalTitle}>Nouveau mot de passe</Text>
      <Text style={styles.modalSubtitle}>
        Créez un nouveau mot de passe sécurisé pour votre compte.
      </Text>

      <View style={styles.modalFieldGroup}>
        <Text style={styles.fieldLabel}>Nouveau mot de passe</Text>
        <View style={[styles.inputBox, styles.modalInputBox]}>
          <View style={styles.inputLeadingIcon}>
            <Ionicons name="lock-closed-outline" size={18} color={theme.colors.primary} />
          </View>
          <TextInput
            style={styles.textInput}
            placeholder="Nouveau mot de passe"
            placeholderTextColor={theme.colors.textMuted}
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry={!showNewPassword}
          />
          <TouchableOpacity onPress={() => setShowNewPassword(!showNewPassword)} style={styles.eyeBtn}>
            <Ionicons
              name={showNewPassword ? 'eye-off-outline' : 'eye-outline'}
              size={18}
              color={theme.colors.textMuted}
            />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.modalFieldGroup}>
        <Text style={styles.fieldLabel}>Confirmez le mot de passe</Text>
        <View style={[styles.inputBox, styles.modalInputBox]}>
          <View style={styles.inputLeadingIcon}>
            <Ionicons name="lock-closed-outline" size={18} color={theme.colors.primary} />
          </View>
          <TextInput
            style={styles.textInput}
            placeholder="Confirmez le mot de passe"
            placeholderTextColor={theme.colors.textMuted}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry={!showConfirmPassword}
          />
          <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={styles.eyeBtn}>
            <Ionicons
              name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
              size={18}
              color={theme.colors.textMuted}
            />
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.modalButton, (resetLoading || !newPassword || !confirmPassword) && styles.disabledButton]}
        onPress={handleResetPassword}
        disabled={resetLoading || !newPassword || !confirmPassword}
        activeOpacity={0.9}
      >
        <LinearGradient
          colors={
            !newPassword || !confirmPassword
              ? [theme.colors.grayLight, theme.colors.grayLight]
              : [theme.colors.primary, theme.colors.primaryDark || '#1A4FC8']
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.modalGradientButton}
        >
          {resetLoading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text
              style={[
                styles.modalButtonText,
                (!newPassword || !confirmPassword) && { color: theme.colors.textMuted },
              ]}
            >
              Modifier mon mot de passe
            </Text>
          )}
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );

  const renderStep4 = () => (
    <View style={[styles.stepWrapper, styles.successWrapper]}>
      <View style={styles.successIconWrapper}>
        <Ionicons name="checkmark-circle" size={80} color={theme.colors.success || '#4CAF50'} />
      </View>
      <Text style={styles.modalTitle}>Mot de passe modifié !</Text>
      <Text style={styles.modalSubtitle}>
        Votre mot de passe a été modifié avec succès. Vous pouvez maintenant vous connecter à votre compte.
      </Text>

      <TouchableOpacity
        style={styles.modalButton}
        onPress={() => {
          setIsResetModalVisible(false);
          if (resetEmail) setIdentifier(resetEmail);
        }}
        activeOpacity={0.9}
      >
        <LinearGradient
          colors={[theme.colors.primary, theme.colors.primaryDark || '#1A4FC8']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.modalGradientButton}
        >
          <Text style={styles.modalButtonText}>Retour à la connexion</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );

  // ─────────────────────────────────────────────────────────
  // Rendu
  // ─────────────────────────────────────────────────────────

  const spin = waveAnim.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-20deg', '0deg', '20deg'],
  });

  const scale = waveAnim.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [0.95, 1, 1.08],
  });

  return (
    <TouchableWithoutFeedback onPress={dismissKeyboard}>
      <SafeAreaView style={styles.container}>
        <StatusBar style="dark" translucent backgroundColor="transparent" />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView
            ref={scrollViewRef}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* ═══════════════════════════════════════════════
                EN-TÊTE PREMIUM
            ═══════════════════════════════════════════════ */}
            <View style={styles.headerSection}>
              {/* Bouton retour */}
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => router.replace('/')}
                activeOpacity={0.7}
                accessibilityLabel="Retour"
              >
                <Ionicons name="arrow-back" size={20} color={theme.colors.text} />
              </TouchableOpacity>

              {/* Logo + Identité de marque */}
              <Animated.View
                style={[
                  styles.brandContainer,
                  { opacity: logoOpacity, transform: [{ scale: logoScale }] },
                ]}
              >
                {/* Logo Zemy officiel */}
                <View style={styles.logoWrapper}>
                  <Image
                    source={require('../../assets/images/logozemy.png')}
                    style={styles.logoImage}
                    resizeMode="contain"
                    accessibilityLabel="Logo Zemy"
                  />
                </View>

                <Text style={styles.brandTagline}>Transport & covoiturage</Text>
              </Animated.View>

              {/* Titre de bienvenue */}
              <Animated.View
                style={[
                  styles.welcomeContainer,
                  { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
                ]}
              >
                <View style={styles.welcomeRow}>
                  <Text style={styles.welcomeTitle}>
                    Ravi de vous <Text style={styles.welcomeHighlight}>revoir</Text>
                  </Text>
                  <Animated.Text
                    style={[
                      styles.waveEmoji,
                      {
                        transform: [
                          { rotate: spin },
                          { scale: scale },
                        ],
                      },
                    ]}
                  >
                    👋
                  </Animated.Text>
                </View>
                <Text style={styles.welcomeSubtitle}>
                  Connectez-vous pour accéder à votre espace
                </Text>
              </Animated.View>
            </View>

            {/* ═══════════════════════════════════════════════
                CARTE DE CONNEXION PREMIUM
            ═══════════════════════════════════════════════ */}
            <Animated.View
              style={[
                styles.card,
                { opacity: fadeAnim, transform: [{ translateY: formSlideAnim }] },
              ]}
            >
              {/* ─── Champ Identifiant ─── */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Email ou Téléphone</Text>

                <View
                  style={[
                    styles.inputBox,
                    identifierFocused && styles.inputBoxFocused,
                  ]}
                >
                  {/* Sélecteur de pays ou icône neutre/email */}
                  {isPhoneInput ? (
                    <TouchableOpacity
                      style={styles.countryTrigger}
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
                        preferredCountries={['BJ', 'TG', 'CI', 'SN', 'BF', 'NE', 'CM', 'GA', 'NG']}
                        containerButtonStyle={styles.pickerButtonStyle}
                      />
                      <Ionicons name="chevron-down" size={10} color={theme.colors.textMuted} />
                      <View style={styles.inputSeparator} />
                      <Text style={styles.callingCode}>+{callingCode}</Text>
                      <View style={styles.inputSeparator} />
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.inputLeadingIcon}>
                      <Ionicons
                        name={
                          !identifier.trim()
                            ? 'person-outline'
                            : isEmail(identifier)
                            ? 'mail-outline'
                            : 'call-outline'
                        }
                        size={18}
                        color={identifierFocused ? theme.colors.primary : theme.colors.textMuted}
                      />
                    </View>
                  )}

                  <TextInput
                    ref={phoneInputRef}
                    style={styles.textInput}
                    placeholder={
                      !identifier
                        ? 'Email ou numéro de téléphone'
                        : isPhoneInput
                        ? '01 95 95 95 95'
                        : 'jean@mail.com'
                    }
                    placeholderTextColor={theme.colors.textMuted}
                    value={identifier}
                    onChangeText={handleIdentifierChange}
                    onFocus={handleIdentifierFocus}
                    onBlur={() => setIdentifierFocused(false)}
                    autoCapitalize="none"
                    keyboardType={isEmail(identifier) ? 'email-address' : 'default'}
                    returnKeyType="next"
                    onSubmitEditing={() => passwordInputRef.current?.focus()}
                    blurOnSubmit={false}
                    accessibilityLabel="Email ou numéro de téléphone"
                  />

                  {identifier.length > 0 && (
                    <TouchableOpacity
                      onPress={() => setIdentifier('')}
                      style={styles.clearBtn}
                      accessibilityLabel="Effacer"
                    >
                      <Ionicons name="close-circle" size={16} color={theme.colors.textMuted} />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Hint format numéro */}
                {phoneFormatHint && (
                  <View style={styles.hintRow}>
                    <Ionicons name="information-circle-outline" size={12} color={theme.colors.primary} />
                    <Text style={styles.hintText}>{phoneFormatHint}</Text>
                  </View>
                )}
              </View>

              {/* ─── Champ Mot de passe ─── */}
              <View style={styles.fieldGroup}>
                <View style={styles.fieldLabelRow}>
                  <Text style={styles.fieldLabel}>Mot de passe</Text>
                  <TouchableOpacity onPress={handleForgotPassword} accessibilityRole="button">
                    <Text style={styles.forgotLink}>Oublié ?</Text>
                  </TouchableOpacity>
                </View>

                <View
                  style={[
                    styles.inputBox,
                    passwordFocused && styles.inputBoxFocused,
                  ]}
                >
                  <View style={styles.inputLeadingIcon}>
                    <Ionicons
                      name="lock-closed-outline"
                      size={18}
                      color={passwordFocused ? theme.colors.primary : theme.colors.textMuted}
                    />
                  </View>
                  <TextInput
                    ref={passwordInputRef}
                    style={styles.textInput}
                    placeholder="Votre mot de passe"
                    placeholderTextColor={theme.colors.textMuted}
                    value={password}
                    onChangeText={setPassword}
                    onFocus={handlePasswordFocus}
                    onBlur={() => setPasswordFocused(false)}
                    secureTextEntry={!showPassword}
                    returnKeyType="done"
                    onSubmitEditing={handleLogin}
                    accessibilityLabel="Mot de passe"
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeBtn}
                    accessibilityLabel={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={18}
                      color={theme.colors.textMuted}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* ─── Bouton Connexion ─── */}
              <Animated.View style={{ transform: [{ scale: buttonScale }], marginTop: 4 }}>
                <TouchableOpacity
                  onPress={handleLogin}
                  disabled={loading || !identifier || !password}
                  onPressIn={handlePressIn}
                  onPressOut={handlePressOut}
                  activeOpacity={0.92}
                  accessibilityRole="button"
                  accessibilityLabel="Se connecter"
                >
                  <LinearGradient
                    colors={
                      !identifier || !password || loading
                        ? [theme.colors.grayLight, theme.colors.grayLight]
                        : [theme.colors.primary, theme.colors.primaryDark || '#1A4FC8']
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.loginBtn}
                  >
                    {loading ? (
                      <View style={styles.loadingRow}>
                        <ActivityIndicator color="#fff" size="small" />
                        <Text style={styles.loginBtnText}>Connexion en cours...</Text>
                      </View>
                    ) : (
                      <View style={styles.loginBtnContent}>
                        <Text
                          style={[
                            styles.loginBtnText,
                            (!identifier || !password) && { color: theme.colors.textMuted },
                          ]}
                        >
                          Se connecter
                        </Text>
                        {identifier && password && (
                          <Ionicons name="arrow-forward" size={18} color="#fff" />
                        )}
                      </View>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>
            </Animated.View>

            {/* ═══════════════════════════════════════════════
                FOOTER – Lien inscription
            ═══════════════════════════════════════════════ */}
            <Animated.View
              style={[styles.footer, { opacity: fadeAnim }]}
            >
              <Text style={styles.footerText}>Pas encore de compte ?</Text>
              <TouchableOpacity
                onPress={() => router.push('/(auth)/register')}
                activeOpacity={0.7}
                style={styles.registerBtn}
                accessibilityRole="button"
                accessibilityLabel="S'inscrire"
              >
                <Text style={styles.registerBtnText}>Créer un compte</Text>
                <Ionicons name="arrow-forward" size={13} color={theme.colors.primary} />
              </TouchableOpacity>
            </Animated.View>

            {/* Espace clavier */}
            <View style={styles.bottomSpacer} />
          </ScrollView>
        </KeyboardAvoidingView>

        <Modal
          visible={isResetModalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => {
            if (resetStep < 4 && !resetLoading) {
              setIsResetModalVisible(false);
            }
          }}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modalOverlay}>
              <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.modalKeyboardAvoiding}
              >
                <View style={styles.modalContent}>
                  {resetStep < 4 && (
                    <TouchableOpacity
                      style={styles.modalCloseButton}
                      onPress={() => setIsResetModalVisible(false)}
                      disabled={resetLoading}
                    >
                      <Ionicons name="close" size={20} color={theme.colors.text} />
                    </TouchableOpacity>
                  )}

                  <Animated.View
                    style={[
                      styles.modalStepContainer,
                      {
                        opacity: stepOpacity,
                        transform: [{ translateX: stepTranslateX }],
                      },
                    ]}
                  >
                    {resetStep === 1 && renderStep1()}
                    {resetStep === 2 && renderStep2()}
                    {resetStep === 3 && renderStep3()}
                    {resetStep === 4 && renderStep4()}
                  </Animated.View>
                </View>
              </KeyboardAvoidingView>
            </View>
          </TouchableWithoutFeedback>
        </Modal>

        <CustomAlert
          visible={alertConfig.visible}
          title={alertConfig.title}
          message={alertConfig.message}
          type={alertConfig.type}
          onClose={() => setAlertConfig({ ...alertConfig, visible: false })}
        />
      </SafeAreaView>
    </TouchableWithoutFeedback>
  );
}

// ─────────────────────────────────────────────────────────────
// Styles premium
// ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 24,
  },

  // ── En-tête ──────────────────────────────────────────────
  headerSection: {
    paddingTop: IS_SMALL_SCREEN ? 8 : 12,
    marginBottom: IS_SMALL_SCREEN ? 16 : 24,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: IS_SMALL_SCREEN ? 12 : 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },

  // ── Brand ─────────────────────────────────────────────────
  brandContainer: {
    alignItems: 'center',
    marginBottom: IS_SMALL_SCREEN ? 14 : 22,
  },
  logoWrapper: {
    width: IS_SMALL_SCREEN ? 80 : 100,
    height: IS_SMALL_SCREEN ? 80 : 100,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    // Ombre colorée (signature Zemy)
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
    backgroundColor: '#fff',
    borderRadius: IS_SMALL_SCREEN ? 40 : 50,
  },
  logoImage: {
    width: '60%',
    height: '60%',
  },
  brandName: {
    fontSize: IS_SMALL_SCREEN ? 26 : 30,
    fontWeight: '800',
    color: theme.colors.text,
    letterSpacing: 0.5,
  },
  brandTagline: {
    fontSize: 12,
    color: theme.colors.textMuted,
    fontWeight: '500',
    letterSpacing: 0.3,
    marginTop: 2,
  },

  // ── Titre bienvenue ────────────────────────────────────────
  welcomeContainer: {
    alignItems: 'center',
  },
  welcomeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  welcomeTitle: {
    fontSize: IS_SMALL_SCREEN ? 20 : 24,
    fontWeight: '700',
    color: theme.colors.text,
    textAlign: 'center',
  },
  waveEmoji: {
    fontSize: IS_SMALL_SCREEN ? 24 : 28,
    marginLeft: 6,
  },
  welcomeHighlight: {
    color: theme.colors.primary,
  },
  welcomeSubtitle: {
    fontSize: 13,
    color: theme.colors.textLight,
    textAlign: 'center',
    lineHeight: 20,
  },

  // ── Carte premium ──────────────────────────────────────────
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: 24,
    padding: IS_SMALL_SCREEN ? 18 : 24,
    marginBottom: 20,
    // Ombre douce multi-couche style iOS
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 18,
    elevation: 6,
    // Légère bordure pour définir la carte
    borderWidth: 1,
    borderColor: theme.colors.border + '60',
  },

  // ── Groupe de champ ────────────────────────────────────────
  fieldGroup: {
    marginBottom: IS_SMALL_SCREEN ? 14 : 18,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 8,
    letterSpacing: 0.1,
  },
  forgotLink: {
    fontSize: 13,
    color: theme.colors.primary,
    fontWeight: '600',
  },

  // ── Champ de saisie ────────────────────────────────────────
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: 14,
    height: 52,
    backgroundColor: theme.colors.background,
    overflow: 'hidden',
    // Transition subtile via ombre
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  inputBoxFocused: {
    borderColor: theme.colors.primary,
    // Ombre bleue légère au focus
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  inputLeadingIcon: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textInput: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 15,
    height: '100%',
    paddingVertical: 0,
    paddingRight: 8,
  },
  clearBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  eyeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 4,
  },

  // ── Sélecteur de pays ──────────────────────────────────────
  countryTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 10,
    height: '100%',
  },
  pickerButtonStyle: {
    // Neutralise la taille par défaut du composant
  },
  inputSeparator: {
    width: 1,
    height: 22,
    backgroundColor: theme.colors.border,
    marginHorizontal: 6,
  },
  callingCode: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
    marginRight: 2,
    minWidth: 38,
  },

  // ── Hint ──────────────────────────────────────────────────
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    paddingHorizontal: 2,
    gap: 4,
  },
  hintText: {
    fontSize: 11,
    color: theme.colors.primary,
    fontStyle: 'italic',
  },

  // ── Bouton Connexion ───────────────────────────────────────
  loginBtn: {
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    // Ombre colorée signature
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  loginBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  loginBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.3,
  },

  // ── Footer ────────────────────────────────────────────────
  footer: {
    alignItems: 'center',
    gap: 8,
  },
  footerText: {
    fontSize: 13,
    color: theme.colors.textLight,
  },
  registerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: theme.colors.primaryLight,
  },
  registerBtnText: {
    fontSize: 14,
    color: theme.colors.primary,
    fontWeight: '700',
  },

  // ── Spacer ────────────────────────────────────────────────
  bottomSpacer: {
    height: Platform.OS === 'ios' ? 32 : 16,
  },

  // ── Modal Styles ──────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(9, 16, 29, 0.6)',
    justifyContent: 'flex-end',
  },
  modalKeyboardAvoiding: {
    width: '100%',
  },
  modalContent: {
    backgroundColor: theme.colors.card,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: Platform.OS === 'ios' ? 44 : 30,
    minHeight: height * 0.45,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 20,
  },
  modalCloseButton: {
    position: 'absolute',
    right: 20,
    top: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  modalStepContainer: {
    width: '100%',
  },
  stepWrapper: {
    width: '100%',
    paddingTop: 10,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: theme.colors.textLight,
    lineHeight: 22,
    marginBottom: 20,
  },
  modalHighlightText: {
    fontWeight: '600',
    color: theme.colors.text,
  },
  modalFieldGroup: {
    marginBottom: 16,
  },
  modalInputBox: {
    backgroundColor: theme.colors.background,
  },
  modalButton: {
    height: 52,
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 10,
  },
  disabledButton: {
    opacity: 0.7,
  },
  modalGradientButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },

  // OTP Styles
  otpContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 14,
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 10,
  },
  otpBox: {
    width: 48,
    height: 52,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  otpBoxFocused: {
    borderColor: theme.colors.primary,
    backgroundColor: '#fff',
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  otpBoxFilled: {
    borderColor: theme.colors.primary,
  },
  otpText: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text,
  },
  hiddenInput: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },

  // Resend Timer
  resendContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  resendText: {
    fontSize: 13,
    color: theme.colors.textLight,
  },
  timerText: {
    fontWeight: '600',
    color: theme.colors.primary,
  },
  resendLinkText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.primary,
    textDecorationLine: 'underline',
  },

  // Success Step Styles
  successWrapper: {
    alignItems: 'center',
    paddingTop: 20,
  },
  successIconWrapper: {
    marginBottom: 16,
    shadowColor: theme.colors.success || '#10B981',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 5,
  },
});