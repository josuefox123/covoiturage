import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TitreSection } from './AnimationsFade';
import { C, SHsm } from './theme-trajet';

interface CarteItineraireProps {
  ride: any;
  departure?: string;
  destination?: string;
  heureArrivee: string;
}

/**
 * Carte d'itinéraire complet du trajet :
 * départ → escales → arrivée avec horaires.
 */
export function CarteItineraire({ ride, departure, destination, heureArrivee }: CarteItineraireProps) {
  const titre = departure && destination ? 'Itinéraire complet' : 'Itinéraire';

  return (
    <View style={styles.carte}>
      <TitreSection titre={titre} icone="map-outline" />
      <View>
        {/* Départ */}
        <View style={{ flexDirection: 'row', gap: 16 }}>
          <View style={{ alignItems: 'center', width: 20 }}>
            <View style={[styles.itDot, { backgroundColor: C.primary, width: 14, height: 14 }]} />
            <View style={styles.itLine} />
          </View>
          <View style={{ flex: 1, paddingBottom: 20 }}>
            <Text style={styles.itCity}>{ride.departure_location.split(',')[0]}</Text>
            <Text style={styles.itTime}>{ride.departure_time?.substring(0, 5)}</Text>
          </View>
        </View>

        {/* Escales */}
        {(ride.stopovers || []).map((stop: any, idx: number) => (
          <View key={idx} style={{ flexDirection: 'row', gap: 16 }}>
            <View style={{ alignItems: 'center', width: 20 }}>
              <View style={[styles.itDot, { backgroundColor: C.warning, width: 10, height: 10 }]} />
              <View style={styles.itLine} />
            </View>
            <View style={{ flex: 1, paddingBottom: 20 }}>
              <Text style={styles.itCity}>{(stop.name || stop.location || 'Escale').split(',')[0]}</Text>
              {stop.arrival_time && (
                <Text style={styles.itTime}>{stop.arrival_time?.substring(0, 5)}</Text>
              )}
            </View>
          </View>
        ))}

        {/* Arrivée */}
        <View style={{ flexDirection: 'row', gap: 16 }}>
          <View style={{ alignItems: 'center', width: 20 }}>
            <View style={[styles.itDot, { backgroundColor: C.error, width: 14, height: 14 }]} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.itCity}>{ride.arrival_location.split(',')[0]}</Text>
            <Text style={styles.itTime}>{heureArrivee}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  carte: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, ...SHsm },
  itDot: { borderRadius: 8, borderWidth: 2, borderColor: '#FFFFFF', ...SHsm },
  itLine: { flex: 1, width: 2, backgroundColor: '#E2E8F0', marginVertical: 4, borderRadius: 1, minHeight: 24 },
  itCity: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  itTime: { fontSize: 12, color: '#64748B', marginTop: 2, fontWeight: '500' }
});
