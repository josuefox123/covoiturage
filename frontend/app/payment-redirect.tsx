/**
 * ==============================================================
 * Fichier :
 * payment-redirect.tsx
 *
 * Description :
 * Écran intermédiaire sécurisé pour le paiement FedaPay.
 * Affiche des instructions claires, ouvre le navigateur système
 * sécurisé via expo-web-browser, et gère le polling de vérification
 * en arrière-plan à la fermeture.
 *
 * Projet :
 * Zemy
 * ==============================================================
 */
import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, ActivityIndicator, TouchableOpacity, Animated } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import * as ExpoLinking from 'expo-linking';
import { useAuth } from '../src/context/AuthContext';
import { CustomAlert } from '../src/utils/CustomAlert';

WebBrowser.maybeCompleteAuthSession();

const COLORS = {
  blue: '#2F80ED',
  green: '#10B981',
  success: '#16A34A',
  error: '#DC2626',
  warning: '#F59E0B',
  white: '#FFFFFF',
  background: '#F9FAFB',
  card: '#FFFFFF',
  text: '#1F2937',
  textLight: '#6B7280',
  border: '#E5E7EB',
};

type ScreenStatus = 'initial' | 'waiting' | 'verifying' | 'success' | 'error';

export default function PaymentRedirectScreen() {
  const { checkoutUrl, bookingId, parcelId } = useLocalSearchParams<{
    checkoutUrl: string;
    bookingId?: string;
    parcelId?: string;
  }>();

  const router = useRouter();
  const { authFetch } = useAuth();

  const [status, setStatus] = useState<ScreenStatus>('initial');
  const [errorMessage, setErrorMessage] = useState('');
  const [pollingAttempt, setPollingAttempt] = useState(0);

  const pollingRef = useRef<any>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Déterminer la couleur thématique (Vert pour Colis, Bleu pour Trajets)
  const isParcel = !!parcelId;
  const themeColor = isParcel ? COLORS.green : COLORS.blue;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const startPaymentVerification = () => {
    setStatus('verifying');

    const verifyEndpoint = bookingId
      ? `/bookings/${bookingId}/verify-payment/`
      : `/parcels/${parcelId}/verify-payment/`;

    let attempts = 0;
    const maxAttempts = 12; // 60 secondes (12 * 5s)

    const check = async () => {
      attempts++;
      setPollingAttempt(attempts);
      try {
        const res = await authFetch(verifyEndpoint, { method: 'POST' });

        // Si le paiement est validé
        if (
          res.status === 'Paiement validé avec succès.' ||
          res.already_processed ||
          res.status === 'approved' ||
          (res.payment && res.payment.status === 'approved')
        ) {
          if (pollingRef.current) clearInterval(pollingRef.current);
          setStatus('success');
          setTimeout(() => {
            router.back();
          }, 2500);
          return true;
        }

        // Si le paiement a échoué définitivement
        if (res.status === 'failed' || res.status === 'canceled' || res.error) {
          if (pollingRef.current) clearInterval(pollingRef.current);
          setStatus('error');
          setErrorMessage(res.error || 'Le paiement a échoué ou a été annulé par votre opérateur.');
          return true;
        }
      } catch (error: any) {
        console.log('Error verifying payment:', error);
      }

      if (attempts >= maxAttempts) {
        if (pollingRef.current) clearInterval(pollingRef.current);
        CustomAlert.alert(
          'Paiement en cours de confirmation',
          'Votre paiement est toujours en cours de traitement. Votre place sera confirmée automatiquement dès réception.',
          [{ text: 'OK', onPress: () => router.back() }]
        );
        return true;
      }
      return false;
    };

    check(); // Première vérification immédiate

    pollingRef.current = setInterval(async () => {
      await check();
    }, 5000);
  };

  const handleContinue = async () => {
    setStatus('waiting');
    try {
      // Générer le deep link pointant vers cet écran
      const callbackUrl = ExpoLinking.createURL('payment-redirect', {
        queryParams: {
          booking_id: bookingId || undefined,
          parcel_id: parcelId || undefined,
        },
      });

      console.log('Opening WebBrowser with callback URL:', callbackUrl);
      const result = await WebBrowser.openAuthSessionAsync(checkoutUrl, callbackUrl);

      console.log('WebBrowser dismissed with result:', result);

      // On lance la vérification à la fermeture du navigateur, quel que soit le type de retour
      startPaymentVerification();
    } catch (error: any) {
      console.log('WebBrowser launch error:', error);
      setStatus('error');
      setErrorMessage("Impossible de lancer la fenêtre de paiement sécurisé.");
    }
  };

  const handleClose = () => {
    if (status === 'verifying') {
      CustomAlert.alert(
        'Vérification en cours',
        'Veuillez ne pas quitter cette page pendant que nous confirmons la transaction.'
      );
      return;
    }

    if (status === 'initial' || status === 'waiting') {
      CustomAlert.alert(
        'Fermer le paiement ?',
        'Voulez-vous quitter la page ? Votre transaction restera en attente et vous pourrez la valider ou la relancer plus tard.',
        [
          { text: 'Continuer le paiement', style: 'cancel' },
          { text: 'Quitter', style: 'destructive', onPress: () => router.back() },
        ]
      );
    } else {
      router.back();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        {status !== 'verifying' && status !== 'success' && (
          <TouchableOpacity activeOpacity={0.85} style={styles.closeButton} onPress={handleClose}>
            <Ionicons name="close" size={24} color={COLORS.text} />
          </TouchableOpacity>
        )}
        <Text style={styles.headerTitle}>Paiement sécurisé</Text>
        <View style={{ width: 44 }} />
      </View>

      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        {/* ─── ÉTAT INITIAL ─────────────────────────────────── */}
        {status === 'initial' && (
          <View style={styles.card}>
            <View style={[styles.iconContainer, { backgroundColor: themeColor + '10' }]}>
              <Ionicons name="shield-checkmark" size={64} color={themeColor} />
            </View>
            <Text style={styles.title}>Paiement sécurisé</Text>
            <Text style={styles.description}>
              Votre paiement va s'ouvrir dans une fenêtre sécurisée. Veuillez compléter la transaction pour valider votre {isParcel ? 'colis' : 'place'}.
            </Text>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: themeColor }]}
              onPress={handleContinue}
              activeOpacity={0.9}
            >
              <Text style={styles.buttonText}>Continuer</Text>
              <Ionicons name="arrow-forward" size={18} color={COLORS.white} />
            </TouchableOpacity>
          </View>
        )}

        {/* ─── EN ATTENTE DU NAVIGATEUR ─────────────────────── */}
        {status === 'waiting' && (
          <View style={styles.card}>
            <ActivityIndicator size="large" color={themeColor} style={{ marginBottom: 24 }} />
            <Text style={styles.title}>Fenêtre de paiement ouverte</Text>
            <Text style={styles.description}>
              Veuillez finaliser votre paiement dans la fenêtre sécurisée. Si elle ne s'est pas affichée, cliquez ci-dessous pour la rouvrir.
            </Text>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: themeColor }]}
              onPress={handleContinue}
              activeOpacity={0.9}
            >
              <Text style={styles.buttonText}>Réouvrir la fenêtre</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ─── VERIFICATION EN COURS ────────────────────────── */}
        {status === 'verifying' && (
          <View style={styles.card}>
            <ActivityIndicator size="large" color={themeColor} style={{ marginBottom: 24 }} />
            <Text style={[styles.title, { color: themeColor }]}>✔ Vérification du paiement...</Text>
            <Text style={styles.subtitle}>⏳ Quelques secondes...</Text>
            <Text style={styles.description}>
              Tentative {pollingAttempt} sur 12. Ne fermez pas l'application pendant la confirmation de la transaction avec votre opérateur.
            </Text>
          </View>
        )}

        {/* ─── SUCCÈS ────────────────────────────────────────── */}
        {status === 'success' && (
          <View style={styles.card}>
            <View style={[styles.iconContainer, { backgroundColor: COLORS.success + '10' }]}>
              <Ionicons name="checkmark-circle" size={72} color={COLORS.success} />
            </View>
            <Text style={[styles.title, { color: COLORS.success }]}>✅ Paiement confirmé</Text>
            <Text style={styles.description}>
              Félicitations, votre paiement a été validé ! Redirection automatique en cours...
            </Text>
          </View>
        )}

        {/* ─── ERREUR ────────────────────────────────────────── */}
        {status === 'error' && (
          <View style={styles.card}>
            <View style={[styles.iconContainer, { backgroundColor: COLORS.error + '10' }]}>
              <Ionicons name="close-circle" size={72} color={COLORS.error} />
            </View>
            <Text style={[styles.title, { color: COLORS.error }]}>❌ Paiement non validé</Text>
            <Text style={styles.description}>
              {errorMessage || 'Une erreur est survenue lors de la validation de votre transaction.'}
            </Text>
            <View style={styles.errorActions}>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: themeColor, flex: 1 }]}
                onPress={handleContinue}
                activeOpacity={0.9}
              >
                <Text style={styles.buttonText}>Réessayer</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.buttonSecondary, { flex: 1 }]}
                onPress={() => setStatus('initial')}
                activeOpacity={0.8}
              >
                <Text style={styles.buttonSecondaryText}>Retour</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  closeButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textLight,
    marginBottom: 16,
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    color: COLORS.textLight,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 54,
    borderRadius: 16,
    paddingHorizontal: 32,
    gap: 8,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },
  errorActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  buttonSecondary: {
    height: 54,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.white,
  },
  buttonSecondaryText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
  },
});
