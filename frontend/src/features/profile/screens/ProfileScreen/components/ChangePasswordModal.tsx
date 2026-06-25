import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../../../../../styles/theme';
import { styles } from '../styles';
import { AppBottomSheet } from '../../../../../components/AppBottomSheet';
import { CustomAlert } from '../../../../../utils/CustomAlert';
import { fetchApi } from '../../../../../services/api';

interface ChangePasswordModalProps {
  visible: boolean;
  onClose: () => void;
  user: any;
}

export function ChangePasswordModal({
  visible,
  onClose,
  user,
}: ChangePasswordModalProps) {
  const [pwdStep, setPwdStep] = useState(1);
  const [pwdOtp, setPwdOtp] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmNewPwd, setConfirmNewPwd] = useState('');
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfirmNewPwd, setShowConfirmNewPwd] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdResendTimer, setPwdResendTimer] = useState(0);

  const pwdOtpInputRef = useRef<TextInput>(null);
  const pwdStepOpacity = useRef(new Animated.Value(1)).current;
  const pwdStepTranslateX = useRef(new Animated.Value(0)).current;

  // Initialize/reset states when modal opens
  useEffect(() => {
    if (visible) {
      setPwdStep(1);
      setPwdOtp('');
      setNewPwd('');
      setConfirmNewPwd('');
      setShowNewPwd(false);
      setShowConfirmNewPwd(false);
      setPwdResendTimer(0);
    }
  }, [visible]);

  // Resend Timer Interval
  useEffect(() => {
    let interval: any;
    if (visible && pwdStep === 2 && pwdResendTimer > 0) {
      interval = setInterval(() => {
        setPwdResendTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [visible, pwdStep, pwdResendTimer]);

  // Auto-focus OTP input on Step 2
  useEffect(() => {
    if (pwdStep === 2 && visible) {
      setTimeout(() => {
        pwdOtpInputRef.current?.focus();
      }, 300);
    }
  }, [pwdStep, visible]);

  const animatePwdStepTransition = useCallback((nextStep: number) => {
    Animated.parallel([
      Animated.timing(pwdStepOpacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(pwdStepTranslateX, {
        toValue: -20,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setPwdStep(nextStep);
      pwdStepTranslateX.setValue(20);
      Animated.parallel([
        Animated.timing(pwdStepOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(pwdStepTranslateX, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    });
  }, [pwdStepOpacity, pwdStepTranslateX]);

  const handleSendPwdOtpCode = useCallback(async () => {
    if (!user?.email) {
      CustomAlert.alert('Erreur', "Votre compte n'a pas d'adresse email associée.");
      return;
    }
    setPwdLoading(true);
    try {
      const email = user.email.trim().toLowerCase();
      await fetchApi('/auth/send-reset-code/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setPwdResendTimer(60);
      animatePwdStepTransition(2);
    } catch (error: any) {
      CustomAlert.alert('Erreur', error?.message || "Impossible d'envoyer le code OTP. Veuillez réessayer.");
    } finally {
      setPwdLoading(false);
    }
  }, [user, animatePwdStepTransition]);

  const handleResendPwdOtpCode = useCallback(async () => {
    if (pwdResendTimer > 0) return;
    if (!user?.email) return;
    setPwdLoading(true);
    try {
      const email = user.email.trim().toLowerCase();
      await fetchApi('/auth/send-reset-code/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setPwdResendTimer(60);
      CustomAlert.alert('Code renvoyé', 'Un nouveau code de validation a été envoyé.');
    } catch (error: any) {
      CustomAlert.alert('Erreur', error?.message || 'Impossible de renvoyer le code.');
    } finally {
      setPwdLoading(false);
    }
  }, [pwdResendTimer, user]);

  const handleVerifyPwdOtpCode = useCallback(async () => {
    if (!user?.email) return;
    if (pwdOtp.length !== 6) {
      CustomAlert.alert('Saisie incomplète', 'Veuillez saisir le code OTP à 6 chiffres.');
      return;
    }
    setPwdLoading(true);
    try {
      const email = user.email.trim().toLowerCase();
      await fetchApi('/auth/verify-reset-code/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: pwdOtp }),
      });
      animatePwdStepTransition(3);
    } catch (error: any) {
      CustomAlert.alert('Code invalide', error?.message || 'Le code saisi est incorrect ou a expiré.');
    } finally {
      setPwdLoading(false);
    }
  }, [pwdOtp, user, animatePwdStepTransition]);

  const handleConfirmPwdChange = useCallback(async () => {
    if (!user?.email) return;
    if (!newPwd || !confirmNewPwd) {
      CustomAlert.alert('Champs requis', 'Veuillez renseigner et confirmer le mot de passe.');
      return;
    }
    if (newPwd.length < 6) {
      CustomAlert.alert('Sécurité faible', 'Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }
    if (newPwd !== confirmNewPwd) {
      CustomAlert.alert('Mots de passe différents', 'Les mots de passe saisis ne correspondent pas.');
      return;
    }
    setPwdLoading(true);
    try {
      const email = user.email.trim().toLowerCase();
      await fetchApi('/auth/reset-password/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          code: pwdOtp,
          password: newPwd,
        }),
      });
      animatePwdStepTransition(4);
    } catch (error: any) {
      CustomAlert.alert('Erreur', error?.message || 'Impossible de modifier le mot de passe.');
    } finally {
      setPwdLoading(false);
    }
  }, [newPwd, confirmNewPwd, pwdOtp, user, animatePwdStepTransition]);

  const renderPwdOtpBoxes = () => {
    const boxes = [];
    for (let i = 0; i < 6; i++) {
      const char = pwdOtp[i] || '';
      const isFocused = pwdOtp.length === i;
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
        onPress={() => pwdOtpInputRef.current?.focus()}
      >
        {boxes}
      </TouchableOpacity>
    );
  };

  const renderPwdStep1 = () => (
    <View style={styles.stepWrapper}>
      <Text style={styles.modalTitle}>Modifier le mot de passe</Text>
      <Text style={styles.modalSubtitle}>
        Pour modifier votre mot de passe en toute sécurité, nous allons envoyer un code de validation OTP à votre adresse email :{' '}
        <Text style={styles.modalHighlightText}>{user?.email}</Text>.
      </Text>

      <TouchableOpacity
        style={[styles.modalButton, pwdLoading && styles.disabledButton]}
        onPress={handleSendPwdOtpCode}
        disabled={pwdLoading}
        activeOpacity={0.9}
      >
        <LinearGradient
          colors={[theme.colors.primary, '#3B82F6']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.modalBtnGradient}
        >
          {pwdLoading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.modalButtonText}>Envoyer le code OTP</Text>
          )}
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );

  const renderPwdStep2 = () => (
    <View style={styles.stepWrapper}>
      <Text style={styles.modalTitle}>Vérification</Text>
      <Text style={styles.modalSubtitle}>
        Saisissez le code OTP à 6 chiffres envoyé à{' '}
        <Text style={styles.modalHighlightText}>{user?.email}</Text>.
      </Text>

      <View style={styles.otpContainer}>
        {renderPwdOtpBoxes()}
        <TextInput
          ref={pwdOtpInputRef}
          style={styles.hiddenInput}
          value={pwdOtp}
          onChangeText={(text) => setPwdOtp(text.replace(/\D/g, '').slice(0, 6))}
          keyboardType="number-pad"
          maxLength={6}
          caretHidden
        />
      </View>

      <View style={styles.resendContainer}>
        {pwdResendTimer > 0 ? (
          <Text style={styles.resendText}>
            Renvoyer le code dans <Text style={styles.timerText}>{pwdResendTimer}s</Text>
          </Text>
        ) : (
          <TouchableOpacity onPress={handleResendPwdOtpCode} activeOpacity={0.7}>
            <Text style={styles.resendLinkText}>Renvoyer le code</Text>
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity
        style={[styles.modalButton, (pwdLoading || pwdOtp.length !== 6) && styles.disabledButton]}
        onPress={handleVerifyPwdOtpCode}
        disabled={pwdLoading || pwdOtp.length !== 6}
        activeOpacity={0.9}
      >
        <LinearGradient
          colors={
            pwdOtp.length !== 6
              ? [theme.colors.border, theme.colors.border]
              : [theme.colors.primary, '#3B82F6']
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.modalBtnGradient}
        >
          {pwdLoading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text
              style={[
                styles.modalButtonText,
                pwdOtp.length !== 6 && { color: theme.colors.textMuted },
              ]}
            >
              Vérifier
            </Text>
          )}
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );

  const renderPwdStep3 = () => (
    <View style={styles.stepWrapper}>
      <Text style={styles.modalTitle}>Nouveau mot de passe</Text>
      <Text style={styles.modalSubtitle}>
        Veuillez entrer un nouveau mot de passe sécurisé (minimum 6 caractères).
      </Text>

      <View style={{ marginBottom: 16 }}>
        <Text style={{ fontSize: 13, fontWeight: '600', color: theme.colors.textMuted, marginBottom: 6 }}>Nouveau mot de passe</Text>
        <View style={styles.inputWrapper}>
          <Ionicons name="lock-closed-outline" size={18} color={theme.colors.primary} style={styles.inputIcon} />
          <TextInput
            style={styles.modalInputModern}
            placeholder="Nouveau mot de passe"
            placeholderTextColor={theme.colors.textMuted}
            value={newPwd}
            onChangeText={setNewPwd}
            secureTextEntry={!showNewPwd}
          />
          <TouchableOpacity onPress={() => setShowNewPwd(!showNewPwd)} style={{ padding: 8 }}>
            <Ionicons
              name={showNewPwd ? 'eye-off-outline' : 'eye-outline'}
              size={18}
              color={theme.colors.textMuted}
            />
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ marginBottom: 16 }}>
        <Text style={{ fontSize: 13, fontWeight: '600', color: theme.colors.textMuted, marginBottom: 6 }}>Confirmez le mot de passe</Text>
        <View style={styles.inputWrapper}>
          <Ionicons name="lock-closed-outline" size={18} color={theme.colors.primary} style={styles.inputIcon} />
          <TextInput
            style={styles.modalInputModern}
            placeholder="Confirmez le mot de passe"
            placeholderTextColor={theme.colors.textMuted}
            value={confirmNewPwd}
            onChangeText={setConfirmNewPwd}
            secureTextEntry={!showConfirmNewPwd}
          />
          <TouchableOpacity onPress={() => setShowConfirmNewPwd(!showConfirmNewPwd)} style={{ padding: 8 }}>
            <Ionicons
              name={showConfirmNewPwd ? 'eye-off-outline' : 'eye-outline'}
              size={18}
              color={theme.colors.textMuted}
            />
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.modalButton, (pwdLoading || !newPwd || !confirmNewPwd) && styles.disabledButton]}
        onPress={handleConfirmPwdChange}
        disabled={pwdLoading || !newPwd || !confirmNewPwd}
        activeOpacity={0.9}
      >
        <LinearGradient
          colors={
            !newPwd || !confirmNewPwd
              ? [theme.colors.border, theme.colors.border]
              : [theme.colors.primary, '#3B82F6']
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.modalBtnGradient}
        >
          {pwdLoading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text
              style={[
                styles.modalButtonText,
                (!newPwd || !confirmNewPwd) && { color: theme.colors.textMuted },
              ]}
            >
              Confirmer la modification
            </Text>
          )}
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );

  const renderPwdStep4 = () => (
    <View style={[styles.stepWrapper, styles.successWrapper]}>
      <View style={styles.successIconWrapper}>
        <Ionicons name="checkmark-circle" size={72} color={theme.colors.success || '#10B981'} />
      </View>
      <Text style={styles.modalTitle}>Mot de passe modifié !</Text>
      <Text style={[styles.modalSubtitle, { textAlign: 'center', marginTop: 8 }]}>
        Votre mot de passe a été modifié avec succès.
      </Text>

      <TouchableOpacity
        style={{ width: '100%', marginTop: 20 }}
        onPress={onClose}
        activeOpacity={0.9}
      >
        <LinearGradient
          colors={[theme.colors.primary, '#3B82F6']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.modalBtnGradient}
        >
          <Text style={styles.modalButtonText}>Fermer</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );

  return (
    <AppBottomSheet
      visible={visible}
      onClose={onClose}
      snapPoints={['65%', '90%']}
    >
      <View style={{ minHeight: 320 }}>
        {pwdStep < 4 && (
          <TouchableOpacity
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: '#F3F4F6',
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 10,
            }}
            onPress={onClose}
            disabled={pwdLoading}
          >
            <Ionicons name="close" size={20} color={theme.colors.text} />
          </TouchableOpacity>
        )}

        <Animated.View
          style={[
            styles.modalStepContainer,
            {
              opacity: pwdStepOpacity,
              transform: [{ translateX: pwdStepTranslateX }],
            },
          ]}
        >
          {pwdStep === 1 && renderPwdStep1()}
          {pwdStep === 2 && renderPwdStep2()}
          {pwdStep === 3 && renderPwdStep3()}
          {pwdStep === 4 && renderPwdStep4()}
        </Animated.View>
      </View>
    </AppBottomSheet>
  );
}
