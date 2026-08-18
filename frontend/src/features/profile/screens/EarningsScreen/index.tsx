/**
 * EarningsScreen — Écran des gains conducteur Zemy
 *
 * Affiche :
 * - Solde disponible (grand, très visible)
 * - En traitement / Déjà versé / Total gagné
 * - Bouton "Retirer mes gains"
 * - Historique par trajet avec statuts payouts
 *
 * Projet : Zemy
 */
import React, { useState, useCallback, useRef } from 'react';
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
  Alert,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import {
  fetchDriverEarnings,
  claimPayout,
  DriverEarningsResponse,
  RideEarning,
  PayoutItem,
} from '../../../../services/earnings.service';

// ---------------------------------------------------------------
// Constants
// ---------------------------------------------------------------

const COLORS = {
  primary: '#10B981',       // Vert Zemy
  primaryDark: '#059669',
  primaryLight: '#D1FAE5',
  secondary: '#F59E0B',     // Amber
  danger: '#EF4444',
  blue: '#3B82F6',
  background: '#F0FDF4',
  card: '#FFFFFF',
  text: '#111827',
  muted: '#6B7280',
  border: '#E5E7EB',
  dark: '#064E3B',
};

const OPERATORS = [
  { key: 'mtn', label: 'MTN Mobile Money', color: '#F59E0B', icon: 'phone-portrait' },
  { key: 'moov', label: 'Moov Money', color: '#3B82F6', icon: 'phone-portrait' },
  { key: 'celtiis', label: 'Celtiis Cash', color: '#8B5CF6', icon: 'phone-portrait' },
];

function formatAmount(amount: number): string {
  return amount.toLocaleString('fr-FR') + ' FCFA';
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function getPayoutStatusConfig(status: string) {
  switch (status) {
    case 'paid':
      return { label: 'Versé', color: COLORS.primary, bg: COLORS.primaryLight, icon: 'checkmark-circle' };
    case 'processing':
      return { label: 'En traitement', color: COLORS.blue, bg: '#DBEAFE', icon: 'time' };
    case 'pending':
      return { label: 'En attente', color: COLORS.secondary, bg: '#FEF3C7', icon: 'hourglass' };
    case 'failed':
      return { label: 'Échoué', color: COLORS.danger, bg: '#FEE2E2', icon: 'close-circle' };
    case 'cancelled':
      return { label: 'Annulé', color: COLORS.muted, bg: '#F3F4F6', icon: 'ban' };
    default:
      return { label: status, color: COLORS.muted, bg: '#F3F4F6', icon: 'ellipse' };
  }
}

// ---------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------

const StatCard = ({ icon, label, amount, iconColor, bg }: {
  icon: string; label: string; amount: number; iconColor: string; bg: string;
}) => (
  <View style={[styles.statCard, { backgroundColor: bg }]}>
    <View style={[styles.statIcon, { backgroundColor: iconColor + '20' }]}>
      <Ionicons name={icon as any} size={18} color={iconColor} />
    </View>
    <Text style={[styles.statAmount, { color: COLORS.text }]}>{formatAmount(amount)}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

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
  const hasPayouts = item.payouts && item.payouts.length > 0;

  return (
    <View style={styles.rideCard}>
      <TouchableOpacity
        style={styles.rideCardHeader}
        onPress={() => hasPayouts && setExpanded(!expanded)}
        activeOpacity={hasPayouts ? 0.7 : 1}
      >
        <View style={styles.rideRoute}>
          <Ionicons name="location" size={14} color={COLORS.primary} />
          <Text style={styles.rideRouteText} numberOfLines={1}>
            {item.departure_location} → {item.arrival_location}
          </Text>
        </View>
        <View style={styles.rideRight}>
          <Text style={styles.rideAmount}>+{formatAmount(item.driver_amount)}</Text>
          {hasPayouts && (
            <Ionicons
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={14}
              color={COLORS.muted}
            />
          )}
        </View>
      </TouchableOpacity>

      <View style={styles.rideCardMeta}>
        <Text style={styles.rideMeta}>{formatDate(item.departure_date)}</Text>
        <Text style={styles.rideMeta}>·</Text>
        <Text style={styles.rideMeta}>{item.bookings_count} passager(s)</Text>
        <Text style={styles.rideMeta}>·</Text>
        <Text style={styles.rideMeta}>Commission : {formatAmount(item.zemy_commission)}</Text>
      </View>

      {expanded && hasPayouts && (
        <View style={styles.payoutsContainer}>
          {item.payouts.map((p: PayoutItem) => (
            <View key={p.payout_id} style={styles.payoutRow}>
              <Ionicons name="arrow-redo" size={13} color={COLORS.muted} />
              <Text style={styles.payoutAmt}>{formatAmount(p.amount)}</Text>
              <Text style={styles.payoutPhone}>{p.phone_number}</Text>
              <PayoutBadge status={p.status} />
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

// ---------------------------------------------------------------
// WithdrawModal
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
  const [result, setResult] = useState<any>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const handleClose = () => {
    setStep('form');
    setAmount('');
    setPhone('');
    setOperator('mtn');
    setError('');
    setResult(null);
    onClose();
  };

  const handleContinue = () => {
    setError('');
    const amtNum = parseInt(amount.replace(/\s/g, ''), 10);
    if (!amount || isNaN(amtNum) || amtNum <= 0) {
      setError('Veuillez entrer un montant valide.');
      return;
    }
    if (amtNum > availableBalance) {
      setError(`Le montant dépasse votre solde disponible (${formatAmount(availableBalance)}).`);
      return;
    }
    if (!phone || phone.trim().length < 8) {
      setError('Veuillez entrer un numéro Mobile Money valide.');
      return;
    }
    setStep('confirm');
  };

  const handleConfirm = async () => {
    setStep('loading');
    try {
      const amtNum = parseInt(amount.replace(/\s/g, ''), 10);
      const res = await claimPayout({
        amount: amtNum,
        phone_number: phone.trim(),
        operator,
      });
      setResult(res);
      setStep('success');
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    } catch (e: any) {
      setStep('form');
      setError(e.message || 'Une erreur est survenue. Veuillez réessayer.');
    }
  };

  const handleSuccessDone = () => {
    handleClose();
    onSuccess();
  };

  const amtNum = parseInt(amount.replace(/\s/g, ''), 10) || 0;
  const selectedOp = OPERATORS.find(o => o.key === operator)!;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <KeyboardAvoidingView style={styles.modalContainer} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Header */}
        <View style={styles.modalHeader}>
          {step !== 'success' && step !== 'loading' && (
            <TouchableOpacity onPress={step === 'confirm' ? () => setStep('form') : handleClose} style={styles.modalBack}>
              <Ionicons name={step === 'confirm' ? 'arrow-back' : 'close'} size={22} color={COLORS.text} />
            </TouchableOpacity>
          )}
          <Text style={styles.modalTitle}>
            {step === 'form' ? 'Retirer mes gains' :
             step === 'confirm' ? 'Confirmation' :
             step === 'loading' ? 'Traitement...' : 'Retrait soumis !'}
          </Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalContent}>

          {/* FORM */}
          {step === 'form' && (
            <>
              {/* Solde disponible */}
              <View style={styles.balanceCard}>
                <Ionicons name="wallet" size={28} color={COLORS.primary} />
                <Text style={styles.balanceCardLabel}>Solde disponible</Text>
                <Text style={styles.balanceCardAmount}>{formatAmount(availableBalance)}</Text>
              </View>

              {/* Montant */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Montant à retirer (FCFA)</Text>
                <View style={styles.inputRow}>
                  <TextInput
                    style={styles.input}
                    value={amount}
                    onChangeText={setAmount}
                    keyboardType="numeric"
                    placeholder="Ex: 5 000"
                    placeholderTextColor={COLORS.muted}
                  />
                  <TouchableOpacity
                    style={styles.maxBtn}
                    onPress={() => setAmount(String(availableBalance))}
                  >
                    <Text style={styles.maxBtnText}>MAX</Text>
                  </TouchableOpacity>
                </View>

                {/* Boutons rapides de pourcentage */}
                <View style={styles.percentRow}>
                  {[0.25, 0.50, 0.75, 1.0].map((percent) => {
                    const pctValue = Math.floor(availableBalance * percent);
                    return (
                      <TouchableOpacity
                        key={percent}
                        style={styles.percentBtn}
                        onPress={() => setAmount(String(pctValue))}
                      >
                        <Text style={styles.percentBtnText}>{percent * 100}%</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {amtNum > 0 && amtNum <= availableBalance ? (
                  <View style={styles.dynamicFeedback}>
                    <Text style={styles.feedbackText}>
                      Vous recevrez : <Text style={{fontWeight: '700', color: COLORS.primaryDark}}>{formatAmount(amtNum)}</Text>
                    </Text>
                    <Text style={styles.feedbackText}>
                      Solde restant : <Text style={{fontWeight: '700'}}>{formatAmount(availableBalance - amtNum)}</Text>
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* Numéro Mobile Money */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Numéro Mobile Money</Text>
                <TextInput
                  style={styles.input}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  placeholder="Ex: 97 XX XX XX"
                  placeholderTextColor={COLORS.muted}
                />
              </View>

              {/* Opérateur */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Opérateur</Text>
                <View style={styles.operatorGrid}>
                  {OPERATORS.map(op => (
                    <TouchableOpacity
                      key={op.key}
                      style={[
                        styles.operatorBtn,
                        operator === op.key && { borderColor: op.color, backgroundColor: op.color + '15' }
                      ]}
                      onPress={() => setOperator(op.key as any)}
                    >
                      <View style={[styles.operatorDot, { backgroundColor: op.color }]} />
                      <Text style={[
                        styles.operatorLabel,
                        operator === op.key && { color: op.color, fontWeight: '700' }
                      ]}>
                        {op.label}
                      </Text>
                      {operator === op.key && <Ionicons name="checkmark-circle" size={16} color={op.color} />}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {error ? (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle" size={16} color={COLORS.danger} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <TouchableOpacity
                style={[
                  styles.primaryBtn,
                  (!amount || amtNum <= 0 || amtNum > availableBalance) && { opacity: 0.5 }
                ]}
                onPress={handleContinue}
                disabled={!amount || amtNum <= 0 || amtNum > availableBalance}
              >
                <Ionicons name="arrow-forward-circle" size={20} color="#FFF" />
                <Text style={styles.primaryBtnText}>Continuer</Text>
              </TouchableOpacity>
            </>
          )}

          {/* CONFIRM */}
          {step === 'confirm' && (
            <>
              <View style={styles.confirmCard}>
                <Text style={styles.confirmLabel}>Montant à retirer</Text>
                <Text style={styles.confirmAmount}>{formatAmount(amtNum)}</Text>
              </View>

              <View style={styles.confirmDetails}>
                {[
                  { label: 'Vers le numéro', value: phone },
                  { label: 'Opérateur', value: selectedOp.label },
                  { label: 'Solde restant', value: formatAmount(availableBalance - amtNum) },
                ].map(row => (
                  <View key={row.label} style={styles.confirmRow}>
                    <Text style={styles.confirmRowLabel}>{row.label}</Text>
                    <Text style={styles.confirmRowValue}>{row.value}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.warningBox}>
                <Ionicons name="information-circle" size={16} color={COLORS.secondary} />
                <Text style={styles.warningText}>
                  Vérifiez bien le numéro avant de confirmer. Le montant sera envoyé sur ce numéro.
                </Text>
              </View>

              <TouchableOpacity style={styles.primaryBtn} onPress={handleConfirm}>
                <Ionicons name="checkmark-circle" size={20} color="#FFF" />
                <Text style={styles.primaryBtnText}>Confirmer le retrait</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.ghostBtn} onPress={() => setStep('form')}>
                <Text style={styles.ghostBtnText}>Modifier</Text>
              </TouchableOpacity>
            </>
          )}

          {/* LOADING */}
          {step === 'loading' && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.loadingText}>Traitement de votre demande...</Text>
              <Text style={styles.loadingSubtext}>Cela ne prendra que quelques secondes.</Text>
            </View>
          )}

          {/* SUCCESS */}
          {step === 'success' && result && (
            <Animated.View style={[styles.successContainer, { opacity: fadeAnim }]}>
              <View style={styles.successIcon}>
                <Ionicons name="checkmark-circle" size={64} color={COLORS.primary} />
              </View>
              <Text style={styles.successTitle}>Demande soumise !</Text>
              <Text style={styles.successSub}>
                Votre retrait de{' '}
                <Text style={{ fontWeight: '700', color: COLORS.primary }}>
                  {formatAmount(result.amount)}
                </Text>{' '}
                a été soumis avec succès.
              </Text>

              <View style={styles.successDetails}>
                <View style={styles.confirmRow}>
                  <Text style={styles.confirmRowLabel}>Référence</Text>
                  <Text style={[styles.confirmRowValue, { fontFamily: 'monospace', fontSize: 11 }]}>
                    {result.payout_reference}
                  </Text>
                </View>
                <View style={styles.confirmRow}>
                  <Text style={styles.confirmRowLabel}>Mode</Text>
                  <Text style={styles.confirmRowValue}>
                    {result.payment_mode === 'automatic' ? '⚡ Automatique' : '👤 Manuel'}
                  </Text>
                </View>
                <View style={styles.confirmRow}>
                  <Text style={styles.confirmRowLabel}>Statut</Text>
                  <PayoutBadge status={result.status} />
                </View>
              </View>

              <Text style={styles.successNote}>
                {result.payment_mode === 'automatic'
                  ? 'Le virement est en cours. Vous recevrez une notification dès la confirmation.'
                  : 'Notre équipe traitera votre demande dans les plus brefs délais.'}
              </Text>

              <TouchableOpacity style={styles.primaryBtn} onPress={handleSuccessDone}>
                <Text style={styles.primaryBtnText}>Terminer</Text>
              </TouchableOpacity>
            </Animated.View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ---------------------------------------------------------------
// Main Screen
// ---------------------------------------------------------------

export default function EarningsScreen() {
  const [data, setData] = useState<DriverEarningsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    try {
      setError('');
      const res = await fetchDriverEarnings();
      setData(res);
    } catch (e: any) {
      setError(e.message || 'Impossible de charger vos gains.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    loadData();
  }, [loadData]));

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const summary = data?.summary;
  const history = data?.history || [];
  const available = summary?.available_balance || 0;

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Chargement de vos gains...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
        }
        contentContainerStyle={styles.scrollContent}
      >
        {/* Hero — Solde disponible */}
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <Text style={styles.heroLabel}>Solde disponible</Text>
            <Ionicons name="wallet-outline" size={20} color="rgba(255,255,255,0.7)" />
          </View>
          <Text style={styles.heroAmount}>{formatAmount(available)}</Text>

          <TouchableOpacity
            style={[
              styles.withdrawBtn,
              available <= 0 && styles.withdrawBtnDisabled
            ]}
            onPress={() => available > 0 && setShowWithdraw(true)}
            activeOpacity={available > 0 ? 0.8 : 1}
          >
            <Ionicons name="arrow-up-circle" size={20} color={available > 0 ? COLORS.primary : COLORS.muted} />
            <Text style={[
              styles.withdrawBtnText,
              available <= 0 && { color: COLORS.muted }
            ]}>
              {available > 0 ? 'Retirer mes gains' : 'Aucun gain disponible'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Stats cards */}
        {summary && (
          <View style={styles.statsRow}>
            <StatCard
              icon="time-outline"
              label="En traitement"
              amount={summary.in_processing}
              iconColor={COLORS.secondary}
              bg="#FFFBEB"
            />
            <StatCard
              icon="checkmark-done"
              label="Déjà versé"
              amount={summary.already_paid}
              iconColor={COLORS.primary}
              bg={COLORS.primaryLight}
            />
            <StatCard
              icon="trending-up"
              label="Total gagné"
              amount={summary.driver_amount}
              iconColor={COLORS.blue}
              bg="#EFF6FF"
            />
          </View>
        )}

        {/* Erreur */}
        {error ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={16} color={COLORS.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Historique */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Historique des gains</Text>
          {history.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={48} color={COLORS.border} />
              <Text style={styles.emptyTitle}>Aucun gain pour l'instant</Text>
              <Text style={styles.emptySubtitle}>
                Vos gains apparaîtront ici une fois que vos trajets seront terminés.
              </Text>
            </View>
          ) : (
            history.map((item: RideEarning) => (
              <RideEarningCard key={item.ride_id} item={item} />
            ))
          )}
        </View>
      </ScrollView>

      {/* Modal de retrait */}
      <WithdrawModal
        visible={showWithdraw}
        availableBalance={available}
        onClose={() => setShowWithdraw(false)}
        onSuccess={() => {
          setShowWithdraw(false);
          loadData();
        }}
      />
    </View>
  );
}

// ---------------------------------------------------------------
// Styles
// ---------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: COLORS.background,
  },

  // Hero
  heroCard: {
    margin: 16,
    borderRadius: 20,
    padding: 24,
    backgroundColor: COLORS.primaryDark,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  heroLabel: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 14,
    fontWeight: '500',
  },
  heroAmount: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 20,
  },
  withdrawBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 13,
  },
  withdrawBtnDisabled: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  withdrawBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.primary,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    gap: 8,
    marginBottom: 8,
  },
  statCard: {
    flex: 1,
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    gap: 4,
  },
  statIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  statAmount: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  statLabel: {
    fontSize: 10,
    color: COLORS.muted,
    textAlign: 'center',
  },

  // Section
  section: {
    margin: 16,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 12,
  },

  // Ride card
  rideCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    marginBottom: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  rideCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  rideRoute: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  rideRouteText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    flex: 1,
  },
  rideRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rideAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
  },
  rideCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  rideMeta: {
    fontSize: 11,
    color: COLORS.muted,
  },
  payoutsContainer: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    padding: 12,
    gap: 8,
  },
  payoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  payoutAmt: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
    minWidth: 80,
  },
  payoutPhone: {
    fontSize: 11,
    color: COLORS.muted,
    flex: 1,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    padding: 32,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.muted,
  },
  emptySubtitle: {
    fontSize: 13,
    color: COLORS.muted,
    textAlign: 'center',
    lineHeight: 18,
  },

  // Error / Info boxes
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FEE2E2',
    borderRadius: 10,
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 13,
    color: COLORS.danger,
    flex: 1,
    lineHeight: 18,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FEF3C7',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  warningText: {
    fontSize: 12,
    color: '#92400E',
    flex: 1,
    lineHeight: 17,
  },

  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 20 : 16,
    paddingBottom: 12,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalBack: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
  },
  modalContent: {
    padding: 20,
    paddingBottom: 40,
  },

  // Balance card in modal
  balanceCard: {
    backgroundColor: COLORS.primaryDark,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    gap: 6,
    marginBottom: 24,
  },
  balanceCardLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
  },
  balanceCardAmount: {
    color: '#FFF',
    fontSize: 28,
    fontWeight: '800',
  },

  // Form elements
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  maxBtn: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  maxBtnText: {
    color: COLORS.primaryDark,
    fontWeight: '800',
    fontSize: 12,
  },
  inputHint: {
    marginTop: 6,
    fontSize: 12,
    color: COLORS.muted,
  },

  // Operator
  operatorGrid: {
    gap: 8,
  },
  operatorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.card,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 13,
  },
  operatorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  operatorLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },

  // Buttons
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 15,
    marginBottom: 10,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 16,
  },
  ghostBtn: {
    alignItems: 'center',
    padding: 12,
  },
  ghostBtnText: {
    color: COLORS.muted,
    fontWeight: '600',
    fontSize: 14,
  },

  // Confirm
  confirmCard: {
    backgroundColor: COLORS.primaryDark,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  confirmLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    marginBottom: 4,
  },
  confirmAmount: {
    color: '#FFF',
    fontSize: 32,
    fontWeight: '800',
  },
  confirmDetails: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    marginBottom: 16,
    overflow: 'hidden',
  },
  confirmRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  confirmRowLabel: {
    fontSize: 13,
    color: COLORS.muted,
  },
  confirmRowValue: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    gap: 16,
    minHeight: 300,
  },
  loadingText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
    textAlign: 'center',
  },
  loadingSubtext: {
    fontSize: 13,
    color: COLORS.muted,
    textAlign: 'center',
  },

  // Success
  successContainer: {
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  successIcon: {
    marginBottom: 8,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.text,
  },
  successSub: {
    fontSize: 14,
    color: COLORS.muted,
    textAlign: 'center',
    lineHeight: 20,
  },
  successDetails: {
    width: '100%',
    backgroundColor: COLORS.card,
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 8,
  },
  successNote: {
    fontSize: 12,
    color: COLORS.muted,
    textAlign: 'center',
    lineHeight: 17,
    paddingHorizontal: 16,
  },
  percentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    gap: 8,
  },
  percentBtn: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  percentBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.muted,
  },
  dynamicFeedback: {
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    gap: 4,
  },
  feedbackText: {
    fontSize: 13,
    color: '#1E40AF',
  },
});
