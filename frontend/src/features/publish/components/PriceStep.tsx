import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../../../src/styles/theme';

interface PriceStepProps {
  price: string;
  priceLoading: boolean;
  priceSuggestion: any;
  estimation: any;
  localPriceText: string;
  setLocalPriceText: (text: string) => void;
  updateOverallPrice: (text: string) => void;
  priceInputFocused: boolean;
  setPriceInputFocused: (focused: boolean) => void;
  legs: any[];
  legPrices: number[];
  setLegPrices: (prices: number[]) => void;
  departure: string;
  arrival: string;
  stopovers: any[];
  seats: number;
  financialSettings: any;
}

export function PriceStep({
  price,
  priceLoading,
  priceSuggestion,
  estimation,
  localPriceText,
  setLocalPriceText,
  updateOverallPrice,
  priceInputFocused,
  setPriceInputFocused,
  legs,
  legPrices,
  setLegPrices,
  departure,
  arrival,
  stopovers,
  seats,
  financialSettings
}: PriceStepProps) {
  const priceNum = parseInt(price, 10) || 0;

  const calcCommission = (driverPayout: number) => {
    if (!financialSettings) {
      const pct = 10;
      const minC = 100;
      let commission = Math.floor(driverPayout * (pct / 100));
      if (commission < minC) commission = minC;
      return commission;
    }
    if (!financialSettings.is_commission_active) return 0;
    const pct = financialSettings.commission_percentage !== undefined ? financialSettings.commission_percentage : 10;
    const minC = financialSettings.min_commission !== undefined ? financialSettings.min_commission : 100;
    const maxC = financialSettings.max_commission;
    let commission = Math.floor(driverPayout * (pct / 100));
    if (commission < minC) commission = minC;
    if (maxC && commission > maxC) commission = maxC;
    return commission;
  };

  const commission = calcCommission(priceNum);
  const totalPassenger = priceNum + commission;
  const driverPayout = priceNum;

  return (
    <View>
      <Text style={styles.stepTitle}>Combien souhaitez-vous gagner ?</Text>
      <Text style={styles.stepSubtitle}>
        {legs.length > 1 
          ? "Fixez le prix global pour tout le trajet, puis ajustez-le par tronçon si besoin."
          : "Fixez le montant que vous souhaitez recevoir par place pour ce trajet."}
      </Text>

      {priceLoading ? (
        <Text style={styles.simpleSuggestionText}>Calcul du prix conseillé en cours...</Text>
      ) : priceSuggestion ? (
        <View style={{ marginBottom: 16 }}>
          <Text style={styles.simpleSuggestionText}>
            Prix conseillé pour ce trajet : <Text style={{ fontWeight: '800', color: theme.colors.primary }}>{priceSuggestion.suggested_price.toLocaleString()} FCFA</Text> (basé sur {estimation?.distanceKm || 0} km).
          </Text>
          <View style={styles.suggestBtnRow}>
            {[
              { label: 'Min', val: priceSuggestion.min_price },
              { label: 'Conseillé', val: priceSuggestion.suggested_price },
              { label: 'Max', val: priceSuggestion.max_price },
            ].map((item, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.suggestPresetBtn, price === String(item.val) && styles.suggestPresetBtnActive]}
                onPress={() => {
                  setLocalPriceText(String(item.val));
                  updateOverallPrice(String(item.val));
                }}
              >
                <Text style={[styles.suggestPresetLabel, price === String(item.val) && styles.suggestPresetLabelActive]}>
                  {item.label}
                </Text>
                <Text style={[styles.suggestPresetText, price === String(item.val) && styles.suggestPresetTextActive]}>
                  {item.val.toLocaleString()} F
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.priceInputCard}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={styles.priceInputLabel}>PRIX GLOBAL PAR PLACE (FCFA)</Text>
          <TouchableOpacity onPress={() => {
            setLocalPriceText('0');
            updateOverallPrice('0');
          }}>
            <Text style={{ fontSize: 11, color: theme.colors.primary, fontWeight: '700' }}>Effacer</Text>
          </TouchableOpacity>
        </View>

        <TextInput
          style={[styles.simplePriceInput, priceInputFocused && styles.simplePriceInputFocused]}
          value={localPriceText}
          onChangeText={(txt) => {
            let cleaned = txt.replace(/[^0-9]/g, '');
            if (cleaned.startsWith('0') && cleaned.length > 1) {
              cleaned = cleaned.substring(1);
            }
            const finalVal = cleaned || '0';
            setLocalPriceText(finalVal);
            updateOverallPrice(finalVal);
          }}
          keyboardType="numeric"
          placeholder="Ex : 5000"
          placeholderTextColor="#9CA3AF"
          selectTextOnFocus
          maxLength={7}
          autoFocus={true}
          onFocus={() => setPriceInputFocused(true)}
          onBlur={() => setPriceInputFocused(false)}
        />
      </View>

      {/* Adjust individual segments */}
      {legs.length > 1 && (
        <>
          <View style={{ marginTop: 24, marginBottom: 8 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: theme.colors.text }}>
              Ajuster le prix des tronçons individuels
            </Text>
            <Text style={{ fontSize: 13, color: theme.colors.textLight, marginTop: 2 }}>
              La modification d'un tronçon mettra à jour automatiquement le prix global ci-dessus.
            </Text>
          </View>

          {/* Bandeau obligatoire : prix par tronçon */}
          <View style={{ backgroundColor: '#FFF7ED', borderRadius: 12, padding: 12, marginBottom: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderWidth: 1, borderColor: '#FED7AA' }}>
            <Ionicons name="alert-circle" size={18} color="#F97316" style={{ marginTop: 2 }} />
            <Text style={{ flex: 1, fontSize: 13, color: '#92400E', fontWeight: '600', lineHeight: 18 }}>
              {'Vous avez ajouté des points d\'arrêt. Le prix de chaque tronçon est obligatoire et sera affiché au passager pour paiement.'}
            </Text>
          </View>


          <View style={styles.segmentPricesList}>
            {legs.map((leg, idx) => {
              const startCity = idx === 0 ? departure.split(',')[0].trim() : stopovers[idx - 1]?.name.split(',')[0].trim();
              const endCity = idx === legs.length - 1 ? arrival.split(',')[0].trim() : stopovers[idx]?.name.split(',')[0].trim();
              const legPrice = legPrices[idx] || 0;
              const dist = leg.distanceKm || 0;

              return (
                <View key={idx} style={styles.segmentRow}>
                  <View style={styles.segmentLeft}>
                    <View style={styles.segmentTimeline}>
                      <View style={styles.segmentDotBlue} />
                      <View style={styles.segmentLine} />
                      <View style={styles.segmentDotGreen} />
                    </View>
                    <View style={styles.segmentAddresses}>
                      <Text style={styles.segmentCityText}>
                        {startCity} ➔ {endCity}
                      </Text>
                      <Text style={{ fontSize: 12, color: theme.colors.textLight, marginTop: 2, fontWeight: '600' }}>
                        Tronçon {idx + 1} • {dist} km
                      </Text>
                    </View>
                  </View>

                  <View style={styles.segmentRight}>
                    <TouchableOpacity
                      style={styles.legPriceAdjustBtn}
                      onPress={() => {
                        const nextPrices = [...legPrices];
                        nextPrices[idx] = Math.max(0, legPrice - 500);
                        setLegPrices(nextPrices);
                      }}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="remove" size={16} color={theme.colors.primary} />
                    </TouchableOpacity>
                    <Text style={styles.legPriceValueText}>{legPrice.toLocaleString()} F</Text>
                    <TouchableOpacity
                      style={styles.legPriceAdjustBtn}
                      onPress={() => {
                        const nextPrices = [...legPrices];
                        nextPrices[idx] = legPrice + 500;
                        setLegPrices(nextPrices);
                      }}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="add" size={16} color={theme.colors.primary} />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>

          <View style={styles.totalSegmentSummaryCard}>
            <Ionicons name="wallet" size={24} color="#059669" />
            <View style={{ flex: 1 }}>
              <Text style={styles.totalSegmentSummaryText}>
                Somme totale des tronçons :
              </Text>
              <Text style={{ fontSize: 16, fontWeight: '900', color: '#059669', marginTop: 2 }}>
                {priceNum.toLocaleString()} FCFA
              </Text>
            </View>
          </View>
        </>
      )}

      {priceNum > 0 && (
        <View style={styles.totalEarningsCard}>
          <View style={styles.totalEarningsHeader}>
            <Ionicons name="wallet" size={24} color="#059669" />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.totalEarningsTitle}>VOTRE GAIN TOTAL ESTIMÉ</Text>
              <Text style={styles.totalEarningsSub}>
                Si les <Text style={{ fontWeight: '800' }}>{seats} places</Text> sont réservées ({driverPayout.toLocaleString()} F × {seats})
              </Text>
            </View>
            <Text style={styles.totalEarningsAmount}>
              {(driverPayout * seats).toLocaleString()} FCFA
            </Text>
          </View>
        </View>
      )}

      {priceNum > 0 && (
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
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  stepTitle: { fontSize: 22, fontWeight: '800', color: theme.colors.text, marginTop: 20, marginBottom: 6 },
  stepSubtitle: { fontSize: 14, color: theme.colors.textLight, marginBottom: 20, lineHeight: 20 },
  simpleSuggestionText: { fontSize: 13, color: theme.colors.textLight, marginBottom: 16, marginTop: 4, lineHeight: 18 },
  suggestBtnRow: { flexDirection: 'row', gap: 8 },
  suggestPresetBtn: { flex: 1, paddingVertical: 8, paddingHorizontal: 6, borderRadius: 12, backgroundColor: '#F8FAFC', alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  suggestPresetBtnActive: { backgroundColor: `${theme.colors.primary}15`, borderColor: theme.colors.primary },
  suggestPresetLabel: { fontSize: 10, fontWeight: '700', color: theme.colors.textLight, textTransform: 'uppercase', marginBottom: 2 },
  suggestPresetLabelActive: { color: theme.colors.primary },
  suggestPresetText: { fontSize: 13, fontWeight: '800', color: theme.colors.text },
  suggestPresetTextActive: { color: theme.colors.primary },
  priceInputCard: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 18, marginBottom: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  priceInputLabel: { fontSize: 11, fontWeight: '800', color: theme.colors.textLight, textTransform: 'uppercase', letterSpacing: 0.5 },
  simplePriceInput: { height: 52, borderWidth: 1.5, borderColor: '#CBD5E1', borderRadius: 14, paddingHorizontal: 16, fontSize: 18, fontWeight: '700', color: theme.colors.text, backgroundColor: '#F8FAFC', marginTop: 10, textAlign: 'left' },
  simplePriceInputFocused: { borderColor: theme.colors.primary, borderWidth: 2, backgroundColor: '#FFFFFF', shadowColor: theme.colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  segmentPricesList: { marginTop: 16, gap: 12 },
  segmentRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 16, padding: 16, shadowColor: '#0F172A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 10, elevation: 2 },
  segmentLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 16 },
  segmentTimeline: { alignItems: 'center', width: 16, marginRight: 12 },
  segmentDotBlue: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#0066FF' },
  segmentDotGreen: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981' },
  segmentLine: { width: 2, height: 16, backgroundColor: '#E2E8F0', marginVertical: 2 },
  segmentAddresses: { flex: 1, gap: 4 },
  segmentCityText: { fontSize: 14, fontWeight: '800', color: '#1F2937' },
  segmentRight: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 4 },
  legPriceAdjustBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
  legPriceValueText: { fontSize: 14, fontWeight: '800', color: '#1F2937', marginHorizontal: 12, minWidth: 60, textAlign: 'center' },
  totalSegmentSummaryCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#A7F3D0', borderRadius: 16, padding: 16, marginTop: 20, gap: 10 },
  totalSegmentSummaryText: { fontSize: 13, fontWeight: '700', color: '#065F46' },
  totalEarningsCard: { backgroundColor: '#ECFDF5', borderRadius: 16, padding: 16, borderWidth: 1.5, borderColor: '#A7F3D0', marginTop: 16, marginBottom: 14 },
  totalEarningsHeader: { flexDirection: 'row', alignItems: 'center' },
  totalEarningsTitle: { fontSize: 11, fontWeight: '800', color: '#065F46', letterSpacing: 0.5 },
  totalEarningsSub: { fontSize: 12, color: '#047857', marginTop: 2 },
  totalEarningsAmount: { fontSize: 20, fontWeight: '900', color: '#047857' },
  commissionCard: { backgroundColor: '#F8FAFC', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 16 },
  commissionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  commissionLabel: { flex: 1, marginRight: 8, fontSize: 14, fontWeight: '600', color: theme.colors.text },
  commissionValue: { fontSize: 15, fontWeight: '800', color: theme.colors.text },
  commissionLabelSub: { flex: 1, marginRight: 8, fontSize: 12, color: theme.colors.textLight },
  commissionValueSub: { fontSize: 13, color: theme.colors.textLight, fontWeight: '600' },
  commissionDivider: { height: 1, backgroundColor: '#E2E8F0', marginVertical: 8 },
  commissionLabelTotal: { flex: 1, marginRight: 8, fontSize: 15, fontWeight: '800', color: theme.colors.primary },
  commissionValueTotal: { fontSize: 18, fontWeight: '900', color: theme.colors.primary }
});
