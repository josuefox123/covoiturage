/**
 * ==============================================================
 * Fichier :
 * VerificationModal.tsx
 *
 * Description :
 * Composant ou logique de l'application Zemy.
 *
 * Projet :
 * Zemy
 * ==============================================================
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';

const { width, height } = Dimensions.get('window');
const SNOOZE_KEY = '@zemy_verify_snoozed_until';
const SNOOZE_DURATION_MS = 2 * 60 * 60 * 1000; // 2 heures

interface Props {
  visible: boolean;
  onDismiss: () => void;     // fermeture temporaire ("Plus tard")
  onVerify: () => void;      // navigue vers vérification
  userName?: string;
}

/**
 * Composant VerificationModal.
 *
 * Responsabilités :
 * - Affichage et gestion de l'état lié à VerificationModal.
 */
export default function VerificationModal({ visible, onDismiss, onVerify, userName }: Props) {
  const { user } = useAuth();
  const isRejected = user?.verification_status === 'rejected';

  const scaleAnim  = useRef(new Animated.Value(0.85)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim  = useRef(new Animated.Value(0)).current;
  const badgePulse = useRef(new Animated.Value(1)).current;
  const [dotStep, setDotStep] = useState(0);

  // Pulse du badge ⚠️
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(badgePulse, { toValue: 1.15, duration: 800, useNativeDriver: true }),
        Animated.timing(badgePulse, { toValue: 1,    duration: 800, useNativeDriver: true }),
      ])
    );
    if (visible) pulse.start();
    else pulse.stop();
    return () => pulse.stop();
  }, [visible]);

  // Dots animés (…)
  useEffect(() => {
    if (!visible) return;
    const t = setInterval(() => setDotStep(s => (s + 1) % 4), 500);
    return () => clearInterval(t);
  }, [visible]);

  // Entrée du modal
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim,   { toValue: 1, friction: 7, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
    } else {
      scaleAnim.setValue(0.85);
      opacityAnim.setValue(0);
    }
  }, [visible]);

  // Shake sur "Plus tard" pour signaler que c'est quasi-obligatoire
  const triggerShake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8,   duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,   duration: 60, useNativeDriver: true }),
    ]).start(() => onDismiss());
  };

  const dots = '.'.repeat(dotStep);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
    >
      {/* Backdrop flouté */}
      <View style={styles.backdrop}>
        <Animated.View
          style={[
            styles.card,
            {
              opacity: opacityAnim,
              transform: [
                { scale: scaleAnim },
                { translateX: shakeAnim },
              ],
            },
          ]}
        >
          {/* ── Gradient supérieur ── */}
          <LinearGradient
            colors={['#1E3A8A', '#2563EB', '#3B82F6']}
            style={styles.cardHeader}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            {/* Badge animé */}
            <Animated.View style={[styles.badgeWrap, { transform: [{ scale: badgePulse }] }]}>
              <LinearGradient colors={['#FCD34D', '#F59E0B']} style={styles.badge}>
                <Ionicons name="shield-checkmark" size={28} color="#FFFFFF" />
              </LinearGradient>
            </Animated.View>

            {/* Titre */}
            <Text style={styles.headerTitle}>
              {isRejected ? "Vérification rejetée ❌" : `Vérification requise${dots}`}
            </Text>
            <Text style={styles.headerSub}>
              {isRejected 
                ? "Vos documents n'ont pas pu être validés." 
                : `Bonjour ${userName ? userName : 'là'} ! 👋`
              }
            </Text>

            {/* Motif décoratif */}
            <View style={styles.decorCircle1} />
            <View style={styles.decorCircle2} />
          </LinearGradient>

          {/* ── Corps ── */}
          <View style={styles.cardBody}>

            {/* Raisons */}
            {[
              { icon: 'shield-checkmark-outline', color: '#2563EB', text: 'Réservez des courses en toute sécurité' },
              { icon: 'people-outline',           color: '#10B981', text: 'Rejoignez une communauté vérifiée et de confiance' },
              { icon: 'lock-closed-outline',      color: '#F59E0B', text: 'Protégez votre compte et vos données' },
              { icon: 'car-outline',              color: '#8B5CF6', text: 'Accédez à toutes les fonctionnalités de Zemy' },
            ].map((item, i) => (
              <View key={i} style={styles.reasonRow}>
                <View style={[styles.reasonIconWrap, { backgroundColor: item.color + '18' }]}>
                  <Ionicons name={item.icon as any} size={20} color={item.color} />
                </View>
                <Text style={styles.reasonText}>{item.text}</Text>
              </View>
            ))}

            {/* Alerte rouge */}
            <View style={styles.alertBox}>
              <Ionicons name={isRejected ? "alert-circle" : "information-circle"} size={18} color="#DC2626" />
              <Text style={styles.alertText}>
                {isRejected 
                  ? "Veuillez soumettre des photos de meilleure qualité pour pouvoir réserver."
                  : "Sans vérification, vous ne pouvez pas réserver de course."
                }
              </Text>
            </View>

            {/* ── CTA principal ── */}
            <TouchableOpacity
              style={styles.ctaBtn}
              onPress={onVerify}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={isRejected ? ['#DC2626', '#B91C1C'] : ['#2563EB', '#1E40AF']}
                style={styles.ctaBtnGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Ionicons name="shield-checkmark" size={20} color="#FFFFFF" />
                <Text style={styles.ctaBtnText}>
                  {isRejected ? "Recommencer la vérification" : "Se faire vérifier maintenant"}
                </Text>
                <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
              </LinearGradient>
            </TouchableOpacity>

            {/* Plus tard */}
            <TouchableOpacity style={styles.laterBtn} onPress={triggerShake}>
              <Text style={styles.laterText}>Plus tard (accès limité)</Text>
            </TouchableOpacity>

          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.35,
    shadowRadius: 40,
    elevation: 20,
    backgroundColor: '#FFFFFF',
  },

  // ── Header gradient ──────────────────────────────────────────
  cardHeader: {
    paddingTop: 36,
    paddingBottom: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
    overflow: 'hidden',
  },
  badgeWrap: {
    marginBottom: 16,
  },
  badge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: 0.3,
    minHeight: 28, // stabilise l'animation des points
  },
  headerSub: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    fontWeight: '500',
  },
  decorCircle1: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.06)',
    top: -30,
    right: -30,
  },
  decorCircle2: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.06)',
    bottom: -20,
    left: -20,
  },

  // ── Body ─────────────────────────────────────────────────────
  cardBody: {
    padding: 24,
    backgroundColor: '#FFFFFF',
  },

  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 14,
  },
  reasonIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  reasonText: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
    lineHeight: 20,
  },

  alertBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
    marginBottom: 20,
    marginTop: 4,
  },
  alertText: {
    flex: 1,
    fontSize: 13,
    color: '#DC2626',
    fontWeight: '600',
    lineHeight: 18,
  },

  // ── CTA ──────────────────────────────────────────────────────
  ctaBtn: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  ctaBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  ctaBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    flex: 1,
    textAlign: 'center',
  },

  laterBtn: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  laterText: {
    fontSize: 13,
    color: '#9CA3AF',
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
});
