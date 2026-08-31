/**
 * ==============================================================
 * Fichier :
 * LoginScreen/index.tsx
 *
 * Description :
 * Écran de connexion premium pour l'application Zemy.
 *
 * Projet :
 * Zemy
 * ==============================================================
 */

import React, { useRef, useEffect, useCallback } from 'react';
import {
  Text,
  View,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
  ScrollView,
  Image,
  Keyboard,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../../../../styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import CustomAlert from '../../../../components/CustomAlert';
import CountryPicker from 'react-native-country-picker-modal';

import { styles } from './styles';
import { useLoginForm } from './hooks/useLoginForm';

export default function LoginScreen() {
  const router = useRouter();
  const form = useLoginForm();

  // Refs
  const phoneInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const cardSlide = useRef(new Animated.Value(40)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;
  const logoScale = useRef(new Animated.Value(0.85)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const footerOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      // 1. Logo pop-in
      Animated.parallel([
        Animated.spring(logoScale, {
          toValue: 1,
          friction: 7,
          tension: 70,
          useNativeDriver: true,
        }),
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 350,
          useNativeDriver: true,
        }),
      ]),
      // 2. Header slides up
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 380,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 380,
          useNativeDriver: true,
        }),
      ]),
      // 3. Card slides up
      Animated.parallel([
        Animated.timing(cardSlide, {
          toValue: 0,
          duration: 320,
          useNativeDriver: true,
        }),
        Animated.timing(footerOpacity, {
          toValue: 1,
          duration: 350,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, []);

  const handleIdentifierFocus = useCallback(() => {
    form.setIdentifierFocused(true);
  }, [form.setIdentifierFocused]);

  const handlePasswordFocus = useCallback(() => {
    form.setPasswordFocused(true);
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y: 200, animated: true });
    }, 200);
  }, [form.setPasswordFocused]);

  const handlePressIn = useCallback(() => {
    Animated.spring(buttonScale, {
      toValue: 0.97,
      friction: 8,
      tension: 120,
      useNativeDriver: true,
    }).start();
  }, [buttonScale]);

  const handlePressOut = useCallback(() => {
    Animated.spring(buttonScale, {
      toValue: 1,
      friction: 5,
      tension: 100,
      useNativeDriver: true,
    }).start();
  }, [buttonScale]);

  const dismissKeyboard = useCallback(() => {
    Keyboard.dismiss();
    form.setIdentifierFocused(false);
    form.setPasswordFocused(false);
  }, [form]);

  const handleForgotPassword = useCallback(() => {
    Keyboard.dismiss();
    const emailParam =
      form.identifier && form.identifier.includes('@') ? form.identifier : '';
    router.push({
      pathname: '/(auth)/forgot-password',
      params: { email: emailParam },
    });
  }, [form.identifier, router]);

  const isButtonDisabled = form.loading || !form.identifier || !form.password;

  return (
    <KeyboardAvoidingView
      style={styles.keyboardWrapper}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <StatusBar style="dark" translucent backgroundColor="transparent" />

        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          bounces={false}
          onScrollBeginDrag={dismissKeyboard}
        >
          {/* ─── HEADER ─────────────────────────────────────────── */}
          <View style={styles.headerSection}>
            {/* Bouton retour */}
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => {
                if (router.canGoBack()) {
                  router.back();
                } else {
                  router.replace('/');
                }
              }}
              activeOpacity={0.75}
              accessibilityLabel="Retour à l'écran précédent"
              accessibilityRole="button"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="arrow-back" size={18} color={theme.colors.text} />
            </TouchableOpacity>


            {/* Titre de bienvenue */}
            <Animated.View
              style={[
                styles.welcomeContainer,
                { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
              ]}
            >
              <Text style={styles.welcomeTitle}>Bienvenue</Text>
              <Text style={styles.welcomeSubtitle}>
                Connectez-vous pour accéder à votre espace
              </Text>
            </Animated.View>
          </View>

          {/* ─── CARTE DE CONNEXION ──────────────────────────────── */}
          <Animated.View
            style={[
              styles.card,
              { opacity: fadeAnim, transform: [{ translateY: cardSlide }] },
            ]}
          >
            {/* ─── Champ téléphone ─── */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Numéro de téléphone</Text>

              <View
                style={[
                  styles.phoneInputContainer,
                  form.identifierFocused && styles.inputFocused,
                ]}
              >
                {/* Sélecteur pays */}
                <TouchableOpacity
                  style={styles.countrySelector}
                  onPress={() => form.setShowCountryPicker(true)}
                  activeOpacity={0.75}
                  accessibilityLabel="Choisir le pays"
                  accessibilityRole="button"
                  hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                >
                  <CountryPicker
                    countryCode={form.countryCode}
                    withFlag
                    withCallingCode
                    withFilter
                    withAlphaFilter
                    withEmoji
                    onSelect={form.handleCountrySelect}
                    visible={form.showCountryPicker}
                    onClose={() => form.setShowCountryPicker(false)}
                    preferredCountries={[
                      'BJ', 'TG', 'CI', 'SN', 'BF', 'NE', 'CM', 'GA', 'NG',
                    ]}
                    containerButtonStyle={styles.pickerButtonStyle}
                  />
                  <Ionicons
                    name="chevron-down"
                    size={11}
                    color={theme.colors.textMuted}
                  />
                </TouchableOpacity>

                {/* Séparateur */}
                <View style={styles.phoneDivider} />

                {/* Indicatif */}
                <Text style={styles.phoneCallingCode}>+{form.callingCode}</Text>

                {/* Champ numéro */}
                <TextInput
                  ref={phoneInputRef}
                  style={styles.phoneTextInput}
                  placeholder="01 23 45 67 89"
                  placeholderTextColor={theme.colors.textMuted}
                  value={form.identifier}
                  onChangeText={(value) => {
                    const cleaned = value.replace(/[^\d\s]/g, '');
                    form.setIdentifier(cleaned);
                  }}
                  onFocus={handleIdentifierFocus}
                  onBlur={() => form.setIdentifierFocused(false)}
                  autoCapitalize="none"
                  keyboardType="phone-pad"
                  returnKeyType="next"
                  onSubmitEditing={() => passwordInputRef.current?.focus()}
                  blurOnSubmit={false}
                  autoComplete="tel"
                  textContentType="telephoneNumber"
                  accessibilityLabel="Numéro de téléphone"
                  accessibilityHint="Entrez votre numéro sans l'indicatif pays"
                />

                {/* Bouton effacer */}
                {form.identifier.length > 0 && (
                  <TouchableOpacity
                    onPress={() => form.setIdentifier('')}
                    style={styles.clearBtn}
                    accessibilityLabel="Effacer le numéro"
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons
                      name="close-circle"
                      size={17}
                      color={theme.colors.textMuted}
                    />
                  </TouchableOpacity>
                )}
              </View>

              {/* Hint format */}
              {form.phoneFormatHint && (
                <View style={styles.hintRow}>
                  <Ionicons
                    name="information-circle-outline"
                    size={12}
                    color={theme.colors.primary}
                  />
                  <Text style={styles.hintText}>{form.phoneFormatHint}</Text>
                </View>
              )}
            </View>

            {/* ─── Champ mot de passe ─── */}
            <View style={styles.fieldGroup}>
              <View style={styles.fieldLabelRow}>
                <Text style={styles.fieldLabel}>Mot de passe</Text>
                <TouchableOpacity
                  onPress={handleForgotPassword}
                  accessibilityRole="button"
                  accessibilityLabel="Mot de passe oublié"
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.forgotLink}>Mot de passe oublié ?</Text>
                </TouchableOpacity>
              </View>

              <View
                style={[
                  styles.inputBox,
                  form.passwordFocused && styles.inputFocused,
                ]}
              >
                <View style={styles.inputLeadingIcon}>
                  <Ionicons
                    name="lock-closed-outline"
                    size={17}
                    color={
                      form.passwordFocused
                        ? theme.colors.primary
                        : theme.colors.textMuted
                    }
                  />
                </View>
                <TextInput
                  ref={passwordInputRef}
                  style={styles.textInput}
                  placeholder="Votre mot de passe"
                  placeholderTextColor={theme.colors.textMuted}
                  value={form.password}
                  onChangeText={form.setPassword}
                  onFocus={handlePasswordFocus}
                  onBlur={() => form.setPasswordFocused(false)}
                  secureTextEntry={!form.showPassword}
                  returnKeyType="done"
                  onSubmitEditing={form.handleLogin}
                  autoComplete="password"
                  textContentType="password"
                  accessibilityLabel="Mot de passe"
                  accessibilityHint="Entrez votre mot de passe"
                />
                <TouchableOpacity
                  onPress={() => form.setShowPassword(!form.showPassword)}
                  style={styles.eyeBtn}
                  accessibilityLabel={
                    form.showPassword
                      ? 'Masquer le mot de passe'
                      : 'Afficher le mot de passe'
                  }
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons
                    name={form.showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={18}
                    color={theme.colors.textMuted}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* ─── Bouton Connexion ─── */}
            <Animated.View
              style={[
                styles.loginBtnWrap,
                { transform: [{ scale: buttonScale }] },
              ]}
            >
              <TouchableOpacity
                onPress={form.handleLogin}
                disabled={isButtonDisabled}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                activeOpacity={0.92}
                accessibilityRole="button"
                accessibilityLabel="Se connecter"
                accessibilityHint={
                  isButtonDisabled
                    ? 'Remplissez tous les champs pour continuer'
                    : 'Appuyez pour vous connecter'
                }
              >
                <LinearGradient
                  colors={
                    isButtonDisabled
                      ? [theme.colors.grayLight, theme.colors.grayLight]
                      : [theme.colors.primary, theme.colors.primaryDark]
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.loginBtn}
                >
                  {form.loading ? (
                    <View style={styles.loadingRow}>
                      <ActivityIndicator color="#fff" size="small" />
                      <Text style={styles.loginBtnText}>Connexion en cours...</Text>
                    </View>
                  ) : (
                    <View style={styles.loginBtnContent}>
                      <Text
                        style={[
                          styles.loginBtnText,
                          isButtonDisabled && { color: theme.colors.textMuted },
                        ]}
                      >
                        Se connecter
                      </Text>
                      {!isButtonDisabled && (
                        <Ionicons name="arrow-forward" size={17} color="#fff" />
                      )}
                    </View>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>

            {/* ─── Badge de sécurité ─── */}
            <View style={styles.securityBadge}>
              <Ionicons
                name="shield-checkmark-outline"
                size={13}
                color={theme.colors.secondary}
              />
              <Text style={styles.securityText}>Connexion sécurisée</Text>
            </View>
          </Animated.View>

          {/* ─── FOOTER – Inscription ────────────────────────────── */}
          <Animated.View style={[styles.footer, { opacity: footerOpacity }]}>
            <Text style={styles.footerText}>Pas encore de compte ?</Text>
            <TouchableOpacity
              onPress={() => router.push('/(auth)/register')}
              activeOpacity={0.75}
              style={styles.registerBtn}
              accessibilityRole="button"
              accessibilityLabel="Créer un compte"
            >
              <Text style={styles.registerBtnText}>Créer un compte</Text>
              <Ionicons name="arrow-forward" size={14} color={theme.colors.primary} />
            </TouchableOpacity>
          </Animated.View>

          <View style={styles.bottomSpacer} />
        </ScrollView>

        {/* Alert */}
        <CustomAlert
          visible={form.alertConfig.visible}
          title={form.alertConfig.title}
          message={form.alertConfig.message}
          type={form.alertConfig.type as any}
          onClose={() =>
            form.setAlertConfig({ ...form.alertConfig, visible: false })
          }
        />
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}
