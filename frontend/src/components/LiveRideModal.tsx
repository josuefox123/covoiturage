/**
 * ==============================================================
 * Fichier :
 * LiveRideModal.tsx
 *
 * Description :
 * Composant ou logique de l'application Zemy.
 *
 * Projet :
 * Zemy
 * ==============================================================
 */
import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, Alert,
  Dimensions, ActivityIndicator, TextInput, KeyboardAvoidingView,
  Platform, Linking,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../styles/theme';
import * as Location from 'expo-location';
import { useAuth } from '../context/AuthContext';
import { Ride } from '../types';
import { CustomAlert } from '../utils/CustomAlert';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const DEFAULT_LAT = 6.3703;
const DEFAULT_LON = 2.3764;
const DEFAULT_ZOOM = 13;

interface Coords { lat: number; lon: number; }

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
    const resp2 = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`,
      { headers: { 'User-Agent': 'CovoitBeninApp/1.0' } }
    );
    const data2 = await resp2.json();
    if (data2 && data2.length > 0) {
      return { lat: parseFloat(data2[0].lat), lon: parseFloat(data2[0].lon) };
    }
    return null;
  } catch (err) {
    return null;
  }
}

interface RouteData {
  coords: [number, number][];
  distance: number;
  duration: number;
}

const formatDuration = (seconds: number): string => {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  if (remainingMins === 0) return `${hours}h`;
  return `${hours}h ${remainingMins}m`;
};

const formatDistance = (meters: number): string => {
  if (meters < 1000) return `${Math.round(meters)} m`;
  const kms = (meters / 1000).toFixed(1);
  return `${kms} km`;
};

async function getRoutes(from: Coords, to: Coords): Promise<RouteData[] | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${from.lon},${from.lat};${to.lon},${to.lat}?overview=full&geometries=geojson&alternatives=true`;
    const resp = await fetch(url);
    const data = await resp.json();
    if (data.routes && data.routes.length > 0) {
      return data.routes.map((r: any) => {
        const coords: [number, number][] = r.geometry.coordinates.map(
          ([lon, lat]: [number, number]) => [lat, lon]
        );
        return {
          coords,
          distance: r.distance,
          duration: r.duration
        };
      });
    }
    return null;
  } catch (err) {
    return null;
  }
}

const isItTimeForLiveRide = (dateStr: string, timeStr: string) => {
  if (!dateStr || !timeStr) return false;
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, minutes] = timeStr.split(':').map(Number);
  const departureDate = new Date(year, month - 1, day, hours, minutes, 0, 0);
  const now = new Date();
  const tenMinutesBefore = new Date(departureDate.getTime() - 10 * 60 * 1000);
  return now.getTime() >= tenMinutesBefore.getTime();
};

/**
 * Composant LiveRideModal.
 *
 * Responsabilités :
 * - Affichage et gestion de l'état lié à LiveRideModal.
 */
export default function LiveRideModal() {
  const { user, authFetch } = useAuth();
  const webviewRef = useRef<WebView>(null);
  const watchRef = useRef<Location.LocationSubscription | null>(null);
  const isMountedRef = useRef(true);

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
  const [routes, setRoutes] = useState<RouteData[]>([]);
  const [activeRouteIndex, setActiveRouteIndex] = useState<number>(0);

  const activeRideRef = useRef<Ride | null>(null);
  const isDriverRef = useRef<boolean>(false);

  useEffect(() => {
    activeRideRef.current = activeRide;
  }, [activeRide]);

  useEffect(() => {
    isDriverRef.current = isDriver;
  }, [isDriver]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    let mounted = true;

    const checkActiveRides = async () => {
      try {
        const [ridesResp, bookingsResp] = await Promise.all([
          authFetch(`/rides/?driver=${user.id}`),
          authFetch(`/bookings/?passenger=${user.id}`),
        ]);

        if (!mounted || !isMountedRef.current) return;

        const ridesData = ridesResp.results || ridesResp || [];
        const bookingsData = bookingsResp.results || bookingsResp || [];

        const driverRides: Ride[] = ridesData.filter(
          (r: Ride) => (r.status === 'active' || r.status === 'started') && isItTimeForLiveRide(r.departure_date, r.departure_time)
        );
        const passengerRides: Ride[] = bookingsData
          .filter((b: any) => b.status === 'confirmed' && b.payment_status !== 'pending')
          .map((b: any) => b.ride_details)
          .filter((r: Ride) => r && (r.status === 'active' || r.status === 'started') && isItTimeForLiveRide(r.departure_date, r.departure_time));

        let currentRide: Ride | null = null;
        let asDriver = false;
        let bookingId: string | null = null;

        if (driverRides.length > 0) {
          currentRide = driverRides[0];
          asDriver = true;
        } else if (passengerRides.length > 0) {
          currentRide = passengerRides[0];
          const matchingBooking = bookingsData.find(
            (b: any) => b.ride_details && b.ride_details.id === currentRide!.id
          );
          bookingId = matchingBooking?.id || null;
        }

        if (currentRide) {
          setActiveRide(currentRide);
          setIsDriver(asDriver);
          setActiveBookingId(bookingId);
          setVisible(true);
          await geocodeRide(currentRide);
          if (currentRide.status === 'started') {
            await startTracking();
          } else {
            stopTracking();
          }
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
    const delay = visible ? 10000 : 60000;
    const interval = setInterval(checkActiveRides, delay);
    
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [user, authFetch, visible]);

  const geocodeRide = async (ride: Ride) => {
    try {
      let dep: Coords | null = null;
      let dest: Coords | null = null;

      // Try using pre-stored coordinates first
      if (ride.departure_latitude !== null && ride.departure_latitude !== undefined &&
          ride.departure_longitude !== null && ride.departure_longitude !== undefined) {
        dep = {
          lat: Number(ride.departure_latitude),
          lon: Number(ride.departure_longitude),
        };
      }
      if (ride.arrival_latitude !== null && ride.arrival_latitude !== undefined &&
          ride.arrival_longitude !== null && ride.arrival_longitude !== undefined) {
        dest = {
          lat: Number(ride.arrival_latitude),
          lon: Number(ride.arrival_longitude),
        };
      }

      // Fallback to geocoding if coordinates are missing
      if (!dep && ride.departure_location) {
        dep = await geocodeBenin(ride.departure_location);
      }
      if (!dest && ride.arrival_location) {
        dest = await geocodeBenin(ride.arrival_location);
      }

      if (!isMountedRef.current) return;
      if (dep) setDepartCoords(dep);
      if (dest) setDestCoords(dest);
    } catch (err) {
      console.log('Error setting ride coords:', err);
    }
  };

  const startTracking = async () => {
    if (watchRef.current) return;

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;

    const loc = await Location.getCurrentPositionAsync({});
    if (!isMountedRef.current) return;

    const pos = { lat: loc.coords.latitude, lon: loc.coords.longitude };
    setLocation(pos);

    // Initial position upload if driver is already started
    const currentActiveRide = activeRideRef.current;
    const currentIsDriver = isDriverRef.current;
    if (currentIsDriver && currentActiveRide && currentActiveRide.status === 'started') {
      authFetch(`/rides/${currentActiveRide.id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driver_latitude: pos.lat,
          driver_longitude: pos.lon
        })
      }).catch(err => console.log('Error updating driver initial location:', err));
    }

    watchRef.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, timeInterval: 8000, distanceInterval: 10 },
      (newLoc) => {
        if (!isMountedRef.current) return;
        const newPos = { lat: newLoc.coords.latitude, lon: newLoc.coords.longitude };
        setLocation(newPos);
        sendToMap({ type: 'updateUserPosition', lat: newPos.lat, lon: newPos.lon });

        const latestActiveRide = activeRideRef.current;
        const latestIsDriver = isDriverRef.current;
        if (latestIsDriver && latestActiveRide && latestActiveRide.status === 'started') {
          authFetch(`/rides/${latestActiveRide.id}/`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              driver_latitude: newPos.lat,
              driver_longitude: newPos.lon
            })
          }).catch(err => console.log('Error updating driver location:', err));
        }
      }
    );
  };

  const stopTracking = () => {
    if (watchRef.current) {
      watchRef.current.remove();
      watchRef.current = null;
    }
  };

  const sendToMap = (message: object) => {
    webviewRef.current?.injectJavaScript(
      `window.handleMessage && window.handleMessage(${JSON.stringify(message)}); true;`
    );
  };

  useEffect(() => {
    if (!mapReady || !location) return;
    sendToMap({ type: 'updateUserPosition', lat: location.lat, lon: location.lon });
  }, [location, mapReady]);

  useEffect(() => {
    if (!mapReady || !activeRide || isDriver) return;
    if (activeRide.driver_latitude !== null && activeRide.driver_latitude !== undefined &&
        activeRide.driver_longitude !== null && activeRide.driver_longitude !== undefined) {
      sendToMap({
        type: 'updateDriverPosition',
        lat: activeRide.driver_latitude,
        lon: activeRide.driver_longitude
      });
    }
  }, [activeRide, mapReady, isDriver]);

  useEffect(() => {
    if (!mapReady || !departCoords) return;
    sendToMap({ type: 'setDepartMarker', lat: departCoords.lat, lon: departCoords.lon });
  }, [departCoords, mapReady]);

  useEffect(() => {
    if (!mapReady || !destCoords) return;
    sendToMap({ type: 'setDestMarker', lat: destCoords.lat, lon: destCoords.lon });
  }, [destCoords, mapReady]);

  useEffect(() => {
    if (!mapReady || !departCoords || !destCoords) return;
    loadRoute(departCoords, destCoords);
  }, [departCoords, destCoords, mapReady]);

  useEffect(() => {
    if (!mapReady || routes.length === 0) return;
    sendToMap({ type: 'drawRoutes', routes, activeIndex: activeRouteIndex });
  }, [routes, activeRouteIndex, mapReady]);

  const loadRoute = async (from: Coords, to: Coords) => {
    setRouteLoading(true);
    try {
      const fetchedRoutes = await getRoutes(from, to);
      if (!isMountedRef.current) return;

      if (fetchedRoutes && fetchedRoutes.length > 0) {
        setRoutes(fetchedRoutes);
        setActiveRouteIndex(0);
        sendToMap({ type: 'fitBounds', points: [
          [from.lat, from.lon],
          [to.lat, to.lon],
        ]});
      } else {
        setRoutes([]);
        sendToMap({
          type: 'fitBounds',
          points: [
            [from.lat, from.lon],
            [to.lat, to.lon],
          ]
        });
      }
    } finally {
      if (isMountedRef.current) {
        setRouteLoading(false);
      }
    }
  };

  const onMapMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'ready' && isMountedRef.current) {
        setMapReady(true);
      } else if (data.type === 'selectRoute' && isMountedRef.current) {
        setActiveRouteIndex(data.index);
      }
    } catch (err) {
    }
  };

  const openGoogleMaps = () => {
    if (!destCoords) {
      CustomAlert.alert('Erreur', "L'adresse d'arrivée n'a pas pu être géolocalisée.");
      return;
    }
    const dest = `${destCoords.lat},${destCoords.lon}`;
    
    const url = Platform.select({
      android: `google.navigation:q=${dest}`,
      ios: `comgooglemaps://?daddr=${dest}&directionsmode=driving`,
    });

    Linking.canOpenURL(url!).then(supported => {
      if (supported) {
        return Linking.openURL(url!);
      } else {
        const fallbackUrl = Platform.select({
          ios: `http://maps.apple.com/?daddr=${dest}`,
          android: `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving`
        });
        return Linking.openURL(fallbackUrl!);
      }
    }).catch(err => console.log(err));
  };

  const handleStartRide = () => {
    CustomAlert.alert('Démarrer le trajet', 'Voulez-vous démarrer ce trajet ? Le suivi GPS sera activé.', [
      { text: 'Non', style: 'cancel' },
      {
        text: 'Oui, démarrer',
        onPress: async () => {
          try {
            await authFetch(`/rides/${activeRide?.id}/start/`, { method: 'POST' });
            // Fetch updated ride details
            const resp = await authFetch(`/rides/${activeRide?.id}/`);
            if (!isMountedRef.current) return;
            const updatedRide = resp.results || resp;
            setActiveRide(updatedRide);
            await startTracking();
            CustomAlert.alert('✅ Trajet démarré', 'Le trajet a commencé. Bonne route !');
          } catch (error: any) {
            CustomAlert.alert('Erreur', error.message || 'Impossible de démarrer le trajet.');
          }
        },
      },
    ]);
  };

  const handleCompleteRide = () => {
    CustomAlert.alert('Terminer le trajet', 'Avez-vous terminé ce trajet ?', [
      { text: 'Non', style: 'cancel' },
      {
        text: 'Oui, terminer',
        onPress: async () => {
          try {
            await authFetch(`/rides/${activeRide?.id}/complete/`, { method: 'POST' });
            if (!isMountedRef.current) return;
            setVisible(false);
            stopTracking();
            CustomAlert.alert('✅ Trajet terminé', 'Merci pour ce trajet !');
          } catch (error: any) {
            CustomAlert.alert('Erreur', error.message || 'Impossible de terminer le trajet.');
          }
        },
      },
    ]);
  };

  const handlePassengerComplete = () => {
    CustomAlert.alert('Terminer ma réservation', 'Confirmez-vous être arrivé(e) à destination ?', [
      { text: 'Non', style: 'cancel' },
      {
        text: 'Oui, je suis arrivé(e)',
        onPress: async () => {
          try {
            if (activeBookingId) {
              await authFetch(`/bookings/${activeBookingId}/complete/`, { method: 'POST' });
            }
            if (!isMountedRef.current) return;
            setVisible(false);
            stopTracking();
            CustomAlert.alert('✅ Arrivé(e) !', 'Votre trajet est terminé. Merci d\'avoir voyagé avec nous !');
          } catch (error: any) {
            CustomAlert.alert('Erreur', error.message || 'Impossible de terminer la réservation.');
          }
        },
      },
    ]);
  };

  const handleSendReport = async () => {
    if (!problemText.trim()) return;
    setSendingReport(true);
    try {
      const bodyPayload: any = {
        ride_id: activeRide?.id,
        problem: problemText.trim(),
      };
      if (location) {
        bodyPayload.latitude = location.lat;
        bodyPayload.longitude = location.lon;
      }
      await authFetch('/conversations/report-problem/', {
        method: 'POST',
        body: JSON.stringify(bodyPayload),
      });
      if (!isMountedRef.current) return;
      setShowReportModal(false);
      setProblemText('');
      CustomAlert.alert('✅ Envoyé', "Votre problème a été signalé. L'administration vous contactera.");
    } catch (error: any) {
      CustomAlert.alert('Erreur', error.message || 'Impossible de signaler le problème.');
    } finally {
      if (isMountedRef.current) setSendingReport(false);
    }
  };

  const leafletHtml = useMemo(() => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script src="https://unpkg.com/leaflet.marker.slideto@0.2.0/Leaflet.Marker.SlideTo.js"></script>
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
    .driver-dot {
      width: 18px; height: 18px;
      background: #10B981;
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 2px 6px rgba(16,185,129,0.5);
    }
    .driver-pulse-ring {
      width: 40px; height: 40px;
      background: rgba(16,185,129,0.25);
      border-radius: 50%;
      position: absolute;
      top: -11px; left: -11px;
      animation: pulse 2s infinite;
    }
    .leaflet-control-attribution { display: none !important; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', { 
      zoomControl: true,
      preferCanvas: true 
    }).setView([${DEFAULT_LAT}, ${DEFAULT_LON}], ${DEFAULT_ZOOM});
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, detectRetina: true
    }).addTo(map);

    var userMarker = null;
    var driverMarker = null;
    var departMarker = null;
    var destMarker = null;
    var routeLine = null;

    function makeIcon(cls) {
      return L.divIcon({ className: '', html: '<div class="' + cls + '"></div>', iconSize: [14,14], iconAnchor: [7,7] });
    }
    function makeUserIcon() {
      return L.divIcon({ className: '', html: '<div style="position:relative"><div class="pulse-ring"></div><div class="user-dot"></div></div>', iconSize: [18,18], iconAnchor: [9,9] });
    }
    function makeDriverIcon() {
      return L.divIcon({ className: '', html: '<div style="position:relative"><div class="driver-pulse-ring"></div><div class="driver-dot"></div></div>', iconSize: [18,18], iconAnchor: [9,9] });
    }

    window.handleMessage = function(msg) {
      if (msg.type === 'setView') {
        map.setView([msg.lat, msg.lon], msg.zoom || 14, { animate: true });
      } else if (msg.type === 'updateUserPosition') {
        if (!userMarker) {
          userMarker = L.marker([msg.lat, msg.lon], { icon: makeUserIcon(), zIndexOffset: 1000 }).addTo(map);
        } else {
          if (userMarker.slideTo) {
            userMarker.slideTo([msg.lat, msg.lon], { duration: 1500 });
          } else {
            userMarker.setLatLng([msg.lat, msg.lon]);
          }
        }
      } else if (msg.type === 'updateDriverPosition') {
        if (!driverMarker) {
          driverMarker = L.marker([msg.lat, msg.lon], { icon: makeDriverIcon(), zIndexOffset: 1100 })
            .bindTooltip('Conducteur', { permanent: false, direction: 'top' }).addTo(map);
        } else {
          if (driverMarker.slideTo) {
            driverMarker.slideTo([msg.lat, msg.lon], { duration: 1500 });
          } else {
            driverMarker.setLatLng([msg.lat, msg.lon]);
          }
        }
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
      } else if (msg.type === 'drawRoutes') {
        if (window.routeLines) {
          window.routeLines.forEach(function(line) {
            map.removeLayer(line);
          });
        }
        window.routeLines = [];

        msg.routes.forEach(function(r, index) {
          var color = index === msg.activeIndex ? '#3B82F6' : '#9CA3AF';
          var weight = index === msg.activeIndex ? 6 : 4;
          var opacity = index === msg.activeIndex ? 0.9 : 0.4;
          
          var line = L.polyline(r.coords, {
            color: color,
            weight: weight,
            opacity: opacity,
            lineJoin: 'round',
            smoothFactor: 2,
            renderer: L.canvas()
          }).addTo(map);
          
          line.on('click', function() {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'selectRoute', index: index }));
          });
          
          window.routeLines.push(line);
        });
      } else if (msg.type === 'fitBounds') {
        map.fitBounds(msg.points, { padding: [40, 40] });
      }
    };

    map.whenReady(function() {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
    });
  </script>
</body>
</html>`, []);

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
                <View style={[
                  styles.liveDot,
                  { backgroundColor: activeRide.status === 'started' ? theme.colors.success : '#F59E0B' }
                ]} />
                <Text style={[
                  styles.liveText,
                  { color: activeRide.status === 'started' ? theme.colors.success : '#F59E0B' }
                ]}>
                  {activeRide.status === 'started' ? 'EN COURS' : 'PRÊT À DÉMARRER'}
                </Text>
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

          {/* Main Content */}
          <>
            {/* Map */}
              <View style={styles.mapContainer}>
                <WebView
                  ref={webviewRef}
                  originWhitelist={['*']}
                  source={{ html: leafletHtml }}
                  onMessage={onMapMessage}
                  javaScriptEnabled
                  domStorageEnabled
                  cacheEnabled={false}
                  androidLayerType="hardware"
                  style={styles.map}
                  scrollEnabled={false}
                />
                {!mapReady && (
                  <View style={styles.mapLoader}>
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                    <Text style={styles.mapLoaderText}>Chargement de la carte...</Text>
                  </View>
                )}

                {mapReady && (
                  <View style={styles.mapControls}>
                    <TouchableOpacity
                      style={styles.controlBtn}
                      onPress={() => location && sendToMap({ type: 'setView', lat: location.lat, lon: location.lon, zoom: 15 })}
                    >
                      <Ionicons name="locate" size={20} color={theme.colors.primary} />
                    </TouchableOpacity>

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

              {/* Détails de l'itinéraire sélectionné */}
              {routes.length > 0 && (
                <View style={styles.routeDetailsRow}>
                  <View style={styles.routeHeader}>
                    <Ionicons name="git-branch-outline" size={16} color={theme.colors.primary} />
                    <Text style={styles.routeTitle}>
                      Itinéraire ({activeRouteIndex + 1}/{routes.length})
                    </Text>
                  </View>
                  <View style={styles.routeStats}>
                    <View style={styles.routeStatItem}>
                      <Ionicons name="time-outline" size={15} color={theme.colors.textLight} />
                      <Text style={styles.routeStatLabel}>Durée :</Text>
                      <Text style={styles.routeStatValue}>
                        {formatDuration(routes[activeRouteIndex].duration)}
                      </Text>
                    </View>
                    <View style={styles.routeStatItem}>
                      <Ionicons name="swap-horizontal-outline" size={15} color={theme.colors.textLight} />
                      <Text style={styles.routeStatLabel}>Distance :</Text>
                      <Text style={styles.routeStatValue}>
                        {formatDistance(routes[activeRouteIndex].distance)}
                      </Text>
                    </View>
                  </View>
                  {routes.length > 1 && (
                    <View style={styles.routeSelector}>
                      {routes.map((_, idx) => (
                        <TouchableOpacity
                          key={idx}
                          style={[
                            styles.routeSelectorBtn,
                            activeRouteIndex === idx && styles.routeSelectorBtnActive
                          ]}
                          onPress={() => setActiveRouteIndex(idx)}
                        >
                          <Text style={[
                            styles.routeSelectorBtnText,
                            activeRouteIndex === idx && styles.routeSelectorBtnTextActive
                          ]}>
                            Chemin {idx + 1}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              )}

              {/* Footer */}
              <View style={styles.footer}>
                {activeRide.status === 'started' && (
                  <TouchableOpacity style={styles.googleMapsBtn} onPress={openGoogleMaps}>
                    <Ionicons name="map" size={18} color="#4285F4" />
                    <Text style={styles.googleMapsBtnText}>Navigation GPS sur Google Maps</Text>
                    <Ionicons name="open-outline" size={16} color="#4285F4" />
                  </TouchableOpacity>
                )}

                <View style={styles.actionRow}>
                  {activeRide.status === 'active' ? (
                    <TouchableOpacity style={styles.startBtn} onPress={handleStartRide}>
                      <Ionicons name="play-circle" size={20} color={theme.colors.white} />
                      <Text style={styles.startBtnText}>Démarrer le trajet</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity style={styles.completeBtn} onPress={isDriver ? handleCompleteRide : handlePassengerComplete}>
                      <Ionicons name="checkmark-circle" size={20} color={theme.colors.white} />
                      <Text style={styles.completeBtnText}>{isDriver ? 'Terminer le trajet' : 'Je suis arrivé(e)'}</Text>
                    </TouchableOpacity>
                  )}
                  
                  <TouchableOpacity style={styles.reportBtn} onPress={() => setShowReportModal(true)}>
                    <Ionicons name="warning-outline" size={20} color={theme.colors.white} />
                    <Text style={styles.reportBtnText}>Signaler</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </>
          </View>
      </Modal>

      {/* Report Problem Modal */}
      <Modal visible={showReportModal} transparent animationType="fade">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.reportOverlay}>
          <View style={styles.reportCard}>
            <Text style={styles.reportTitle}>🚨 Signaler un problème</Text>
            <Text style={styles.reportSubtitle}>Décrivez le problème. Votre position GPS sera automatiquement envoyée à l'administration.</Text>
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
  overlay: { flex: 1, backgroundColor: theme.colors.white, marginTop: 40, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden', shadowColor: theme.colors.black, shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 20 },
  floatingBubble: { position: 'absolute', bottom: 160, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: theme.colors.primary, justifyContent: 'center', alignItems: 'center', shadowColor: theme.colors.black, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 10, zIndex: 9999 },
  liveIndicatorBubble: { position: 'absolute', top: 4, right: 4, width: 14, height: 14, borderRadius: 7, backgroundColor: theme.colors.white, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: theme.colors.white, borderBottomWidth: 1, borderBottomColor: theme.colors.background },
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
  mapControls: { position: 'absolute', right: 12, bottom: 16, gap: 8 },
  controlBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.white, justifyContent: 'center', alignItems: 'center', shadowColor: theme.colors.black, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 6, elevation: 4, marginBottom: 8 },
  legendRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8, backgroundColor: theme.colors.background, gap: 16, borderTopWidth: 1, borderTopColor: theme.colors.border },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 12, color: theme.colors.text, fontWeight: '500', flex: 1 },
  routeDetailsRow: { padding: 16, backgroundColor: theme.colors.white, borderTopWidth: 1, borderTopColor: theme.colors.border },
  routeHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  routeTitle: { fontSize: 13, fontWeight: '700', color: theme.colors.text },
  routeStats: { flexDirection: 'row', gap: 20, marginBottom: 12 },
  routeStatItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  routeStatLabel: { fontSize: 13, color: theme.colors.textLight },
  routeStatValue: { fontSize: 13, fontWeight: '700', color: theme.colors.primary },
  routeSelector: { flexDirection: 'row', gap: 8, marginTop: 4 },
  routeSelectorBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, borderColor: theme.colors.border, borderWidth: 1, alignItems: 'center', backgroundColor: '#F8FAFC' },
  routeSelectorBtnActive: { backgroundColor: '#EFF6FF', borderColor: theme.colors.primary, borderWidth: 1.5 },
  routeSelectorBtnText: { fontSize: 12, color: theme.colors.textLight, fontWeight: '600' },
  routeSelectorBtnTextActive: { color: theme.colors.primary, fontWeight: '700' },
  footer: { padding: 16, backgroundColor: theme.colors.white, borderTopWidth: 1, borderTopColor: theme.colors.background, gap: 10 },
  googleMapsBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#EFF6FF', padding: 12, borderRadius: 12, gap: 8, borderWidth: 1, borderColor: '#BFDBFE' },
  googleMapsBtnText: { fontSize: 14, color: '#4285F4', fontWeight: '600', flex: 1 },
  actionRow: { flexDirection: 'row', gap: 12 },
  completeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.success, padding: 14, borderRadius: 12, gap: 8 },
  completeBtnText: { color: theme.colors.white, fontSize: 15, fontWeight: 'bold' },
  reportBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.error, padding: 14, borderRadius: 12, gap: 8 },
  reportBtnText: { color: theme.colors.white, fontSize: 15, fontWeight: 'bold' },
  reportOverlay: { flex: 1, backgroundColor: theme.colors.overlay, justifyContent: 'flex-end' },
  reportCard: { backgroundColor: theme.colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  reportTitle: { fontSize: 20, fontWeight: 'bold', color: theme.colors.text, marginBottom: 8 },
  reportSubtitle: { fontSize: 14, color: theme.colors.textLight, marginBottom: 16, lineHeight: 20 },
  reportInput: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, padding: 14, fontSize: 14, color: theme.colors.text, minHeight: 100, backgroundColor: theme.colors.background, marginBottom: 16 },
  reportActions: { flexDirection: 'row', gap: 12 },
  reportCancelBtn: { flex: 1, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center' },
  reportCancelText: { fontSize: 15, color: theme.colors.textLight, fontWeight: '600' },
  reportSendBtn: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: theme.colors.error, alignItems: 'center' },
  reportSendBtnDisabled: { backgroundColor: '#FCA5A5' },
  reportSendText: { fontSize: 15, color: theme.colors.white, fontWeight: 'bold' },
  passengerWaitingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#FAFAFA',
  },
  pulsingCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  waitingTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  waitingText: {
    fontSize: 16,
    color: theme.colors.textLight,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 40,
  },
  passengerReportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FEE2E2',
    backgroundColor: '#FEF2F2',
  },
  passengerReportText: {
    fontSize: 14,
    color: theme.colors.error,
    fontWeight: '600',
  },
  startBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    padding: 14,
    borderRadius: 12,
    gap: 8,
  },
  startBtnText: {
    color: theme.colors.white,
    fontSize: 15,
    fontWeight: 'bold',
  },
});
