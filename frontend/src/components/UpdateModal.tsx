/**
 * ==============================================================
 * Fichier : UpdateModal.tsx
 *
 * Description :
 * Interface épurée et professionnelle pour les mises à jour EAS Update.
 * - Écran 1 : Pop-up sobre aux couleurs de Zemy pour annoncer la mise à jour.
 * - Écran 2 : Page immersive avec barre de chargement de 0 à 100%.
 * Sans émojis ni icônes superflues, style corporate soigné.
 *
 * Projet : Zemy
 * ==============================================================
 */

import React, { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Animated,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface UpdateModalProps {
  isAvailable: boolean;
  isDownloading: boolean;
  progress: number;
  statusText: string;
  error: string | null;
  onStartUpdate: () => void;
  onDismiss: () => void;
  onRetry?: () => void;
}

export default function UpdateModal({
  isAvailable,
  isDownloading,
  progress,
  statusText,
  error,
  onStartUpdate,
  onDismiss,
  onRetry,
}: UpdateModalProps) {
  // Animation d'apparition du pop-up
  const promptScale = useRef(new Animated.Value(1)).current;
  const promptOpacity = useRef(new Animated.Value(1)).current;

  // Animation douce du logo pendant le chargement
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isAvailable && !isDownloading) {
      Animated.parallel([
        Animated.spring(promptScale, {
          toValue: 1,
          friction: 8,
          tension: 60,
          useNativeDriver: true,
        }),
        Animated.timing(promptOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isAvailable, isDownloading]);

  useEffect(() => {
    if (isDownloading) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.03,
            duration: 900,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0.98,
            duration: 900,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [isDownloading]);

  // ==============================================================
  // ÉCRAN 2 : PAGE PLEIN ÉCRAN DE CHARGEMENT (0 À 100%)
  // ==============================================================
  if (isDownloading) {
    const isCompleted = progress >= 100;

    return (
      <Modal visible={true} animationType="fade" transparent={false} statusBarTranslucent>
        <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
        <View style={styles.downloadContainer}>
          {/* Logo officiel Zemy */}
          <View style={styles.logoContainer}>
            <Animated.View style={[styles.logoWrapper, { transform: [{ scale: pulseAnim }] }]}>
              <Image
                source={require('../../assets/images/logozemy.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </Animated.View>
          </View>

          {/* Titre et état */}
          <View style={styles.statusSection}>
            <Text style={styles.downloadTitle}>
              {error
                ? 'Échec du téléchargement'
                : isCompleted
                ? 'Installation terminée'
                : 'Mise à jour en cours'}
            </Text>
            <Text style={styles.downloadSubtitle}>
              {error
                ? error
                : statusText || 'Téléchargement des composants en cours...'}
            </Text>
          </View>

          {/* Carte de progression */}
          {!error ? (
            <View style={styles.progressCard}>
              <View style={styles.percentageRow}>
                <Text style={styles.percentageLabel}>Progression</Text>
                <Text style={styles.percentageValue}>{Math.round(progress)} %</Text>
              </View>

              {/* Barre de chargement */}
              <View style={styles.progressBarTrack}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${Math.min(100, Math.max(2, progress))}%`,
                    },
                  ]}
                >
                  <LinearGradient
                    colors={['#2563EB', '#38BDF8']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={StyleSheet.absoluteFill}
                  />
                </View>
              </View>

              {/* Étapes textuelles épurées */}
              <View style={styles.stepsRow}>
                <Text style={[styles.stepText, progress >= 30 && styles.stepTextDone]}>
                  Téléchargement
                </Text>
                <View style={styles.stepDivider} />
                <Text style={[styles.stepText, progress >= 75 && styles.stepTextDone]}>
                  Vérification
                </Text>
                <View style={styles.stepDivider} />
                <Text style={[styles.stepText, isCompleted && styles.stepTextDone]}>
                  Finalisation
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.errorCard}>
              <Text style={styles.errorTitle}>Connexion interrompue</Text>
              <Text style={styles.errorCardText}>
                La connexion a été interrompue. Veuillez vérifier votre réseau Internet.
              </Text>
              <View style={styles.errorBtnRow}>
                <TouchableOpacity
                  style={[styles.btnAction, { backgroundColor: '#E2E8F0', flex: 1 }]}
                  onPress={onDismiss}
                >
                  <Text style={[styles.btnActionText, { color: '#475569' }]}>Ignorer</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btnAction, { backgroundColor: '#2563EB', flex: 1 }]}
                  onPress={onRetry || onStartUpdate}
                >
                  <Text style={[styles.btnActionText, { color: '#FFFFFF' }]}>Réessayer</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Mention de bas de page */}
          <View style={styles.footerNote}>
            <Text style={styles.footerNoteText}>
              {isCompleted
                ? "Redémarrage de l'application en cours..."
                : "Veuillez ne pas fermer l'application pendant l'opération."}
            </Text>
          </View>
        </View>
      </Modal>
    );
  }

  // ==============================================================
  // ÉCRAN 1 : POP-UP ANNONCE SOBRE ET CORPORATE
  // ==============================================================
  if (!isAvailable) return null;

  return (
    <Modal visible={isAvailable} animationType="none" transparent onRequestClose={onDismiss}>
      <View style={styles.promptOverlay}>
        <Animated.View
          style={[
            styles.promptCard,
            {
              opacity: promptOpacity,
              transform: [{ scale: promptScale }],
            },
          ]}
        >
          {/* Logo officiel centré en en-tête */}
          <View style={styles.headerLogoWrapper}>
            <Image
              source={require('../../assets/images/logozemy.png')}
              style={styles.headerLogo}
              resizeMode="contain"
            />
          </View>

          {/* Titre et description sobres */}
          <Text style={styles.promptTitle}>Mise à jour disponible</Text>
          <Text style={styles.promptMessage}>
            Une nouvelle version de Zemy est prête. Installez-la dès maintenant pour bénéficier des
            dernières améliorations et corrections.
          </Text>

          {/* Liste des points clés */}
          <View style={styles.benefitContainer}>
            <View style={styles.benefitItem}>
              <View style={styles.bulletDot} />
              <Text style={styles.benefitText}>Amélioration de la fluidité et des performances</Text>
            </View>
            <View style={styles.benefitItem}>
              <View style={styles.bulletDot} />
              <Text style={styles.benefitText}>Nouvelles corrections de stabilité</Text>
            </View>
          </View>

          {/* Boutons d'action */}
          <View style={styles.promptButtonContainer}>
            <TouchableOpacity
              style={styles.primaryButtonWrap}
              onPress={onStartUpdate}
              activeOpacity={0.85}
            >
              <LinearGradient colors={['#2563EB', '#1D4ED8']} style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>Mettre à jour maintenant</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryButton} onPress={onDismiss} activeOpacity={0.7}>
              <Text style={styles.secondaryButtonText}>Plus tard</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // ==============================================================
  // Styles Popup d'annonce
  // ==============================================================
  promptOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  promptCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  headerLogoWrapper: {
    width: 140,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerLogo: {
    width: '100%',
    height: '100%',
  },
  promptTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 8,
  },
  promptMessage: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 18,
  },
  benefitContainer: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2563EB',
  },
  benefitText: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '500',
  },
  promptButtonContainer: {
    width: '100%',
    gap: 8,
  },
  primaryButtonWrap: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  primaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButton: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '600',
  },

  // ==============================================================
  // Styles Page Plein Écran Téléchargement
  // ==============================================================
  downloadContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoWrapper: {
    width: 180,
    height: 70,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  statusSection: {
    alignItems: 'center',
    marginBottom: 28,
    paddingHorizontal: 16,
  },
  downloadTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
    textAlign: 'center',
  },
  downloadSubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
  },
  progressCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  percentageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 10,
  },
  percentageLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  percentageValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#2563EB',
  },
  progressBarTrack: {
    width: '100%',
    height: 12,
    borderRadius: 6,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
    marginBottom: 18,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 6,
    overflow: 'hidden',
  },
  stepsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
  },
  stepTextDone: {
    color: '#0F172A',
    fontWeight: '700',
  },
  stepDivider: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 10,
  },
  errorCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    elevation: 3,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#DC2626',
    marginBottom: 8,
  },
  errorCardText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
  },
  errorBtnRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
    width: '100%',
  },
  btnAction: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnActionText: {
    fontSize: 14,
    fontWeight: '700',
  },
  footerNote: {
    position: 'absolute',
    bottom: 36,
    paddingHorizontal: 20,
  },
  footerNoteText: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
  },
});
