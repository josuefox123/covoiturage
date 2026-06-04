import React, { useState, useRef, useEffect } from 'react';
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
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../../src/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';
import CustomAlert from '../../src/components/CustomAlert';

const { width, height } = Dimensions.get('window');

export default function LoginScreen() {
  const router = useRouter();
  const { loginWithPassword } = useAuth();

  const phoneInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [phoneFocused, setPhoneFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [alertConfig, setAlertConfig] = useState({ visible: false, title: '', message: '', type: 'error' as any });

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Gérer le focus pour scroller automatiquement
  const handlePhoneFocus = () => {
    setPhoneFocused(true);
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y: 200, animated: true });
    }, 100);
  };

  const handlePasswordFocus = () => {
    setPasswordFocused(true);
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y: 350, animated: true });
    }, 100);
  };

  const handlePressIn = () => {
    Animated.spring(buttonScale, {
      toValue: 0.97,
      friction: 5,
      tension: 100,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(buttonScale, {
      toValue: 1,
      friction: 5,
      tension: 100,
      useNativeDriver: true,
    }).start();
  };

  const handleLogin = async () => {
    Keyboard.dismiss();

    if (!phone || !password) {
      setAlertConfig({
        visible: true,
        title: "Champs manquants",
        message: "Veuillez remplir tous les champs.",
        type: 'error'
      });
      return;
    }

    setLoading(true);
    try {
      await loginWithPassword(phone.trim(), password);
      router.replace('/(tabs)/home');
    } catch (error: any) {
      setAlertConfig({
        visible: true,
        title: "Erreur de connexion",
        message: error?.message || "Identifiants invalides ou problème de réseau.",
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    Keyboard.dismiss();
    setAlertConfig({
      visible: true,
      title: "Mot de passe oublié",
      message: "Veuillez contacter le support pour réinitialiser votre mot de passe.",
      type: 'info'
    });
  };

  const formatPhoneNumber = (text: string) => {
    let cleaned = text.replace(/\D/g, '');
    if (cleaned.length > 10) cleaned = cleaned.slice(0, 10);
    setPhone(cleaned);
  };

  const dismissKeyboard = () => {
    Keyboard.dismiss();
    setPhoneFocused(false);
    setPasswordFocused(false);
  };

  return (
    <TouchableWithoutFeedback onPress={dismissKeyboard}>
      <SafeAreaView style={styles.container}>
        <StatusBar style="dark" translucent backgroundColor={theme.colors.transparent} />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          <ScrollView
            ref={scrollViewRef}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            scrollEnabled={true}
          >
            <View style={styles.content}>
              {/* Bouton retour */}
              <TouchableOpacity style={styles.backButton} onPress={() => router.replace('/')} activeOpacity={0.7}>
                <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
              </TouchableOpacity>

              {/* En-tête */}
              <Animated.View style={[styles.header, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
                <Text style={styles.title}>
                  Ravi de vous{"\n"}
                  <Text style={styles.titleHighlight}>revoir 👋</Text>
                </Text>
                <Text style={styles.subtitle}>
                  Connectez-vous pour continuer votre aventure
                </Text>
              </Animated.View>

              {/* Formulaire */}
              <Animated.View style={[styles.form, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
                {/* Champ Téléphone */}
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Numéro de téléphone</Text>
                  <View style={[
                    styles.inputWrapper,
                    phoneFocused && styles.inputWrapperFocused,
                    phone && styles.inputWrapperFilled
                  ]}>
                    <Ionicons
                      name="call-outline"
                      size={20}
                      color={phoneFocused ? theme.colors.primary : theme.colors.textMuted}
                      style={styles.inputIcon}
                    />
                    <TextInput
                      ref={phoneInputRef}
                      style={styles.input}
                      placeholder="01 95 95 95 95"
                      placeholderTextColor={theme.colors.textMuted}
                      value={phone}
                      onChangeText={formatPhoneNumber}
                      onFocus={handlePhoneFocus}
                      onBlur={() => setPhoneFocused(false)}
                      autoCapitalize="none"
                      keyboardType="phone-pad"
                      returnKeyType="next"
                      onSubmitEditing={() => passwordInputRef.current?.focus()}
                      blurOnSubmit={false}
                    />
                    {phone.length > 0 && (
                      <TouchableOpacity onPress={() => setPhone('')}>
                        <Ionicons name="close-circle" size={18} color={theme.colors.textMuted} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* Champ Mot de passe */}
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Mot de passe</Text>
                  <View style={[
                    styles.inputWrapper,
                    passwordFocused && styles.inputWrapperFocused,
                    password && styles.inputWrapperFilled
                  ]}>
                    <Ionicons
                      name="lock-closed-outline"
                      size={20}
                      color={passwordFocused ? theme.colors.primary : theme.colors.textMuted}
                      style={styles.inputIcon}
                    />
                    <TextInput
                      ref={passwordInputRef}
                      style={styles.input}
                      placeholder="Votre mot de passe"
                      placeholderTextColor={theme.colors.textMuted}
                      value={password}
                      onChangeText={setPassword}
                      onFocus={handlePasswordFocus}
                      onBlur={() => setPasswordFocused(false)}
                      secureTextEntry={!showPassword}
                      returnKeyType="done"
                      onSubmitEditing={handleLogin}
                    />
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                      <Ionicons
                        name={showPassword ? "eye-off-outline" : "eye-outline"}
                        size={20}
                        color={theme.colors.textMuted}
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Mot de passe oublié */}
                <TouchableOpacity style={styles.forgotPasswordContainer} onPress={handleForgotPassword}>
                  <Text style={styles.forgotPasswordText}>Mot de passe oublié ?</Text>
                </TouchableOpacity>

                {/* Bouton Connexion animé */}
                <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
                  <TouchableOpacity
                    style={[styles.loginButton, (!phone || !password || loading) && styles.disabledButton]}
                    onPress={handleLogin}
                    disabled={loading || !phone || !password}
                    onPressIn={handlePressIn}
                    onPressOut={handlePressOut}
                    activeOpacity={0.9}
                  >
                    <LinearGradient
                      colors={[theme.colors.primary, theme.colors.primaryDark || theme.colors.primary]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.gradientButton}
                    >
                      {loading ? (
                        <View style={styles.loadingContainer}>
                          <ActivityIndicator color={theme.colors.white} size="small" />
                          <Text style={styles.loginButtonText}>Connexion en cours...</Text>
                        </View>
                      ) : (
                        <View style={styles.buttonContent}>
                          <Text style={styles.loginButtonText}>Se connecter</Text>
                          <Ionicons name="arrow-forward" size={20} color={theme.colors.white} />
                        </View>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </Animated.View>
              </Animated.View>

              {/* Footer */}
              <Animated.View style={[styles.footer, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
                <Text style={styles.footerText}>Vous n'avez pas encore de compte ? </Text>
                <TouchableOpacity onPress={() => router.push('/(auth)/register')} activeOpacity={0.7}>
                  <Text style={styles.registerLink}>S'inscrire</Text>
                </TouchableOpacity>
              </Animated.View>





              {/* Espace supplémentaire pour éviter que le dernier élément soit caché */}
              <View style={styles.bottomSpacer} />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

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
  },
  content: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  header: {
    marginBottom: theme.spacing.xl,
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
    lineHeight: 44,
  },
  titleHighlight: {
    color: theme.colors.primary,
  },
  subtitle: {
    fontSize: 15,
    color: theme.colors.textLight,
    lineHeight: 22,
  },
  form: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    marginBottom: theme.spacing.xl,
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  inputContainer: {
    marginBottom: theme.spacing.lg,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    height: 52,
    backgroundColor: theme.colors.background,
  },
  inputWrapperFocused: {
    borderColor: theme.colors.primary,
  },
  inputWrapperFilled: {
    backgroundColor: theme.colors.background,
  },
  inputIcon: {
    marginRight: theme.spacing.sm,
  },
  input: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 15,
    height: '100%',
    paddingVertical: 0,
  },
  forgotPasswordContainer: {
    alignItems: 'flex-end',
    marginBottom: theme.spacing.xl,
  },
  forgotPasswordText: {
    fontSize: 13,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  loginButton: {
    overflow: 'hidden',
    borderRadius: theme.borderRadius.md,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  gradientButton: {
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.white,
    letterSpacing: 0.5,
  },
  disabledButton: {
    opacity: 0.6,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  footerText: {
    fontSize: 14,
    color: theme.colors.textLight,
  },
  registerLink: {
    fontSize: 14,
    color: theme.colors.primary,
    fontWeight: '700',
  },
  decorativeLine: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.border,
  },
  orText: {
    paddingHorizontal: theme.spacing.md,
    color: theme.colors.textLight,
    fontSize: 12,
  },
  socialContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.xl,
  },
  socialButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  bottomSpacer: {
    height: Platform.OS === 'ios' ? 40 : 20,
  },
});