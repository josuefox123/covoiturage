import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../../../src/styles/theme';

interface ItineraryStepProps {
  departure: string;
  arrival: string;
  departureCords: any;
  arrivalCords: any;
  mapSource: any;
  googleRoutes: any[];
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
  estimationLoading
}: ItineraryStepProps) {
  return (
    <View>
      <Text style={styles.stepTitle}>Où allez-vous ?</Text>
      <Text style={styles.stepSubtitle}>Choisissez votre point de départ, votre destination et l'itinéraire</Text>

      <View style={styles.routeCard}>
        {/* Departure */}
        <TouchableOpacity
          style={styles.locationRow}
          onPress={() => onPickLocation('departure')}
          activeOpacity={0.7}
        >
          <View style={styles.dotGreen} />
          <View style={styles.locationContent}>
            <Text style={styles.locationLabel}>Départ</Text>
            <Text style={[styles.locationValue, !departure && styles.locationPlaceholder]}>
              {departure || 'Choisir le lieu de départ'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#C4C4C4" />
        </TouchableOpacity>

        <View style={styles.routeDivider}>
          <View style={styles.routeLine} />
        </View>

        {/* Arrival */}
        <TouchableOpacity
          style={styles.locationRow}
          onPress={() => onPickLocation('arrival')}
          activeOpacity={0.7}
        >
          <View style={styles.dotRed} />
          <View style={styles.locationContent}>
            <Text style={styles.locationLabel}>Arrivée</Text>
            <Text style={[styles.locationValue, !arrival && styles.locationPlaceholder]}>
              {arrival || 'Choisir la destination'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#C4C4C4" />
        </TouchableOpacity>
      </View>

      {/* Route Selector */}
      {googleRoutes.length > 0 && (
        <View style={styles.routeSelectorCard}>
          <Text style={styles.routeSelectorTitle}>Quelle route prenez-vous ?</Text>
          {googleRoutes.map((r, idx) => (
            <TouchableOpacity
              key={idx}
              style={[
                styles.routeSelectorItem,
                selectedRouteIndex === idx && styles.routeSelectorItemActive
              ]}
              onPress={() => onSelectRoute(idx)}
              activeOpacity={0.8}
            >
              <View style={styles.routeRadioCircle}>
                {selectedRouteIndex === idx && <View style={styles.routeRadioInner} />}
              </View>
              <View style={styles.routeSelectorContent}>
                <Text style={styles.routeTimeText}>
                  {r.durationText.replace('hours', 'h').replace('hour', 'h').replace('mins', 'min').replace('min', 'min')}
                </Text>
                <Text style={styles.routeDistanceText}>
                  {r.distanceText} - {r.summary || 'Itinéraire proposé'}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Map WebView */}
      {departureCords && arrivalCords && mapSource && (
        <View style={styles.mapContainer}>
          {estimationLoading && (
            <ActivityIndicator size="large" color={theme.colors.primary} style={StyleSheet.absoluteFill} />
          )}
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
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  stepTitle: { fontSize: 22, fontWeight: '800', color: theme.colors.text, marginTop: 20, marginBottom: 6 },
  stepSubtitle: { fontSize: 14, color: theme.colors.textLight, marginBottom: 20, lineHeight: 20 },
  routeCard: {
    backgroundColor: '#FFFFFF', borderRadius: 20, paddingVertical: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.07, shadowRadius: 12, elevation: 4,
    marginBottom: 16,
  },
  locationRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  dotGreen: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#22C55E', borderWidth: 2, borderColor: '#DCFCE7' },
  dotRed: { width: 12, height: 12, borderRadius: 6, backgroundColor: theme.colors.primary, borderWidth: 2, borderColor: `${theme.colors.primary}30` },
  routeDivider: { marginLeft: 28, paddingLeft: 16, borderLeftWidth: 2, borderLeftColor: '#E5E7EB', borderStyle: 'dashed', paddingVertical: 4 },
  routeLine: { height: 12 },
  locationContent: { flex: 1, marginLeft: 14 },
  locationLabel: { fontSize: 11, color: theme.colors.textLight, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  locationValue: { fontSize: 16, fontWeight: '700', color: theme.colors.text },
  locationPlaceholder: { color: '#C4C4C4', fontWeight: '400' },
  mapContainer: { height: 220, borderRadius: 16, overflow: 'hidden', marginTop: 8, marginBottom: 16, borderWidth: 1, borderColor: '#E5E7EB', position: 'relative' },
  map: { flex: 1 },
  routeSelectorCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  routeSelectorTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.text, marginBottom: 12 },
  routeSelectorItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 14, padding: 14, marginBottom: 10 },
  routeSelectorItemActive: { borderColor: theme.colors.primary, backgroundColor: `${theme.colors.primary}08` },
  routeRadioCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: theme.colors.primary, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  routeRadioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: theme.colors.primary },
  routeSelectorContent: { flex: 1 },
  routeTimeText: { fontSize: 15, fontWeight: '700', color: theme.colors.text },
  routeDistanceText: { fontSize: 13, color: theme.colors.textLight, marginTop: 2 }
});
