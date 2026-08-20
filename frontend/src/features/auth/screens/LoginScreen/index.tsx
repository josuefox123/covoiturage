import React, { useRef, useEffect, useCallback } from 'react';
import {
  Text,
  View,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
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
  const slideAnim = useRef(new Animated.Value(40)).current;
  const formSlideAnim = useRef(new Animated.Value(50)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Initial animations
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
    ]).start();
  }, []);

  const handleIdentifierFocus = useCallback(() => {
    form.setIdentifierFocused(true);

    requestAnimationFrame(() => {
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({
          y: 180,
          animated: true,
        });
      }, 150);
    });
  }, [form.setIdentifierFocused]);

  const handlePasswordFocus = useCallback(() => {
    form.setPasswordFocused(true);

    requestAnimationFrame(() => {
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({
          y: 300,
          animated: true,
        });
      }, 150);
    });
  }, [form.setPasswordFocused]);

  const handlePressIn = useCallback(() => {
    Animated.spring(buttonScale, { toValue: 0.96, friction: 5, tension: 120, useNativeDriver: true }).start();
  }, [buttonScale]);

  const handlePressOut = useCallback(() => {
    Animated.spring(buttonScale, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }).start();
  }, [buttonScale]);

  const dismissKeyboard = useCallback(() => {
    Keyboard.dismiss();
    form.setIdentifierFocused(false);
    form.setPasswordFocused(false);
  }, [form]);

  const handleForgotPassword = useCallback(() => {
    Keyboard.dismiss();
    const emailParam = form.identifier && form.identifier.includes('@') ? form.identifier : '';
    router.push({ pathname: '/(auth)/forgot-password', params: { email: emailParam } });
  }, [form.identifier, router]);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <TouchableWithoutFeedback onPress={dismissKeyboard}>
        <SafeAreaView style={styles.container}>
          <StatusBar style="dark" translucent backgroundColor="transparent" />

          <ScrollView
            ref={scrollViewRef}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            bounces={false}
          >
            {/* ═══════════════════════════════════════════════
                EN-TÊTE PREMIUM
            ═══════════════════════════════════════════════ */}
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
                <View style={styles.logoWrapper}>
                  <Image
                    source={require('../../../../../assets/images/logozemy.png')}
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
                    <Text style={styles.welcomeHighlight}>Bienvenue</Text>
                  </Text>
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
              {/* ─── Champ Numéro de téléphone Premium ─── */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Numéro de téléphone</Text>

                <View
                  style={[
                    styles.phoneInputContainer,
                    form.identifierFocused && styles.phoneInputContainerFocused,
                  ]}
                >
                  {/* Sélecteur de pays */}
                  <TouchableOpacity
                    style={styles.countrySelector}
                    onPress={() => form.setShowCountryPicker(true)}
                    activeOpacity={0.7}
                    accessibilityLabel="Choisir le pays"
                    accessibilityRole="button"
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
                      preferredCountries={['BJ', 'TG', 'CI', 'SN', 'BF', 'NE', 'CM', 'GA', 'NG']}
                      containerButtonStyle={styles.pickerButtonStyle}
                    />
                    <Ionicons name="chevron-down" size={10} color={theme.colors.textMuted} />
                  </TouchableOpacity>

                  {/* Divider vertical */}
                  <View style={styles.phoneDivider} />

                  {/* Indicatif */}
                  <Text style={styles.phoneCallingCode}>+{form.callingCode}</Text>

                  {/* Champ numéro */}
                  <TextInput
                    ref={phoneInputRef}
                    style={styles.phoneTextInput}
                    placeholder="ex: 01 95 95 95 95"
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
                  />

                  {form.identifier.length > 0 && (
                    <TouchableOpacity
                      onPress={() => form.setIdentifier('')}
                      style={styles.clearBtn}
                      accessibilityLabel="Effacer"
                    >
                      <Ionicons name="close-circle" size={18} color={theme.colors.textMuted} />
                    </TouchableOpacity>
                  )}
                </View>

                {form.phoneFormatHint && (
                  <View style={styles.hintRow}>
                    <Ionicons name="information-circle-outline" size={12} color={theme.colors.primary} />
                    <Text style={styles.hintText}>{form.phoneFormatHint}</Text>
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
                    form.passwordFocused && styles.inputBoxFocused,
                  ]}
                >
                  <View style={styles.inputLeadingIcon}>
                    <Ionicons
                      name="lock-closed-outline"
                      size={18}
                      color={form.passwordFocused ? theme.colors.primary : theme.colors.textMuted}
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
                  />
                  <TouchableOpacity
                    onPress={() => form.setShowPassword(!form.showPassword)}
                    style={styles.eyeBtn}
                    accessibilityLabel={form.showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
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
              <Animated.View style={{ transform: [{ scale: buttonScale }], marginTop: 4 }}>
                <TouchableOpacity
                  onPress={form.handleLogin}
                  disabled={form.loading || !form.identifier || !form.password}
                  onPressIn={handlePressIn}
                  onPressOut={handlePressOut}
                  activeOpacity={0.92}
                  accessibilityRole="button"
                  accessibilityLabel="Se connecter"
                >
                  <LinearGradient
                    colors={
                      !form.identifier || !form.password || form.loading
                        ? [theme.colors.grayLight, theme.colors.grayLight]
                        : [theme.colors.primary, theme.colors.primaryDark || '#1A4FC8']
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
                            (!form.identifier || !form.password) && { color: theme.colors.textMuted },
                          ]}
                        >
                          Se connecter
                        </Text>
                        {form.identifier && form.password && (
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

          <CustomAlert
            visible={form.alertConfig.visible}
            title={form.alertConfig.title}
            message={form.alertConfig.message}
            type={form.alertConfig.type as any}
            onClose={() => form.setAlertConfig({ ...form.alertConfig, visible: false })}
          />
        </SafeAreaView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}
