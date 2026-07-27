/**
 * ==============================================================
 * Fichier :
 * earnings.tsx
 *
 * Description :
 * Onglet Revenus — permet au conducteur de voir ses gains
 * et de réclamer son paiement après un trajet terminé.
 *
 * Projet :
 * Zemy
 * ==============================================================
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../src/context/AuthContext';
import { theme } from '../../src/styles/theme';

interface Payout {
  id: string;
  status: 'pending' | 'processing' | 'paid' | 'failed';
  phone_number: string;
  requested_at: string;
  paid_at: string | null;
}

interface EarningItem {
  ride_id: string;
  departure_location: string;
  arrival_location: string;
  departure_date: string;
  confirmed_passengers: number;
  amount_due: number;
  payout: Payout | null;
}

interface Summary {
  total_earned: number;
  total_claimable: number;
  total_paid_out: number;
}

const PAYOUT_STATUS_CONFIG = {
  pending: { label: 'En attente', color: '#F59E0B', bg: '#FFFBEB', icon: 'time-outline' as const },
  processing: { label: 'En cours', color: '#3B82F6', bg: '#EFF6FF', icon: 'sync-outline' as const },
  paid: { label: 'Versé ✓', color: '#16A34A', bg: '#F0FDF4', icon: 'checkmark-circle' as const },
  failed: { label: 'Échoué', color: '#DC2626', bg: '#FEF2F2', icon: 'close-circle-outline' as const },
};

export default function EarningsScreen() {
  const { authFetch } = useAuth();
  const [earnings, setEarnings] = useState<EarningItem[]>([]);
  const [summary, setSummary] = useState<Summary>({ total_earned: 0, total_claimable: 0, total_paid_out: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [selectedRide, setSelectedRide] = useState<EarningItem | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [claiming, setClaiming] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const modalAnim = useRef(new Animated.Value(0)).current;

  const fetchEarnings = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const data = await authFetch('/driver/earnings/');
      setEarnings(data?.earnings ?? []);
      setSummary(data?.summary ?? { total_earned: 0, total_claimable: 0, total_paid_out: 0 });
    } catch (e) {
      console.error('Erreur chargement revenus:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    }
  }, [authFetch]);

  useEffect(() => {
    fetchEarnings();
  }, [fetchEarnings]);

  const openClaimModal = (item: EarningItem) => {
    setSelectedRide(item);
    setPhoneNumber('');
    setShowModal(true);
    Animated.spring(modalAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 65,
      friction: 8,
    }).start();
  };

  const closeModal = () => {
    Animated.timing(modalAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setShowModal(false);
      setSelectedRide(null);
    });
  };

  const handleClaim = async () => {
    if (!selectedRide) return;
    const cleaned = phoneNumber.replace(/\s/g, '');
    if (cleaned.length < 8) {
      Alert.alert('Numéro invalide', 'Veuillez saisir un numéro Mobile Money valide (min 8 chiffres).');
      return;
    }

    try {
      setClaiming(true);
      await authFetch('/driver/claim/', {
        method: 'POST',
        body: JSON.stringify({ ride_id: selectedRide.ride_id, phone_number: cleaned }),
      });

      closeModal();
      Alert.alert(
        '✅ Demande soumise',
        `Votre demande de virement de ${selectedRide.amount_due.toLocaleString('fr-FR')} XOF a été soumise.\n\nVous recevrez votre argent sous 24h sur le ${cleaned}.`,
        [{ text: 'OK', onPress: () => fetchEarnings(true) }]
      );
    } catch (e: any) {
      const msg = e?.message || 'Une erreur est survenue. Veuillez réessayer.';
      Alert.alert('Erreur', msg);
    } finally {
      setClaiming(false);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch { return dateStr; }
  };

  const renderItem = ({ item }: { item: EarningItem }) => {
    const hasPayout = !!item.payout;
    const payoutCfg = item.payout ? PAYOUT_STATUS_CONFIG[item.payout.status] : null;
    const isClaimable = !hasPayout;

    return (
      <Animated.View style={[styles.card, { opacity: fadeAnim }]}>
        {/* Header trajet */}
        <View style={styles.cardHeader}>
          <LinearGradient colors={['#16A34A', '#15803D']} style={styles.rideIcon}>
            <Ionicons name="car-sport" size={20} color="white" />
          </LinearGradient>
          <View style={styles.rideInfo}>
            <Text style={styles.rideRoute} numberOfLines={1}>
              {item.departure_location} → {item.arrival_location}
            </Text>
            <Text style={styles.rideDate}>{formatDate(item.departure_date)}</Text>
          </View>
          <View style={styles.amountBadge}>
            <Text style={styles.amountValue}>{item.amount_due.toLocaleString('fr-FR')} F</Text>
            <Text style={styles.amountLabel}>{item.confirmed_passengers} passager{item.confirmed_passengers > 1 ? 's' : ''}</Text>
          </View>
        </View>

        <View style={styles.cardDivider} />

        {/* Footer statut + bouton */}
        <View style={styles.cardFooter}>
          {hasPayout && payoutCfg ? (
            <View style={[styles.payoutBadge, { backgroundColor: payoutCfg.bg }]}>
              <Ionicons name={payoutCfg.icon} size={14} color={payoutCfg.color} />
              <Text style={[styles.payoutLabel, { color: payoutCfg.color }]}>{payoutCfg.label}</Text>
              {item.payout?.phone_number ? (
                <Text style={styles.payoutPhone}> · {item.payout.phone_number}</Text>
              ) : null}
            </View>
          ) : (
            <Text style={styles.claimableHint}>💰 Disponible à réclamer</Text>
          )}

          {isClaimable && (
            <TouchableOpacity
              style={styles.claimBtn}
              onPress={() => openClaimModal(item)}
              activeOpacity={0.8}
            >
              <LinearGradient colors={['#16A34A', '#15803D']} style={styles.claimBtnGrad}>
                <Ionicons name="cash-outline" size={15} color="white" />
                <Text style={styles.claimBtnText}>Réclamer</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>💰 Mes Revenus</Text>
          <Text style={styles.headerSub}>Réclamez vos gains de conducteur</Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={() => fetchEarnings(true)} activeOpacity={0.7}>
          <Ionicons name="refresh-outline" size={22} color={theme.colors.text} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#16A34A" />
          <Text style={styles.loadingText}>Chargement de vos revenus…</Text>
        </View>
      ) : (
        <>
          {/* Summary bar */}
          <LinearGradient colors={['#16A34A', '#15803D']} style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{summary.total_earned.toLocaleString('fr-FR')} F</Text>
                <Text style={styles.summaryLabel}>Total gagné</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{summary.total_claimable.toLocaleString('fr-FR')} F</Text>
                <Text style={styles.summaryLabel}>À réclamer</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{summary.total_paid_out.toLocaleString('fr-FR')} F</Text>
                <Text style={styles.summaryLabel}>Déjà versé</Text>
              </View>
            </View>
          </LinearGradient>

          {earnings.length === 0 ? (
            <View style={styles.centered}>
              <LinearGradient colors={['#F0FDF4', '#DCFCE7']} style={styles.emptyIcon}>
                <Ionicons name="cash-outline" size={48} color="#16A34A" />
              </LinearGradient>
              <Text style={styles.emptyTitle}>Aucun revenu disponible</Text>
              <Text style={styles.emptyText}>
                Vos revenus apparaîtront ici une fois{'\n'}que vous aurez terminé des trajets.
              </Text>
            </View>
          ) : (
            <FlatList
              data={earnings}
              keyExtractor={item => item.ride_id}
              renderItem={renderItem}
              contentContainerStyle={styles.list}
              showsVerticalScrollIndicator={false}
              ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
              onRefresh={() => fetchEarnings(true)}
              refreshing={refreshing}
            />
          )}
        </>
      )}

      {/* Modal de saisie du numéro */}
      <Modal visible={showModal} transparent animationType="none" onRequestClose={closeModal}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={closeModal} />
          <Animated.View
            style={[
              styles.modalContainer,
              {
                transform: [{ scale: modalAnim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }],
                opacity: modalAnim,
              },
            ]}
          >
            {/* Modal header */}
            <LinearGradient colors={['#16A34A', '#15803D']} style={styles.modalHeader}>
              <Ionicons name="cash-outline" size={32} color="white" />
              <Text style={styles.modalTitle}>Réclamer votre paiement</Text>
              {selectedRide && (
                <Text style={styles.modalSubtitle}>
                  {selectedRide.amount_due.toLocaleString('fr-FR')} FCFA
                </Text>
              )}
            </LinearGradient>

            <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
              {selectedRide && (
                <View style={styles.rideRecap}>
                  <Ionicons name="navigate-outline" size={16} color="#6B7280" />
                  <Text style={styles.rideRecapText} numberOfLines={2}>
                    {selectedRide.departure_location} → {selectedRide.arrival_location}
                  </Text>
                </View>
              )}

              <Text style={styles.inputLabel}>Numéro Mobile Money (MTN, Moov…)</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="phone-portrait-outline" size={20} color="#6B7280" style={{ marginLeft: 12 }} />
                <TextInput
                  style={styles.phoneInput}
                  placeholder="Ex: 22961000000"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="phone-pad"
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                  maxLength={20}
                  returnKeyType="done"
                  onSubmitEditing={handleClaim}
                />
              </View>

              <View style={styles.infoBox}>
                <Ionicons name="information-circle-outline" size={16} color="#3B82F6" />
                <Text style={styles.infoText}>
                  L'argent sera envoyé sur ce numéro sous 24h après validation par notre équipe.
                </Text>
              </View>

              {/* Actions */}
              <TouchableOpacity
                style={[styles.confirmBtn, (!phoneNumber.replace(/\s/g, '') || claiming) && styles.confirmBtnDisabled]}
                onPress={handleClaim}
                disabled={!phoneNumber.replace(/\s/g, '') || claiming}
                activeOpacity={0.8}
              >
                {claiming ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <>
                    <Ionicons name="send-outline" size={18} color="white" />
                    <Text style={styles.confirmBtnText}>Envoyer la demande</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.cancelBtn} onPress={closeModal}>
                <Text style={styles.cancelText}>Annuler</Text>
              </TouchableOpacity>
            </ScrollView>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#111827' },
  headerSub: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  refreshBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center', alignItems: 'center',
  },

  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32, gap: 12 },
  loadingText: { color: '#6B7280', fontSize: 14, marginTop: 12 },

  // Summary card
  summaryCard: { marginHorizontal: 16, marginTop: 16, borderRadius: 16, padding: 18 },
  summaryRow: { flexDirection: 'row', alignItems: 'center' },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  summaryLabel: { fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  summaryDivider: { width: 1, height: 36, backgroundColor: 'rgba(255,255,255,0.25)', marginHorizontal: 8 },

  // Empty state
  emptyIcon: {
    width: 96, height: 96, borderRadius: 48,
    justifyContent: 'center', alignItems: 'center', marginBottom: 8,
  },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#111827' },
  emptyText: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 20 },

  // List
  list: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32 },

  // Card
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  rideIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  rideInfo: { flex: 1, gap: 3 },
  rideRoute: { fontSize: 14, fontWeight: '700', color: '#111827' },
  rideDate: { fontSize: 12, color: '#6B7280' },
  amountBadge: { alignItems: 'flex-end', gap: 2 },
  amountValue: { fontSize: 16, fontWeight: '800', color: '#111827' },
  amountLabel: { fontSize: 11, color: '#9CA3AF' },

  cardDivider: { height: 1, backgroundColor: '#F3F4F6', marginHorizontal: 16 },

  cardFooter: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  payoutBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
  },
  payoutLabel: { fontSize: 12, fontWeight: '600' },
  payoutPhone: { fontSize: 11, color: '#6B7280' },
  claimableHint: { fontSize: 13, color: '#16A34A', fontWeight: '600' },

  claimBtn: { borderRadius: 10, overflow: 'hidden' },
  claimBtnGrad: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 9,
  },
  claimBtnText: { color: 'white', fontWeight: '700', fontSize: 13 },

  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    maxHeight: '85%',
  },
  modalHeader: {
    alignItems: 'center',
    paddingTop: 28,
    paddingBottom: 20,
    paddingHorizontal: 24,
    gap: 8,
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: 'white' },
  modalSubtitle: { fontSize: 28, fontWeight: '900', color: 'white' },

  modalBody: { paddingHorizontal: 20, paddingTop: 20 },

  rideRecap: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: '#F9FAFB',
    padding: 12, borderRadius: 10, marginBottom: 20,
  },
  rideRecapText: { flex: 1, fontSize: 13, color: '#374151', lineHeight: 18 },

  inputLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#E5E7EB',
    borderRadius: 12, backgroundColor: '#FAFAFA',
  },
  phoneInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 14,
    fontSize: 16,
    color: '#111827',
    fontWeight: '500',
  },

  infoBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: '#EFF6FF',
    padding: 12, borderRadius: 10, marginTop: 12, marginBottom: 20,
  },
  infoText: { flex: 1, fontSize: 12, color: '#2563EB', lineHeight: 17 },

  confirmBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#16A34A',
    paddingVertical: 16, borderRadius: 14, marginBottom: 10,
  },
  confirmBtnDisabled: { opacity: 0.5 },
  confirmBtnText: { color: 'white', fontWeight: '700', fontSize: 16 },

  cancelBtn: { alignItems: 'center', paddingVertical: 12, marginBottom: 16 },
  cancelText: { color: '#6B7280', fontSize: 14, fontWeight: '500' },
});
