/**
 * ==============================================================
 * Fichier :
 * TripConfirmationModal.tsx
 *
 * Description :
 * Modal d'alerte urgente envoyée au conducteur 30 minutes avant le départ.
 * Le conducteur doit confirmer la lecture puis choisir si le trajet tient ou non.
 *
 * Projet :
 * Zemy
 * ==============================================================
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  Dimensions,
  ActivityIndicator,
  ScrollView,
  Vibration,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../../styles/theme';
import { API_URL } from '../../../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getStoredAccessToken } from '../../../context/AuthContext';

const { width, height } = Dimensions.get('window');

interface TripConfirmationModalProps {
  visible: boolean;
  rideId: string;
  departureLocation?: string;
  arrivalLocation?: string;
  onClose: () => void;
  onConfirmed: () => void;
  onCancelled: () => void;
}

type Step = 'acknowledgment' | 'choice' | 'loading' | 'done';

export const TripConfirmationModal: React.FC<TripConfirmationModalProps> = ({
  visible,
  rideId,
  departureLocation = 'Départ',
  arrivalLocation = 'Arrivée',
  onClose,
  onConfirmed,
  onCancelled,
}) => {
  const [step, setStep] = useState<Step>('acknowledgment');
  const [hasRead, setHasRead] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const fadeIn    = useRef(new Animated.Value(0)).current;

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setStep('acknowledgment');
      setHasRead(false);
      setError(null);

      // Vibration d'urgence à l'ouverture
      Vibration.vibrate([0, 400, 200, 400, 200, 400]);

      // Fade in
      Animated.timing(fadeIn, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();

      // Pulsation rouge continue
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.08, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1,    duration: 800, useNativeDriver: true }),
        ])
      ).start();

      // Shake initial de l'icône avertissement
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 8,  duration: 80, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -8, duration: 80, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 8,  duration: 80, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -8, duration: 80, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0,  duration: 80, useNativeDriver: true }),
      ]).start();
    } else {
      fadeIn.setValue(0);
      pulseAnim.stopAnimation();
    }
  }, [visible]);

  const sendConfirmation = async (confirmed: boolean) => {
    setStep('loading');
    setError(null);
    try {
      const token = await getStoredAccessToken();
      const res = await fetch(`${API_URL}/rides/${rideId}/confirm-departure/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ confirmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Une erreur est survenue.');

      setStep('done');
      if (confirmed) {
        setTimeout(() => { onConfirmed(); onClose(); }, 1800);
      } else {
        setTimeout(() => { onCancelled(); onClose(); }, 2500);
      }
    } catch (err: any) {
      setError(err.message || 'Erreur réseau. Réessayez.');
      setStep('choice');
    }
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={() => { /* bloquant intentionnellement */ }}
    >
      <Animated.View style={[styles.overlay, { opacity: fadeIn }]}>
        <Animated.View style={[styles.card, { transform: [{ scale: pulseAnim }] }]}>

          {/* ——— Bande urgence ——— */}
          <View style={styles.urgentBanner}>
            <Ionicons name="alert-circle" size={18} color="#FFF" />
            <Text style={styles.urgentBannerText}>ACTION REQUISE DANS LES 10 MIN</Text>
            <Ionicons name="alert-circle" size={18} color="#FFF" />
          </View>

          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>

            {/* ——— Étape 1 : Confirmation de lecture ——— */}
            {step === 'acknowledgment' && (
              <>
                <Animated.View style={[styles.warningIconContainer, { transform: [{ translateX: shakeAnim }] }]}>
                  <Ionicons name="warning" size={64} color="#EF4444" />
                </Animated.View>

                <Text style={styles.title}>VOTRE TRAJET PART DANS 30 MIN</Text>
                <Text style={styles.route}>{departureLocation} → {arrivalLocation}</Text>

                <View style={styles.messageBubble}>
                  <Text style={styles.messageText}>
                    Le trajet tient-il toujours ?{'\n\n'}
                    Vos passagers comptent sur vous.{'\n'}
                    Sans réponse de votre part dans <Text style={styles.bold}>10 minutes</Text>, le trajet sera{' '}
                    <Text style={styles.dangerText}>annulé automatiquement</Text> et vos passagers remboursés.
                  </Text>
                </View>

                {/* Checkbox de lecture obligatoire */}
                <TouchableOpacity
                  style={styles.checkboxRow}
                  onPress={() => setHasRead(prev => !prev)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.checkbox, hasRead && styles.checkboxChecked]}>
                    {hasRead && <Ionicons name="checkmark" size={16} color="#FFF" />}
                  </View>
                  <Text style={styles.checkboxLabel}>
                    J'ai lu et compris ce message
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.btnPrimary, !hasRead && styles.btnDisabled]}
                  onPress={() => hasRead && setStep('choice')}
                  activeOpacity={hasRead ? 0.85 : 1}
                  disabled={!hasRead}
                >
                  <Text style={styles.btnPrimaryText}>Continuer →</Text>
                </TouchableOpacity>
              </>
            )}

            {/* ——— Étape 2 : Choix OUI / NON ——— */}
            {step === 'choice' && (
              <>
                <View style={styles.warningIconContainer}>
                  <Ionicons name="car" size={64} color={theme.colors.primary} />
                </View>

                <Text style={styles.title}>LE TRAJET TIENT-IL TOUJOURS ?</Text>
                <Text style={styles.route}>{departureLocation} → {arrivalLocation}</Text>

                {error && (
                  <View style={styles.errorBox}>
                    <Ionicons name="warning-outline" size={16} color={theme.colors.error} />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}

                <View style={styles.choiceContainer}>
                  {/* OUI */}
                  <TouchableOpacity
                    style={styles.btnYes}
                    onPress={() => sendConfirmation(true)}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="checkmark-circle" size={28} color="#FFF" />
                    <View style={styles.btnTextBlock}>
                      <Text style={styles.btnYesTitle}>OUI, le trajet tient</Text>
                      <Text style={styles.btnYesSub}>Je confirme mon départ dans 30 min</Text>
                    </View>
                  </TouchableOpacity>

                  {/* NON */}
                  <TouchableOpacity
                    style={styles.btnNo}
                    onPress={() => sendConfirmation(false)}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="close-circle" size={28} color={theme.colors.error} />
                    <View style={styles.btnTextBlock}>
                      <Text style={styles.btnNoTitle}>NON, je dois annuler</Text>
                      <Text style={styles.btnNoSub}>Les passagers seront remboursés automatiquement</Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* ——— Loading ——— */}
            {step === 'loading' && (
              <View style={styles.centerBlock}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text style={styles.loadingText}>Traitement en cours…</Text>
              </View>
            )}

            {/* ——— Done ——— */}
            {step === 'done' && (
              <View style={styles.centerBlock}>
                <Ionicons name="checkmark-circle" size={72} color={theme.colors.success} />
                <Text style={styles.doneTitle}>C'est noté !</Text>
                <Text style={styles.doneSub}>
                  {hasRead
                    ? 'Vous recevrez une notification de démarrage 10 min avant le départ.'
                    : 'Le trajet a été annulé. Vos passagers seront remboursés.'}
                </Text>
              </View>
            )}

          </ScrollView>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

// =====================================================================
// Styles
// =====================================================================
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    overflow: 'hidden',
    // Ombre rouge urgente
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 20,
  },

  // Bande rouge en haut
  urgentBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#EF4444',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  urgentBannerText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'Inter-Bold',
    fontWeight: '800',
    letterSpacing: 1.2,
  },

  body: {
    padding: 24,
    paddingBottom: 32,
    alignItems: 'center',
  },

  warningIconContainer: {
    marginVertical: 8,
    alignItems: 'center',
  },
  warningEmoji: {
    fontSize: 64,
  },

  title: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginTop: 12,
    letterSpacing: 0.5,
  },
  route: {
    fontSize: 15,
    fontFamily: 'Inter-Medium',
    color: theme.colors.primary,
    marginTop: 6,
    marginBottom: 20,
    textAlign: 'center',
  },

  messageBubble: {
    backgroundColor: '#FEF2F2',
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    marginBottom: 24,
  },
  messageText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    lineHeight: 22,
  },
  bold: {
    fontFamily: 'Inter-Bold',
    fontWeight: '700',
  },
  dangerText: {
    color: '#EF4444',
    fontFamily: 'Inter-Bold',
    fontWeight: '700',
  },

  // Checkbox
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    marginBottom: 24,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E2E8F0',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: theme.colors.success,
    borderColor: theme.colors.success,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#374151',
  },

  // Bouton continuer
  btnPrimary: {
    width: '100%',
    height: 52,
    backgroundColor: theme.colors.primary,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    fontWeight: '700',
  },
  btnDisabled: {
    backgroundColor: '#CBD5E1',
  },

  // Choix OUI / NON
  choiceContainer: {
    width: '100%',
    gap: 14,
    marginTop: 8,
  },
  btnYes: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: theme.colors.success,
    borderRadius: 16,
    padding: 18,
    shadowColor: theme.colors.success,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  btnYesTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    fontWeight: '700',
  },
  btnYesSub: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    marginTop: 2,
  },
  btnNo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    borderWidth: 2,
    borderColor: theme.colors.error,
  },
  btnNoTitle: {
    color: theme.colors.error,
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    fontWeight: '700',
  },
  btnNoSub: {
    color: '#6B7280',
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    marginTop: 2,
  },
  btnTextBlock: {
    flex: 1,
  },

  // Error
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEE2E2',
    borderRadius: 10,
    padding: 12,
    width: '100%',
    marginBottom: 16,
  },
  errorText: {
    flex: 1,
    color: theme.colors.error,
    fontSize: 13,
    fontFamily: 'Inter-Medium',
  },

  // Loading / Done
  centerBlock: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 16,
  },
  loadingText: {
    fontSize: 15,
    fontFamily: 'Inter-Medium',
    color: theme.colors.textMuted,
  },
  doneTitle: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#0F172A',
    fontWeight: '700',
  },
  doneSub: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 8,
  },
});
