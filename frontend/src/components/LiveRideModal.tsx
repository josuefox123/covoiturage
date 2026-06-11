import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Alert,
  Dimensions,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../styles/theme';
import * as Location from 'expo-location';
import { useAuth } from '../context/AuthContext';
import { Ride } from '../types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Centre du Bénin - Cotonou
const DEFAULT_LAT = 6.3703;
const DEFAULT_LON = 2.3764;
const DEFAULT_ZOOM = 13;

interface Coords { lat: number; lon: number; }

// Geocode un nom de lieu avec Nominatim, centré sur le Bénin
async function geocodeBenin(place: string): Promise<Coords | null> {
  try {
    const query = encodeURIComponent(`${place}, Bénin`);
    const resp = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=3&countrycodes=bj&addressdetails=1`,
      { headers: { 'User-Agent': 'CovoitBeninApp/1.0' } }
    );
    const data = await resp.json();
    if (data && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
    }
    // Fallback sans restriction de pays
    const resp2 = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`,
      { headers: { 'User-Agent': 'CovoitBeninApp/1.0' } }
    );
    const data2 = await resp2.json();
    if (data2 && data2.length > 0) {
      return { lat: parseFloat(data2[0].lat), lon: parseFloat(data2[0].lon) };
    }
    return null;
  } catch {
    return null;
  }
}

// Route via OSRM (Open Source, 100% gratuit)
async function getRoute(from: Coords, to: Coords): Promise<[number, number][] | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${from.lon},${from.lat};${to.lon},${to.lat}?overview=full&geometries=geojson`;
    const resp = await fetch(url);
    const data = await resp.json();
    if (data.routes && data.routes.length > 0) {
      const coords: [number, number][] = data.routes[0].geometry.coordinates.map(
        ([lon, lat]: [number, number]) => [lat, lon]
      );
      return coords;
    }
    return null;
  } catch {
    return null;
  }
}

// Helper to determine if it is currently time for the ride to be active (within 15 minutes of departure time or later on the same day)
const isItTimeForRide = (dateStr: string, timeStr: string) => {
  if (!dateStr || !timeStr) return false;
  const rideDate = new Date(dateStr);
  const now = new Date();
  if (rideDate.toDateString() !== now.toDateString()) return false;
  
  const [hours, minutes] = timeStr.split(':').map(Number);
  const rideTimeInMinutes = hours * 60 + minutes;
  const currentTimeInMinutes = now.getHours() * 60 + now.getMinutes();
  
  return currentTimeInMinutes >= rideTimeInMinutes - 15;
};

export default function LiveRideModal() {
  const { user, authFetch } = useAuth();
  const webviewRef = useRef<WebView>(null);
  const [visible, setVisible] = useState(false);
  const [activeRide, setActiveRide] = useState<Ride | null>(null);
  const [location, setLocation] = useState<Coords | null>(null);
  const [destCoords, setDestCoords] = useState<Coords | null>(null);
  const [departCoords, setDepartCoords] = useState<Coords | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [isDriver, setIsDriver] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [problemText, setProblemText] = useState('');
  const [sendingReport, setSendingReport] = useState(false);
  const [routeLoading, setRouteLoading] = useState(false);
  const [activeBookingId, setActiveBookingId] = useState<string | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const watchRef = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    if (!user) return;

    const checkActiveRides = async () => {
      try {
        const [ridesResp, bookingsResp] = await Promise.all([
          authFetch(`/rides/?driver=${user.id}`),
          authFetch(`/bookings/?passenger=${user.id}`),
        ]);

        const ridesData = ridesResp.results || ridesResp || [];
        const bookingsData = bookingsResp.results || bookingsResp || [];

        const driverRides: Ride[] = ridesData.filter(
          (r: Ride) => r.status === 'active' && isItTimeForRide(r.departure_date, r.departure_time)
        );
        const passengerRides: Ride[] = bookingsData
          .map((b: any) => b.ride_details)
          .filter((r: Ride) => r && r.status === 'active' && isItTimeForRide(r.departure_date, r.departure_time));

        let currentRide: Ride | null = null;
        let asDriver = false;
        let bookingId: string | null = null;

        if (driverRides.length > 0) {
          currentRide = driverRides[0];
          asDriver = true;
        } else if (passengerRides.length > 0) {
          currentRide = passengerRides[0];
          // Récupérer l'ID de la réservation correspondante
          const matchingBooking = bookingsData.find(
            (b: any) => b.ride_details && b.ride_details.id === currentRide!.id
          );
          bookingId = matchingBooking?.id || null;
        }

        if (currentRide) {
          setActiveRide(currentRide);
          setIsDriver(asDriver);
          setActiveBookingId(bookingId);
          // Only show automatically if we just started tracking
          if (!activeRide) setVisible(true); 
          startTracking();
          geocodeRide(currentRide);
        } else {
          setVisible(false);
          setIsMinimized(false);
          stopTracking();
        }
      } catch (error) {
        console.error('Error checking active rides:', error);
      }
    };

    checkActiveRides();
    const interval = setInterval(checkActiveRides, 60000);
    return () => { clearInterval(interval); stopTracking(); };
  }, [user]);

  const geocodeRide = async (ride: Ride) => {
    const [dep, dest] = await Promise.all([
      geocodeBenin(ride.departure_location),
      geocodeBenin(ride.arrival_location),
    ]);
    if (dep) setDepartCoords(dep);
    if (dest) setDestCoords(dest);
  };

  const startTracking = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;
    const loc = await Location.getCurrentPositionAsync({});
    const pos = { lat: loc.coords.latitude, lon: loc.coords.longitude };
    setLocation(pos);

    watchRef.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, timeInterval: 8000, distanceInterval: 10 },
      (newLoc) => {
        const newPos = { lat: newLoc.coords.latitude, lon: newLoc.coords.longitude };
        setLocation(newPos);
        sendToMap({ type: 'updateUserPosition', lat: newPos.lat, lon: newPos.lon });
      }
    );
  };

  const stopTracking = () => { watchRef.current?.remove(); watchRef.current = null; };

  const sendToMap = (message: object) => {
    webviewRef.current?.injectJavaScript(
      `window.handleMessage && window.handleMessage(${JSON.stringify(message)}); true;`
    );
  };

  // Quand la carte ET les coordonnées sont prêtes → charger la route
  useEffect(() => {
    if (!mapReady) return;
    if (location) sendToMap({ type: 'updateUserPosition', lat: location.lat, lon: location.lon });
    if (departCoords) sendToMap({ type: 'setDepartMarker', lat: departCoords.lat, lon: departCoords.lon });
    if (destCoords) sendToMap({ type: 'setDestMarker', lat: destCoords.lat, lon: destCoords.lon });

    if (departCoords && destCoords) {
      loadRoute(departCoords, destCoords);
      // Ajuster la vue pour inclure les deux points
      sendToMap({ type: 'fitBounds', points: [
        [departCoords.lat, departCoords.lon],
        [destCoords.lat, destCoords.lon],
      ]});
    } else if (location) {
      sendToMap({ type: 'setView', lat: location.lat, lon: location.lon, zoom: 14 });
    }
  }, [mapReady, location, departCoords, destCoords]);

  const loadRoute = async (from: Coords, to: Coords) => {
    setRouteLoading(true);
    try {
      const routeCoords = await getRoute(from, to);
      if (routeCoords) {
        sendToMap({ type: 'drawRoute', coords: routeCoords });
      }
    } finally {
      setRouteLoading(false);
    }
  };

  const onMapMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'ready') setMapReady(true);
    } catch (e) {}
  };

  const openGoogleMaps = () => {
    if (!destCoords) {
      Alert.alert('Erreur', "L'adresse d'arrivée n'a pas pu être géolocalisée.");
      return;
    }
    const origin = location ? `${location.lat},${location.lon}` : `${DEFAULT_LAT},${DEFAULT_LON}`;
    const dest = `${destCoords.lat},${destCoords.lon}`;
    const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}&travelmode=driving`;
    Linking.openURL(url).catch(() => {
      Linking.openURL(`geo:${dest}?q=${dest}`);
    });
  };

  const handleCompleteRide = () => {
    Alert.alert('Terminer le trajet', 'Avez-vous terminé ce trajet ?', [
      { text: 'Non', style: 'cancel' },
      {
        text: 'Oui, terminer',
        onPress: async () => {
          try {
            await authFetch(`/rides/${activeRide?.id}/complete/`, { method: 'POST' });
            setVisible(false);
            stopTracking();
            Alert.alert('✅ Trajet terminé', 'Merci pour ce trajet !');
          } catch (error: any) {
            Alert.alert('Erreur', error.message || 'Impossible de terminer le trajet.');
          }
        },
      },
    ]);
  };

  const handlePassengerComplete = () => {
    Alert.alert('Terminer ma réservation', 'Confirmez-vous être arrivé(e) à destination ?', [
      { text: 'Non', style: 'cancel' },
      {
        text: 'Oui, je suis arrivé(e)',
        onPress: async () => {
          try {
            if (activeBookingId) {
              await authFetch(`/bookings/${activeBookingId}/complete/`, { method: 'POST' });
            }
            setVisible(false);
            stopTracking();
            Alert.alert('✅ Arrivé(e) !', 'Votre trajet est terminé. Merci d\'avoir voyagé avec nous !');
          } catch (error: any) {
            Alert.alert('Erreur', error.message || 'Impossible de terminer la réservation.');
          }
        },
      },
    ]);
  };

  const handleSendReport = async () => {
    if (!problemText.trim()) return;
    setSendingReport(true);
    try {
      await authFetch('/conversations/report-problem/', {
        method: 'POST',
        body: JSON.stringify({ ride_id: activeRide?.id, problem: problemText.trim() }),
      });
      setShowReportModal(false);
      setProblemText('');
      Alert.alert('✅ Envoyé', "Votre problème a été signalé. L'administration vous contactera.");
    } catch (error: any) {
      Alert.alert('Erreur', error.message || 'Impossible de signaler le problème.');
    } finally {
      setSendingReport(false);
    }
  };

  const lat = location?.lat ?? DEFAULT_LAT;
  const lon = location?.lon ?? DEFAULT_LON;

  const leafletHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body, html, #map { width: 100%; height: 100%; }
    .user-dot {
      width: 18px; height: 18px;
      background: #4285F4;
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 2px 6px rgba(66,133,244,0.5);
    }
    .pulse-ring {
      width: 40px; height: 40px;
      background: rgba(66,133,244,0.25);
      border-radius: 50%;
      position: absolute;
      top: -11px; left: -11px;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0% { transform: scale(0.5); opacity: 1; }
      100% { transform: scale(1.5); opacity: 0; }
    }
    .depart-marker { background: #22C55E; width:14px; height:14px; border-radius:50%; border:3px solid white; box-shadow:0 2px 6px rgba(0,0,0,0.3); }
    .dest-marker { background: #EF4444; width:14px; height:14px; border-radius:50%; border:3px solid white; box-shadow:0 2px 6px rgba(0,0,0,0.3); }
    .leaflet-control-attribution { display: none !important; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', { zoomControl: true }).setView([${DEFAULT_LAT}, ${DEFAULT_LON}], ${DEFAULT_ZOOM});
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, detectRetina: true
    }).addTo(map);

    var userMarker = null;
    var departMarker = null;
    var destMarker = null;
    var routeLine = null;

    function makeIcon(cls) {
      return L.divIcon({ className: '', html: '<div class="' + cls + '"></div>', iconSize: [14,14], iconAnchor: [7,7] });
    }
    function makeUserIcon() {
      return L.divIcon({ className: '', html: '<div style="position:relative"><div class="pulse-ring"></div><div class="user-dot"></div></div>', iconSize: [18,18], iconAnchor: [9,9] });
    }

    window.handleMessage = function(msg) {
      if (msg.type === 'setView') {
        map.setView([msg.lat, msg.lon], msg.zoom || 14, { animate: true });
      } else if (msg.type === 'updateUserPosition') {
        if (!userMarker) userMarker = L.marker([msg.lat, msg.lon], { icon: makeUserIcon(), zIndexOffset: 1000 }).addTo(map);
        else userMarker.setLatLng([msg.lat, msg.lon]);
      } else if (msg.type === 'setDepartMarker') {
        if (!departMarker) {
          departMarker = L.marker([msg.lat, msg.lon], { icon: makeIcon('depart-marker') })
            .bindTooltip('Départ', { permanent: true, direction: 'top', offset:[0,-8] }).addTo(map);
        }
      } else if (msg.type === 'setDestMarker') {
        if (!destMarker) {
          destMarker = L.marker([msg.lat, msg.lon], { icon: makeIcon('dest-marker') })
            .bindTooltip('Arrivée', { permanent: true, direction: 'top', offset:[0,-8] }).addTo(map);
        }
      } else if (msg.type === 'drawRoute') {
        if (routeLine) map.removeLayer(routeLine);
        routeLine = L.polyline(msg.coords, {
          color: '#3B82F6',
          weight: 5,
          opacity: 0.85,
          lineJoin: 'round'
        }).addTo(map);
      } else if (msg.type === 'fitBounds') {
        map.fitBounds(msg.points, { padding: [40, 40] });
      }
    };

    map.whenReady(function() {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
    });
  </script>
</body>
</html>`;

  if (!activeRide) return null;

  if (isMinimized) {
    return (
      <TouchableOpacity 
        style={styles.floatingBubble} 
        onPress={() => {
          setIsMinimized(false);
          setVisible(true);
        }}
        activeOpacity={0.8}
      >
        <View style={styles.liveIndicatorBubble}>
          <View style={styles.liveDot} />
        </View>
        <Ionicons name="car-sport" size={24} color={theme.colors.white} />
      </TouchableOpacity>
    );
  }

  if (!visible) return null;

  return (
    <>
      <Modal visible={visible} animationType="slide" transparent>
        <View style={styles.overlay}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.liveIndicator}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>EN COURS</Text>
                {routeLoading && <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginLeft: 8 }} />}
              </View>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {activeRide.departure_location} → {activeRide.arrival_location}
              </Text>
            </View>
            <TouchableOpacity onPress={() => { setVisible(false); setIsMinimized(true); }} style={styles.closeButton}>
              <Ionicons name="remove-outline" size={26} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          {/* Map */}
          <View style={styles.mapContainer}>
            <WebView
              ref={webviewRef}
              originWhitelist={['*']}
              source={{ html: leafletHtml }}
              onMessage={onMapMessage}
              javaScriptEnabled
              domStorageEnabled
              style={styles.map}
              scrollEnabled={false}
            />
            {!mapReady && (
              <View style={styles.mapLoader}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text style={styles.mapLoaderText}>Chargement de la carte...</Text>
              </View>
            )}

            {/* Boutons superposés sur la carte */}
            {mapReady && (
              <View style={styles.mapControls}>
                {/* Recentrer sur ma position */}
                <TouchableOpacity
                  style={styles.controlBtn}
                  onPress={() => location && sendToMap({ type: 'setView', lat: location.lat, lon: location.lon, zoom: 15 })}
                >
                  <Ionicons name="locate" size={20} color={theme.colors.primary} />
                </TouchableOpacity>

                {/* Ouvrir Google Maps */}
                <TouchableOpacity style={styles.controlBtn} onPress={openGoogleMaps}>
                  <Ionicons name="navigate" size={20} color="#4285F4" />
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Légende de la route */}
          {(departCoords || destCoords) && (
            <View style={styles.legendRow}>
              {departCoords && (
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: theme.colors.success }]} />
                  <Text style={styles.legendText} numberOfLines={1}>{activeRide.departure_location}</Text>
                </View>
              )}
              {destCoords && (
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: theme.colors.error }]} />
                  <Text style={styles.legendText} numberOfLines={1}>{activeRide.arrival_location}</Text>
                </View>
              )}
            </View>
          )}

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.googleMapsBtn} onPress={openGoogleMaps}>
              <Ionicons name="map" size={18} color="#4285F4" />
              <Text style={styles.googleMapsBtnText}>Navigation GPS sur Google Maps</Text>
              <Ionicons name="open-outline" size={16} color="#4285F4" />
            </TouchableOpacity>

            <View style={styles.actionRow}>
              {isDriver ? (
                <TouchableOpacity style={styles.completeBtn} onPress={handleCompleteRide}>
                  <Ionicons name="checkmark-circle" size={20} color={theme.colors.white} />
                  <Text style={styles.completeBtnText}>Terminer le trajet</Text>
                </TouchableOpacity>
              ) : (
                <>
                  <TouchableOpacity style={styles.completeBtn} onPress={handlePassengerComplete}>
                    <Ionicons name="checkmark-circle" size={20} color={theme.colors.white} />
                    <Text style={styles.completeBtnText}>Je suis arrivé(e)</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.reportBtn} onPress={() => setShowReportModal(true)}>
                    <Ionicons name="warning-outline" size={20} color={theme.colors.white} />
                    <Text style={styles.reportBtnText}>Signaler</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* Report Problem Modal */}
      <Modal visible={showReportModal} transparent animationType="fade">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.reportOverlay}>
          <View style={styles.reportCard}>
            <Text style={styles.reportTitle}>🚨 Signaler un problème</Text>
            <Text style={styles.reportSubtitle}>Décrivez brièvement le problème. L'administration sera alertée immédiatement.</Text>
            <TextInput
              style={styles.reportInput}
              placeholder="Ex: retard important, comportement dangereux..."
              placeholderTextColor={theme.colors.textLight}
              value={problemText}
              onChangeText={setProblemText}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <View style={styles.reportActions}>
              <TouchableOpacity style={styles.reportCancelBtn} onPress={() => { setShowReportModal(false); setProblemText(''); }}>
                <Text style={styles.reportCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.reportSendBtn, !problemText.trim() && styles.reportSendBtnDisabled]}
                onPress={handleSendReport}
                disabled={sendingReport || !problemText.trim()}
              >
                {sendingReport ? <ActivityIndicator size="small" color={theme.colors.white} /> : <Text style={styles.reportSendText}>Envoyer</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: theme.colors.white,
    marginTop: 40,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 20,
  },
  floatingBubble: {
    position: 'absolute',
    bottom: 160, // Au-dessus de la bulle de messagerie (qui est à 90)
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
    zIndex: 9999,
  },
  liveIndicatorBubble: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: theme.colors.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.colors.white,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.background,
  },
  headerLeft: { flex: 1, marginRight: 12 },
  liveIndicator: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.success },
  liveText: { fontSize: 11, fontWeight: 'bold', color: theme.colors.success, letterSpacing: 1 },
  headerTitle: { fontSize: 16, fontWeight: 'bold', color: theme.colors.text },
  closeButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center' },
  mapContainer: { flex: 1, position: 'relative' },
  map: { flex: 1 },
  mapLoader: { position: 'absolute', inset: 0, backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center' },
  mapLoaderText: { marginTop: 12, fontSize: 14, color: theme.colors.textLight },
  mapControls: {
    position: 'absolute',
    right: 12,
    bottom: 16,
    gap: 8,
  },
  controlBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
    marginBottom: 8,
  },
  legendRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: theme.colors.background,
    gap: 16,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 12, color: theme.colors.text, fontWeight: '500', flex: 1 },
  footer: {
    padding: 16,
    backgroundColor: theme.colors.white,
    borderTopWidth: 1,
    borderTopColor: theme.colors.background,
    gap: 10,
  },
  googleMapsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    padding: 12,
    borderRadius: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  googleMapsBtnText: { fontSize: 14, color: '#4285F4', fontWeight: '600', flex: 1 },
  actionRow: { flexDirection: 'row', gap: 12 },
  completeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: theme.colors.success, padding: 14, borderRadius: 12, gap: 8,
  },
  completeBtnText: { color: theme.colors.white, fontSize: 15, fontWeight: 'bold' },
  reportBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: theme.colors.error, padding: 14, borderRadius: 12, gap: 8,
  },
  reportBtnText: { color: theme.colors.white, fontSize: 15, fontWeight: 'bold' },
  // Report Modal
  reportOverlay: { flex: 1, backgroundColor: theme.colors.overlay, justifyContent: 'flex-end' },
  reportCard: { backgroundColor: theme.colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  reportTitle: { fontSize: 20, fontWeight: 'bold', color: theme.colors.text, marginBottom: 8 },
  reportSubtitle: { fontSize: 14, color: theme.colors.textLight, marginBottom: 16, lineHeight: 20 },
  reportInput: {
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, padding: 14,
    fontSize: 14, color: theme.colors.text, minHeight: 100, backgroundColor: theme.colors.background, marginBottom: 16,
  },
  reportActions: { flexDirection: 'row', gap: 12 },
  reportCancelBtn: { flex: 1, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center' },
  reportCancelText: { fontSize: 15, color: theme.colors.textLight, fontWeight: '600' },
  reportSendBtn: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: theme.colors.error, alignItems: 'center' },
  reportSendBtnDisabled: { backgroundColor: '#FCA5A5' },
  reportSendText: { fontSize: 15, color: theme.colors.white, fontWeight: 'bold' },
});
