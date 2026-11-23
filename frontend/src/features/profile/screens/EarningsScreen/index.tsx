/**
 * ==============================================================
 * Fichier :
 * EarningsScreen/index.tsx
 *
 * Description :
 * Portefeuille et gains conducteur Zemy — Interface moderne, sobre,
 * haut de gamme et parfaitement responsive.
 *
 * Projet :
 * Zemy
 * ==============================================================
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Animated,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import {
  fetchDriverEarnings,
  claimPayout,
  DriverEarningsResponse,
  RideEarning,
  PayoutItem,
} from '../../../../services/earnings.service';

// ---------------------------------------------------------------
// Constantes & Palette Zemy
// ---------------------------------------------------------------

const THEME = {
  primary: '#2563EB',         // Bleu Zemy officiel
  primaryDark: '#1D4ED8',
  primaryLight: '#EFF6FF',
  primaryBorder: '#BFDBFE',
  accent: '#F59E0B',          // Jaune/Ambre d'accent
  accentLight: '#FFFBEB',
  accentBorder: '#FDE68A',
  success: '#10B981',         // Vert uniquement pour succès et versements
  successLight: '#ECFDF5',
  successBorder: '#A7F3D0',
  danger: '#EF4444',          // Rouge pour erreurs
  dangerLight: '#FEF2F2',
  dangerBorder: '#FECACA',
  background: '#F8FAFC',
  card: '#FFFFFF',
  text: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  border: '#E2E8F0',
};

const OPERATORS = [
  { key: 'mtn', label: 'MTN Mobile Money', color: '#F59E0B', bg: '#FFFBEB', icon: 'phone-portrait-outline' },
  { key: 'moov', label: 'Moov Money', color: '#0284C7', bg: '#F0F9FF', icon: 'phone-portrait-outline' },
  { key: 'celtiis', label: 'Celtiis Cash', color: '#7C3AED', bg: '#F5F3FF', icon: 'phone-portrait-outline' },
];

function formatAmount(amount?: number | null): string {
  if (amount === undefined || amount === null || isNaN(amount)) return '0 FCFA';
  return Math.round(amount).toLocaleString('fr-FR') + ' FCFA';
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function getPayoutStatusConfig(status?: string) {
  switch (status) {
    case 'paid':
      return { label: 'Versé', color: '#059669', bg: '#ECFDF5', icon: 'checkmark-circle' };
    case 'processing':
      return { label: 'En traitement', color: '#2563EB', bg: '#EFF6FF', icon: 'sync-outline' };
    case 'pending':
      return { label: 'En attente', color: '#D97706', bg: '#FFFBEB', icon: 'time-outline' };
    case 'failed':
      return { label: 'Échoué', color: '#DC2626', bg: '#FEF2F2', icon: 'close-circle' };
    case 'cancelled':
      return { label: 'Annulé', color: '#64748B', bg: '#F1F5F9', icon: 'ban-outline' };
    default:
      return { label: status || 'Inconnu', color: '#64748B', bg: '#F1F5F9', icon: 'ellipse-outline' };
  }
}

// ---------------------------------------------------------------
// Sous-composants
// ---------------------------------------------------------------

const PayoutBadge = ({ status }: { status: string }) => {
  const cfg = getPayoutStatusConfig(status);
  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
      <Ionicons name={cfg.icon as any} size={11} color={cfg.color} />
      <Text style={[styles.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
};

const RideEarningCard = ({ item }: { item: RideEarning }) => {
  const [expanded, setExpanded] = useState(false);
  const hasPayouts = Array.isArray(item.payouts) && item.payouts.length > 0;

  const depCity = (item.departure_location || 'Départ').split(',')[0].trim();
  const arrCity = (item.arrival_location || 'Arrivée').split(',')[0].trim();

  return (
    <View style={styles.rideCard}>
      <TouchableOpacity
        style={styles.rideCardHeader}
        onPress={() => hasPayouts && setExpanded(!expanded)}
        activeOpacity={hasPayouts ? 0.7 : 1}
      >
        <View style={styles.rideRoute}>
          <View style={styles.routeIconBox}>
            <Ionicons name="car-outline" size={16} color={THEME.primary} />
          </View>
          <View style={styles.routeTextBox}>
            <View style={styles.routeCitiesRow}>
              <Text style={styles.routeCity} numberOfLines={1}>
                {depCity}
              </Text>
              <Ionicons name="arrow-forward" size={11} color={THEME.textMuted} style={{ marginHorizontal: 4 }} />
              <Text style={styles.routeCity} numberOfLines={1}>
                {arrCity}
              </Text>
            </View>
            <Text style={styles.rideMetaText}>
              {formatDate(item.departure_date)} · {item.bookings_count} passager{item.bookings_count > 1 ? 's' : ''}
            </Text>
          </View>
        </View>

        <View style={styles.rideRight}>
          <Text style={styles.rideAmount}>+{formatAmount(item.driver_amount)}</Text>
          {hasPayouts && (
            <View style={styles.expandIconBox}>
              <Ionicons
                name={expanded ? 'chevron-up' : 'chevron-down'}
                size={14}
                color={THEME.textMuted}
              />
            </View>
          )}
        </View>
      </TouchableOpacity>

      {/* Détail commission */}
      <View style={styles.commissionRow}>
        <Text style={styles.commissionLabel}>Commission Zemy :</Text>
        <Text style={styles.commissionValue}>{formatAmount(item.zemy_commission)}</Text>
      </View>

      {/* Versements détaillés */}
      {expanded && hasPayouts && (
        <View style={styles.payoutsContainer}>
          <Text style={styles.payoutsSectionTitle}>Détail des versements liés</Text>
          {item.payouts.map((p: PayoutItem) => (
            <View key={p.payout_id} style={styles.payoutRow}>
              <View style={styles.payoutLeft}>
                <Ionicons name="phone-portrait-outline" size={13} color={THEME.textMuted} />
                <Text style={styles.payoutPhone} numberOfLines={1}>
                  {p.phone_number || 'Numéro indisponible'}
                </Text>
              </View>
              <Text style={styles.payoutAmt}>{formatAmount(p.amount)}</Text>
              <PayoutBadge status={p.status} />
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

// ---------------------------------------------------------------
// Modal de Retrait (4 étapes)
// ---------------------------------------------------------------

const WithdrawModal = ({
  visible,
  availableBalance,
  onClose,
  onSuccess,
}: {
  visible: boolean;
  availableBalance: number;
  onClose: () => void;
  onSuccess: () => void;
}) => {
  const [step, setStep] = useState<'form' | 'confirm' | 'loading' | 'success'>('form');
  const [amount, setAmount] = useState('');
  const [phone, setPhone] = useState('');
  const [operator, setOperator] = useState<'mtn' | 'moov' | 'celtiis'>('mtn');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Réinitialisation propre à la fermeture
  const handleClose = () => {
    if (isSubmitting) return; // Empêcher la fermeture pendant la requête
    setStep('form');
    setAmount('');
    setPhone('');
    setOperator('mtn');
    setError('');
    setIsSubmitting(false);
    setResult(null);
    onClose();
  };

  const handleContinue = () => {
    setError('');
    const cleanAmount = amount.replace(/\s/g, '').replace(/,/g, '.');
    const amtNum = parseInt(cleanAmount, 10);

    if (!amount || isNaN(amtNum) || amtNum <= 0) {
      setError('Veuillez entrer un montant valide supérieur à 0.');
      return;
    }
    if (amtNum > availableBalance) {
      setError(`Le montant dépasse votre solde disponible (${formatAmount(availableBalance)}).`);
      return;
    }

    const cleanPhone = phone.trim().replace(/\s/g, '');
    if (!cleanPhone || cleanPhone.length < 8) {
      setError('Veuillez entrer un numéro Mobile Money valide (au moins 8 chiffres).');
      return;
    }

    setStep('confirm');
  };

  const handleConfirm = async () => {
    if (isSubmitting) return; // Anti-double soumission
    setIsSubmitting(true);
    setStep('loading');
    setError('');

    try {
      const cleanAmount = amount.replace(/\s/g, '').replace(/,/g, '.');
      const amtNum = parseInt(cleanAmount, 10);
      const res = await claimPayout({
        amount: amtNum,
        phone_number: phone.trim(),
        operator,
      });

      setResult(res);
      setStep('success');
      Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start();
    } catch (e: any) {
      setStep('form');
      setError(e.message || 'Une erreur est survenue lors de la demande de retrait.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSuccessDone = () => {
    handleClose();
    onSuccess();
  };

  const cleanAmount = amount.replace(/\s/g, '').replace(/,/g, '.');
  const amtNum = parseInt(cleanAmount, 10) || 0;
  const remaining = Math.max(0, availableBalance - amtNum);
  const selectedOp = OPERATORS.find((o) => o.key === operator) || OPERATORS[0];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.modalContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header de la modal */}
        <View style={styles.modalHeader}>
          {step !== 'success' && step !== 'loading' ? (
            <TouchableOpacity
              onPress={step === 'confirm' ? () => setStep('form') : handleClose}
              style={styles.modalCloseBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name={step === 'confirm' ? 'arrow-back' : 'close'}
                size={20}
                color={THEME.text}
              />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 34 }} />
          )}

          <Text style={styles.modalTitle}>
            {step === 'form' && 'Retrait de gains'}
            {step === 'confirm' && 'Confirmation du retrait'}
            {step === 'loading' && 'Traitement en cours'}
            {step === 'success' && 'Demande enregistrée'}
          </Text>

          <View style={{ width: 34 }} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.modalContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── ÉTAPE 1 : Formulaire de retrait ── */}
          {step === 'form' && (
            <>
              {/* Carte solde disponible */}
              <View style={styles.modalBalanceCard}>
                <Text style={styles.modalBalanceLabel}>Solde disponible pour retrait</Text>
                <Text style={styles.modalBalanceAmount}>{formatAmount(availableBalance)}</Text>
              </View>

              {/* Champ Saisie Montant */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Montant à retirer (FCFA)</Text>
                <View style={styles.amountInputRow}>
                  <TextInput
                    style={styles.amountInput}
                    value={amount}
                    onChangeText={(val) => {
                      // Autoriser uniquement les chiffres
                      const numeric = val.replace(/\D/g, '');
                      setAmount(numeric);
                    }}
                    keyboardType="number-pad"
                    placeholder="ex : 5000"
                    placeholderTextColor={THEME.textMuted}
                  />
                  <TouchableOpacity
                    style={styles.maxPillBtn}
                    onPress={() => setAmount(String(availableBalance))}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.maxPillBtnText}>MAX</Text>
                  </TouchableOpacity>
                </View>

                {/* Raccourcis de pourcentage */}
                <View style={styles.percentRow}>
                  {[0.25, 0.5, 0.75, 1.0].map((pct) => {
                    const val = Math.floor(availableBalance * pct);
                    const isActive = amtNum === val && val > 0;
                    return (
                      <TouchableOpacity
                        key={pct}
                        style={[styles.percentBtn, isActive && styles.percentBtnActive]}
                        onPress={() => setAmount(String(val))}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.percentBtnText, isActive && styles.percentBtnTextActive]}>
                          {pct === 1.0 ? '100 %' : `${pct * 100} %`}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Feedback dynamique sur le solde restant */}
                {amtNum > 0 && amtNum <= availableBalance && (
                  <View style={styles.feedbackBox}>
                    <Ionicons name="information-circle-outline" size={15} color={THEME.primary} />
                    <Text style={styles.feedbackText}>
                      Solde restant après retrait : <Text style={{ fontWeight: '700' }}>{formatAmount(remaining)}</Text>
                    </Text>
                  </View>
                )}
              </View>

              {/* Choix de l'opérateur Mobile Money */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Opérateur de versement</Text>
                <View style={styles.operatorSelector}>
                  {OPERATORS.map((op) => {
                    const isSelected = operator === op.key;
                    return (
                      <TouchableOpacity
                        key={op.key}
                        style={[
                          styles.operatorCard,
                          isSelected && { borderColor: op.color, backgroundColor: op.bg },
                        ]}
                        onPress={() => setOperator(op.key as any)}
                        activeOpacity={0.8}
                      >
                        <View style={[styles.operatorDot, { backgroundColor: op.color }]} />
                        <Text
                          style={[
                            styles.operatorCardText,
                            isSelected && { color: op.color, fontWeight: '700' },
                          ]}
                          numberOfLines={1}
                        >
                          {op.label}
                        </Text>
                        <Ionicons
                          name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                          size={18}
                          color={isSelected ? op.color : THEME.textMuted}
                        />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Champ Numéro Mobile Money */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Numéro de compte Mobile Money</Text>
                <View style={styles.standardInputBox}>
                  <Ionicons name="phone-portrait-outline" size={18} color={THEME.textMuted} style={{ marginRight: 8 }} />
                  <TextInput
                    style={styles.standardInput}
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                    placeholder="ex : 97 00 00 00"
                    placeholderTextColor={THEME.textMuted}
                    autoCapitalize="none"
                  />
                </View>
                <Text style={styles.phoneHintText}>
                  Vérifiez que ce numéro est bien enregistré et actif chez l'opérateur choisi.
                </Text>
              </View>

              {/* Affichage d'erreur */}
              {error ? (
                <View style={styles.errorBanner}>
                  <Ionicons name="alert-circle" size={16} color={THEME.danger} />
                  <Text style={styles.errorBannerText}>{error}</Text>
                </View>
              ) : null}

              {/* Bouton Continuer */}
              <TouchableOpacity
                style={[
                  styles.modalPrimaryBtn,
                  (!amount || amtNum <= 0 || amtNum > availableBalance) && styles.modalBtnDisabled,
                ]}
                onPress={handleContinue}
                disabled={!amount || amtNum <= 0 || amtNum > availableBalance}
                activeOpacity={0.85}
              >
                <Text style={styles.modalPrimaryBtnText}>Continuer</Text>
                <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </>
          )}

          {/* ── ÉTAPE 2 : Confirmation ── */}
          {step === 'confirm' && (
            <>
              <View style={styles.confirmHeaderCard}>
                <Text style={styles.confirmHeaderSub}>Montant du retrait</Text>
                <Text style={styles.confirmHeaderAmount}>{formatAmount(amtNum)}</Text>
              </View>

              <View style={styles.confirmSummaryCard}>
                <View style={styles.confirmRow}>
                  <Text style={styles.confirmRowLabel}>Bénéficiaire</Text>
                  <Text style={styles.confirmRowValue}>{phone}</Text>
                </View>
                <View style={styles.confirmRow}>
                  <Text style={styles.confirmRowLabel}>Opérateur</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View style={[styles.operatorDot, { backgroundColor: selectedOp.color }]} />
                    <Text style={[styles.confirmRowValue, { color: selectedOp.color }]}>
                      {selectedOp.label}
                    </Text>
                  </View>
                </View>
                <View style={styles.confirmRow}>
                  <Text style={styles.confirmRowLabel}>Solde restant après retrait</Text>
                  <Text style={styles.confirmRowValue}>{formatAmount(remaining)}</Text>
                </View>
              </View>

              <View style={styles.warningBox}>
                <Ionicons name="shield-checkmark" size={16} color={THEME.accent} />
                <Text style={styles.warningBoxText}>
                  Vérifiez attentivement les informations ci-dessus avant de valider votre demande.
                </Text>
              </View>

              <TouchableOpacity
                style={styles.modalPrimaryBtn}
                onPress={handleConfirm}
                disabled={isSubmitting}
                activeOpacity={0.85}
              >
                <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                <Text style={styles.modalPrimaryBtnText}>Confirmer le retrait</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSecondaryBtn}
                onPress={() => setStep('form')}
                disabled={isSubmitting}
                activeOpacity={0.7}
              >
                <Text style={styles.modalSecondaryBtnText}>Modifier les informations</Text>
              </TouchableOpacity>
            </>
          )}

          {/* ── ÉTAPE 3 : Traitement en cours ── */}
          {step === 'loading' && (
            <View style={styles.loadingStepBox}>
              <ActivityIndicator size="large" color={THEME.primary} />
              <Text style={styles.loadingStepTitle}>Traitement de votre demande...</Text>
              <Text style={styles.loadingStepSub}>
                Veuillez patienter pendant la communication sécurisée avec le serveur de paiement.
              </Text>
            </View>
          )}

          {/* ── ÉTAPE 4 : Succès ── */}
          {step === 'success' && result && (
            <Animated.View style={[styles.successStepBox, { opacity: fadeAnim }]}>
              <View style={styles.successIconCircle}>
                <Ionicons name="checkmark" size={36} color="#FFFFFF" />
              </View>

              <Text style={styles.successTitle}>Demande enregistrée !</Text>
              <Text style={styles.successAmount}>{formatAmount(result.amount)}</Text>
              <Text style={styles.successSub}>
                Votre demande de retrait vers {result.phone_number || phone} a été transmise avec succès.
              </Text>

              <View style={styles.successDetailsCard}>
                <View style={styles.confirmRow}>
                  <Text style={styles.confirmRowLabel}>Référence</Text>
                  <Text style={[styles.confirmRowValue, { fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontSize: 12 }]}>
                    {result.payout_reference || result.payout_id || '—'}
                  </Text>
                </View>
                <View style={styles.confirmRow}>
                  <Text style={styles.confirmRowLabel}>Mode de traitement</Text>
                  <Text style={styles.confirmRowValue}>
                    {result.payment_mode === 'automatic' ? 'Instantané (Automatique)' : 'Manuel sécurisé'}
                  </Text>
                </View>
                <View style={styles.confirmRow}>
                  <Text style={styles.confirmRowLabel}>Statut actuel</Text>
                  <PayoutBadge status={result.status || 'pending'} />
                </View>
              </View>

              <View style={styles.noticeBox}>
                <Ionicons name="time-outline" size={16} color={THEME.primary} />
                <Text style={styles.noticeText}>
                  {result.payment_mode === 'automatic'
                    ? 'Le virement est en cours de traitement par l\'opérateur. Vous recevrez une confirmation SMS.'
                    : 'Votre demande est en cours de validation par l\'équipe Zemy. Les fonds seront transférés sous peu.'}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.modalPrimaryBtn}
                onPress={handleSuccessDone}
                activeOpacity={0.85}
              >
                <Text style={styles.modalPrimaryBtnText}>Terminer</Text>
              </TouchableOpacity>
            </Animated.View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ---------------------------------------------------------------
// Écran Principal
// ---------------------------------------------------------------

export default function EarningsScreen() {
  const router = useRouter();
  const [data, setData] = useState<DriverEarningsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [error, setError] = useState('');

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadData = useCallback(async (isRefresh = false) => {
    try {
      if (!isRefresh) setError('');
      const res = await fetchDriverEarnings();
      if (isMountedRef.current) {
        setData(res);
      }
    } catch (e: any) {
      if (isMountedRef.current) {
        // En cas d'erreur lors d'un pull-to-refresh, ne pas effacer les données existantes
        setError(e.message || 'Impossible de synchroniser vos gains.');
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadData(false);
    }, [loadData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData(true);
  };

  const summary = data?.summary;
  const history = Array.isArray(data?.history) ? data.history : [];
  const available = summary?.available_balance || 0;

  if (loading && !data) {
    return (
      <View style={styles.loadingCenter}>
        <ActivityIndicator size="large" color={THEME.primary} />
        <Text style={styles.loadingCenterText}>Chargement de vos gains...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="dark-content" />

      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          {router.canGoBack() && (
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.headerBackBtn}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="arrow-back" size={20} color={THEME.text} />
            </TouchableOpacity>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Mes gains</Text>
            <Text style={styles.headerSub}>Suivez vos revenus et vos versements</Text>
          </View>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={THEME.primary} />
        }
      >
        {/* ── Carte Principale : Solde disponible ── */}
        <LinearGradient
          colors={[THEME.primary, THEME.primaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <View style={styles.heroHeaderRow}>
            <View style={styles.heroLabelBox}>
              <Ionicons name="wallet-outline" size={16} color="rgba(255, 255, 255, 0.85)" />
              <Text style={styles.heroLabel}>SOLDE DISPONIBLE</Text>
            </View>
          </View>

          <Text style={styles.heroAmount} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
            {formatAmount(available)}
          </Text>

          <TouchableOpacity
            style={[
              styles.heroActionBtn,
              available <= 0 && styles.heroActionBtnDisabled,
            ]}
            onPress={() => available > 0 && setShowWithdraw(true)}
            activeOpacity={available > 0 ? 0.85 : 1}
            disabled={available <= 0}
          >
            <Ionicons
              name="cash-outline"
              size={18}
              color={available > 0 ? THEME.primary : THEME.textMuted}
            />
            <Text
              style={[
                styles.heroActionBtnText,
                available <= 0 && { color: THEME.textMuted },
              ]}
            >
              {available > 0 ? 'Retirer mes gains' : 'Aucun gain à retirer'}
            </Text>
          </TouchableOpacity>
        </LinearGradient>

        {/* ── Statistiques clés (3 indicateurs) ── */}
        {summary && (
          <View style={styles.statsRow}>
            {/* 1. En traitement */}
            <View style={[styles.statCard, { backgroundColor: THEME.accentLight, borderColor: THEME.accentBorder }]}>
              <View style={styles.statIconBox}>
                <Ionicons name="time-outline" size={16} color={THEME.accent} />
              </View>
              <Text style={[styles.statValue, { color: '#B45309' }]} numberOfLines={1} adjustsFontSizeToFit>
                {formatAmount(summary.in_processing)}
              </Text>
              <Text style={styles.statLabel}>En traitement</Text>
            </View>

            {/* 2. Déjà versé */}
            <View style={[styles.statCard, { backgroundColor: THEME.successLight, borderColor: THEME.successBorder }]}>
              <View style={styles.statIconBox}>
                <Ionicons name="checkmark-done-outline" size={16} color={THEME.success} />
              </View>
              <Text style={[styles.statValue, { color: '#047857' }]} numberOfLines={1} adjustsFontSizeToFit>
                {formatAmount(summary.already_paid)}
              </Text>
              <Text style={styles.statLabel}>Déjà versé</Text>
            </View>

            {/* 3. Total gagné */}
            <View style={[styles.statCard, { backgroundColor: THEME.primaryLight, borderColor: THEME.primaryBorder }]}>
              <View style={styles.statIconBox}>
                <Ionicons name="trending-up-outline" size={16} color={THEME.primary} />
              </View>
              <Text style={[styles.statValue, { color: '#1D4ED8' }]} numberOfLines={1} adjustsFontSizeToFit>
                {formatAmount(summary.driver_amount)}
              </Text>
              <Text style={styles.statLabel}>Total gagné</Text>
            </View>
          </View>
        )}

        {/* Bannière d'erreur si la récupération échoue */}
        {error ? (
          <View style={styles.mainErrorBox}>
            <Ionicons name="alert-circle" size={16} color={THEME.danger} />
            <Text style={styles.mainErrorText}>{error}</Text>
          </View>
        ) : null}

        {/* ── Historique des gains par trajet ── */}
        <View style={styles.historySection}>
          <View style={styles.historySectionHeader}>
            <Text style={styles.historyTitle}>Historique des gains</Text>
            {history.length > 0 && (
              <Text style={styles.historyCount}>{history.length} trajet{history.length > 1 ? 's' : ''}</Text>
            )}
          </View>

          {history.length === 0 ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="receipt-outline" size={32} color={THEME.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>Aucun gain pour l'instant</Text>
              <Text style={styles.emptySubtitle}>
                Vos revenus de covoiturage s'afficheront automatiquement ici dès que vos trajets seront effectués.
              </Text>
            </View>
          ) : (
            history.map((item: RideEarning) => (
              <RideEarningCard key={item.ride_id} item={item} />
            ))
          )}
        </View>
      </ScrollView>

      {/* ── Modal de Retrait ── */}
      <WithdrawModal
        visible={showWithdraw}
        availableBalance={available}
        onClose={() => setShowWithdraw(false)}
        onSuccess={() => {
          setShowWithdraw(false);
          loadData(true);
        }}
      />
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------
// Feuilles de Styles Épurées & Professionnelles
// ---------------------------------------------------------------

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: THEME.background,
  },
  loadingCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: THEME.background,
  },
  loadingCenterText: {
    fontSize: 14,
    color: THEME.textSecondary,
    fontWeight: '500',
  },

  // Header
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: THEME.background,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: THEME.card,
    borderWidth: 1,
    borderColor: THEME.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: THEME.text,
    letterSpacing: -0.4,
  },
  headerSub: {
    fontSize: 13,
    color: THEME.textSecondary,
    marginTop: 2,
    fontWeight: '500',
  },

  scrollContent: {
    paddingBottom: 40,
  },

  // Carte Héro Solde
  heroCard: {
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 12,
    borderRadius: 20,
    padding: 20,
    shadowColor: THEME.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 6,
  },
  heroHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  heroLabelBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.9)',
    letterSpacing: 0.6,
  },
  heroAmount: {
    fontSize: 34,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.6,
    marginBottom: 18,
  },
  heroActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 13,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  heroActionBtnDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    shadowOpacity: 0,
    elevation: 0,
  },
  heroActionBtnText: {
    fontSize: 14.5,
    fontWeight: '700',
    color: THEME.primary,
  },

  // Ligne de Statistiques
  statsRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    gap: 8,
    marginBottom: 14,
  },
  statCard: {
    flex: 1,
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    alignItems: 'center',
    gap: 2,
  },
  statIconBox: {
    marginBottom: 3,
  },
  statValue: {
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: THEME.textSecondary,
    textAlign: 'center',
  },

  // Section Historique
  historySection: {
    marginHorizontal: 16,
    marginTop: 6,
  },
  historySectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  historyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.text,
  },
  historyCount: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.textMuted,
  },

  // Carte de trajet
  rideCard: {
    backgroundColor: THEME.card,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: THEME.border,
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  rideCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 13,
  },
  rideRoute: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 8,
  },
  routeIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: THEME.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  routeTextBox: {
    flex: 1,
  },
  routeCitiesRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  routeCity: {
    fontSize: 13.5,
    fontWeight: '700',
    color: THEME.text,
    flexShrink: 1,
  },
  rideMetaText: {
    fontSize: 11,
    color: THEME.textMuted,
    marginTop: 2,
    fontWeight: '500',
  },
  rideRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rideAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.primary,
  },
  expandIconBox: {
    padding: 2,
  },

  commissionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 13,
    paddingBottom: 10,
  },
  commissionLabel: {
    fontSize: 11,
    color: THEME.textMuted,
  },
  commissionValue: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.textSecondary,
  },

  payoutsContainer: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    backgroundColor: '#F8FAFC',
    padding: 12,
    gap: 8,
  },
  payoutsSectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  payoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  payoutLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  payoutPhone: {
    fontSize: 12,
    color: THEME.textSecondary,
    fontWeight: '500',
  },
  payoutAmt: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.text,
    minWidth: 70,
    textAlign: 'right',
  },

  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },

  // État vide
  emptyCard: {
    alignItems: 'center',
    padding: 28,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.border,
    backgroundColor: THEME.card,
    marginTop: 4,
  },
  emptyIconCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.text,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 12.5,
    color: THEME.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 260,
  },

  mainErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: THEME.dangerLight,
    borderWidth: 1,
    borderColor: THEME.dangerBorder,
    borderRadius: 10,
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  mainErrorText: {
    fontSize: 12.5,
    color: THEME.danger,
    flex: 1,
  },

  // ── MODAL STYLES ──
  modalContainer: {
    flex: 1,
    backgroundColor: THEME.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 16 : 14,
    paddingBottom: 12,
    backgroundColor: THEME.card,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.text,
  },
  modalContent: {
    padding: 18,
    paddingBottom: 40,
  },

  modalBalanceCard: {
    backgroundColor: THEME.primaryLight,
    borderWidth: 1,
    borderColor: THEME.primaryBorder,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginBottom: 20,
    gap: 4,
  },
  modalBalanceLabel: {
    fontSize: 12,
    color: THEME.textSecondary,
    fontWeight: '500',
  },
  modalBalanceAmount: {
    fontSize: 24,
    fontWeight: '800',
    color: THEME.primaryDark,
  },

  inputGroup: {
    marginBottom: 18,
  },
  inputLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    color: THEME.text,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.card,
    borderWidth: 1.5,
    borderColor: THEME.border,
    borderRadius: 12,
    height: 52,
    paddingHorizontal: 12,
  },
  amountInput: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: THEME.text,
    height: '100%',
  },
  maxPillBtn: {
    backgroundColor: THEME.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  maxPillBtnText: {
    color: THEME.primaryDark,
    fontWeight: '800',
    fontSize: 11,
  },

  percentRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  percentBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  percentBtnActive: {
    backgroundColor: THEME.primaryLight,
    borderColor: THEME.primary,
  },
  percentBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.textSecondary,
  },
  percentBtnTextActive: {
    color: THEME.primary,
    fontWeight: '700',
  },

  feedbackBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 4,
  },
  feedbackText: {
    fontSize: 12,
    color: THEME.textSecondary,
  },

  operatorSelector: {
    gap: 8,
  },
  operatorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: THEME.card,
    borderWidth: 1.5,
    borderColor: THEME.border,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  operatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  operatorCardText: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '600',
    color: THEME.text,
  },

  standardInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.card,
    borderWidth: 1.5,
    borderColor: THEME.border,
    borderRadius: 12,
    height: 52,
    paddingHorizontal: 12,
  },
  standardInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: THEME.text,
    height: '100%',
  },
  phoneHintText: {
    fontSize: 11,
    color: THEME.textMuted,
    marginTop: 5,
    paddingHorizontal: 2,
  },

  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: THEME.dangerLight,
    borderWidth: 1,
    borderColor: THEME.dangerBorder,
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  errorBannerText: {
    fontSize: 12,
    color: THEME.danger,
    flex: 1,
  },

  modalPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: THEME.primary,
    borderRadius: 13,
    paddingVertical: 14,
    marginTop: 6,
    shadowColor: THEME.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  modalBtnDisabled: {
    backgroundColor: '#CBD5E1',
    shadowOpacity: 0,
    elevation: 0,
  },
  modalPrimaryBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  modalSecondaryBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    marginTop: 6,
  },
  modalSecondaryBtnText: {
    color: THEME.textSecondary,
    fontWeight: '600',
    fontSize: 13.5,
  },

  confirmHeaderCard: {
    backgroundColor: THEME.primary,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
    gap: 4,
  },
  confirmHeaderSub: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '600',
  },
  confirmHeaderAmount: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  confirmSummaryCard: {
    backgroundColor: THEME.card,
    borderWidth: 1,
    borderColor: THEME.border,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 14,
  },
  confirmRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  confirmRowLabel: {
    fontSize: 12.5,
    color: THEME.textSecondary,
  },
  confirmRowValue: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.text,
  },

  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: THEME.accentLight,
    borderWidth: 1,
    borderColor: THEME.accentBorder,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  warningBoxText: {
    fontSize: 12,
    color: '#92400E',
    flex: 1,
    lineHeight: 17,
  },

  loadingStepBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  loadingStepTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.text,
  },
  loadingStepSub: {
    fontSize: 13,
    color: THEME.textMuted,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 18,
  },

  successStepBox: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  successIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: THEME.success,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: THEME.text,
    marginBottom: 4,
  },
  successAmount: {
    fontSize: 26,
    fontWeight: '800',
    color: THEME.primary,
    marginBottom: 6,
  },
  successSub: {
    fontSize: 13,
    color: THEME.textSecondary,
    textAlign: 'center',
    maxWidth: 290,
    lineHeight: 18,
    marginBottom: 16,
  },
  successDetailsCard: {
    width: '100%',
    backgroundColor: THEME.card,
    borderWidth: 1,
    borderColor: THEME.border,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 14,
  },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: THEME.primaryLight,
    borderWidth: 1,
    borderColor: THEME.primaryBorder,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    width: '100%',
  },
  noticeText: {
    fontSize: 12,
    color: '#1E40AF',
    flex: 1,
    lineHeight: 17,
  },
});
