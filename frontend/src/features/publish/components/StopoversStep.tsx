import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../../../src/styles/theme';

interface Stopover {
  id: string;
  name: string;
  checked?: boolean;

  // Position précise de l'arrêt
  latitude?: number | null;
  longitude?: number | null;

  // Adresse retournée par la recherche GPS
  address?: string;

  // Durée d'arrêt
  stopDurationMin?: number;
}

interface DetectedStopover extends Stopover {
  checked?: boolean;
}

interface StopoversStepProps {
  departure: string;
  arrival: string;
  subStep: 1 | 2;

  googleRoutes: any[];
  selectedRouteIndex: number;

  detectedStopovers: DetectedStopover[];
  stopovers: Stopover[];

  toggleStopoverCheck: (id: string) => void;

  updateStopover: (
    id: string,
    updates: Partial<Stopover>
  ) => void;

  onAddStopoverPress: () => void;

  onPickLocationForStopover: (id: string) => void;

  // Nouveau : permet de choisir/modifier précisément la position
  onPickPositionForStopover?: (id: string) => void;

  // Optionnel : suppression d'un arrêt
  onRemoveStopover?: (id: string) => void;

  estimationLoading: boolean;
  estimation: any;
}

const formatDuration = (totalMin: number): string => {
  const min = Math.max(0, Number(totalMin) || 0);

  const h = Math.floor(min / 60);
  const m = min % 60;

  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;

  return `${h}h${m.toString().padStart(2, '0')}`;
};

const getCityName = (value?: string) => {
  if (!value) return 'Étape';

  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)[0] || 'Étape';
};

const hasPosition = (stopover: Stopover) => {
  return (
    typeof stopover.latitude === 'number' &&
    typeof stopover.longitude === 'number'
  );
};

export function StopoversStep({
  departure,
  arrival,
  subStep,
  googleRoutes,
  selectedRouteIndex,
  detectedStopovers,
  stopovers,
  toggleStopoverCheck,
  updateStopover,
  onAddStopoverPress,
  onPickLocationForStopover,
  onPickPositionForStopover,
  onRemoveStopover,
  estimationLoading,
  estimation,
}: StopoversStepProps) {

  const selectedStopovers = stopovers.filter(
    (stopover) => stopover.checked !== false
  );

  const totalStopoversMin = selectedStopovers.reduce(
    (acc, s) => acc + (Number(s.stopDurationMin) || 0),
    0
  );

  return (
    <View>
      <Text style={styles.stepTitle}>
        Configurez vos arrêts
      </Text>

      <Text style={styles.stepSubtitle}>
        Vérifiez chaque arrêt, choisissez sa position précise et
        définissez le temps nécessaire sur place.
      </Text>

      {/* Timeline */}
      <View style={styles.timelineContainer}>
        <View style={styles.timelineTrack} />

        {/* Départ */}
        <View style={styles.timelineNodeRow}>
          <View style={styles.timelineCircleGrey}>
            <View style={styles.timelineCircleInnerGrey} />
          </View>

          <View style={styles.timelineContent}>
            <View style={styles.timelineTag}>
              <Text style={styles.timelineTagText}>
                DÉPART
              </Text>
            </View>

            <Text
              style={styles.timelineNodeCityText}
              numberOfLines={1}
            >
              {getCityName(departure)}
            </Text>

            <Text
              style={styles.timelineNodeAddressText}
              numberOfLines={2}
            >
              {departure}
            </Text>
          </View>
        </View>

        {/* Arrêts sélectionnés */}
        {selectedStopovers.length > 0 ? (
          selectedStopovers.map((s, idx) => (
            <View key={s.id} style={styles.timelineNodeRow}>
              <View style={styles.timelineCircleBlue}>
                <View style={styles.timelineCircleInnerBlue} />
              </View>

              <View style={styles.timelineContent}>
                <View style={styles.timelineHeaderRow}>
                  <View style={styles.stopoverTitleContainer}>
                    <Text
                      style={styles.timelineNodeCityText}
                      numberOfLines={1}
                    >
                      {getCityName(s.name)}
                    </Text>

                    <View style={styles.stopoverBadge}>
                      <Text style={styles.stopoverBadgeText}>
                        ARRÊT {idx + 1}
                      </Text>
                    </View>
                  </View>

                  {/* Durée */}
                  <View style={styles.timelineDurationContainer}>
                    <TouchableOpacity
                      onPress={() =>
                        updateStopover(s.id, {
                          stopDurationMin: Math.max(
                            1,
                            (s.stopDurationMin || 15) - 1
                          ),
                        })
                      }
                      style={styles.timelineDurationBtn}
                      hitSlop={{
                        top: 8,
                        bottom: 8,
                        left: 8,
                        right: 8,
                      }}
                    >
                      <Text style={styles.timelineDurationBtnText}>
                        −
                      </Text>
                    </TouchableOpacity>

                    <Text style={styles.timelineDurationText}>
                      {s.stopDurationMin || 15} min
                    </Text>

                    <TouchableOpacity
                      onPress={() =>
                        updateStopover(s.id, {
                          stopDurationMin:
                            (s.stopDurationMin || 15) + 1,
                        })
                      }
                      style={styles.timelineDurationBtn}
                      hitSlop={{
                        top: 8,
                        bottom: 8,
                        left: 8,
                        right: 8,
                      }}
                    >
                      <Text style={styles.timelineDurationBtnText}>
                        +
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Adresse */}
                <Text
                  style={styles.timelineNodeAddressText}
                  numberOfLines={2}
                >
                  {s.address || s.name || 'Position non définie'}
                </Text>

                {/* Position */}
                <TouchableOpacity
                  style={[
                    styles.positionSelector,
                    hasPosition(s) &&
                      styles.positionSelectorActive,
                  ]}
                  onPress={() => {
                    if (onPickPositionForStopover) {
                      onPickPositionForStopover(s.id);
                    } else {
                      onPickLocationForStopover(s.id);
                    }
                  }}
                  activeOpacity={0.75}
                >
                  <Ionicons
                    name={
                      hasPosition(s)
                        ? 'checkmark-circle'
                        : 'location-outline'
                    }
                    size={17}
                    color={
                      hasPosition(s)
                        ? '#16A34A'
                        : theme.colors.primary
                    }
                  />

                  <View style={styles.positionSelectorContent}>
                    <Text
                      style={[
                        styles.positionSelectorTitle,
                        hasPosition(s) &&
                          styles.positionSelectorTitleActive,
                      ]}
                    >
                      {hasPosition(s)
                        ? 'Position précise définie'
                        : 'Définir la position précise'}
                    </Text>

                    <Text style={styles.positionSelectorSubtitle}>
                      {hasPosition(s)
                        ? `${Number(s.latitude).toFixed(
                            5
                          )}, ${Number(s.longitude).toFixed(5)}`
                        : 'Indiquez exactement où les passagers doivent vous rejoindre'}
                    </Text>
                  </View>

                  <Ionicons
                    name="chevron-forward"
                    size={17}
                    color="#94A3B8"
                  />
                </TouchableOpacity>

                {/* Actions */}
                <View style={styles.stopoverActions}>
                  <TouchableOpacity
                    onPress={() =>
                      onPickLocationForStopover(s.id)
                    }
                    style={styles.smallAction}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name="search-outline"
                      size={15}
                      color="#64748B"
                    />

                    <Text style={styles.smallActionText}>
                      Modifier
                    </Text>
                  </TouchableOpacity>

                  {onRemoveStopover && (
                    <TouchableOpacity
                      onPress={() =>
                        Alert.alert(
                          'Supprimer l’arrêt',
                          `Voulez-vous supprimer "${s.name}" ?`,
                          [
                            {
                              text: 'Annuler',
                              style: 'cancel',
                            },
                            {
                              text: 'Supprimer',
                              style: 'destructive',
                              onPress: () =>
                                onRemoveStopover(s.id),
                            },
                          ]
                        )
                      }
                      style={styles.smallAction}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={15}
                        color="#EF4444"
                      />

                      <Text
                        style={[
                          styles.smallActionText,
                          { color: '#EF4444' },
                        ]}
                      >
                        Supprimer
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.timelineEmptyRow}>
            <Ionicons
              name="git-branch-outline"
              size={22}
              color="#94A3B8"
            />

            <Text style={styles.timelineEmptyText}>
              Aucun arrêt sélectionné
            </Text>

            <Text style={styles.timelineEmptyHint}>
              Vous pouvez ajouter un arrêt personnalisé.
            </Text>
          </View>
        )}

        {/* Arrivée */}
        <View style={styles.timelineNodeRow}>
          <View style={styles.timelineCircleGrey}>
            <View style={styles.timelineCircleInnerGrey} />
          </View>

          <View style={styles.timelineContent}>
            <View style={styles.timelineTag}>
              <Text style={styles.timelineTagText}>
                ARRIVÉE
              </Text>
            </View>

            <Text
              style={styles.timelineNodeCityText}
              numberOfLines={1}
            >
              {getCityName(arrival)}
            </Text>

            <Text
              style={styles.timelineNodeAddressText}
              numberOfLines={2}
            >
              {arrival}
            </Text>
          </View>
        </View>
      </View>

      {/* Estimation */}
      {departure && arrival && (
        <View style={styles.estimationCard}>
          {estimationLoading && !estimation ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator
                size="small"
                color={theme.colors.primary}
              />

              <Text style={styles.loadingText}>
                Calcul de l'itinéraire...
              </Text>
            </View>
          ) : estimation ? (
            <View style={{ flex: 1 }}>
              <View style={styles.estimationHeader}>
                <Ionicons
                  name="analytics-outline"
                  size={17}
                  color={theme.colors.primary}
                />

                <Text style={styles.estimationHeaderText}>
                  Résumé du trajet
                </Text>
              </View>

              <Text style={styles.estimationHint}>
                Calcul basé sur les routes réelles
              </Text>

              <View style={styles.estimationRow}>
                <View style={styles.estimationItem}>
                  <View style={styles.estimationIcon}>
                    <Ionicons
                      name="navigate-circle-outline"
                      size={22}
                      color={theme.colors.primary}
                    />
                  </View>

                  <View>
                    <Text style={styles.estimationLabel}>
                      Distance
                    </Text>

                    <Text style={styles.estimationValue}>
                      {Number(estimation.distanceKm || 0).toLocaleString(
                        'fr-FR'
                      )}{' '}
                      km
                    </Text>
                  </View>
                </View>

                <View style={styles.estimationDivider} />

                <View style={styles.estimationItem}>
                  <View style={styles.estimationIcon}>
                    <Ionicons
                      name="time-outline"
                      size={22}
                      color={theme.colors.primary}
                    />
                  </View>

                  <View>
                    <Text style={styles.estimationLabel}>
                      Durée totale
                    </Text>

                    <Text style={styles.estimationValue}>
                      {formatDuration(
                        (estimation.durationMin || 0) +
                          totalStopoversMin
                      )}
                    </Text>

                    {totalStopoversMin > 0 && (
                      <Text style={styles.stopDurationSummary}>
                        + {totalStopoversMin} min d'arrêt
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            </View>
          ) : null}
        </View>
      )}

      {/* Ajouter un arrêt */}
      <TouchableOpacity
        style={styles.addStopoverButton}
        onPress={onAddStopoverPress}
        activeOpacity={0.8}
      >
        <View style={styles.addStopoverIcon}>
          <Ionicons
            name="add"
            size={20}
            color={theme.colors.primary}
          />
        </View>

        <View style={styles.addStopoverContent}>
          <Text style={styles.addStopoverTitle}>
            Ajouter un arrêt
          </Text>

          <Text style={styles.addStopoverSubtitle}>
            Ville, quartier ou position GPS précise
          </Text>
        </View>

        <Ionicons
          name="chevron-forward"
          size={18}
          color="#94A3B8"
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  stepTitle: {
    fontSize: 23,
    fontWeight: '800',
    color: theme.colors.text,
    marginTop: 20,
    marginBottom: 7,
    letterSpacing: -0.3,
  },

  stepSubtitle: {
    fontSize: 14,
    color: theme.colors.textLight,
    marginBottom: 20,
    lineHeight: 21,
  },

  recapContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    padding: 15,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 22,
  },

  recapRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  recapTextContainer: {
    flex: 1,
    marginLeft: 10,
  },

  recapLabel: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 2,
  },

  recapText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.text,
  },

  recapArrow: {
    marginLeft: 8,
    marginVertical: 3,
  },

  routeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },

  routeInfoText: {
    flex: 1,
    marginLeft: 7,
    fontSize: 12,
    color: theme.colors.textMuted,
    fontWeight: '600',
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },

  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: theme.colors.text,
  },

  sectionSubtitle: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },

  proposalBadge: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: `${theme.colors.primary}12`,
    justifyContent: 'center',
    alignItems: 'center',
  },

  proposalBadgeText: {
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: '800',
  },

  checklistCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    marginBottom: 16,
  },

  proposalItem: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },

  proposalItemActive: {
    backgroundColor: `${theme.colors.primary}04`,
  },

  proposalMain: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  proposalContent: {
    flex: 1,
    marginLeft: 12,
  },

  proposalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  checklistText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.text,
  },

  proposalNumber: {
    width: 23,
    height: 23,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },

  proposalNumberText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
  },

  proposalHint: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 3,
  },

  checkboxSquare: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },

  checkboxSquareActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary,
  },

  positionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 11,
    marginLeft: 34,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
  },

  positionButtonText: {
    flex: 1,
    marginLeft: 7,
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.primary,
  },

  emptyStopoversCard: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    borderRadius: 18,
    marginBottom: 16,
    backgroundColor: '#F8FAFC',
  },

  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },

  emptyStopoversTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 5,
  },

  emptyStopoversText: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },

  addStopoverButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },

  addStopoverIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: `${theme.colors.primary}10`,
    justifyContent: 'center',
    alignItems: 'center',
  },

  addStopoverContent: {
    flex: 1,
    marginLeft: 11,
  },

  addStopoverTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.text,
  },

  addStopoverSubtitle: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },

  timelineContainer: {
    position: 'relative',
    marginVertical: 12,
    paddingLeft: 2,
  },

  timelineTrack: {
    position: 'absolute',
    left: 12,
    top: 22,
    bottom: 22,
    width: 2,
    backgroundColor: '#E2E8F0',
    zIndex: 1,
  },

  timelineNodeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 7,
    zIndex: 2,
  },

  timelineCircleGrey: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#94A3B8',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 13,
  },

  timelineCircleInnerGrey: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#94A3B8',
  },

  timelineCircleBlue: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: theme.colors.primary,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 13,
  },

  timelineCircleInnerBlue: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.primary,
  },

  timelineContent: {
    flex: 1,
    marginLeft: 13,
    backgroundColor: '#F8FAFC',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 13,
    paddingVertical: 11,
  },

  timelineHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },

  stopoverTitleContainer: {
    flex: 1,
  },

  timelineTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
    backgroundColor: '#E2E8F0',
    marginBottom: 5,
  },

  timelineTagText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#64748B',
    letterSpacing: 0.6,
  },

  stopoverBadge: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    backgroundColor: `${theme.colors.primary}10`,
  },

  stopoverBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    color: theme.colors.primary,
  },

  timelineNodeCityText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1F2937',
    flex: 1,
  },

  timelineNodeAddressText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 4,
    lineHeight: 16,
  },

  timelineDurationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 2,
    paddingVertical: 1,
  },

  timelineDurationBtn: {
    width: 25,
    height: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },

  timelineDurationBtnText: {
    fontSize: 17,
    fontWeight: '800',
    color: theme.colors.primary,
  },

  timelineDurationText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1F2937',
    marginHorizontal: 4,
  },

  positionSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    padding: 9,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },

  positionSelectorActive: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },

  positionSelectorContent: {
    flex: 1,
    marginLeft: 8,
  },

  positionSelectorTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: theme.colors.primary,
  },

  positionSelectorTitleActive: {
    color: '#16A34A',
  },

  positionSelectorSubtitle: {
    fontSize: 9,
    color: '#94A3B8',
    marginTop: 2,
  },

  stopoverActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 15,
  },

  smallAction: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
  },

  smallActionText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    marginLeft: 4,
  },

  timelineEmptyRow: {
    marginLeft: 33,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#CBD5E1',
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
  },

  timelineEmptyText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 7,
  },

  timelineEmptyHint: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 3,
  },

  estimationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },

  estimationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  estimationHeaderText: {
    marginLeft: 7,
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.text,
  },

  estimationHint: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 3,
    marginBottom: 14,
  },

  estimationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  estimationItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },

  estimationIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: `${theme.colors.primary}10`,
    justifyContent: 'center',
    alignItems: 'center',
  },

  estimationLabel: {
    fontSize: 10,
    color: theme.colors.textLight,
    fontWeight: '600',
    marginLeft: 8,
  },

  estimationValue: {
    fontSize: 17,
    fontWeight: '800',
    color: theme.colors.text,
    marginLeft: 8,
    marginTop: 1,
  },

  estimationDivider: {
    width: 1,
    height: 42,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 12,
  },

  stopDurationSummary: {
    fontSize: 9,
    color: theme.colors.primary,
    fontWeight: '700',
    marginLeft: 8,
    marginTop: 2,
  },

  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
  },

  loadingText: {
    marginLeft: 9,
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
});
