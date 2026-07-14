import { useState, useCallback, useMemo, useEffect } from 'react';
import { Keyboard } from 'react-native';
import { useRouter } from 'expo-router';
import { CountryCode, Country } from 'react-native-country-picker-modal';
import * as Location from 'expo-location';
import { useAuth } from '../../../../../context/AuthContext';

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

const isEmail = (value: string): boolean => value.includes('@');
const isInternational = (value: string): boolean => value.trim().startsWith('+');

export function useLoginForm() {
  const router = useRouter();
  const { loginWithPassword } = useAuth();

  // ── States ────────────────────────────────────────────────
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
    type: 'error' as 'error' | 'success' | 'warning' | 'info',
  });

  // ── Country Picker States ─────────────────────────────────
  const [countryCode, setCountryCode] = useState<CountryCode>('BJ');
  const [callingCode, setCallingCode] = useState('229');
  const [showCountryPicker, setShowCountryPicker] = useState(false);

  // ── Detect Country ────────────────────────────────────────
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
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    detectCountryFromGPS();
  }, [detectCountryFromGPS]);

  // ── Handlers ──────────────────────────────────────────────
  const handleCountrySelect = useCallback((country: Country) => {
    setCountryCode(country.cca2);
    if (country.callingCode?.length > 0) setCallingCode(country.callingCode[0]);
    setShowCountryPicker(false);
  }, []);

  const formatIdentifier = useCallback((): string => {
    const value = identifier.trim();
    if (isEmail(value)) return value.toLowerCase();
    if (isInternational(value)) return value;
    return `+${callingCode}${value.replace(/\D/g, '')}`;
  }, [identifier, callingCode]);

  const getIdentifierError = useCallback((): string | null => {
    const value = identifier.trim();
    if (!value) return 'Veuillez saisir votre numéro de téléphone.';
    if (isEmail(value)) {
      return 'Veuillez utiliser votre numéro de téléphone pour vous connecter.';
    }
    if (isInternational(value)) {
      return value.replace(/\D/g, '').length < 7 ? 'Numéro international trop court.' : null;
    }
    const digits = value.replace(/\D/g, '');
    const min = COUNTRY_MIN_DIGITS[countryCode] ?? 6;
    return digits.length < min ? `Numéro trop court (min. ${min} chiffres).` : null;
  }, [identifier, countryCode]);

  const isPhoneInput = useMemo(() => {
    return true; // Always true since we only accept phone numbers now
  }, [identifier]);

  const phoneFormatHint = useMemo((): string | null => {
    if (!identifier.trim() || isEmail(identifier) || isInternational(identifier)) return null;
    const digits = identifier.replace(/\D/g, '');
    if (digits.length < 3) return null;
    return `→ +${callingCode}${digits}`;
  }, [identifier, callingCode]);

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

  return {
    identifier,
    setIdentifier,
    password,
    setPassword,
    loading,
    showPassword,
    setShowPassword,
    identifierFocused,
    setIdentifierFocused,
    passwordFocused,
    setPasswordFocused,
    alertConfig,
    setAlertConfig,
    countryCode,
    callingCode,
    showCountryPicker,
    setShowCountryPicker,
    handleCountrySelect,
    isPhoneInput,
    phoneFormatHint,
    handleLogin,
  };
}
