import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
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
  onConfirm,
}: PublishSummaryModalProps) {
  const priceNum = parseInt(price, 10) || 0;

  const calcCommission = (driverPayout: number) => {
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
        ? financialSettings.commission_percentage
        : 10;

    const minC =
      financialSettings.min_commission !== undefined
        ? financialSettings.min_commission
        : 100;

    const maxC = financialSettings.max_commission;

    let commission = Math.floor(driverPayout * (pct / 100));

    if (commission < minC) {
      commission = minC;
    }

    if (maxC && commission > maxC) {
      commission = maxC;
    }

    return commission;
  };

  const commission = calcCommission(priceNum);
  const totalPassenger = priceNum + commission;
  const driverPayout = priceNum;

  const parseLoc = (locStr: string) => {
    if (!locStr) {
      return {
        name: '',
        note: '',
      };
    }

    const parts = locStr.split('|||');

    return {
      name: parts[0],
      note: parts[1] || '',
    };
  };

  const parsedDep = parseLoc(departure);
  const parsedArr = parseLoc(arrival);

  const totalDuration =
    (estimation?.durationMin || 0) +
    stopovers.reduce(
      (sum, s) => sum + (Number(s.stopDurationMin) || 0),
      0
    );

  const preferenceCount = [
    music,
    chatty,
    airCond,
    luggageAllowed,
    drivingRelay,
    petsAllowed,
    !smoking,
    stopsAllowed,
  ].filter(Boolean).length;

  const renderChip = (
    icon: keyof typeof Ionicons.glyphMap,
    label: string
  ) => (
    <View style={styles.preferenceChip} key={label}>
      <View style={styles.preferenceChipIcon}>
        <Ionicons
          name={icon}
          size={13}
          color={theme.colors.primary}
        />
      </View>

      <Text style={styles.preferenceChipText}>{label}</Text>
    </View>
  );

  return (
    <AppBottomSheet
      visible={visible}
      onClose={onClose}
      snapPoints={['88%', '96%']}
      initialIndex={0}
    >
      <View style={styles.container}>

        {/* ───────────────── HEADER ───────────────── */}

        <View style={styles.header}>
          <View style={styles.handle} />

          <View style={styles.headerTopRow}>
            <View style={styles.headerIcon}>
              <Ionicons
                name="checkmark"
                size={19}
                color={theme.colors.primary}
              />
            </View>

            <View style={styles.headerTexts}>
              <Text style={styles.title}>
                Prêt à publier ?
              </Text>

              <Text style={styles.subtitle}>
                Vérifiez une dernière fois votre trajet
              </Text>
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}
              activeOpacity={0.75}
            >
              <Ionicons
                name="close"
                size={20}
                color={theme.colors.textMuted}
              />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >

          {/* ───────────────── ROUTE ───────────────── */}

          <View style={styles.sectionCard}>

            <View style={styles.sectionHeader}>
              <View style={styles.sectionIcon}>
                <Ionicons
                  name="navigate-outline"
                  size={17}
                  color={theme.colors.primary}
                />
              </View>

              <View>
                <Text style={styles.sectionTitle}>
                  Votre itinéraire
                </Text>

                <Text style={styles.sectionSubtitle}>
                  Parcours du trajet
                </Text>
              </View>
            </View>

            <View style={styles.routeCard}>

              {/* Départ */}

              <View style={styles.routeRow}>

                <View style={styles.routeIndicatorColumn}>
                  <View style={styles.departureDot} />

                  {(stopovers.length > 0 || parsedArr.name) && (
                    <View style={styles.routeLine} />
                  )}
                </View>

                <View style={styles.routeContent}>
                  <Text style={styles.routeLabel}>
                    DÉPART
                  </Text>

                  <Text
                    style={styles.routeName}
                    numberOfLines={2}
                  >
                    {parsedDep.name}
                  </Text>

                  {parsedDep.note ? (
                    <View style={styles.locationNote}>
                      <Ionicons
                        name="location-outline"
                        size={12}
                        color={theme.colors.primary}
                      />

                      <Text style={styles.locationNoteText}>
                        {parsedDep.note}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>

              {/* Arrêts */}

              {stopovers.length > 0 && (
                <View style={styles.stopoversContainer}>

                  <View style={styles.stopoversHeader}>
                    <Ionicons
                      name="ellipsis-horizontal-circle-outline"
                      size={15}
                      color={theme.colors.primary}
                    />

                    <Text style={styles.stopoversTitle}>
                      {stopovers.length} arrêt{stopovers.length > 1 ? 's' : ''}
                    </Text>
                  </View>

                  {stopovers.map((stop, index) => {
                    const parsedStop = parseLoc(stop.name);

                    return (
                      <View
                        key={stop.id ?? index}
                        style={styles.stopRow}
                      >
                        <View style={styles.stopNumber}>
                          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.primary }} />
                        </View>

                        <View style={styles.stopInfo}>
                          <Text
                            style={styles.stopName}
                            numberOfLines={2}
                          >
                            {parsedStop.name ||
                              'Étape'}
                          </Text>

                          <View style={styles.stopMeta}>
                            <Ionicons
                              name="time-outline"
                              size={11}
                              color={theme.colors.textMuted}
                            />

                            <Text style={styles.stopDuration}>
                              {stop.stopDurationMin} min d'arrêt
                            </Text>
                          </View>

                          {parsedStop.note ? (
                            <Text style={styles.stopNote}>
                              {parsedStop.note}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}

              {/* Arrivée */}

              <View style={styles.routeRow}>

                <View style={styles.routeIndicatorColumn}>
                  <View style={styles.arrivalDot} />
                </View>

                <View style={styles.routeContent}>
                  <Text style={styles.routeLabel}>
                    ARRIVÉE
                  </Text>

                  <Text
                    style={styles.routeName}
                    numberOfLines={2}
                  >
                    {parsedArr.name}
                  </Text>

                  {parsedArr.note ? (
                    <View style={styles.locationNote}>
                      <Ionicons
                        name="location-outline"
                        size={12}
                        color={theme.colors.primary}
                      />

                      <Text style={styles.locationNoteText}>
                        {parsedArr.note}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>

              {/* Metrics */}

              {estimation && (
                <View style={styles.metricsContainer}>

                  <View style={styles.metricItem}>
                    <View style={styles.metricIcon}>
                      <Ionicons
                        name="navigate-outline"
                        size={15}
                        color={theme.colors.primary}
                      />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={styles.metricLabel}>
                        DISTANCE
                      </Text>

                      <Text style={styles.metricValue}>
                        {estimation.distanceKm} km
                      </Text>
                    </View>
                  </View>

                  <View style={styles.metricDivider} />

                  <View style={styles.metricItem}>
                    <View style={styles.metricIcon}>
                      <Ionicons
                        name="time-outline"
                        size={15}
                        color={theme.colors.primary}
                      />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={styles.metricLabel}>
                        DURÉE
                      </Text>

                      <Text style={styles.metricValue}>
                        {formatDuration(totalDuration)}
                      </Text>
                    </View>
                  </View>

                </View>
              )}

            </View>
          </View>

          {/* ───────────────── DATE ───────────────── */}

          <View style={styles.sectionCard}>

            <View style={styles.sectionHeader}>
              <View style={styles.sectionIcon}>
                <Ionicons
                  name="calendar-outline"
                  size={17}
                  color={theme.colors.primary}
                />
              </View>

              <View>
                <Text style={styles.sectionTitle}>
                  Départ
                </Text>

                <Text style={styles.sectionSubtitle}>
                  Date et disponibilité
                </Text>
              </View>
            </View>

            <View style={styles.infoGrid}>
              <View style={styles.infoBox}>
                <Text style={styles.infoLabel}>DATE</Text>
                <Text style={styles.infoValue}>
                  {selectedDateObj.toLocaleDateString('fr-FR', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                  })}
                </Text>
              </View>

              <View style={styles.infoDivider} />

              <View style={styles.infoBox}>
                <Text style={styles.infoLabel}>HEURE</Text>
                <Text style={styles.infoValue}>{time}</Text>
              </View>

              <View style={styles.infoDivider} />

              <View style={styles.infoBox}>
                <Text style={styles.infoLabel}>PLACES</Text>
                <Text style={styles.infoValue}>
                  {seats} place{seats > 1 ? 's' : ''}
                </Text>
              </View>
            </View>

            {isRecurrent && (
              <View style={styles.recurrentCard}>
                <View style={styles.recurrentIcon}>
                  <Ionicons
                    name="repeat"
                    size={16}
                    color={theme.colors.primary}
                  />
                </View>

                <View style={styles.recurrentContent}>
                  <Text style={styles.recurrentTitle}>
                    Trajet récurrent
                  </Text>

                  <Text style={styles.recurrentText}>
                    {getEstimatedRidesCount()} départ{getEstimatedRidesCount() > 1 ? 's' : ''} seront programmés
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* ───────────────── TARIFICATION ───────────────── */}

          <View style={styles.sectionCard}>

            <View style={styles.sectionHeader}>
              <View style={styles.sectionIcon}>
                <Ionicons
                  name="wallet-outline"
                  size={17}
                  color="#059669"
                />
              </View>

              <View>
                <Text style={styles.sectionTitle}>
                  Tarification
                </Text>

                <Text style={styles.sectionSubtitle}>
                  Répartition du prix par place
                </Text>
              </View>
            </View>

            <View style={styles.priceCard}>

              <View style={styles.priceRow}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.priceMainLabel}>
                    Votre rémunération
                  </Text>

                  <Text style={styles.priceHint}>
                    Montant que vous recevez
                  </Text>
                </View>

                <Text style={styles.priceMainValue}>
                  {driverPayout.toLocaleString()} FCFA
                </Text>
              </View>

              <View style={styles.priceRow}>
                <Text style={styles.priceSecondaryLabel}>
                  Frais de service Zemy ({financialSettings?.commission_percentage ?? 10}%)
                </Text>

                <Text style={styles.priceSecondaryValue}>
                  +{commission.toLocaleString()} FCFA
                </Text>
              </View>

              <View style={styles.priceDivider} />

              <View style={styles.passengerPriceRow}>
                <View style={styles.passengerPriceIcon}>
                  <Ionicons
                    name="person-outline"
                    size={16}
                    color={theme.colors.primary}
                  />
                </View>

                <View style={styles.passengerPriceContent}>
                  <Text style={styles.passengerPriceLabel}>
                    Prix payé par le passager
                  </Text>

                  <Text style={styles.passengerPriceValue}>
                    {totalPassenger.toLocaleString()} FCFA
                  </Text>
                </View>
              </View>

            </View>

            {/* Gain total */}

            <LinearGradient
              colors={['#ECFDF5', '#F0FDF4']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.totalEarningCard}
            >
              <View style={styles.totalEarningIcon}>
                <Ionicons
                  name="trending-up"
                  size={20}
                  color="#047857"
                />
              </View>

              <View style={styles.totalEarningContent}>
                <Text style={styles.totalEarningLabel}>
                  GAIN TOTAL POTENTIEL
                </Text>

                <Text style={styles.totalEarningSeats}>
                  {seats} place{seats > 1 ? 's' : ''} disponible{seats > 1 ? 's' : ''}
                </Text>
              </View>

              <Text style={styles.totalEarningAmount}>
                {(driverPayout * seats).toLocaleString()} FCFA
              </Text>
            </LinearGradient>

          </View>

          {/* ───────────────── PREFERENCES ───────────────── */}

          <View style={styles.sectionCard}>

            <View style={styles.sectionHeader}>
              <View style={styles.sectionIcon}>
                <Ionicons
                  name="options-outline"
                  size={17}
                  color={theme.colors.primary}
                />
              </View>

              <View style={styles.preferenceHeaderContent}>
                <View>
                  <Text style={styles.sectionTitle}>
                    Préférences
                  </Text>

                  <Text style={styles.sectionSubtitle}>
                    Informations visibles par les passagers
                  </Text>
                </View>

                <View style={styles.preferenceCount}>
                  <Text style={styles.preferenceCountText}>
                    {preferenceCount}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.preferencesContainer}>

              {music &&
                renderChip(
                  'musical-notes-outline',
                  'Musique'
                )}

              {chatty &&
                renderChip(
                  'chatbubbles-outline',
                  'Discussion'
                )}

              {airCond &&
                renderChip(
                  'snow-outline',
                  'Clim'
                )}

              {luggageAllowed &&
                renderChip(
                  'briefcase-outline',
                  `Bagages ${luggageSize === 'petit' ? 'petits' : luggageSize === 'moyen' ? 'moyens' : 'grands'}`
                )}

              {drivingRelay &&
                renderChip(
                  'car-sport-outline',
                  'Relais'
                )}

              {petsAllowed &&
                renderChip(
                  'paw-outline',
                  'Animaux'
                )}

              {!smoking &&
                renderChip(
                  'ban-outline',
                  'Non-fumeur'
                )}

              {stopsAllowed &&
                renderChip(
                  'pause-circle-outline',
                  'Pauses'
                )}

              {preferenceCount === 0 && (
                <View style={styles.emptyPreference}>
                  <Ionicons
                    name="options-outline"
                    size={18}
                    color={theme.colors.textMuted}
                  />

                  <Text style={styles.emptyPreferenceText}>
                    Aucune préférence particulière
                  </Text>
                </View>
              )}

            </View>

            {/* Description */}

            {description.trim() ? (
              <View style={styles.descriptionCard}>

                <View style={styles.descriptionHeader}>
                  <Ionicons
                    name="chatbox-ellipses-outline"
                    size={15}
                    color={theme.colors.primary}
                  />

                  <Text style={styles.descriptionTitle}>
                    Message aux passagers
                  </Text>
                </View>

                <Text style={styles.descriptionText}>
                  “{description.trim()}”
                </Text>

              </View>
            ) : null}

          </View>

          {/* ───────────────── ACTIONS ───────────────── */}

          <View style={styles.actionsContainer}>

            <TouchableOpacity
              style={styles.editButton}
              onPress={onClose}
              activeOpacity={0.8}
              disabled={loading}
            >
              <Ionicons
                name="create-outline"
                size={20}
                color={theme.colors.text}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.publishButton}
              onPress={onConfirm}
              disabled={loading}
              activeOpacity={0.9}
            >
              <LinearGradient
                colors={[
                  theme.colors.primary,
                  theme.colors.primaryDark || '#1A4FC8',
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.publishGradient}
              >
                {loading ? (
                  <>
                    <ActivityIndicator
                      color="#FFFFFF"
                      size="small"
                    />

                    <Text style={styles.publishText}>
                      Publication...
                    </Text>
                  </>
                ) : (
                  <>
                    <View style={styles.publishIcon}>
                      <Ionicons
                        name="checkmark"
                        size={15}
                        color={theme.colors.primary}
                      />
                    </View>

                    <Text style={styles.publishText}>
                      Confirmer & publier
                    </Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

          </View>

          <View style={styles.bottomSafeSpace} />

        </ScrollView>
      </View>
    </AppBottomSheet>
  );
}

const styles = StyleSheet.create({

  /* ───────────────── GLOBAL ───────────────── */

  container: {
    flex: 1,
    backgroundColor: '#F7F9FC',
  },

  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 30,
  },

  bottomSafeSpace: {
    height: 10,
  },

  /* ───────────────── HEADER ───────────────── */

  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 18,
    paddingTop: 5,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
  },

  handle: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#CBD5E1',
    marginBottom: 17,
  },

  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  headerIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#EEF4FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  headerTexts: {
    flex: 1,
  },

  title: {
    fontSize: 19,
    fontWeight: '900',
    color: theme.colors.text,
    letterSpacing: -0.3,
  },

  subtitle: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 3,
  },

  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* ───────────────── SECTION ───────────────── */

  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginTop: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E9EEF5',
    shadowColor: '#0F172A',
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.035,
    shadowRadius: 12,
    elevation: 2,
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },

  sectionIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: '#EEF4FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },

  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.text,
  },

  sectionSubtitle: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 2,
  },

  /* ───────────────── ROUTE ───────────────── */

  routeCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 17,
    padding: 14,
    borderWidth: 1,
    borderColor: '#EDF1F5',
  },

  routeRow: {
    flexDirection: 'row',
  },

  routeIndicatorColumn: {
    width: 28,
    alignItems: 'center',
  },

  departureDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#22C55E',
    borderWidth: 4,
    borderColor: '#DCFCE7',
  },

  arrivalDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#EF4444',
    borderWidth: 4,
    borderColor: '#FEE2E2',
  },

  routeLine: {
    width: 2,
    flex: 1,
    minHeight: 35,
    backgroundColor: '#CBD5E1',
    marginVertical: 3,
  },

  routeContent: {
    flex: 1,
    paddingLeft: 8,
    paddingBottom: 4,
  },

  routeLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: theme.colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: 3,
  },

  routeName: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.text,
    lineHeight: 20,
  },

  locationNote: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },

  locationNoteText: {
    flex: 1,
    fontSize: 11,
    color: theme.colors.primary,
    fontWeight: '600',
  },

  /* ───────────────── STOPS ───────────────── */

  stopoversContainer: {
    marginLeft: 28,
    marginVertical: 10,
    paddingLeft: 13,
    borderLeftWidth: 1,
    borderLeftColor: '#CBD5E1',
  },

  stopoversHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 8,
  },

  stopoversTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: theme.colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },

  stopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },

  stopNumber: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#E8EEF9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },

  stopNumberText: {
    fontSize: 10,
    fontWeight: '800',
    color: theme.colors.primary,
  },

  stopInfo: {
    flex: 1,
  },

  stopName: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.text,
  },

  stopMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },

  stopDuration: {
    fontSize: 10,
    color: theme.colors.textMuted,
  },

  stopNote: {
    fontSize: 10,
    color: theme.colors.primary,
    marginTop: 2,
  },

  /* ───────────────── METRICS ───────────────── */

  metricsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 13,
    paddingTop: 13,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    flexWrap: 'wrap',
    gap: 10,
  },

  metricItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },

  metricIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: '#EEF4FF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  metricDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 8,
  },

  metricLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: theme.colors.textMuted,
    letterSpacing: 0.7,
  },

  metricValue: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.text,
    marginTop: 1,
  },

  /* ───────────────── INFO GRID ───────────────── */

  infoGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#EEF2F7',
  },

  infoBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  infoDivider: {
    width: 1,
    height: 20,
    backgroundColor: '#E2E8F0',
  },

  infoLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: theme.colors.textMuted,
    letterSpacing: 0.7,
    marginBottom: 4,
  },

  infoValue: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.text,
    textTransform: 'capitalize',
  },

  /* ───────────────── RECURRENT ───────────────── */

  recurrentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF4FF',
    borderRadius: 13,
    padding: 11,
    marginTop: 9,
  },

  recurrentIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },

  recurrentContent: {
    flex: 1,
  },

  recurrentTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.primary,
  },

  recurrentText: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 2,
  },

  /* ───────────────── PRICING ───────────────── */

  priceCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E8EDF3',
  },

  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 11,
    flexWrap: 'wrap',
    gap: 4,
  },

  priceMainLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.text,
  },

  priceHint: {
    fontSize: 10,
    color: theme.colors.textMuted,
    marginTop: 2,
  },

  priceMainValue: {
    fontSize: 15,
    fontWeight: '900',
    color: '#059669',
  },

  priceSecondaryLabel: {
    flex: 1,
    fontSize: 11,
    color: theme.colors.textMuted,
  },

  priceSecondaryValue: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textMuted,
  },

  priceDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 5,
  },

  passengerPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    flexWrap: 'wrap',
    gap: 6,
  },

  passengerPriceIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#EEF4FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 9,
  },

  passengerPriceContent: {
    flex: 1,
    minWidth: 150,
  },

  passengerPriceLabel: {
    fontSize: 11,
    color: theme.colors.textMuted,
  },

  passengerPriceValue: {
    fontSize: 18,
    fontWeight: '900',
    color: theme.colors.primary,
    marginTop: 1,
  },

  totalEarningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 16,
    padding: 13,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    flexWrap: 'wrap',
    gap: 8,
  },

  totalEarningIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },

  totalEarningContent: {
    flex: 1,
    minWidth: 120,
  },

  totalEarningLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: '#065F46',
    letterSpacing: 0.6,
  },

  totalEarningSeats: {
    fontSize: 10,
    color: '#047857',
    marginTop: 2,
  },

  totalEarningAmount: {
    fontSize: 16,
    fontWeight: '900',
    color: '#047857',
  },

  /* ───────────────── PREFERENCES ───────────────── */

  preferenceHeaderContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  preferenceCount: {
    minWidth: 26,
    height: 26,
    paddingHorizontal: 7,
    borderRadius: 13,
    backgroundColor: '#EEF4FF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  preferenceCountText: {
    fontSize: 11,
    fontWeight: '900',
    color: theme.colors.primary,
  },

  preferencesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },

  preferenceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 11,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },

  preferenceChipIcon: {
    width: 20,
    height: 20,
    borderRadius: 7,
    backgroundColor: '#EEF4FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 5,
  },

  preferenceChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#334155',
  },

  emptyPreference: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 10,
  },

  emptyPreferenceText: {
    fontSize: 11,
    color: theme.colors.textMuted,
  },

  /* ───────────────── DESCRIPTION ───────────────── */

  descriptionCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 13,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },

  descriptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },

  descriptionTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: theme.colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },

  descriptionText: {
    fontSize: 12,
    lineHeight: 18,
    color: theme.colors.text,
    fontStyle: 'italic',
  },

  /* ───────────────── ACTIONS ───────────────── */

  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 16,
    width: '100%',
  },

  editButton: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#DCE3EC',
  },

  publishButton: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: theme.colors.primary,
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 4,
  },

  publishGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },

  publishIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  publishText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFFFF',
  },
});
