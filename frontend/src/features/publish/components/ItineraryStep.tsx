import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../../../src/styles/theme';

interface RouteOption {
  durationText: string;
  distanceText: string;
  summary?: string;
}

interface ItineraryStepProps {
  departure: string;
  arrival: string;
  departureCords: any;
  arrivalCords: any;
  mapSource: any;
  googleRoutes: RouteOption[];
  selectedRouteIndex: number;
  webviewRef: any;
  onMapMessage: (e: any) => void;
  onPickLocation: (type: 'departure' | 'arrival') => void;
  onSelectRoute: (idx: number) => void;
  estimationLoading: boolean;
}

export function ItineraryStep({
  departure,
  arrival,
  departureCords,
  arrivalCords,
  mapSource,
  googleRoutes,
  selectedRouteIndex,
  webviewRef,
  onMapMessage,
  onPickLocation,
  onSelectRoute,
  estimationLoading,
}: ItineraryStepProps) {
  const formatDuration = (duration: string) => {
    if (!duration) return '--';

    return duration
      .replace(/\bhours?\b/gi, 'h')
      .replace(/\bmins?\b/gi, 'min')
      .replace(/\bminutes?\b/gi, 'min')
      .replace(/\s+/g, ' ')
      .trim();
  };

  return (
    <View style={styles.container}>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Ionicons
            name="navigate"
            size={20}
            color={theme.colors.primary}
          />
        </View>

        <View style={styles.headerContent}>
          <Text style={styles.stepTitle}>
            Où allez-vous ?
          </Text>

          <Text style={styles.stepSubtitle}>
            Indiquez votre départ et votre destination
          </Text>
        </View>
      </View>

      {/* Route card */}
      <View style={styles.routeCard}>

        {/* Departure */}
        <TouchableOpacity
          style={styles.locationRow}
          onPress={() => onPickLocation('departure')}
          activeOpacity={0.75}
        >
          <View style={styles.timeline}>
            <View style={styles.departureDot}>
              <View style={styles.departureDotInner} />
            </View>
          </View>

          <View style={styles.locationContent}>
            <Text style={styles.locationLabel}>
              DÉPART
            </Text>

            <Text
              numberOfLines={2}
              style={[
                styles.locationValue,
                !departure && styles.locationPlaceholder,
              ]}
            >
              {departure || 'Choisir le lieu de départ'}
            </Text>
          </View>

          <View style={styles.locationAction}>
            <Ionicons
              name={departure ? 'create-outline' : 'chevron-forward'}
              size={20}
              color={departure ? theme.colors.primary : '#94A3B8'}
            />
          </View>
        </TouchableOpacity>

        {/* Timeline */}
        <View style={styles.timelineConnector}>
          <View style={styles.timelineLine} />
        </View>

        {/* Arrival */}
        <TouchableOpacity
          style={styles.locationRow}
          onPress={() => onPickLocation('arrival')}
          activeOpacity={0.75}
        >
          <View style={styles.timeline}>
            <View style={styles.arrivalDot}>
              <View style={styles.arrivalDotInner} />
            </View>
          </View>

          <View style={styles.locationContent}>
            <Text style={styles.locationLabel}>
              ARRIVÉE
            </Text>

            <Text
              numberOfLines={2}
              style={[
                styles.locationValue,
                !arrival && styles.locationPlaceholder,
              ]}
            >
              {arrival || 'Choisir la destination'}
            </Text>
          </View>

          <View style={styles.locationAction}>
            <Ionicons
              name={arrival ? 'create-outline' : 'chevron-forward'}
              size={20}
              color={arrival ? theme.colors.primary : '#94A3B8'}
            />
          </View>
        </TouchableOpacity>

      </View>

      {/* Routes */}
      {googleRoutes.length > 0 && (
        <View style={styles.routesSection}>

          <View style={styles.routesHeader}>
            <View>
              <Text style={styles.routesTitle}>
                Itinéraires disponibles
              </Text>

              <Text style={styles.routesSubtitle}>
                Choisissez l'itinéraire qui vous convient
              </Text>
            </View>

            <View style={styles.routesCount}>
              <Text style={styles.routesCountText}>
                {googleRoutes.length}
              </Text>
            </View>
          </View>

          <View style={styles.routesList}>
            {googleRoutes.map((route, idx) => {
              const isSelected = selectedRouteIndex === idx;
              const isRecommended = idx === 0;

              return (
                <TouchableOpacity
                  key={idx}
                  style={[
                    styles.routeItem,
                    isSelected && styles.routeItemSelected,
                  ]}
                  onPress={() => onSelectRoute(idx)}
                  activeOpacity={0.8}
                >
                  {/* Radio */}
                  <View
                    style={[
                      styles.radio,
                      isSelected && styles.radioSelected,
                    ]}
                  >
                    {isSelected && (
                      <View style={styles.radioInner} />
                    )}
                  </View>

                  {/* Route information */}
                  <View style={styles.routeInfo}>

                    <View style={styles.routeTopRow}>
                      <Text style={styles.routeDuration}>
                        {formatDuration(route.durationText)}
                      </Text>

                      {isRecommended && (
                        <View style={styles.recommendedBadge}>
                          <Ionicons
                            name="sparkles"
                            size={11}
                            color="#047857"
                          />

                          <Text style={styles.recommendedText}>
                            Recommandé
                          </Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.routeMeta}>

                      <View style={styles.metaItem}>
                        <Ionicons
                          name="speedometer-outline"
                          size={14}
                          color="#64748B"
                        />

                        <Text style={styles.routeDistance}>
                          {route.distanceText}
                        </Text>
                      </View>

                      {route.summary && (
                        <>
                          <View style={styles.metaSeparator} />

                          <Text
                            numberOfLines={1}
                            style={styles.routeSummary}
                          >
                            {route.summary}
                          </Text>
                        </>
                      )}

                    </View>
                  </View>

                  {/* Check */}
                  {isSelected && (
                    <View style={styles.checkContainer}>
                      <Ionicons
                        name="checkmark"
                        size={16}
                        color="#FFFFFF"
                      />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {/* Map */}
      {departureCords && arrivalCords && mapSource && (
        <View style={styles.mapSection}>

          <View style={styles.mapHeader}>
            <View style={styles.mapTitleContainer}>
              <Ionicons
                name="map-outline"
                size={18}
                color={theme.colors.primary}
              />

              <Text style={styles.mapTitle}>
                Aperçu du trajet
              </Text>
            </View>

            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />

              <Text style={styles.liveText}>
                Itinéraire
              </Text>
            </View>
          </View>

          <View style={styles.mapContainer}>

            <WebView
              ref={webviewRef}
              originWhitelist={['*']}
              source={mapSource}
              style={styles.map}
              scrollEnabled={false}
              domStorageEnabled
              javaScriptEnabled
              onMessage={onMapMessage}
            />

            {/* Loading overlay */}
            {estimationLoading && (
              <View style={styles.mapLoadingOverlay}>
                <View style={styles.loadingCard}>
                  <ActivityIndicator
                    size="small"
                    color={theme.colors.primary}
                  />

                  <Text style={styles.loadingText}>
                    Calcul de l'itinéraire...
                  </Text>
                </View>
              </View>
            )}

            {/* Map controls decoration */}
            {!estimationLoading && (
              <View style={styles.mapFloatingBadge}>
                <Ionicons
                  name="navigate"
                  size={14}
                  color={theme.colors.primary}
                />

                <Text style={styles.mapFloatingText}>
                  Trajet sélectionné
                </Text>
              </View>
            )}

          </View>
        </View>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },

  /* HEADER */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 18,
  },

  headerIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: `${theme.colors.primary}12`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },

  headerContent: {
    flex: 1,
  },

  stepTitle: {
    fontSize: 23,
    fontWeight: '800',
    color: theme.colors.text,
    letterSpacing: -0.4,
  },

  stepSubtitle: {
    fontSize: 13,
    color: theme.colors.textLight,
    marginTop: 3,
    lineHeight: 18,
  },

  /* LOCATION CARD */
  routeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E8EDF3',
    paddingVertical: 6,
    shadowColor: '#0F172A',
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 3,
    marginBottom: 20,
  },

  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 76,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },

  timeline: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },

  departureDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#DCFCE7',
    justifyContent: 'center',
    alignItems: 'center',
  },

  departureDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#16A34A',
  },

  arrivalDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: `${theme.colors.primary}18`,
    justifyContent: 'center',
    alignItems: 'center',
  },

  arrivalDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.primary,
  },

  timelineConnector: {
    position: 'absolute',
    left: 29,
    top: 72,
    height: 35,
    zIndex: 2,
  },

  timelineLine: {
    width: 1.5,
    height: '100%',
    backgroundColor: '#CBD5E1',
  },

  locationContent: {
    flex: 1,
    marginLeft: 10,
    marginRight: 10,
  },

  locationLabel: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 4,
  },

  locationValue: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text,
    lineHeight: 20,
  },

  locationPlaceholder: {
    color: '#94A3B8',
    fontWeight: '500',
  },

  locationAction: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* ROUTES */
  routesSection: {
    marginBottom: 20,
  },

  routesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },

  routesTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: theme.colors.text,
  },

  routesSubtitle: {
    fontSize: 12,
    color: theme.colors.textLight,
    marginTop: 3,
  },

  routesCount: {
    minWidth: 30,
    height: 30,
    paddingHorizontal: 8,
    borderRadius: 15,
    backgroundColor: `${theme.colors.primary}12`,
    justifyContent: 'center',
    alignItems: 'center',
  },

  routesCountText: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.primary,
  },

  routesList: {
    gap: 10,
  },

  routeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 17,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },

  routeItemSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: `${theme.colors.primary}07`,
  },

  radio: {
    width: 21,
    height: 21,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },

  radioSelected: {
    borderColor: theme.colors.primary,
  },

  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.primary,
  },

  routeInfo: {
    flex: 1,
  },

  routeTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  routeDuration: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.text,
  },

  recommendedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },

  recommendedText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#047857',
  },

  routeMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },

  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  routeDistance: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },

  metaSeparator: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    marginHorizontal: 7,
  },

  routeSummary: {
    flex: 1,
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },

  checkContainer: {
    width: 27,
    height: 27,
    borderRadius: 14,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },

  /* MAP */
  mapSection: {
    marginBottom: 20,
  },

  mapHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },

  mapTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },

  mapTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.text,
  },

  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 5,
    gap: 5,
  },

  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22C55E',
  },

  liveText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },

  mapContainer: {
    height: 240,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    position: 'relative',
    backgroundColor: '#E2E8F0',
  },

  map: {
    flex: 1,
  },

  mapLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  loadingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 5,
  },

  loadingText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.text,
  },

  mapFloatingBadge: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    gap: 5,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },

  mapFloatingText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#334155',
  },
});
