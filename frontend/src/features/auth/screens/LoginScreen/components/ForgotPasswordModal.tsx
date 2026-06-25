import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Modal,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  View,
  TouchableOpacity,
  Animated,
  Text,
  TextInput,
  ActivityIndicator,
  Platform,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../../../../../styles/theme';
import { styles } from '../styles';
import { fetchApi } from '../../../../../services/api';

interface ForgotPasswordModalProps {
  visible: boolean;
  onClose: () => void;
  initialEmail: string;
  onAlert: (config: { title: string; message: string; type: 'error' | 'success' | 'warning' | 'info' }) => void;
}

export function ForgotPasswordModal({
  visible,
  onClose,
  initialEmail,
  onAlert,
}: ForgotPasswordModalProps) {
  const [resetStep, setResetStep] = useState(1);
  const [resetEmail, setResetEmail] = useState('');
  const [resetOtp, setResetOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  const otpInputRef = useRef<TextInput>(null);

  const stepOpacity = useRef(new Animated.Value(1)).current;
  const stepTranslateX = useRef(new Animated.Value(0)).current;

  // Initialize email when modal opens
  useEffect(() => {
    if (visible) {
      setResetEmail(initialEmail || '');
      setResetStep(1);
      setResetOtp('');
      setNewPassword('');
      setConfirmPassword('');
      setShowNewPassword(false);
      setShowConfirmPassword(false);
    }
  }, [visible, initialEmail]);

  // Resend Timer Interval
  useEffect(() => {
    let interval: any;
    if (visible && resetStep === 2 && resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [visible, resetStep, resendTimer]);

  // Auto-focus OTP input on Step 2
  useEffect(() => {
    if (resetStep === 2 && visible) {
      setTimeout(() => {
        otpInputRef.current?.focus();
      }, 300);
    }
  }, [resetStep, visible]);

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
      onAlert({
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
      onAlert({
        title: 'Erreur',
        message: error?.message || "Impossible d'envoyer le code. Veuillez réessayer.",
        type: 'error',
      });
    } finally {
      setResetLoading(false);
    }
  }, [getResetEmailError, resetEmail, animateStepTransition, onAlert]);

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
      onAlert({
        title: 'Code renvoyé',
        message: 'Un nouveau code de validation a été envoyé.',
        type: 'success',
      });
    } catch (error: any) {
      onAlert({
        title: 'Erreur',
        message: error?.message || 'Impossible de renvoyer le code.',
        type: 'error',
      });
    } finally {
      setResetLoading(false);
    }
  }, [resendTimer, resetEmail, onAlert]);

  const handleVerifyResetCode = useCallback(async () => {
    Keyboard.dismiss();
    if (resetOtp.length !== 6) {
      onAlert({
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
      onAlert({
        title: 'Code invalide',
        message: error?.message || 'Le code saisi est incorrect ou a expiré.',
        type: 'error',
      });
    } finally {
      setResetLoading(false);
    }
  }, [resetOtp, resetEmail, animateStepTransition, onAlert]);

  const handleResetPassword = useCallback(async () => {
    Keyboard.dismiss();
    if (!newPassword || !confirmPassword) {
      onAlert({
        title: 'Champs requis',
        message: 'Veuillez renseigner et confirmer le mot de passe.',
        type: 'warning',
      });
      return;
    }
    if (newPassword.length < 6) {
      onAlert({
        title: 'Sécurité faible',
        message: 'Le mot de passe doit contenir au moins 6 caractères.',
        type: 'warning',
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      onAlert({
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
      onAlert({
        title: 'Erreur',
        message: error?.message || 'Impossible de réinitialiser le mot de passe.',
        type: 'error',
      });
    } finally {
      setResetLoading(false);
    }
  }, [newPassword, confirmPassword, resetOtp, resetEmail, animateStepTransition, onAlert]);

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
            <Ionicons name="mail-outline" size={18} color={theme.colors.primary} />
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

  const renderStep2 = () => (
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
        onPress={onClose}
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

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={() => {
        if (resetStep < 4 && !resetLoading) {
          onClose();
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
                  onPress={onClose}
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
  );
}
