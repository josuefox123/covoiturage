/**
 * ==============================================================
 * Fichier :
 * payments.tsx
 *
 * Description :
 * Écran de retour de paiement FedaPay.
 * Distingue 3 cas :
 *  1. "approved" → confirmation, succès
 *  2. "pending" + mode défini → attente opérateur → polling 5s
 *  3. "pending" + mode null → l'utilisateur n'a PAS payé → offrir de payer
 *
 * Projet :
 * Zemy
 * ==============================================================
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, ActivityIndicator, StyleSheet,
  TouchableOpacity, Animated, ScrollView
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/context/AuthContext';
import * as WebBrowser from 'expo-web-browser';
import * as ExpoLinking from 'expo-linking';

WebBrowser.maybeCompleteAuthSession();

const COLORS = {
  primary: '#2F80ED',
  success: '#16A34A',
  error: '#DC2626',
  warning: '#D97706',
  white: '#FFFFFF',
  background: '#F9FAFB',
  text: '#1F2937',
  textLight: '#6B7280',
  border: '#E5E7EB',
  successLight: '#F0FDF4',
  errorLight: '#FEF2F2',
  warningLight: '#FFFBEB',
  infoLight: '#EFF6FF',
};

const MAX_POLLING_RETRIES = 12; // 12 × 5s = 60 secondes max

type ScreenStatus = 'verifying' | 'success' | 'waiting_operator' | 'not_paid' | 'failed';

export default function PaymentCallbackScreen() {
  const { booking_id, parcel_id } = useLocalSearchParams<{
    booking_id?: string;
    parcel_id?: string;
  }>();
  const router = useRouter();
  const { authFetch } = useAuth();

  const [screenStatus, setScreenStatus] = useState<ScreenStatus>('verifying');
  const [message, setMessage] = useState('Connexion à FedaPay...');
  const [retryCount, setRetryCount] = useState(0);
  const [countdown, setCountdown] = useState(5);

  // Pour relancer le paiement directement depuis cet écran
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);

  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMounted = useRef(true);

  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const clearPolling = useCallback(() => {
    if (pollingRef.current) { clearTimeout(pollingRef.current); pollingRef.current = null; }
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
  }, []);

  useEffect(() => {
    isMounted.current = true;
    doVerify(0);
    return () => {
      isMounted.current = false;
      clearPolling();
    };
  }, [booking_id, parcel_id]);

  const doVerify = useCallback(async (attempt: number) => {
    if (!isMounted.current) return;

    if (!booking_id && !parcel_id) {
      setScreenStatus('success');
      setMessage('Retour à l\'application...');
      setTimeout(() => { if (isMounted.current) router.replace('/(tabs)/'); }, 2000);
      return;
    }

    try {
      if (!isMounted.current) return;
      setScreenStatus('verifying');
      setMessage('Vérification du statut auprès de FedaPay...');

      let res: any;
      if (booking_id) {
        res = await authFetch(`/bookings/${booking_id}/verify-payment/`, {
          method: 'POST',
          body: JSON.stringify({})
        });
      } else if (parcel_id) {
        res = await authFetch(`/parcels/${parcel_id}/verify-payment/`, {
          method: 'POST',
          body: JSON.stringify({})
        });
      }

      if (!isMounted.current) return;

      // ─── SUCCÈS ─────────────────────────────────────────────
      if (res?.already_processed || res?.status === 'Paiement validé avec succès.') {
        clearPolling();
        setScreenStatus('success');
        setMessage(
          booking_id
            ? 'Votre réservation est confirmée ! Vous recevrez bientôt un message du conducteur.'
            : 'Votre envoi de colis est confirmé !'
        );
        return;
      }

      // ─── PENDING ─────────────────────────────────────────────
      if (res?.status === 'pending') {
        // Cas 1 : l'utilisateur n'a pas complété le paiement sur FedaPay
        if (res?.payment_not_started) {
          clearPolling();
          setScreenStatus('not_paid');
          setMessage(
            'Le paiement n\'a pas été effectué sur FedaPay. Le navigateur a été fermé avant que vous ayez confirmé le paiement.\n\nVous pouvez réessayer en appuyant sur "Payer maintenant".'
          );
          return;
        }

        // Cas 2 : paiement initié, en attente de confirmation opérateur → polling
        if (attempt < MAX_POLLING_RETRIES) {
          setScreenStatus('waiting_operator');
          setRetryCount(attempt + 1);
          setMessage('Votre paiement a été initié. En attente de confirmation de l\'opérateur mobile...');
          startPolling(attempt + 1);
        } else {
          // Trop de tentatives
          clearPolling();
          setScreenStatus('not_paid');
          setMessage(
            'Le statut du paiement reste en attente après 60 secondes.\n\nSi vous avez été débité, contactez le support. Sinon, réessayez de payer.'
          );
        }
        return;
      }

      // ─── ÉCHEC (declined, canceled...) ──────────────────────
      clearPolling();
      setScreenStatus('failed');
      setMessage(res?.error || `Le paiement a échoué ou a été annulé.`);

    } catch (error: any) {
      if (!isMounted.current) return;
      if (attempt < MAX_POLLING_RETRIES) {
        setMessage('Erreur réseau, nouvelle tentative...');
        startPolling(attempt + 1);
      } else {
        clearPolling();
        setScreenStatus('failed');
        setMessage(error?.message || 'Impossible de contacter le serveur de paiement.');
      }
    }
  }, [booking_id, parcel_id, authFetch, clearPolling]);

  const startPolling = useCallback((attempt: number) => {
    clearPolling();
    if (!isMounted.current) return;

    setCountdown(5);
    countdownRef.current = setInterval(() => {
      if (!isMounted.current) { clearPolling(); return; }
      setCountdown(prev => {
        if (prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    pollingRef.current = setTimeout(() => {
      if (!isMounted.current) return;
      doVerify(attempt);
    }, 5000);
  }, [doVerify, clearPolling]);

  // Ouvrir le checkout FedaPay pour payer (ou repayer)
  const handleOpenPayment = async () => {
    if (!booking_id && !parcel_id) return;
    setPaymentLoading(true);
    try {
      const endpoint = booking_id ? `/bookings/${booking_id}/pay/` : `/parcels/${parcel_id}/pay/`;
      const idKey = booking_id ? 'booking_id' : 'parcel_id';
      const idValue = booking_id || parcel_id;

      const callbackUrl = ExpoLinking.createURL('payments', {
        queryParams: { [idKey]: String(idValue) }
      });

      const payRes = await authFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify({ callback_url: callbackUrl })
      });

      if (payRes?.url) {
        // Ouvrir FedaPay checkout (réutilise la transaction existante, pas de doublon)
        await WebBrowser.openAuthSessionAsync(payRes.url, callbackUrl);
        // Après retour, revérifier
        if (isMounted.current) {
          setRetryCount(0);
          doVerify(0);
        }
      } else if (payRes?.error) {
        setScreenStatus('failed');
        setMessage(payRes.error);
      }
    } catch (error: any) {
      setScreenStatus('failed');
      setMessage(error?.message || 'Impossible de lancer le paiement.');
    } finally {
      if (isMounted.current) setPaymentLoading(false);
    }
  };

  const handleManualRetry = () => {
    clearPolling();
    setRetryCount(0);
    doVerify(0);
  };

  const handleGoToTrips = () => {
    clearPolling();
    router.replace('/(tabs)/trips');
  };

  const handleGoHome = () => {
    clearPolling();
    router.replace('/(tabs)/');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} bounces={false}>

        {/* ─── VÉRIFICATION ─────────────────────────────────── */}
        {screenStatus === 'verifying' && (
          <>
            <ActivityIndicator size="large" color={COLORS.primary} style={styles.spinnerLarge} />
            <Text style={styles.title}>Vérification en cours...</Text>
            <Text style={styles.subtitle}>{message}</Text>
          </>
        )}

        {/* ─── ATTENTE OPÉRATEUR (polling) ───────────────────── */}
        {screenStatus === 'waiting_operator' && (
          <>
            <Animated.View style={[styles.iconCircle, { backgroundColor: COLORS.infoLight, transform: [{ scale: pulseAnim }] }]}>
              <Ionicons name="time" size={64} color={COLORS.primary} />
            </Animated.View>
            <Text style={[styles.title, { color: COLORS.primary }]}>Traitement en cours ⏳</Text>
            <Text style={styles.subtitle}>{message}</Text>

            <View style={styles.countdownContainer}>
              <ActivityIndicator size="small" color={COLORS.primary} />
              <Text style={styles.countdownText}>
                Vérification dans {countdown}s • Tentative {retryCount}/{MAX_POLLING_RETRIES}
              </Text>
            </View>

            <TouchableOpacity style={[styles.btn, { backgroundColor: COLORS.primary }]} onPress={handleGoToTrips}>
              <Text style={styles.btnText}>Voir mes réservations</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnSecondary} onPress={handleManualRetry}>
              <Text style={styles.btnSecondaryText}>🔄 Vérifier maintenant</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ─── PAIEMENT NON EFFECTUÉ ─────────────────────────── */}
        {screenStatus === 'not_paid' && (
          <>
            <View style={[styles.iconCircle, { backgroundColor: COLORS.warningLight }]}>
              <Ionicons name="card" size={64} color={COLORS.warning} />
            </View>
            <Text style={[styles.title, { color: COLORS.warning }]}>Paiement incomplet</Text>
            <Text style={styles.subtitle}>{message}</Text>

            <View style={styles.infoBox}>
              <Ionicons name="information-circle" size={18} color={COLORS.primary} />
              <Text style={styles.infoText}>
                Aucun montant ne vous sera débité si vous n'avez pas finalisé le paiement sur FedaPay.
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.btn, { backgroundColor: COLORS.warning }, paymentLoading && { opacity: 0.7 }]}
              onPress={handleOpenPayment}
              disabled={paymentLoading}
            >
              {paymentLoading
                ? <ActivityIndicator color={COLORS.white} />
                : <Text style={styles.btnText}>💳 Payer maintenant</Text>
              }
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnSecondary} onPress={handleGoToTrips}>
              <Text style={styles.btnSecondaryText}>Voir mes réservations</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btnSecondary, { marginTop: 4 }]} onPress={handleGoHome}>
              <Text style={styles.btnSecondaryText}>Retour à l'accueil</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ─── SUCCÈS ────────────────────────────────────────── */}
        {screenStatus === 'success' && (
          <>
            <View style={[styles.iconCircle, { backgroundColor: COLORS.successLight }]}>
              <Ionicons name="checkmark-circle" size={72} color={COLORS.success} />
            </View>
            <Text style={[styles.title, { color: COLORS.success }]}>Paiement réussi ! 🎉</Text>
            <Text style={styles.subtitle}>{message}</Text>
            <TouchableOpacity style={[styles.btn, { backgroundColor: COLORS.success }]} onPress={handleGoToTrips}>
              <Text style={styles.btnText}>Voir mes réservations</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnSecondary} onPress={handleGoHome}>
              <Text style={styles.btnSecondaryText}>Retour à l'accueil</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ─── ÉCHEC ─────────────────────────────────────────── */}
        {screenStatus === 'failed' && (
          <>
            <View style={[styles.iconCircle, { backgroundColor: COLORS.errorLight }]}>
              <Ionicons name="close-circle" size={72} color={COLORS.error} />
            </View>
            <Text style={[styles.title, { color: COLORS.error }]}>Paiement non confirmé</Text>
            <Text style={styles.subtitle}>{message}</Text>

            <TouchableOpacity
              style={[styles.btn, { backgroundColor: COLORS.warning }, paymentLoading && { opacity: 0.7 }]}
              onPress={handleOpenPayment}
              disabled={paymentLoading}
            >
              {paymentLoading
                ? <ActivityIndicator color={COLORS.white} />
                : <Text style={styles.btnText}>💳 Réessayer le paiement</Text>
              }
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnSecondary} onPress={handleManualRetry}>
              <Text style={styles.btnSecondaryText}>🔄 Vérifier le statut</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btnSecondary, { marginTop: 4 }]} onPress={handleGoHome}>
              <Text style={styles.btnSecondaryText}>Retour à l'accueil</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 28,
    gap: 14,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  spinnerLarge: {
    marginBottom: 16,
    transform: [{ scale: 1.4 }],
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textLight,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 4,
  },
  countdownContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  countdownText: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '600',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#EFF6FF',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    width: '100%',
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.primary,
    lineHeight: 18,
  },
  btn: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  btnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  btnSecondary: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  btnSecondaryText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '600',
  },
});
