import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../../../src/styles/theme';

interface StopoversStepProps {
  departure: string;
  arrival: string;
  subStep: 1 | 2;
  googleRoutes: any[];
  selectedRouteIndex: number;
  detectedStopovers: any[];
  stopovers: any[];
  toggleStopoverCheck: (id: string) => void;
  updateStopover: (id: string, updates: any) => void;
  onAddStopoverPress: () => void;
  onPickLocationForStopover: (id: string) => void;
  estimationLoading: boolean;
  estimation: any;
}

const formatDuration = (totalMin: number): string => {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h${m.toString().padStart(2, '0')}`;
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
  estimationLoading,
  estimation
}: StopoversStepProps) {
  if (subStep === 1) {
    return (
      <View>
        <Text style={styles.stepTitle}>Ajoutez des étapes pour trouver plus de passagers</Text>
        <Text style={styles.stepSubtitle}>
          Zemy détecte automatiquement les meilleures villes sur votre itinéraire pour maximiser vos chances de remplissage.
        </Text>

        <View style={styles.recapContainer}>
          <View style={styles.recapRow}>
            <Ionicons name="map-outline" size={16} color={theme.colors.primary} />
            <Text style={styles.recapText} numberOfLines={1}>
              {departure} vers {arrival}
            </Text>
          </View>
          {googleRoutes[selectedRouteIndex] && (
            <View style={styles.recapRow}>
              <Ionicons name="compass-outline" size={16} color={theme.colors.primary} />
              <Text style={styles.recapTextSub} numberOfLines={1}>
                Route : {googleRoutes[selectedRouteIndex].summary || 'Itinéraire sélectionné'}
              </Text>
            </View>
          )}
        </View>

        {detectedStopovers.length > 0 ? (
          <View style={styles.checklistCard}>
            {detectedStopovers.map((s) => (
              <TouchableOpacity
                key={s.id}
                style={styles.checklistItem}
                onPress={() => toggleStopoverCheck(s.id)}
                activeOpacity={0.8}
              >
                <Text style={styles.checklistText}>{s.name}</Text>
                <View style={[styles.checkboxSquare, s.checked && styles.checkboxSquareActive]}>
                  {s.checked && <Ionicons name="checkmark" size={14} color="#FFF" />}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View style={styles.emptyStopoversCard}>
            <Ionicons name="location-outline" size={32} color={theme.colors.textMuted} style={{ marginBottom: 8 }} />
            <Text style={styles.emptyStopoversText}>
              Aucune ville intermédiaire détectée sur l'itinéraire choisi.
            </Text>
          </View>
        )}

        <TouchableOpacity style={styles.addStopoverLink} onPress={onAddStopoverPress} activeOpacity={0.7}>
          <Ionicons name="add" size={20} color={theme.colors.primary} />
          <Text style={styles.addStopoverLinkText}>Ajouter une étape</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View>
      <Text style={styles.stepTitle}>Voici les meilleurs endroits pour s'arrêter. OK pour vous ?</Text>
      <Text style={styles.stepSubtitle}>
        Zemy a sélectionné des points d'arrêt stratégiques. Cliquez sur un arrêt pour le modifier ou l'ajuster.
      </Text>

      <View style={styles.timelineContainer}>
        <View style={styles.timelineTrack} />

        {/* Node 1: Departure */}
        <View style={styles.timelineNodeRow}>
          <View style={styles.timelineCircleGrey}>
            <View style={styles.timelineCircleInnerGrey} />
          </View>
          <View style={styles.timelineContent}>
            <Text style={styles.timelineNodeCityText} numberOfLines={1}>{departure.split(',')[0]}</Text>
            <Text style={styles.timelineNodeAddressText} numberOfLines={1}>{departure}</Text>
          </View>
        </View>

        {/* Nodes: Stopovers */}
        {stopovers.length > 0 ? (
          stopovers.map((s, idx) => (
            <View key={s.id} style={styles.timelineNodeRow}>
              <View style={styles.timelineCircleBlue}>
                <View style={styles.timelineCircleInnerBlue} />
              </View>
              
              <View style={styles.timelineContent}>
                <View style={styles.timelineHeaderRow}>
                  <Text style={styles.timelineNodeCityText} numberOfLines={1}>
                    {s.name ? s.name.split(',')[0] : `Étape ${idx + 1}`}
                  </Text>
                  
                  <View style={styles.timelineDurationContainer}>
                    <TouchableOpacity
                      onPress={() => updateStopover(s.id, { stopDurationMin: Math.max(5, (s.stopDurationMin || 15) - 5) })}
                      style={styles.timelineDurationBtn}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={styles.timelineDurationBtnText}>-</Text>
                    </TouchableOpacity>
                    <Text style={styles.timelineDurationText}>{s.stopDurationMin}m</Text>
                    <TouchableOpacity
                      onPress={() => updateStopover(s.id, { stopDurationMin: (s.stopDurationMin || 15) + 5 })}
                      style={styles.timelineDurationBtn}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={styles.timelineDurationBtnText}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <Text style={styles.timelineNodeAddressText} numberOfLines={1}>
                  {s.name || "Rechercher un point d'arrêt précis"}
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => onPickLocationForStopover(s.id)}
                activeOpacity={0.7}
                style={styles.timelineChevron}
              >
                <Ionicons name="chevron-forward" size={20} color={theme.colors.primary} />
              </TouchableOpacity>
            </View>
          ))
        ) : (
          <View style={styles.timelineEmptyRow}>
            <Text style={styles.timelineEmptyText}>Aucune étape sélectionnée</Text>
          </View>
        )}

        {/* Node Last: Arrival */}
        <View style={styles.timelineNodeRow}>
          <View style={styles.timelineCircleGrey}>
            <View style={styles.timelineCircleInnerGrey} />
          </View>
          <View style={styles.timelineContent}>
            <Text style={styles.timelineNodeCityText} numberOfLines={1}>{arrival.split(',')[0]}</Text>
            <Text style={styles.timelineNodeAddressText} numberOfLines={1}>{arrival}</Text>
          </View>
        </View>
      </View>

      {/* Distance / Duration info */}
      {departure && arrival && (
        <View style={styles.estimationCard}>
          {estimationLoading ? (
            <ActivityIndicator size="small" color={theme.colors.primary} style={{ margin: 20 }} />
          ) : estimation ? (
            (() => {
              const baseDrivingMin = estimation.durationMin || 0;
              const totalStopoversMin = stopovers.reduce((acc, s) => acc + (Number(s.stopDurationMin) || 0), 0);
              const totalDurationMin = baseDrivingMin + totalStopoversMin;

              return (
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 11, color: theme.colors.textMuted, fontStyle: 'italic', marginBottom: 10 }}>
                    Calcul basé sur les routes réelles
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={styles.estimationItem}>
                      <Ionicons name="navigate-circle-outline" size={22} color={theme.colors.primary} />
                      <View style={{ marginLeft: 10 }}>
                        <Text style={styles.estimationLabel}>Distance</Text>
                        <Text style={styles.estimationValue}>{estimation.distanceKm.toLocaleString()} km</Text>
                      </View>
                    </View>
                    <View style={styles.estimationDivider} />
                    <View style={styles.estimationItem}>
                      <Ionicons name="time-outline" size={22} color={theme.colors.primary} />
                      <View style={{ marginLeft: 10 }}>
                        <Text style={styles.estimationLabel}>Durée {totalStopoversMin > 0 ? 'totale' : ''}</Text>
                        <Text style={styles.estimationValue}>{formatDuration(totalDurationMin)}</Text>
                        {totalStopoversMin > 0 && (
                          <Text style={{ fontSize: 10, color: theme.colors.primary, fontWeight: '600', marginTop: 1 }}>
                            (dont {totalStopoversMin} min d'arrêt{totalStopoversMin > 1 ? 's' : ''})
                          </Text>
                        )}
                      </View>
                    </View>
                  </View>
                </View>
              );
            })()
          ) : null}
        </View>
      )}

      <TouchableOpacity style={styles.addStopoverLink} onPress={onAddStopoverPress} activeOpacity={0.7}>
        <Ionicons name="add" size={20} color={theme.colors.primary} />
        <Text style={styles.addStopoverLinkText}>Ajouter un arrêt personnalisé</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  stepTitle: { fontSize: 22, fontWeight: '800', color: theme.colors.text, marginTop: 20, marginBottom: 6 },
  stepSubtitle: { fontSize: 14, color: theme.colors.textLight, marginBottom: 20, lineHeight: 20 },
  recapContainer: { backgroundColor: '#F8FAFC', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 16, gap: 8 },
  recapRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  recapText: { fontSize: 14, fontWeight: '700', color: theme.colors.text },
  recapTextSub: { fontSize: 12, fontWeight: '600', color: theme.colors.textMuted },
  checklistCard: { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 14, paddingVertical: 4, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 6, elevation: 1 },
  checklistItem: { flexDirection: 'row', alignItems: 'center', justifyComposite: 'space-between', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  checklistText: { fontSize: 14, fontWeight: '700', color: theme.colors.text },
  checkboxSquare: { width: 20, height: 20, borderRadius: 6, borderWidth: 2, borderColor: '#CBD5E1', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  checkboxSquareActive: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary },
  emptyStopoversCard: { alignItems: 'center', justifyContent: 'center', padding: 24, borderWidth: 1, borderColor: '#E2E8F0', borderStyle: 'dashed', borderRadius: 16, marginBottom: 20, backgroundColor: '#F8FAFC' },
  emptyStopoversText: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', lineHeight: 18 },
  addStopoverLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', gap: 6, marginVertical: 14, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 24, backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#E2E8F0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  addStopoverLinkText: { fontSize: 14, fontWeight: '800', color: theme.colors.primary },
  timelineContainer: { position: 'relative', marginVertical: 16, paddingLeft: 4 },
  timelineTrack: { position: 'absolute', left: 12, top: 18, bottom: 18, width: 2.5, backgroundColor: '#E2E8F0', zIndex: 1 },
  timelineNodeRow: { flexDirection: 'row', alignItems: 'flex-start', marginVertical: 10, zIndex: 2 },
  timelineCircleGrey: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#9CA3AF', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  timelineCircleInnerGrey: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#9CA3AF' },
  timelineCircleBlue: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: theme.colors.primary, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  timelineCircleInnerBlue: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.primary },
  timelineContent: { flex: 1, marginLeft: 14, backgroundColor: '#F8FAFC', borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 12, paddingVertical: 10 },
  timelineHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  timelineNodeCityText: { fontSize: 14, fontWeight: '800', color: '#1F2937', flex: 1 },
  timelineNodeAddressText: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  timelineDurationContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 8, borderWidth: 1, borderColor: '#CBD5E1', paddingHorizontal: 2, paddingVertical: 1 },
  timelineDurationBtn: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  timelineDurationBtnText: { fontSize: 14, fontWeight: '800', color: theme.colors.primary },
  timelineDurationText: { fontSize: 11, fontWeight: '800', color: '#1F2937', marginHorizontal: 4 },
  timelineChevron: { paddingHorizontal: 8, alignSelf: 'center' },
  timelineEmptyRow: { paddingVertical: 20, paddingHorizontal: 12, alignItems: 'center' },
  timelineEmptyText: { fontSize: 13, color: '#9CA3AF', fontStyle: 'italic' },
  estimationCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2, marginBottom: 16 },
  estimationItem: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  estimationLabel: { fontSize: 11, color: theme.colors.textLight, fontWeight: '600' },
  estimationValue: { fontSize: 18, fontWeight: '800', color: theme.colors.text },
  estimationDivider: { width: 1, height: 40, backgroundColor: '#E5E7EB', marginHorizontal: 16 }
});
