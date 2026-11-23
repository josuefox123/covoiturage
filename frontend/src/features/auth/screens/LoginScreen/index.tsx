/**
 * ==============================================================
 * Fichier :
 * LoginScreen/index.tsx
 *
 * Description :
 * Écran de connexion moderne, élégant et premium pour l'application Zemy.
 *
 * Projet :
 * Zemy
 * ==============================================================
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import CustomAlert from '../../../../components/CustomAlert';
import CountryPicker, { CountryFilter } from 'react-native-country-picker-modal';

function CountryFilterInput(props: any) {
  const [text, setText] = useState('');

  return (
    <CountryFilter
      {...props}
      value={text}
      placeholder="Rechercher un pays ou indicatif (+33, 229, FR...)"
      onChangeText={(val: string) => {
        setText(val);
        const clean = val.replace(/^\++\s*/, '').trim();
        props.onChangeText?.(clean);
      }}
    />
  );
}

import { styles } from './styles';
import { useLoginForm } from './hooks/useLoginForm';
import { useAuth } from '../../../../context/AuthContext';
import { formatPhoneNumber } from '../../../../utils/phoneFormatter';

export default function LoginScreen() {
  const router = useRouter();
  const form = useLoginForm();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      router.replace('/(tabs)/home');
    }
  }, [user, router]);

  // Refs
  const phoneInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  // Animations d'entrée légères et fluides
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const cardSlide = useRef(new Animated.Value(30)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;
  const logoScale = useRef(new Animated.Value(0.9)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const footerOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      // 1. Logo pop-in
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 8,
        tension: 80,
        useNativeDriver: true,
      }),
      // 2. Header & Form fade and slide
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 350,
        useNativeDriver: true,
      }),
      Animated.timing(cardSlide, {
        toValue: 0,
        duration: 350,
        useNativeDriver: true,
      }),
      Animated.timing(footerOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleIdentifierFocus = useCallback(() => {
    form.setIdentifierFocused(true);
  }, [form]);

  const handlePasswordFocus = useCallback(() => {
    form.setPasswordFocused(true);
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y: 160, animated: true });
    }, 200);
  }, [form]);

  const handlePressIn = useCallback(() => {
    Animated.spring(buttonScale, {
      toValue: 0.98,
      friction: 8,
      tension: 140,
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
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <StatusBar style="dark" />

        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          bounces={false}
          onScrollBeginDrag={dismissKeyboard}
        >
          <View>
            {/* ─── Barre supérieure (Retour) ────────────────────── */}
            <View style={styles.topBar}>
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
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="arrow-back" size={18} color="#0F172A" />
              </TouchableOpacity>
            </View>

            {/* ─── Header & Identité Zemy ───────────────────────── */}
            <Animated.View
              style={[
                styles.headerSection,
                { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
              ]}
            >
              <Animated.View
                style={[
                  styles.logoWrapper,
                  { opacity: logoOpacity, transform: [{ scale: logoScale }] },
                ]}
              >
                <Image
                  source={require('../../../../../assets/images/logozemy.png')}
                  style={styles.logoImage}
                  resizeMode="contain"
                />
              </Animated.View>

              <Text style={styles.welcomeTitle}>Bienvenue sur Zemy</Text>
              <Text style={styles.welcomeSubtitle}>
                Retrouvez votre communauté et voyagez en toute confiance.
              </Text>
            </Animated.View>

            {/* ─── Carte Formulaire de connexion ────────────────── */}
            <Animated.View
              style={[
                styles.card,
                { opacity: fadeAnim, transform: [{ translateY: cardSlide }] },
              ]}
            >
              {/* Champ téléphone */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Numéro de téléphone</Text>

                <View
                  style={[
                    styles.phoneInputContainer,
                    form.identifierFocused && styles.inputFocused,
                  ]}
                >
                  {/* Sélecteur de pays */}
                  <TouchableOpacity
                    style={styles.countrySelector}
                    onPress={() => form.setShowCountryPicker(true)}
                    activeOpacity={0.75}
                    accessibilityLabel="Choisir le pays"
                    accessibilityRole="button"
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <CountryPicker
                      countryCode={form.countryCode}
                      withFlag
                      withCallingCode
                      withFilter
                      translation="fra"
                      renderCountryFilter={(filterProps) => (
                        <CountryFilterInput
                          {...filterProps}
                          key={form.showCountryPicker ? 'open' : 'closed'}
                        />
                      )}
                      withAlphaFilter
                      withEmoji
                      onSelect={form.handleCountrySelect}
                      visible={form.showCountryPicker}
                      onClose={() => form.setShowCountryPicker(false)}
                      preferredCountries={[
                        'BJ', 'TG', 'CI', 'SN', 'BF', 'NE', 'CM', 'GA', 'NG', 'FR',
                      ]}
                      containerButtonStyle={styles.pickerButtonStyle}
                    />
                    <Ionicons name="chevron-down" size={12} color="#64748B" />
                  </TouchableOpacity>

                  {/* Séparateur */}
                  <View style={styles.phoneDivider} />

                  {/* Indicatif pays */}
                  <Text style={styles.phoneCallingCode}>+{form.callingCode}</Text>

                  {/* Saisie numéro */}
                  <TextInput
                    ref={phoneInputRef}
                    style={styles.phoneTextInput}
                    placeholder="01 23 45 67 89"
                    placeholderTextColor="#94A3B8"
                    value={form.identifier}
                    onChangeText={(value) => {
                      const formatted = formatPhoneNumber(value, form.countryCode);
                      form.setIdentifier(formatted);
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
                  />

                  {/* Effacer le numéro */}
                  {form.identifier.length > 0 && (
                    <TouchableOpacity
                      onPress={() => form.setIdentifier('')}
                      style={styles.clearBtn}
                      accessibilityLabel="Effacer le numéro"
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Ionicons name="close-circle" size={17} color="#94A3B8" />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Hint format international */}
                {form.phoneFormatHint && (
                  <View style={styles.hintRow}>
                    <Ionicons name="information-circle-outline" size={12} color="#2563EB" />
                    <Text style={styles.hintText}>{form.phoneFormatHint}</Text>
                  </View>
                )}
              </View>

              {/* Champ mot de passe */}
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
                      size={18}
                      color={form.passwordFocused ? '#2563EB' : '#94A3B8'}
                    />
                  </View>
                  <TextInput
                    ref={passwordInputRef}
                    style={styles.textInput}
                    placeholder="Votre mot de passe"
                    placeholderTextColor="#94A3B8"
                    value={form.password}
                    onChangeText={form.setPassword}
                    onFocus={handlePasswordFocus}
                    onBlur={() => form.setPasswordFocused(false)}
                    secureTextEntry={!form.showPassword}
                    returnKeyType="done"
                    onSubmitEditing={form.handleLogin}
                    autoComplete="password"
                    textContentType="password"
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
                      size={19}
                      color="#64748B"
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Bouton de Connexion */}
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
                  activeOpacity={0.9}
                  accessibilityRole="button"
                  accessibilityLabel="Se connecter"
                >
                  <LinearGradient
                    colors={
                      isButtonDisabled
                        ? ['#E2E8F0', '#E2E8F0']
                        : ['#2563EB', '#1D4ED8']
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.loginBtn}
                  >
                    {form.loading ? (
                      <View style={styles.loadingRow}>
                        <ActivityIndicator color="#FFFFFF" size="small" />
                        <Text style={styles.loginBtnText}>Connexion en cours...</Text>
                      </View>
                    ) : (
                      <View style={styles.loginBtnContent}>
                        <Text
                          style={[
                            styles.loginBtnText,
                            isButtonDisabled && { color: '#94A3B8' },
                          ]}
                        >
                          Se connecter
                        </Text>
                        {!isButtonDisabled && (
                          <Ionicons name="arrow-forward" size={17} color="#FFFFFF" />
                        )}
                      </View>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>

              {/* Badge de sécurité discret */}
              <View style={styles.securityBadge}>
                <Ionicons name="shield-checkmark" size={13} color="#10B981" />
                <Text style={styles.securityText}>Connexion sécurisée et chiffrée</Text>
              </View>
            </Animated.View>
          </View>

          {/* ─── Footer Inscription ───────────────────────────── */}
          <Animated.View style={[styles.footer, { opacity: footerOpacity }]}>
            <Text style={styles.footerText}>Vous n'avez pas encore de compte ?</Text>
            <TouchableOpacity
              onPress={() => router.push('/(auth)/register')}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.registerLinkText}>Créer un compte</Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>

        {/* Modal d'Alerte personnalisé */}
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
