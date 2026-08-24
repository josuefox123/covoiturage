import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
} from 'react-native';
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

const normalizeText = (value: string = '') =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

const getPlaceName = (value: string = '') => {
  if (!value) return '';
  return value.split(',')[0].trim();
};

const samePlace = (a: string, b: string) => {
  return normalizeText(getPlaceName(a)) === normalizeText(getPlaceName(b));
};

const formatDistance = (distance: number) => {
  if (!Number.isFinite(distance)) return '0 km';

  if (distance < 1) {
    return `${Math.round(distance * 1000)} m`;
  }

  return `${distance.toLocaleString('fr-FR', {
    maximumFractionDigits: 1,
  })} km`;
};

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
  financialSettings,
}: PriceStepProps) {
  const priceNum = Math.max(0, parseInt(price, 10) || 0);

  /**
   * ---------------------------------------------------------
   * COMMISSION
   * ---------------------------------------------------------
   */

  const calcCommission = (driverPayout: number) => {
    if (driverPayout <= 0) return 0;

    if (!financialSettings) {
      const pct = 10;
      const minC = 100;

      let commission = Math.floor(driverPayout * (pct / 100));

      if (commission < minC) {
        commission = minC;
      }

      return commission;
    }

    if (!financialSettings.is_commission_active) {
      return 0;
    }

    const pct =
      financialSettings.commission_percentage !== undefined
        ? Number(financialSettings.commission_percentage)
        : 10;

    const minC =
      financialSettings.min_commission !== undefined
        ? Number(financialSettings.min_commission)
        : 100;

    const maxC =
      financialSettings.max_commission !== undefined
        ? Number(financialSettings.max_commission)
        : null;

    let commission = Math.floor(driverPayout * (pct / 100));

    if (commission < minC) {
      commission = minC;
    }

    if (maxC !== null && commission > maxC) {
      commission = maxC;
    }

    return commission;
  };

  const commission = calcCommission(priceNum);
  const totalPassenger = priceNum + commission;

  /**
   * ---------------------------------------------------------
   * SOURCE DE VÉRITÉ : LES LEGS GOOGLE
   *
   * Les legs retournés par Google DirectionsService sont
   * TOUJOURS dans l'ordre géographique correct :
   *
   *   legs[0] : Départ → Arrêt 1
   *   legs[1] : Arrêt 1 → Arrêt 2
   *   ...
   *   legs[N] : Arrêt N → Arrivée
   *
   * On utilise directement leg.startName / leg.endName
   * fournis par getRouteLegs() dans publish.tsx.
   * On ne reconstruit JAMAIS l'ordre depuis stopovers.
   * ---------------------------------------------------------
   */

  const cleanLegs = useMemo(() => {
    // -------------------------------------------------------
    // CAS 1 : Google a fourni plusieurs legs (avec stopovers)
    // On utilise directement startName/endName des legs Google
    // -------------------------------------------------------
    if (legs && legs.length > 1) {
      return legs
        .map((leg: any) => {
          const startName =
            leg.startName ||
            getPlaceName(leg.start_address || leg.startAddress || '');
          const endName =
            leg.endName ||
            getPlaceName(leg.end_address || leg.endAddress || '');

          if (!startName || !endName) return null;
          if (samePlace(startName, endName)) return null;

          return {
            ...leg,
            startName,
            endName,
            distanceKm: Number(leg.distanceKm || 0),
          };
        })
        .filter(Boolean);
    }

    // -------------------------------------------------------
    // CAS 2 : Fallback — construire les tronçons depuis stopovers
    // Utilisé quand Google n'a pas encore recalculé avec les waypoints,
    // ou quand les legs ne contiennent pas les adresses intermédiaires.
    // -------------------------------------------------------
    if (!stopovers || stopovers.length === 0) return [];

    // Build ordered stops (deduplicated, no dep/arr)
    const seen = new Set<string>();
    const validStops: any[] = [];
    for (const stop of stopovers) {
      if (!stop?.name) continue;
      const n = normalizeText(getPlaceName(stop.name));
      if (samePlace(stop.name, departure)) continue;
      if (samePlace(stop.name, arrival)) continue;
      if (seen.has(n)) continue;
      seen.add(n);
      validStops.push(stop);
    }

    if (validStops.length === 0) return [];

    // Build route points: dep → stops... → arr
    const points = [
      departure,
      ...validStops.map((s: any) => s.name),
      arrival,
    ].filter(Boolean);

    // Build legs from consecutive points
    const result: any[] = [];
    for (let i = 0; i < points.length - 1; i++) {
      const start = points[i];
      const end = points[i + 1];
      if (!start || !end || samePlace(start, end)) continue;
      result.push({
        startName: getPlaceName(start),
        endName: getPlaceName(end),
        distanceKm: 0,
      });
    }
    return result;
  }, [legs, stopovers, departure, arrival]);

  /**
   * Points de passage dans l'ordre Google pour l'affichage visuel.
   * Construit à partir des legs — jamais depuis stopovers.
   */
  const routePoints = useMemo(() => {
    if (cleanLegs.length === 0) {
      // Fallback: just departure → arrival
      const pts: string[] = [];
      if (departure) pts.push(departure);
      if (arrival) pts.push(arrival);
      return pts;
    }

    const pts: string[] = [];
    cleanLegs.forEach((leg: any, idx: number) => {
      if (idx === 0) pts.push(leg.startName);
      pts.push(leg.endName);
    });

    // Remove consecutive duplicates
    return pts.filter((p, i, arr) =>
      i === 0 || !samePlace(p, arr[i - 1])
    );
  }, [cleanLegs, departure, arrival]);


  /**
   * ---------------------------------------------------------
   * SYNCHRONISATION DES PRIX DES TRONÇONS
   *
   * On garde le prix existant lorsqu'il existe.
   * On ne recrée pas inutilement les valeurs.
   * ---------------------------------------------------------
   */

  const safeLegPrices = useMemo(() => {
    return cleanLegs.map((_, index) => {
      const value = Number(legPrices?.[index]);

      if (!Number.isFinite(value) || value < 0) {
        return 0;
      }

      return Math.round(value);
    });
  }, [cleanLegs, legPrices]);

  /**
   * ---------------------------------------------------------
   * SOMME DES TRONÇONS
   * ---------------------------------------------------------
   */

  const totalLegPrices = useMemo(() => {
    return safeLegPrices.reduce(
      (sum, value) => sum + value,
      0
    );
  }, [safeLegPrices]);

  /**
   * ---------------------------------------------------------
   * PRIX AU FRANC PRÈS
   * ---------------------------------------------------------
   */

  const changeLegPrice = (index: number, delta: number) => {
    const nextPrices = [...safeLegPrices];

    const current = nextPrices[index] || 0;

    nextPrices[index] = Math.max(
      0,
      Math.round(current + delta)
    );

    setLegPrices(nextPrices);
  };

  const setLegPriceDirectly = (
    index: number,
    value: string
  ) => {
    const cleaned = value.replace(/[^0-9]/g, '');

    const amount = cleaned
      ? Math.max(0, parseInt(cleaned, 10))
      : 0;

    const nextPrices = [...safeLegPrices];

    nextPrices[index] = amount;

    setLegPrices(nextPrices);
  };

  /**
   * ---------------------------------------------------------
   * PRIX GLOBAL
   * ---------------------------------------------------------
   */

  const handleGlobalPriceChange = (txt: string) => {
    const cleaned = txt.replace(/[^0-9]/g, '');

    const value = cleaned || '0';

    setLocalPriceText(value);
    updateOverallPrice(value);
  };

  return (
    <View>
      {/* HEADER */}
      <Text style={styles.stepTitle}>
        Combien souhaitez-vous gagner ?
      </Text>

      <Text style={styles.stepSubtitle}>
        Définissez le montant que vous souhaitez recevoir par
        place. Zemy calculera automatiquement les frais de
        service pour le passager.
      </Text>

      {/* SUGGESTION GOOGLE / BACKEND */}
      {priceLoading ? (
        <View style={styles.loadingCard}>
          <Ionicons
            name="sparkles-outline"
            size={18}
            color={theme.colors.primary}
          />

          <Text style={styles.loadingText}>
            Calcul du prix conseillé...
          </Text>
        </View>
      ) : priceSuggestion ? (
        <View style={styles.suggestionCard}>
          <View style={styles.suggestionHeader}>
            <View style={styles.suggestionIcon}>
              <Ionicons
                name="bulb-outline"
                size={18}
                color={theme.colors.primary}
              />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.suggestionTitle}>
                Prix conseillé
              </Text>

              <Text style={styles.suggestionDescription}>
                Basé sur environ{' '}
                {estimation?.distanceKm || 0} km
              </Text>
            </View>
          </View>

          <Text style={styles.suggestionAmount}>
            {Number(
              priceSuggestion.suggested_price || 0
            ).toLocaleString('fr-FR')}{' '}
            FCFA
          </Text>

          <View style={styles.suggestBtnRow}>
            {[
              {
                label: 'Minimum',
                val: Number(priceSuggestion.min_price || 0),
              },
              {
                label: 'Conseillé',
                val: Number(
                  priceSuggestion.suggested_price || 0
                ),
              },
              {
                label: 'Maximum',
                val: Number(priceSuggestion.max_price || 0),
              },
            ].map(item => {
              const active = price === String(item.val);

              return (
                <TouchableOpacity
                  key={item.label}
                  style={[
                    styles.suggestPresetBtn,
                    active &&
                      styles.suggestPresetBtnActive,
                  ]}
                  onPress={() => {
                    const value = String(item.val);

                    setLocalPriceText(value);
                    updateOverallPrice(value);
                  }}
                >
                  <Text
                    style={[
                      styles.suggestPresetLabel,
                      active &&
                        styles.suggestPresetLabelActive,
                    ]}
                  >
                    {item.label}
                  </Text>

                  <Text
                    style={[
                      styles.suggestPresetText,
                      active &&
                        styles.suggestPresetTextActive,
                    ]}
                  >
                    {item.val.toLocaleString('fr-FR')} F
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ) : null}

      {/* PRIX GLOBAL / PORTIONS */}
      {cleanLegs.length > 1 ? (
        /* Case: Trajet avec arrêts - Portions d'abord */
        <View style={styles.segmentsSection}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIcon}>
              <Ionicons
                name="git-branch-outline"
                size={18}
                color={theme.colors.primary}
              />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>
                Prix par portion de trajet
              </Text>

              <Text style={styles.sectionSubtitle}>
                Définissez le prix pour chaque portion. Le prix total du voyage sera calculé automatiquement.
              </Text>
            </View>
          </View>

          <View style={styles.routeOrderCard}>
            {routePoints.map((point, index) => (
              <View
                key={`${point}-${index}`}
                style={styles.routePoint}
              >
                <View
                  style={[
                    styles.routePointDot,
                    index === 0 &&
                      styles.routePointStart,
                    index === routePoints.length - 1 &&
                      styles.routePointEnd,
                  ]}
                />

                <Text
                  style={[
                    styles.routePointText,
                    index === 0 &&
                      styles.routePointStrong,
                    index === routePoints.length - 1 &&
                      styles.routePointStrong,
                  ]}
                  numberOfLines={1}
                >
                  {getPlaceName(point)}
                </Text>

                {index < routePoints.length - 1 && (
                  <Ionicons
                    name="arrow-down"
                    size={14}
                    color="#CBD5E1"
                    style={styles.routeArrow}
                  />
                )}
              </View>
            ))}
          </View>

          <View style={styles.segmentPricesList}>
            {cleanLegs.map((leg, idx) => {
              const legPrice = safeLegPrices[idx] || 0;

              return (
                <View
                  key={`leg-${idx}-${leg.startName}-${leg.endName}`}
                  style={styles.segmentRow}
                >
                  <View style={styles.segmentLeft}>
                    <View style={styles.segmentTimeline}>
                      <View style={styles.segmentDotStart} />
                      <View style={styles.segmentLine} />
                      <View style={styles.segmentDotEnd} />
                    </View>

                    <View style={styles.segmentAddresses}>
                      <Text style={styles.segmentCityText} numberOfLines={1}>
                        {leg.startName}
                      </Text>

                      <View style={styles.segmentArrowRow}>
                        <Ionicons
                          name="arrow-forward"
                          size={13}
                          color={theme.colors.primary}
                        />

                        <Text style={styles.segmentDestination} numberOfLines={1}>
                          {leg.endName}
                        </Text>
                      </View>

                      <Text style={styles.segmentDistance}>
                        {formatDistance(leg.distanceKm)}
                      </Text>
                    </View>
                  </View>

                  {/* PRIX AU FRANC PRÈS */}
                  <View style={styles.segmentPriceBox}>
                    <TouchableOpacity
                      style={styles.legPriceAdjustBtn}
                      onPress={() => changeLegPrice(idx, -100)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="remove" size={16} color={theme.colors.primary} />
                    </TouchableOpacity>

                    <TextInput
                      value={String(legPrice)}
                      onChangeText={value => setLegPriceDirectly(idx, value)}
                      keyboardType="numeric"
                      style={styles.legPriceInput}
                      selectTextOnFocus
                    />

                    <Text style={styles.legPriceCurrency}>F</Text>

                    <TouchableOpacity
                      style={styles.legPriceAdjustBtn}
                      onPress={() => changeLegPrice(idx, 100)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="add" size={16} color={theme.colors.primary} />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>

          {/* TOTAL */}
          <View style={styles.totalSegmentSummaryCard}>
            <View style={styles.totalWalletIcon}>
              <Ionicons
                name="wallet-outline"
                size={20}
                color="#059669"
              />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.totalSegmentSummaryText}>
                Prix total du voyage (somme des portions)
              </Text>

              <Text style={styles.totalSegmentSummaryAmount}>
                {totalLegPrices.toLocaleString('fr-FR')} FCFA
              </Text>
            </View>
          </View>
        </View>
      ) : (
        /* Case: Trajet direct sans arrêts */
        <View style={styles.priceInputCard}>
          <View style={styles.priceHeader}>
            <View>
              <Text style={styles.priceInputLabel}>
                VOTRE GAIN PAR PLACE
              </Text>

              <Text style={styles.priceHint}>
                Montant reçu par le conducteur
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => {
                setLocalPriceText('0');
                updateOverallPrice('0');
              }}
            >
              <Text style={styles.clearText}>Effacer</Text>
            </TouchableOpacity>
          </View>

          <View
            style={[
              styles.priceInputWrapper,
              priceInputFocused && styles.priceInputWrapperFocused,
            ]}
          >
            <TextInput
              style={styles.simplePriceInput}
              value={localPriceText}
              onChangeText={handleGlobalPriceChange}
              keyboardType="numeric"
              placeholder="Ex : 5000"
              placeholderTextColor="#94A3B8"
              selectTextOnFocus
              maxLength={8}
              autoFocus={false}
              onFocus={() => setPriceInputFocused(true)}
              onBlur={() => setPriceInputFocused(false)}
            />

            <Text style={styles.currencyText}>FCFA</Text>
          </View>
        </View>
      )}

      {/* GAIN TOTAL */}
      {priceNum > 0 && (
        <>
          <View style={styles.totalEarningsCard}>
            <View style={styles.totalEarningsIcon}>
              <Ionicons
                name="wallet"
                size={22}
                color="#059669"
              />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.totalEarningsTitle}>
                VOTRE GAIN POTENTIEL
              </Text>

              <Text style={styles.totalEarningsSub}>
                {priceNum.toLocaleString(
                  'fr-FR'
                )}{' '}
                F × {seats} places
              </Text>
            </View>

            <Text
              style={styles.totalEarningsAmount}
            >
              {(priceNum * seats).toLocaleString(
                'fr-FR'
              )}{' '}
              F
            </Text>
          </View>

          {/* COMMISSION */}
          <View style={styles.commissionCard}>
            <View style={styles.commissionRow}>
              <Text style={styles.commissionLabel}>
                Votre gain par place
              </Text>

              <Text
                style={styles.commissionValue}
              >
                {priceNum.toLocaleString(
                  'fr-FR'
                )}{' '}
                F
              </Text>
            </View>

            <View style={styles.commissionRow}>
              <Text
                style={styles.commissionLabelSub}
              >
                Frais de service Zemy (
                {financialSettings
                  ?.commission_percentage ??
                  10}
                %)
              </Text>

              <Text
                style={styles.commissionValueSub}
              >
                +{commission.toLocaleString(
                  'fr-FR'
                )}{' '}
                F
              </Text>
            </View>

            <View
              style={styles.commissionDivider}
            />

            <View style={styles.commissionRow}>
              <Text
                style={styles.commissionLabelTotal}
              >
                Le passager paiera
              </Text>

              <Text
                style={styles.commissionValueTotal}
              >
                {totalPassenger.toLocaleString(
                  'fr-FR'
                )}{' '}
                F
              </Text>
            </View>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  stepTitle: {
    fontSize: 23,
    fontWeight: '800',
    color: theme.colors.text,
    marginTop: 20,
    marginBottom: 6,
  },

  stepSubtitle: {
    fontSize: 14,
    color: theme.colors.textLight,
    marginBottom: 20,
    lineHeight: 21,
  },

  loadingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },

  loadingText: {
    fontSize: 13,
    color: theme.colors.textLight,
    fontWeight: '600',
  },

  suggestionCard: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
  },

  suggestionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  suggestionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },

  suggestionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#166534',
  },

  suggestionDescription: {
    fontSize: 11,
    color: '#4D7C0F',
    marginTop: 2,
  },

  suggestionAmount: {
    fontSize: 24,
    fontWeight: '900',
    color: '#15803D',
    marginVertical: 14,
  },

  suggestBtnRow: {
    flexDirection: 'row',
    gap: 8,
  },

  suggestPresetBtn: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 5,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1FAE5',
  },

  suggestPresetBtnActive: {
    backgroundColor: `${theme.colors.primary}12`,
    borderColor: theme.colors.primary,
  },

  suggestPresetLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
  },

  suggestPresetLabelActive: {
    color: theme.colors.primary,
  },

  suggestPresetText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1F2937',
    marginTop: 3,
  },

  suggestPresetTextActive: {
    color: theme.colors.primary,
  },

  priceInputCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    marginBottom: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },

  priceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  priceInputLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: theme.colors.textLight,
    letterSpacing: 0.6,
  },

  priceHint: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 3,
  },

  clearText: {
    fontSize: 11,
    color: theme.colors.primary,
    fontWeight: '800',
  },

  priceInputWrapper: {
    height: 60,
    marginTop: 12,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 15,
    backgroundColor: '#F8FAFC',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },

  priceInputWrapperFocused: {
    borderColor: theme.colors.primary,
    backgroundColor: '#FFFFFF',
  },

  simplePriceInput: {
    flex: 1,
    fontSize: 25,
    fontWeight: '900',
    color: theme.colors.text,
  },

  currencyText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#64748B',
  },

  segmentsSection: {
    marginTop: 4,
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },

  sectionIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: `${theme.colors.primary}12`,
    justifyContent: 'center',
    alignItems: 'center',
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.text,
  },

  sectionSubtitle: {
    fontSize: 12,
    color: theme.colors.textLight,
    marginTop: 2,
  },

  routeOrderCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },

  routePoint: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 26,
  },

  routePointDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#CBD5E1',
    marginRight: 10,
  },

  routePointStart: {
    backgroundColor: '#22C55E',
  },

  routePointEnd: {
    backgroundColor: '#EF4444',
  },

  routePointText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },

  routePointStrong: {
    color: '#1F2937',
    fontWeight: '800',
  },

  routeArrow: {
    position: 'absolute',
    left: 0,
    top: 25,
  },

  segmentPricesList: {
    gap: 10,
  },

  segmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 14,
  },

  segmentLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },

  segmentTimeline: {
    alignItems: 'center',
    width: 16,
    marginRight: 12,
  },

  segmentDotStart: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22C55E',
  },

  segmentDotEnd: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },

  segmentLine: {
    width: 2,
    height: 18,
    backgroundColor: '#CBD5E1',
    marginVertical: 2,
  },

  segmentAddresses: {
    flex: 1,
  },

  segmentCityText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1F2937',
  },

  segmentArrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },

  segmentDestination: {
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    color: '#1F2937',
  },

  segmentDistance: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 4,
    fontWeight: '600',
  },

  segmentPriceBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 3,
  },

  legPriceAdjustBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },

  legPriceInput: {
    width: 62,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '900',
    color: '#1F2937',
  },

  legPriceCurrency: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    marginRight: 2,
  },

  totalSegmentSummaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 16,
    padding: 15,
    marginTop: 12,
    gap: 10,
  },

  totalWalletIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },

  totalSegmentSummaryText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#065F46',
  },

  totalSegmentSummaryAmount: {
    fontSize: 17,
    fontWeight: '900',
    color: '#059669',
    marginTop: 2,
  },

  warningCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
  },

  warningText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 17,
    color: '#92400E',
  },

  totalEarningsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderRadius: 17,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#A7F3D0',
    marginTop: 20,
    marginBottom: 14,
  },

  totalEarningsIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },

  totalEarningsTitle: {
    fontSize: 10,
    fontWeight: '900',
    color: '#065F46',
    letterSpacing: 0.5,
  },

  totalEarningsSub: {
    fontSize: 12,
    color: '#047857',
    marginTop: 3,
  },

  totalEarningsAmount: {
    fontSize: 18,
    fontWeight: '900',
    color: '#047857',
  },

  commissionCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },

  commissionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 9,
  },

  commissionLabel: {
    flex: 1,
    marginRight: 8,
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
  },

  commissionValue: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.text,
  },

  commissionLabelSub: {
    flex: 1,
    marginRight: 8,
    fontSize: 12,
    color: theme.colors.textLight,
  },

  commissionValueSub: {
    fontSize: 13,
    color: theme.colors.textLight,
    fontWeight: '600',
  },

  commissionDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 8,
  },

  commissionLabelTotal: {
    flex: 1,
    marginRight: 8,
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.primary,
  },

  commissionValueTotal: {
    fontSize: 18,
    fontWeight: '900',
    color: theme.colors.primary,
  },
});
