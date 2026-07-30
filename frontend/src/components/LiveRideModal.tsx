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
import * as Speech from 'expo-speech';

const getDistanceInKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Radius of earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

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
  const [isSoundMuted, setIsSoundMuted] = useState(false);
  const [currentSpeed, setCurrentSpeed] = useState(0);

  const getEtaStr = (durationSeconds: number): string => {
    const now = new Date();
    const etaDate = new Date(now.getTime() + durationSeconds * 1000);
    const hours = String(etaDate.getHours()).padStart(2, '0');
    const minutes = String(etaDate.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const activeRideRef = useRef<Ride | null>(null);
  const isDriverRef = useRef<boolean>(false);

  const hasSpokenStartRef = useRef(false);
  const hasSpokenArrivalRef = useRef(false);
  const hasSpokenDriverApproachingRef = useRef(false);

  const speakText = (text: string) => {
    if (isSoundMuted) return;
    try {
      Speech.speak(text, { language: 'fr', pitch: 1.0, rate: 0.95 });
    } catch (e) {
      console.log('Speech error:', e);
    }
  };

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
            if (!hasSpokenStartRef.current) {
              if (asDriver) {
                speakText("Votre trajet a commencé. Zemy vous souhaite une excellente route. Restez attentif.");
              } else {
                speakText("Votre trajet vient de démarrer avec votre conducteur. Zemy vous souhaite un agréable voyage.");
              }
              hasSpokenStartRef.current = true;
            }
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
      { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 2000, distanceInterval: 2 },
      (newLoc) => {
        if (!isMountedRef.current) return;
        const newPos = { lat: newLoc.coords.latitude, lon: newLoc.coords.longitude };
        setLocation(newPos);
        
        // Update current speed in km/h
        const speedKmH = Math.round((newLoc.coords.speed || 0) * 3.6);
        setCurrentSpeed(speedKmH >= 0 ? speedKmH : 0);

        sendToMap({
          type: 'updateUserPosition',
          lat: newPos.lat,
          lon: newPos.lon,
          heading: newLoc.coords.heading || 0
        });

        // Check destination proximity
        if (destCoords && !hasSpokenArrivalRef.current) {
          const distToDest = getDistanceInKm(newPos.lat, newPos.lon, destCoords.lat, destCoords.lon);
          if (distToDest <= 0.5) { // 500 meters
            speakText("Vous approchez de votre destination. Préparez-vous à descendre.");
            hasSpokenArrivalRef.current = true;
          }
        }

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
    hasSpokenStartRef.current = false;
    hasSpokenArrivalRef.current = false;
    hasSpokenDriverApproachingRef.current = false;
  };

  const sendToMap = (message: object) => {
    webviewRef.current?.injectJavaScript(
      `window.handleMessage && window.handleMessage(${JSON.stringify(message)}); true;`
    );
  };

  useEffect(() => {
    if (!mapReady || !location) return;
    sendToMap({ type: 'updateUserPosition', lat: location.lat, lon: location.lon, heading: 0 });
  }, [location, mapReady]);

  useEffect(() => {
    if (mapReady) {
      sendToMap({ type: 'initRole', isDriver });
    }
  }, [mapReady, isDriver]);

  useEffect(() => {
    if (!mapReady || !activeRide || isDriver) return;
    if (activeRide.driver_latitude !== null && activeRide.driver_latitude !== undefined &&
        activeRide.driver_longitude !== null && activeRide.driver_longitude !== undefined) {
      const drvLat = Number(activeRide.driver_latitude);
      const drvLon = Number(activeRide.driver_longitude);

      sendToMap({
        type: 'updateDriverPosition',
        lat: drvLat,
        lon: drvLon
      });

      // Check driver proximity to passenger
      if (location && !hasSpokenDriverApproachingRef.current && activeRide.status !== 'completed') {
        const distToDriver = getDistanceInKm(location.lat, location.lon, drvLat, drvLon);
        if (distToDriver <= 0.4) {
          speakText("Votre conducteur est tout proche. Il sera là dans quelques instants.");
          hasSpokenDriverApproachingRef.current = true;
        }
      }
    }
  }, [activeRide, mapReady, isDriver, location]);

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

  useEffect(() => {
    if (!mapReady || !activeRide || !activeRide.stopovers) return;
    try {
      let stops = [];
      if (typeof activeRide.stopovers === 'string') {
        stops = JSON.parse(activeRide.stopovers);
      } else if (Array.isArray(activeRide.stopovers)) {
        stops = activeRide.stopovers;
      }
      sendToMap({ type: 'setStopovers', stopovers: stops });
    } catch (err) {
      console.log('Error parsing stopovers in LiveRideModal:', err);
    }
  }, [activeRide, mapReady]);

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
            await startTracking();
            CustomAlert.alert('Trajet démarré', 'Le trajet a commencé. Bonne route !');
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
            speakText("Le trajet est terminé. Merci d'avoir voyagé avec Zemy !");
            CustomAlert.alert('Trajet terminé', 'Merci pour ce trajet !');
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
            speakText("Le trajet est terminé. Merci d'avoir voyagé avec Zemy !");
            CustomAlert.alert('Arrivé(e) !', 'Votre trajet est terminé. Merci d\'avoir voyagé avec nous !');
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
      CustomAlert.alert('Envoyé', "Votre problème a été signalé. L'administration vous contactera.");
    } catch (error: any) {
      CustomAlert.alert('Erreur', error.message || 'Impossible de signaler le problème.');
    } finally {
      if (isMountedRef.current) setSendingReport(false);
    }
  };

  const googleMapHtml = useMemo(() => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body, html, #map { width: 100%; height: 100%; }

    /* Advanced Google Maps Navigation marker styling */
    .nav-marker-wrapper {
      position: absolute;
      width: 80px;
      height: 80px;
      margin-left: -40px;
      margin-top: -40px;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
    }

    /* Directional cone of view */
    .compass-beam {
      position: absolute;
      width: 80px;
      height: 80px;
      background: radial-gradient(circle, rgba(66, 133, 244, 0.4) 0%, rgba(66, 133, 244, 0) 70%);
      clip-path: polygon(50% 50%, 25% 0%, 75% 0%); /* 60deg light cone */
      transform-origin: 50% 50%;
      pointer-events: none;
      display: block;
      transition: transform 0.2s ease-out;
    }

    /* green compass beam for driver when viewed by passenger */
    .compass-beam-driver {
      background: radial-gradient(circle, rgba(16, 185, 129, 0.4) 0%, rgba(16, 185, 129, 0) 70%);
      clip-path: polygon(50% 50%, 25% 0%, 75% 0%);
    }

    .pulse-halo-nav {
      position: absolute;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: rgba(66, 133, 244, 0.25);
      animation: pulseNav 2.5s infinite ease-out;
      pointer-events: none;
    }

    .pulse-halo-nav-driver {
      background: rgba(16, 185, 129, 0.25);
    }

    @keyframes pulseNav {
      0% { transform: scale(0.6); opacity: 1; }
      100% { transform: scale(2.2); opacity: 0; }
    }

    /* 3D chevron wrapper */
    .chevron-svg-container {
      position: absolute;
      transform-origin: 50% 50%;
      filter: drop-shadow(0px 3px 5px rgba(0,0,0,0.4));
      transition: transform 0.2s ease-out;
    }

    .depart-pin {
      width: 16px; height: 16px;
      background: #10B981;
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    }
    .dest-pin {
      width: 16px; height: 16px;
      background: #EF4444;
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    }
    .stopover-pin {
      width: 24px;
      height: 24px;
      background: #4B5563;
      color: white;
      border: 2px solid white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: bold;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map;
    var userMarker = null;
    var driverMarker = null;
    var departMarker = null;
    var destMarker = null;
    var directionsRenderer = null;
    var directionsService = null;
    var departPos = null;
    var destPos = null;
    var isDriverRole = false;
    var autoCenter = true;
    var lastUserPos = null;
    var lastUserHeading = 0;
    var lastDriverPos = null;
    var lastDriverHeading = 0;

    function calculateHeading(prev, curr) {
      if (!prev || !curr) return 0;
      var dLon = (curr.lon - prev.lon) * Math.PI / 180;
      var lat1 = prev.lat * Math.PI / 180;
      var lat2 = curr.lat * Math.PI / 180;
      var y = Math.sin(dLon) * Math.cos(lat2);
      var x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
      var brng = Math.atan2(y, x) * 180 / Math.PI;
      return (brng + 360) % 360;
    }

    function createAdvancedNavMarker(position, type) {
      var wrapper = document.createElement('div');
      wrapper.className = 'nav-marker-wrapper';

      var beam = document.createElement('div');
      beam.className = type === 'driver' ? 'compass-beam compass-beam-driver' : 'compass-beam';
      wrapper.appendChild(beam);

      var halo = document.createElement('div');
      halo.className = type === 'driver' ? 'pulse-halo-nav pulse-halo-nav-driver' : 'pulse-halo-nav';
      wrapper.appendChild(halo);

      var svgCont = document.createElement('div');
      svgCont.className = 'chevron-svg-container';
      
      var fillColor = type === 'driver' ? '#10B981' : '#2563EB'; // Green vs Blue
      svgCont.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
        '<path d="M12 2L4.5 20.29L5.21 21L12 18L18.79 21L19.5 20.29L12 2Z" fill="' + fillColor + '" stroke="white" stroke-width="2" stroke-linejoin="round"/>' +
        '</svg>';
      
      wrapper.appendChild(svgCont);

      var overlay = new google.maps.OverlayView();
      overlay.onAdd = function() {
        this.getPanes().overlayMouseTarget.appendChild(wrapper);
      };
      overlay.draw = function() {
        var point = this.getProjection().fromLatLngToDivPixel(this.position);
        if (point) {
          wrapper.style.left = point.x + 'px';
          wrapper.style.top = point.y + 'px';
        }
      };
      overlay.onRemove = function() {
        if (wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
      };
      overlay.position = position;
      overlay.setPosition = function(pos) {
        this.position = pos;
        this.draw();
      };
      overlay.setRotation = function(heading) {
        svgCont.style.transform = 'rotate(' + heading + 'deg)';
        beam.style.transform = 'rotate(' + heading + 'deg)';
      };
      overlay.setMap(map);
      return overlay;
    }

    function createOverlayMarker(position, cls, title) {
      var div = document.createElement('div');
      div.className = cls;
      div.title = title || '';

      var overlay = new google.maps.OverlayView();
      overlay.onAdd = function() {
        this.getPanes().overlayMouseTarget.appendChild(div);
      };
      overlay.draw = function() {
        var point = this.getProjection().fromLatLngToDivPixel(this.position);
        if (point) {
          div.style.position = 'absolute';
          div.style.left = (point.x - 9) + 'px';
          div.style.top = (point.y - 9) + 'px';
        }
      };
      overlay.onRemove = function() {
        if (div.parentNode) div.parentNode.removeChild(div);
      };
      overlay.position = position;
      overlay.setPosition = function(pos) {
        this.position = pos;
        this.draw();
      };
      overlay.setMap(map);
      return overlay;
    }

    function initMap() {
      map = new google.maps.Map(document.getElementById('map'), {
        zoom: 17,
        center: { lat: ${DEFAULT_LAT}, lng: ${DEFAULT_LON} },
        disableDefaultUI: true,
        tilt: 55,
        heading: 0,
        mapId: 'DEMO_MAP_ID',
        styles: [
          { "featureType": "poi", "stylers": [{ "visibility": "off" }] },
          { "featureType": "transit", "stylers": [{ "visibility": "off" }] },
          { "featureType": "road", "elementType": "labels.icon", "stylers": [{ "visibility": "off" }] }
        ]
      });

      directionsService = new google.maps.DirectionsService();
      directionsRenderer = new google.maps.DirectionsRenderer({
        map: map,
        suppressMarkers: true,
        polylineOptions: {
          strokeColor: '#3B82F6',
          strokeOpacity: 0.9,
          strokeWeight: 5
        }
      });

      map.addListener('tilesloaded', function() {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
        }
      });

      // Disable autoCenter if user manually drags/pans the map
      map.addListener('dragstart', function() {
        autoCenter = false;
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'autoCenterChanged', autoCenter: false }));
        }
      });
    }

    function drawRoute() {
      if (!departPos || !destPos || !directionsService) return;
      
      var waypoints = [];
      if (window.stopoversList && window.stopoversList.length > 0) {
        window.stopoversList.forEach(function(s) {
          if (s.latitude && s.longitude) {
            waypoints.push({
              location: new google.maps.LatLng(Number(s.latitude), Number(s.longitude)),
              stopover: true
            });
          }
        });
      }

      directionsService.route({
        origin: departPos,
        destination: destPos,
        waypoints: waypoints,
        optimizeWaypoints: false,
        travelMode: google.maps.TravelMode.DRIVING
      }, function(response, status) {
        if (status === 'OK') {
          directionsRenderer.setDirections(response);
        } else {
          var line = new google.maps.Polyline({
            path: [departPos, destPos],
            strokeColor: '#3B82F6',
            strokeOpacity: 0.8,
            strokeWeight: 4,
            map: map
          });
        }
      });
    }

    window.handleMessage = function(msg) {
      if (msg.type === 'initRole') {
        isDriverRole = msg.isDriver;

      } else if (msg.type === 'setView') {
        map.setCenter({ lat: msg.lat, lng: msg.lon });
        map.setZoom(msg.zoom || 14);

      } else if (msg.type === 'recenter') {
        autoCenter = true;
        var targetPos = lastUserPos;
        var targetHeading = lastUserHeading;
        
        if (!isDriverRole && lastDriverPos) {
          targetPos = lastDriverPos;
          targetHeading = lastDriverHeading;
        }
        
        if (targetPos) {
          map.panTo(targetPos);
          map.setZoom(17);
          map.setTilt(55);
          if (targetHeading !== undefined && targetHeading !== null && targetHeading !== -1) {
            map.setHeading(targetHeading);
          }
        }

      } else if (msg.type === 'updateUserPosition') {
        var pos = { lat: msg.lat, lng: msg.lon };
        var heading = msg.heading || 0;
        
        lastUserPos = pos;
        lastUserHeading = heading;

        if (!userMarker) {
          userMarker = createAdvancedNavMarker(pos, 'user');
        } else {
          userMarker.setPosition(pos);
        }
        userMarker.setRotation(heading);

        // Follow user if autoCenter is active and they are the driver
        if (autoCenter) {
          var shouldFollow = false;
          if (isDriverRole) {
            shouldFollow = true;
          } else if (!driverMarker) {
            shouldFollow = true; // passenger follows themselves if driver hasn't sent GPS
          }

          if (shouldFollow) {
            map.panTo(pos);
            map.setZoom(17);
            map.setTilt(55);
            if (heading !== undefined && heading !== null && heading !== -1 && heading !== 0) {
              map.setHeading(heading);
            }
          }
        }

      } else if (msg.type === 'updateDriverPosition') {
        var pos = { lat: msg.lat, lng: msg.lon };
        var heading = 0;
        if (lastDriverPos) {
          heading = calculateHeading(lastDriverPos, pos);
        }
        
        lastDriverPos = pos;
        lastDriverHeading = heading;

        if (!driverMarker) {
          driverMarker = createAdvancedNavMarker(pos, 'driver');
        } else {
          driverMarker.setPosition(pos);
        }
        driverMarker.setRotation(heading);

        // Follow driver if autoCenter is active and passenger is watching
        if (autoCenter && !isDriverRole) {
          map.panTo(pos);
          map.setZoom(17);
          map.setTilt(55);
          if (heading !== 0) {
            map.setHeading(heading);
          }
        }

      } else if (msg.type === 'setDepartMarker') {
        var pos = { lat: msg.lat, lng: msg.lon };
        departPos = pos;
        if (!departMarker) {
          departMarker = createOverlayMarker(pos, 'depart-pin', 'Départ');
        } else {
          departMarker.setPosition(pos);
        }
        drawRoute();

      } else if (msg.type === 'setDestMarker') {
        var pos = { lat: msg.lat, lng: msg.lon };
        destPos = pos;
        if (!destMarker) {
          destMarker = createOverlayMarker(pos, 'dest-pin', 'Arrivée');
        } else {
          destMarker.setPosition(pos);
        }
        drawRoute();

      } else if (msg.type === 'drawRoutes') {
        drawRoute();

      } else if (msg.type === 'setStopovers') {
        window.stopoversList = msg.stopovers || [];
        
        if (window.stopoverMarkers) {
          window.stopoverMarkers.forEach(function(m) { m.setMap(null); });
        }
        window.stopoverMarkers = [];
        
        if (msg.stopovers && Array.isArray(msg.stopovers)) {
          msg.stopovers.forEach(function(s, idx) {
            if (s.latitude && s.longitude) {
              var pos = { lat: Number(s.latitude), lng: Number(s.longitude) };
              var div = document.createElement('div');
              div.className = 'stopover-pin';
              div.innerHTML = (idx + 1);
              div.title = s.name;
              
              var overlay = new google.maps.OverlayView();
              overlay.onAdd = function() {
                this.getPanes().overlayMouseTarget.appendChild(div);
              };
              overlay.draw = function() {
                var point = this.getProjection().fromLatLngToDivPixel(this.position);
                if (point) {
                  div.style.position = 'absolute';
                  div.style.left = (point.x - 12) + 'px';
                  div.style.top = (point.y - 12) + 'px';
                }
              };
              overlay.onRemove = function() {
                if (div.parentNode) div.parentNode.removeChild(div);
              };
              overlay.position = pos;
              overlay.setMap(map);
              
              window.stopoverMarkers.push(overlay);
            }
          });
        }
        drawRoute();

      } else if (msg.type === 'fitBounds') {
        if (msg.points && msg.points.length >= 2) {
          var bounds = new google.maps.LatLngBounds();
          msg.points.forEach(function(p) {
            bounds.extend({ lat: p[0], lng: p[1] });
          });
          map.fitBounds(bounds, { top: 60, right: 40, bottom: 60, left: 40 });
        }
      }
    };
  </script>
  <script async defer
    src="https://maps.googleapis.com/maps/api/js?key=AIzaSyDeQDN8_mfUVNcb37Tg1FsiMaBoCuYOgrc&callback=initMap">
  </script>
</body>
</html>
  `, []);

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
        <View style={styles.overlayFull}>
          {/* Full Screen Google Map */}
          <WebView
            ref={webviewRef}
            originWhitelist={['*']}
            source={{ html: googleMapHtml }}
            onMessage={onMapMessage}
            javaScriptEnabled
            domStorageEnabled
            cacheEnabled={false}
            androidLayerType="hardware"
            style={styles.mapFull}
            scrollEnabled={false}
          />

          {/* Loader */}
          {!mapReady && (
            <View style={styles.mapLoaderFull}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text style={styles.mapLoaderText}>Lancement de la navigation...</Text>
            </View>
          )}

          {/* Top Forest Green Guidance Card */}
          {mapReady && (
            <View style={styles.guidageContainer}>
              <View style={styles.guidageMain}>
                <View style={styles.guidageIconContainer}>
                  <Ionicons name="arrow-up" size={32} color={theme.colors.white} />
                </View>
                <View style={styles.guidageTextContainer}>
                  <Text style={styles.guidageInstruction} numberOfLines={2}>
                    {activeRide.status === 'started' 
                      ? `Continuer vers l'arrivée à ${activeRide.arrival_location}`
                      : `Démarrer le trajet vers ${activeRide.arrival_location}`}
                  </Text>
                  <Text style={styles.guidageDistance}>Suivre le tracé bleu Zemy</Text>
                </View>
              </View>
              <View style={styles.guidageSecondary}>
                <Ionicons name="arrow-redo" size={16} color={theme.colors.white} />
                <Text style={styles.guidageSecondaryText}>Puis fin de votre voyage</Text>
              </View>
            </View>
          )}

          {/* Floating Right Navigation Controls */}
          {mapReady && (
            <View style={styles.rightControlsContainer}>
              {/* Compass Heading Recenter */}
              <TouchableOpacity style={styles.navRoundBtn} onPress={() => sendToMap({ type: 'recenter' })} activeOpacity={0.8}>
                <Ionicons name="compass" size={24} color="#EF4444" />
              </TouchableOpacity>

              {/* Locate Recenter */}
              <TouchableOpacity style={styles.navRoundBtn} onPress={() => sendToMap({ type: 'recenter' })} activeOpacity={0.8}>
                <Ionicons name="locate" size={24} color={theme.colors.primary} />
              </TouchableOpacity>

              {/* Sound TTS Settings */}
              <TouchableOpacity 
                style={[styles.navRoundBtn, isSoundMuted && styles.navRoundBtnMuted]} 
                onPress={() => setIsSoundMuted(!isSoundMuted)}
                activeOpacity={0.8}
              >
                <Ionicons 
                  name={isSoundMuted ? "volume-mute" : "volume-high"} 
                  size={22} 
                  color={isSoundMuted ? theme.colors.textLight : "#10B981"} 
                />
              </TouchableOpacity>
            </View>
          )}

          {/* Speedometer widget */}
          {mapReady && (
            <View style={styles.speedometerContainer}>
              <Text style={styles.speedValue}>{currentSpeed}</Text>
              <Text style={styles.speedUnit}>km/h</Text>
            </View>
          )}

          {/* Floating Ride Actions controls (FAB) */}
          {mapReady && (
            <View style={styles.rideControlFabContainer}>
              {activeRide.status === 'active' ? (
                <TouchableOpacity style={styles.startFab} onPress={handleStartRide} activeOpacity={0.8}>
                  <Ionicons name="play" size={20} color={theme.colors.white} />
                  <Text style={styles.rideControlFabText}>DÉMARRER</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity 
                  style={styles.completeFab} 
                  onPress={isDriver ? handleCompleteRide : handlePassengerComplete}
                  activeOpacity={0.8}
                >
                  <Ionicons name="checkmark-sharp" size={20} color={theme.colors.white} />
                  <Text style={styles.rideControlFabText}>TERMINER</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Bottom Info Sheet (Google Maps Style) */}
          {mapReady && (
            <View style={styles.bottomNavPanel}>
              {/* Close button */}
              <TouchableOpacity 
                style={styles.bottomNavCloseBtn} 
                onPress={() => { setVisible(false); setIsMinimized(true); }}
                activeOpacity={0.8}
              >
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>

              {/* Center Navigation Stats */}
              <View style={styles.bottomNavStats}>
                <View style={styles.bottomNavTimeRow}>
                  <Text style={styles.bottomNavTimeText}>
                    {routes.length > 0 ? formatDuration(routes[activeRouteIndex].duration) : '---'}
                  </Text>
                  <Ionicons name="leaf" size={16} color="#10B981" style={{ marginLeft: 6 }} />
                </View>
                <Text style={styles.bottomNavDistanceEtaText}>
                  {routes.length > 0 
                    ? `${formatDistance(routes[activeRouteIndex].distance)} • ETA ${getEtaStr(routes[activeRouteIndex].duration)}`
                    : 'Chargement des étapes...'}
                </Text>
              </View>

              {/* Report Problem button */}
              <TouchableOpacity 
                style={styles.bottomNavReportBtn} 
                onPress={() => setShowReportModal(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="warning-outline" size={22} color={theme.colors.error} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>

      {/* Report Modal */}
      <Modal visible={showReportModal} transparent animationType="fade">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.reportOverlay}>
          <View style={styles.reportCard}>
            <Text style={styles.reportTitle}>Signaler un problème</Text>
            <Text style={styles.reportSubtitle}>Décrivez le problème rencontré sur ce trajet.</Text>
            <TextInput
              style={styles.reportInput}
              placeholder="Ex: retard important, panne de véhicule..."
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

  // New Google Maps Overlay Styles
  overlayFull: {
    flex: 1,
    backgroundColor: '#E5E7EB',
    position: 'relative',
  },
  mapFull: {
    flex: 1,
  },
  mapLoaderFull: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#FAFAFA',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 99,
  },
  guidageContainer: {
    position: 'absolute',
    top: 50,
    left: 12,
    right: 12,
    zIndex: 10,
    backgroundColor: '#0F5132',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
    overflow: 'hidden',
  },
  guidageMain: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  guidageIconContainer: {
    marginRight: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  guidageTextContainer: {
    flex: 1,
  },
  guidageInstruction: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
    lineHeight: 22,
  },
  guidageDistance: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 13,
    marginTop: 2,
  },
  guidageSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0A3B24',
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 8,
  },
  guidageSecondaryText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 12,
    fontWeight: '600',
  },
  rightControlsContainer: {
    position: 'absolute',
    top: 200,
    right: 12,
    zIndex: 10,
    gap: 12,
  },
  navRoundBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 5,
  },
  navRoundBtnMuted: {
    backgroundColor: '#F3F4F6',
  },
  speedometerContainer: {
    position: 'absolute',
    bottom: 120,
    left: 16,
    zIndex: 10,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFF',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 5,
  },
  speedValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    lineHeight: 22,
  },
  speedUnit: {
    fontSize: 10,
    color: '#6B7280',
    fontWeight: '600',
  },
  bottomNavPanel: {
    position: 'absolute',
    bottom: 24,
    left: 12,
    right: 12,
    zIndex: 10,
    backgroundColor: '#FFF',
    borderRadius: 24,
    height: 80,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  bottomNavCloseBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF',
  },
  bottomNavStats: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomNavTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bottomNavTimeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#B45309',
  },
  bottomNavDistanceEtaText: {
    fontSize: 14,
    color: '#4B5563',
    marginTop: 2,
    fontWeight: '500',
  },
  bottomNavReportBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
  },
  rideControlFabContainer: {
    position: 'absolute',
    bottom: 120,
    right: 16,
    zIndex: 10,
  },
  startFab: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 28,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  completeFab: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EF4444',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 28,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  rideControlFabText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 1.2,
  },
});
