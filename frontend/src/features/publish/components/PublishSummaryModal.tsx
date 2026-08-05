import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { AppBottomSheet } from '../../../../src/components/AppBottomSheet';
import { theme } from '../../../../src/styles/theme';

interface PublishSummaryModalProps {
  visible: boolean;
  onClose: () => void;
  departure: string;
  arrival: string;
  stopovers: any[];
  estimation: any;
  selectedDateObj: Date;
  time: string;
  seats: number;
  isRecurrent: boolean;
  getEstimatedRidesCount: () => number;
  price: string;
  financialSettings: any;
  music: boolean;
  chatty: boolean;
  airCond: boolean;
  luggageAllowed: boolean;
  luggageSize: string;
  luggageMaxWeightKg: string;
  luggageType: string;
  drivingRelay: boolean;
  petsAllowed: boolean;
  smoking: boolean;
  stopsAllowed: boolean;
  description: string;
  loading: boolean;
  onConfirm: () => void;
}

const formatDuration = (totalMin: number): string => {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h${m.toString().padStart(2, '0')}`;
};

export function PublishSummaryModal({
  visible,
  onClose,
  departure,
  arrival,
  stopovers,
  estimation,
  selectedDateObj,
  time,
  seats,
  isRecurrent,
  getEstimatedRidesCount,
  price,
  financialSettings,
  music,
  chatty,
  airCond,
  luggageAllowed,
  luggageSize,
  luggageMaxWeightKg,
  luggageType,
  drivingRelay,
  petsAllowed,
  smoking,
  stopsAllowed,
  description,
  loading,
  onConfirm
}: PublishSummaryModalProps) {
  const priceNum = parseInt(price, 10) || 0;
  
  const calcCommission = (totalPrice: number) => {
    if (!financialSettings) {
      const pct = 10;
      const minC = 100;
      let commission = Math.floor(totalPrice * (pct / 100));
      if (commission < minC) commission = minC;
      return commission;
    }
    if (!financialSettings.is_commission_active) return 0;
    const pct = financialSettings.commission_percentage !== undefined ? financialSettings.commission_percentage : 10;
    const minC = financialSettings.min_commission !== undefined ? financialSettings.min_commission : 100;
    const maxC = financialSettings.max_commission;
    let commission = Math.floor(totalPrice * (pct / 100));
    if (commission < minC) commission = minC;
    if (maxC && commission > maxC) commission = maxC;
    return commission;
  };

  const commission = calcCommission(priceNum);
  const totalPassenger = priceNum;
  const driverPayout = priceNum - commission;

  return (
    <AppBottomSheet
      visible={visible}
      onClose={onClose}
      snapPoints={['85%', '95%']}
      initialIndex={0}
    >
      <View style={styles.summaryModalContainer}>
        <Text style={styles.summaryModalTitle}>Récapitulatif de votre trajet</Text>
        <Text style={styles.summaryModalSubtitle}>Vérifiez les détails avant la publication officielle</Text>

        {/* 1. Itinéraire */}
        <View style={styles.summarySectionCard}>
          <View style={styles.summarySectionHeader}>
            <Ionicons name="map-outline" size={18} color={theme.colors.primary} />
            <Text style={styles.summarySectionTitle}>ITINÉRAIRE</Text>
          </View>

          <View style={styles.summaryRouteBox}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={styles.dotGreen} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, color: theme.colors.textMuted, fontWeight: '600' }}>DÉPART</Text>
                <Text style={{ fontSize: 14, fontWeight: '700', color: theme.colors.text }}>{departure}</Text>
              </View>
            </View>

            {stopovers.length > 0 && (
              <View style={{ marginVertical: 8, paddingLeft: 18 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: theme.colors.primary, marginBottom: 4 }}>
                  {stopovers.length} ville(s) / point(s) d'arrêt :
                </Text>
                {stopovers.map((s, idx) => (
                  <Text key={s.id} style={{ fontSize: 12, color: theme.colors.text, marginLeft: 8 }}>
                    • {s.name || `Étape ${idx + 1}`} ({s.stopDurationMin} min d'arrêt)
                  </Text>
                ))}
              </View>
            )}

            <View style={{ height: 1, backgroundColor: '#E2E8F0', marginVertical: 8 }} />

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={styles.dotRed} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, color: theme.colors.textMuted, fontWeight: '600' }}>ARRIVÉE</Text>
                <Text style={{ fontSize: 14, fontWeight: '700', color: theme.colors.text }}>{arrival}</Text>
              </View>
            </View>

            {estimation && (
              <View style={styles.summaryRouteMetrics}>
                <Text style={styles.summaryMetricText}>{estimation.distanceKm} km</Text>
                <Text style={styles.summaryMetricText}>
                  {formatDuration(estimation.durationMin + stopovers.reduce((sum, s) => sum + (Number(s.stopDurationMin) || 0), 0))}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* 2. Date & Places */}
        <View style={styles.summarySectionCard}>
          <View style={styles.summarySectionHeader}>
            <Ionicons name="calendar-outline" size={18} color={theme.colors.primary} />
            <Text style={styles.summarySectionTitle}>DATE & PLACES</Text>
          </View>

          <View style={styles.summaryGrid}>
            <View style={styles.summaryGridItem}>
              <Text style={styles.summaryGridLabel}>Date de départ</Text>
              <Text style={styles.summaryGridValue}>
                {selectedDateObj.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })} à {time}
              </Text>
            </View>
            <View style={styles.summaryGridItem}>
              <Text style={styles.summaryGridLabel}>Places disponibles</Text>
              <Text style={styles.summaryGridValue}>{seats} place(s)</Text>
            </View>
          </View>

          {isRecurrent && (
            <View style={styles.summaryRecurrentBadge}>
              <Ionicons name="repeat-outline" size={14} color={theme.colors.primary} />
              <Text style={styles.summaryRecurrentText}>
                Trajet récurrent : {getEstimatedRidesCount()} départ(s) programmé(s)
              </Text>
            </View>
          )}
        </View>

        {/* 3. Tarification & Payout */}
        <View style={styles.summarySectionCard}>
          <View style={styles.summarySectionHeader}>
            <Ionicons name="cash-outline" size={18} color="#059669" />
            <Text style={[styles.summarySectionTitle, { color: '#059669' }]}>TARIFICATION</Text>
          </View>

          <View style={styles.commissionCard}>
            <View style={styles.commissionRow}>
              <Text style={styles.commissionLabel}>Vous recevrez par place</Text>
              <Text style={styles.commissionValue}>{driverPayout.toLocaleString()} FCFA</Text>
            </View>
            <View style={styles.commissionRow}>
              <Text style={styles.commissionLabelSub}>Frais de service Zemy ({financialSettings?.commission_percentage ?? 10}%)</Text>
              <Text style={styles.commissionValueSub}>+{commission.toLocaleString()} FCFA</Text>
            </View>
            <View style={styles.commissionDivider} />
            <View style={styles.commissionRow}>
              <Text style={styles.commissionLabelTotal}>Le passager paiera par place</Text>
              <Text style={styles.commissionValueTotal}>{totalPassenger.toLocaleString()} FCFA</Text>
            </View>
          </View>

          <View style={styles.summaryTotalCard}>
            <View style={styles.summaryTotalHeader}>
              <Ionicons name="wallet-outline" size={18} color="#059669" />
              <Text style={styles.summaryTotalTitle}>GAIN TOTAL POTENTIEL ({seats} place{seats > 1 ? 's' : ''})</Text>
            </View>
            <Text style={styles.summaryTotalAmount}>{(driverPayout * seats).toLocaleString()} FCFA</Text>
          </View>
        </View>

        {/* 4. Préférences */}
        <View style={styles.summarySectionCard}>
          <View style={styles.summarySectionHeader}>
            <Ionicons name="options-outline" size={18} color={theme.colors.primary} />
            <Text style={styles.summarySectionTitle}>PRÉFÉRENCES</Text>
          </View>

          <View style={styles.summaryBadgesRow}>
            {music && <View style={styles.summaryChip}><Text style={styles.summaryChipText}>Musique autorisée</Text></View>}
            {chatty && <View style={styles.summaryChip}><Text style={styles.summaryChipText}>Discussion appréciée</Text></View>}
            {airCond && <View style={styles.summaryChip}><Text style={styles.summaryChipText}>Climatisation</Text></View>}
            {luggageAllowed && (
              <View style={styles.summaryChip}>
                <Text style={styles.summaryChipText}>
                  Bagages: {luggageSize === 'petit' ? 'Petit' : luggageSize === 'moyen' ? 'Moyen' : 'Grand'} ({luggageMaxWeightKg || 15}kg {luggageType === 'per_passenger' ? '/passager' : 'au total'})
                </Text>
              </View>
            )}
            {drivingRelay && <View style={styles.summaryChip}><Text style={styles.summaryChipText}>Relais conduite accepté</Text></View>}
            {petsAllowed && <View style={styles.summaryChip}><Text style={styles.summaryChipText}>Animaux acceptés</Text></View>}
            {!smoking && <View style={styles.summaryChip}><Text style={styles.summaryChipText}>Non-fumeur</Text></View>}
            {stopsAllowed && <View style={styles.summaryChip}><Text style={styles.summaryChipText}>Pauses acceptées</Text></View>}
          </View>

          {description.trim() ? (
            <View style={{ marginTop: 10, backgroundColor: '#F8FAFC', padding: 10, borderRadius: 10 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: theme.colors.textMuted }}>NOTE PASSAGERS :</Text>
              <Text style={{ fontSize: 12, color: theme.colors.text, marginTop: 2, fontStyle: 'italic' }}>"{description.trim()}"</Text>
            </View>
          ) : null}
        </View>

        {/* Action buttons */}
        <View style={styles.summaryActionsRow}>
          <TouchableOpacity
            style={styles.summaryEditBtn}
            onPress={onClose}
          >
            <Ionicons name="create-outline" size={18} color={theme.colors.text} />
            <Text style={styles.summaryEditBtnText}>Modifier</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.summaryConfirmBtn}
            onPress={onConfirm}
            disabled={loading}
          >
            <LinearGradient
              colors={[theme.colors.primary, theme.colors.primaryDark]}
              style={styles.summaryConfirmGradient}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                  <Text style={styles.summaryConfirmBtnText}>Confirmer & Publier</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </AppBottomSheet>
  );
}

const styles = StyleSheet.create({
  summaryModalContainer: { paddingBottom: 50 },
  summaryModalTitle: { fontSize: 20, fontWeight: '800', color: theme.colors.text, textAlign: 'center' },
  summaryModalSubtitle: { fontSize: 12, color: theme.colors.textMuted, textAlign: 'center', marginBottom: 16 },
  summarySectionCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
  summarySectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  summarySectionTitle: { fontSize: 11, fontWeight: '800', color: theme.colors.primary, letterSpacing: 0.5 },
  summaryRouteBox: { backgroundColor: '#F8FAFC', borderRadius: 12, padding: 12 },
  dotGreen: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#22C55E', borderWidth: 2, borderColor: '#DCFCE7' },
  dotRed: { width: 12, height: 12, borderRadius: 6, backgroundColor: theme.colors.primary, borderWidth: 2, borderColor: `${theme.colors.primary}30` },
  summaryRouteMetrics: { flexDirection: 'row', gap: 16, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#E2E8F0' },
  summaryMetricText: { fontSize: 12, fontWeight: '700', color: theme.colors.text },
  summaryGrid: { flexDirection: 'row', gap: 12 },
  summaryGridItem: { flex: 1, backgroundColor: '#F8FAFC', borderRadius: 10, padding: 10 },
  summaryGridLabel: { fontSize: 10, fontWeight: '600', color: theme.colors.textMuted, textTransform: 'uppercase' },
  summaryGridValue: { fontSize: 13, fontWeight: '700', color: theme.colors.text, marginTop: 2 },
  summaryRecurrentBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#EFF6FF', borderRadius: 8, padding: 8, marginTop: 8 },
  summaryRecurrentText: { fontSize: 12, fontWeight: '700', color: theme.colors.primary },
  summaryPriceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  summaryTotalCard: { backgroundColor: '#ECFDF5', borderRadius: 14, padding: 12, marginTop: 8, borderWidth: 1.5, borderColor: '#A7F3D0' },
  summaryTotalHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  summaryTotalTitle: { fontSize: 11, fontWeight: '800', color: '#065F46', letterSpacing: 0.5, flex: 1 },
  summaryTotalAmount: { fontSize: 22, fontWeight: '900', color: '#047857' },
  summaryBadgesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  summaryChip: { backgroundColor: '#F1F5F9', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  summaryChipText: { fontSize: 11, fontWeight: '600', color: '#334155' },
  summaryActionsRow: { flexDirection: 'row', gap: 12, marginTop: 10, marginBottom: 20 },
  summaryEditBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 14, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#CBD5E1' },
  summaryEditBtnText: { fontSize: 14, fontWeight: '700', color: theme.colors.text },
  summaryConfirmBtn: { flex: 1, borderRadius: 14, overflow: 'hidden' },
  summaryConfirmGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 },
  summaryConfirmBtnText: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  commissionCard: { backgroundColor: '#F8FAFC', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 16, width: '100%' },
  commissionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  commissionLabel: { flex: 1, marginRight: 8, fontSize: 14, fontWeight: '600', color: theme.colors.text },
  commissionValue: { fontSize: 15, fontWeight: '800', color: theme.colors.text },
  commissionLabelSub: { flex: 1, marginRight: 8, fontSize: 12, color: theme.colors.textLight },
  commissionValueSub: { fontSize: 13, color: theme.colors.textLight, fontWeight: '600' },
  commissionDivider: { height: 1, backgroundColor: '#E2E8F0', marginVertical: 8 },
  commissionLabelTotal: { flex: 1, marginRight: 8, fontSize: 15, fontWeight: '800', color: theme.colors.primary },
  commissionValueTotal: { fontSize: 18, fontWeight: '900', color: theme.colors.primary }
});
