/**
 * ==============================================================
 * Fichier :
 * LiveRideModal.tsx
 *
 * Description :
 * Composant premium de suivi de trajet en temps réel pour Zemy.
 * Intégration avancée avec Google Maps, navigation vocale,
 * et gestion intelligente des états de trajet.
 *
 * Projet :
 * Zemy
 * ==============================================================
 */
import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, Alert,
  Dimensions, ActivityIndicator, TextInput, KeyboardAvoidingView,
  Platform, Linking, Animated, StatusBar,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../styles/theme';
import * as Location from 'expo-location';
import { useAuth } from '../context/AuthContext';
import { Ride } from '../types';
import { CustomAlert } from '../utils/CustomAlert';
import * as Speech from 'expo-speech';
import NetInfo from '@react-native-community/netinfo';

// ============================================================
// CONSTANTS & CONFIGURATION
// ============================================================

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const DEFAULT_LAT = 6.3703;
const DEFAULT_LON = 2.3764;
const GOOGLE_MAPS_KEY = 'AIzaSyDeQDN8_mfUVNcb37Tg1FsiMaBoCuYOgrc';

// Configuration constants
const CONFIG = {
  DISTANCE_THRESHOLD_ARRIVAL: 0.5, // km
  DISTANCE_THRESHOLD_DRIVER_APPROACH: 0.4, // km
  TRACKING_INTERVAL: 3000, // ms
  DISTANCE_INTERVAL: 5, // meters
  CHECK_INTERVAL_ACTIVE: 10000, // ms
  CHECK_INTERVAL_IDLE: 60000, // ms
  SPEECH_RATE: 0.9,
  SPEECH_PITCH: 1.0,
} as const;

// ============================================================
// TYPES
// ============================================================

interface Coords {
  lat: number;
  lon: number;
}

interface RouteStep {
  instruction: string;
  distanceText: string;
  distanceValue: number;
  lat: number;
  lon: number;
}

interface RouteData {
  coords: [number, number][];
  distance: number;
  duration: number;
  steps: RouteStep[];
}

interface TrackingState {
  isActive: boolean;
  position: Coords | null;
  speed: number;
  heading: number;
  accuracy: number;
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Calcul de la distance entre deux points géographiques
 */
const getDistanceInKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Décodage du polyline Google Maps
 */
function decodeGooglePolyline(encoded: string): [number, number][] {
  let points: [number, number][] = [];
  let index = 0, len = encoded.length;
  let lat = 0, lng = 0;

  while (index < len) {
    let b, shift = 0, result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    let dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    let dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lng += dlng;

    points.push([lat / 1e5, lng / 1e5]);
  }
  return points;
}

/**
 * Géocodage d'une adresse au Bénin
 */
async function geocodeBenin(place: string): Promise<Coords | null> {
  try {
    const query = encodeURIComponent(`${place}, Bénin`);
    const resp = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${query}&components=country:bj&key=${GOOGLE_MAPS_KEY}&language=fr`
    );
    const data = await resp.json();
    if (data.status === 'OK' && data.results?.length > 0) {
      const loc = data.results[0].geometry.location;
      return { lat: loc.lat, lon: loc.lng };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Récupération des routes alternatives
 */
async function getRoutes(from: Coords, to: Coords): Promise<RouteData[] | null> {
  try {
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${from.lat},${from.lon}&destination=${to.lat},${to.lon}&alternatives=true&key=${GOOGLE_MAPS_KEY}`;
    const resp = await fetch(url);
    const data = await resp.json();
    
    if (data.status === 'OK' && data.routes?.length > 0) {
      return data.routes.map((r: any) => {
        let distance = 0;
        let duration = 0;
        const leg = r.legs?.[0];
        if (leg) {
          distance = leg.distance?.value || 0;
          duration = leg.duration?.value || 0;
        }
        const points = r.overview_polyline?.points ? decodeGooglePolyline(r.overview_polyline.points) : [];
        
        const steps = (leg?.steps || []).map((s: any) => ({
          instruction: s.html_instructions ? s.html_instructions.replace(/<[^>]*>/g, '') : '',
          distanceText: s.distance?.text || '',
          distanceValue: s.distance?.value || 0,
          lat: s.start_location?.lat || 0,
          lon: s.start_location?.lng || 0,
        }));

        return { coords: points, distance, duration, steps };
      });
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Formatage de la durée
 */
const formatDuration = (seconds: number): string => {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  if (remainingMins === 0) return `${hours}h`;
  return `${hours}h ${remainingMins}m`;
};

/**
 * Formatage de la distance
 */
const formatDistance = (meters: number): string => {
  if (meters < 1000) return `${Math.round(meters)} m`;
  const kms = (meters / 1000).toFixed(1);
  return `${kms} km`;
};

/**
 * Vérification si le trajet est actif
 */
const isItTimeForLiveRide = (dateStr: string, timeStr: string): boolean => {
  if (!dateStr || !timeStr) return false;
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, minutes] = timeStr.split(':').map(Number);
  const departureDate = new Date(year, month - 1, day, hours, minutes, 0, 0);
  const now = new Date();
  const tenMinutesBefore = new Date(departureDate.getTime() - 10 * 60 * 1000);
  const twentyFourHoursAfter = new Date(departureDate.getTime() + 24 * 60 * 60 * 1000);
  return now.getTime() >= tenMinutesBefore.getTime() && now.getTime() <= twentyFourHoursAfter.getTime();
};

// ============================================================
// COMPONENT
// ============================================================

export default function LiveRideModal() {
  // Hooks
  const { user, authFetch } = useAuth();
  const insets = useSafeAreaInsets();

  // Refs
  const webviewRef = useRef<WebView>(null);
  const watchRef = useRef<Location.LocationSubscription | null>(null);
  const isMountedRef = useRef(true);
  const activeRideRef = useRef<Ride | null>(null);
  const isDriverRef = useRef<boolean>(false);
  const hasSpokenStartRef = useRef(false);
  const hasSpokenArrivalRef = useRef(false);
  const hasSpokenDriverApproachingRef = useRef(false);
  const lastSpokenInstructionRef = useRef('');

  // Animation refs
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  // State
  const [visible, setVisible] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [activeRide, setActiveRide] = useState<Ride | null>(null);
  const [isDriver, setIsDriver] = useState(false);
  const [activeBookingId, setActiveBookingId] = useState<string | null>(null);
  
  // Map state
  const [mapReady, setMapReady] = useState(false);
  const [location, setLocation] = useState<Coords | null>(null);
  const [destCoords, setDestCoords] = useState<Coords | null>(null);
  const [departCoords, setDepartCoords] = useState<Coords | null>(null);
  const [routes, setRoutes] = useState<RouteData[]>([]);
  const [activeRouteIndex, setActiveRouteIndex] = useState<number>(0);
  const [routeLoading, setRouteLoading] = useState(false);
  
  // Tracking state
  const [trackingState, setTrackingState] = useState<TrackingState>({
    isActive: false,
    position: null,
    speed: 0,
    heading: 0,
    accuracy: 0,
  });
  
  // UI state
  const [isSoundMuted, setIsSoundMuted] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [problemText, setProblemText] = useState('');
  const [sendingReport, setSendingReport] = useState(false);
  const [isConnected, setIsConnected] = useState(true);

  // ============================================================
  // ANIMATIONS
  // ============================================================

  useEffect(() => {
    if (visible && !isMinimized) {
      Animated.spring(slideAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
      
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [visible, isMinimized]);

  // ============================================================
  // NETWORK MONITORING
  // ============================================================

  useEffect(() => {
    let disconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const unsubscribe = NetInfo.addEventListener(state => {
      const connected = state.isConnected ?? true;
      setIsConnected(connected);

      if (!connected) {
        // N'alerter qu'après 5 secondes de déconnexion continue
        // pour éviter les faux positifs lors des transitions 4G ↔ WiFi
        disconnectTimer = setTimeout(() => {
          CustomAlert.alert(
            'Connexion perdue',
            'Votre connexion internet est instable. Le suivi GPS pourrait être affecté.'
          );
        }, 5000);
      } else {
        // Connexion rétablie → annuler l'alerte programmée
        if (disconnectTimer) {
          clearTimeout(disconnectTimer);
          disconnectTimer = null;
        }
      }
    });

    return () => {
      unsubscribe();
      if (disconnectTimer) clearTimeout(disconnectTimer);
    };
  }, []);


  // ============================================================
  // SPEECH UTILITIES
  // ============================================================

  const speakText = useCallback((text: string) => {
    if (!visible || isSoundMuted || !isConnected) return;
    try {
      Speech.speak(text, {
        language: 'fr',
        pitch: CONFIG.SPEECH_PITCH,
        rate: CONFIG.SPEECH_RATE,
      });
    } catch (e) {
      // Silent fail
    }
  }, [visible, isSoundMuted, isConnected]);

  // ============================================================
  // TRACKING MANAGEMENT
  // ============================================================

  const startTracking = useCallback(async () => {
    if (watchRef.current) return;

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      CustomAlert.alert(
        'Permission refusée',
        'Le suivi GPS est nécessaire pour les trajets en cours.'
      );
      return;
    }

    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.BestForNavigation,
    });

    if (!isMountedRef.current) return;

    const pos = { lat: loc.coords.latitude, lon: loc.coords.longitude };
    setLocation(pos);
    setTrackingState(prev => ({
      ...prev,
      isActive: true,
      position: pos,
      speed: Math.round((loc.coords.speed || 0) * 3.6),
      heading: loc.coords.heading || 0,
      accuracy: loc.coords.accuracy || 0,
    }));

    // Initial position upload
    const currentActiveRide = activeRideRef.current;
    const currentIsDriver = isDriverRef.current;
    if (currentIsDriver && currentActiveRide?.status === 'started') {
      await updateDriverPosition(pos);
    }

    watchRef.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: CONFIG.TRACKING_INTERVAL,
        distanceInterval: CONFIG.DISTANCE_INTERVAL,
      },
      (newLoc) => {
        if (!isMountedRef.current) return;
        
        const newPos = { lat: newLoc.coords.latitude, lon: newLoc.coords.longitude };
        const speedKmH = Math.round((newLoc.coords.speed || 0) * 3.6);
        
        setLocation(newPos);
        setTrackingState(prev => ({
          ...prev,
          position: newPos,
          speed: speedKmH >= 0 ? speedKmH : 0,
          heading: newLoc.coords.heading || 0,
          accuracy: newLoc.coords.accuracy || 0,
        }));

        sendToMap({
          type: 'updateUserPosition',
          lat: newPos.lat,
          lon: newPos.lon,
          heading: newLoc.coords.heading || 0,
        });

        // Check destination proximity
        checkProximityAndSpeak(newPos);

        // Update driver position
        const latestActiveRide = activeRideRef.current;
        const latestIsDriver = isDriverRef.current;
        if (latestIsDriver && latestActiveRide?.status === 'started') {
          updateDriverPosition(newPos);
        }
      }
    );
  }, []);

  const stopTracking = useCallback(() => {
    if (watchRef.current) {
      watchRef.current.remove();
      watchRef.current = null;
    }
    setTrackingState(prev => ({ ...prev, isActive: false }));
    hasSpokenStartRef.current = false;
    hasSpokenArrivalRef.current = false;
    hasSpokenDriverApproachingRef.current = false;
    lastSpokenInstructionRef.current = '';
  }, []);

  const updateDriverPosition = useCallback(async (pos: Coords) => {
    try {
      await authFetch(`/rides/${activeRideRef.current?.id}/update_location/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driver_latitude: pos.lat,
          driver_longitude: pos.lon,
        }),
      });
    } catch (error) {
      // Silent fail
    }
  }, [authFetch]);

  const checkProximityAndSpeak = useCallback((pos: Coords) => {
    // Check arrival proximity
    if (destCoords && !hasSpokenArrivalRef.current) {
      const distToDest = getDistanceInKm(pos.lat, pos.lon, destCoords.lat, destCoords.lon);
      if (distToDest <= CONFIG.DISTANCE_THRESHOLD_ARRIVAL) {
        speakText("Vous approchez de votre destination. Préparez-vous à descendre.");
        hasSpokenArrivalRef.current = true;
      }
    }

    // Check driver proximity (passenger view)
    if (!isDriverRef.current && activeRideRef.current) {
      const driverLat = Number(activeRideRef.current.driver_latitude);
      const driverLon = Number(activeRideRef.current.driver_longitude);
      if (driverLat && driverLon && !hasSpokenDriverApproachingRef.current) {
        const distToDriver = getDistanceInKm(pos.lat, pos.lon, driverLat, driverLon);
        if (distToDriver <= CONFIG.DISTANCE_THRESHOLD_DRIVER_APPROACH) {
          speakText("Votre conducteur est tout proche. Il sera là dans quelques instants.");
          hasSpokenDriverApproachingRef.current = true;
        }
      }
    }
  }, [destCoords, speakText]);

  // ============================================================
  // MAP COMMUNICATION
  // ============================================================

  const sendToMap = useCallback((message: object) => {
    webviewRef.current?.injectJavaScript(
      `window.handleMessage && window.handleMessage(${JSON.stringify(message)}); true;`
    );
  }, []);

  const onMapMessage = useCallback((event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'ready' && isMountedRef.current) {
        setMapReady(true);
      } else if (data.type === 'selectRoute' && isMountedRef.current) {
        setActiveRouteIndex(data.index);
      }
    } catch (err) {
      // Silent fail
    }
  }, []);

  // ============================================================
  // RIDE MANAGEMENT
  // ============================================================

  const geocodeRide = useCallback(async (ride: Ride, booking?: any) => {
    try {
      let dep: Coords | null = null;
      let dest: Coords | null = null;

      if (booking) {
        const bDepLat = booking.departure_latitude;
        const bDepLon = booking.departure_longitude;
        const bArrLat = booking.arrival_latitude;
        const bArrLon = booking.arrival_longitude;

        if (bDepLat != null && bDepLon != null) {
          dep = { lat: Number(bDepLat), lon: Number(bDepLon) };
        }
        if (bArrLat != null && bArrLon != null) {
          dest = { lat: Number(bArrLat), lon: Number(bArrLon) };
        }

        if (!dep && booking.departure_location) {
          dep = await geocodeBenin(booking.departure_location);
        }
        if (!dest && booking.arrival_location) {
          dest = await geocodeBenin(booking.arrival_location);
        }
      }

      if (!dep) {
        if (ride.departure_latitude != null && ride.departure_longitude != null) {
          dep = {
            lat: Number(ride.departure_latitude),
            lon: Number(ride.departure_longitude),
          };
        } else if (ride.departure_location) {
          dep = await geocodeBenin(ride.departure_location);
        }
      }

      if (!dest) {
        if (ride.arrival_latitude != null && ride.arrival_longitude != null) {
          dest = {
            lat: Number(ride.arrival_latitude),
            lon: Number(ride.arrival_longitude),
          };
        } else if (ride.arrival_location) {
          dest = await geocodeBenin(ride.arrival_location);
        }
      }

      if (isMountedRef.current) {
        if (dep) setDepartCoords(dep);
        if (dest) setDestCoords(dest);
      }
    } catch (err) {
      // Silent fail
    }
  }, []);

  const checkActiveRides = useCallback(async () => {
    if (!user) return;

    try {
      const [ridesResp, bookingsResp] = await Promise.all([
        authFetch(`/rides/?driver=${user.id}`),
        authFetch(`/bookings/?passenger=${user.id}`),
      ]);

      if (!isMountedRef.current) return;

      const ridesData = ridesResp.results || ridesResp || [];
      const bookingsData = bookingsResp.results || bookingsResp || [];

      const driverRides: Ride[] = ridesData.filter(
        (r: Ride) => (r.status === 'active' || r.status === 'started') && 
                     isItTimeForLiveRide(r.departure_date, r.departure_time)
      );
      
      const passengerRides: Ride[] = bookingsData
        .filter((b: any) => b.status === 'confirmed' && b.payment_status !== 'pending')
        .map((b: any) => b.ride_details)
        .filter((r: Ride) => r && (r.status === 'active' || r.status === 'started') && 
               isItTimeForLiveRide(r.departure_date, r.departure_time));

      let currentRide: Ride | null = null;
      let asDriver = false;
      let bookingId: string | null = null;
      let bookingObj: any = null;

      if (driverRides.length > 0) {
        currentRide = driverRides[0];
        asDriver = true;
      } else if (passengerRides.length > 0) {
        currentRide = passengerRides[0];
        const matchingBooking = bookingsData.find(
          (b: any) => b.ride_details?.id === currentRide!.id
        );
        bookingId = matchingBooking?.id || null;
        bookingObj = matchingBooking || null;
      }

      if (currentRide) {
        const prevRide = activeRideRef.current;
        const statusChanged = prevRide ? prevRide.status !== currentRide.status : true;
        const idChanged = prevRide ? prevRide.id !== currentRide.id : true;

        if (idChanged || statusChanged) {
          setActiveRide(currentRide);
          setIsDriver(asDriver);
          setActiveBookingId(bookingId);
          setVisible(true);
          await geocodeRide(currentRide, bookingObj);
          
          if (currentRide.status === 'started') {
            await startTracking();
            if (!hasSpokenStartRef.current) {
              const message = asDriver
                ? "Votre trajet a commencé. Zemy vous souhaite une excellente route. Restez attentif."
                : "Votre trajet vient de démarrer avec votre conducteur. Zemy vous souhaite un agréable voyage.";
              speakText(message);
              hasSpokenStartRef.current = true;
            }
          } else {
            stopTracking();
          }
        } else {
          if (prevRide && (prevRide.driver_latitude !== currentRide.driver_latitude || 
                           prevRide.driver_longitude !== currentRide.driver_longitude)) {
            setActiveRide(currentRide);
          }
        }
      } else {
        setVisible(false);
        setIsMinimized(false);
        stopTracking();
      }
    } catch (error) {
      console.warn('Error checking active rides:', error);
    }
  }, [user, authFetch, startTracking, stopTracking, speakText, geocodeRide]);

  const loadRoute = useCallback(async (from: Coords, to: Coords) => {
    setRouteLoading(true);
    try {
      const fetchedRoutes = await getRoutes(from, to);
      if (!isMountedRef.current) return;

      if (fetchedRoutes && fetchedRoutes.length > 0) {
        setRoutes(fetchedRoutes);
        setActiveRouteIndex(0);
        sendToMap({ 
          type: 'fitBounds', 
          points: [[from.lat, from.lon], [to.lat, to.lon]] 
        });
      } else {
        setRoutes([]);
        sendToMap({
          type: 'fitBounds',
          points: [[from.lat, from.lon], [to.lat, to.lon]],
        });
      }
    } finally {
      if (isMountedRef.current) {
        setRouteLoading(false);
      }
    }
  }, [sendToMap]);

  // ============================================================
  // RIDE ACTIONS
  // ============================================================

  const handleStartRide = useCallback(() => {
    CustomAlert.alert('Démarrer le trajet', 'Voulez-vous démarrer ce trajet ? Le suivi GPS sera activé.', [
      { text: 'Non', style: 'cancel' },
      {
        text: 'Oui, démarrer',
        onPress: async () => {
          try {
            await authFetch(`/rides/${activeRide?.id}/start/`, { method: 'POST' });
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
  }, [activeRide, authFetch, startTracking]);

  const handleCompleteRide = useCallback(() => {
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
  }, [activeRide, authFetch, stopTracking, speakText]);

  const handlePassengerComplete = useCallback(() => {
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
  }, [activeBookingId, authFetch, stopTracking, speakText]);

  const handleSendReport = useCallback(async () => {
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
  }, [problemText, activeRide, location, authFetch]);

  const openGoogleMaps = useCallback(() => {
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
    }).catch(() => {});
  }, [destCoords]);

  // ============================================================
  // EFFECTS
  // ============================================================

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      stopTracking();
    };
  }, [stopTracking]);

  useEffect(() => {
    activeRideRef.current = activeRide;
  }, [activeRide]);

  useEffect(() => {
    isDriverRef.current = isDriver;
  }, [isDriver]);

  // Check active rides periodically
  useEffect(() => {
    if (!user) return;
    
    checkActiveRides();
    const delay = visible ? CONFIG.CHECK_INTERVAL_ACTIVE : CONFIG.CHECK_INTERVAL_IDLE;
    const interval = setInterval(checkActiveRides, delay);
    
    return () => clearInterval(interval);
  }, [user, checkActiveRides, visible]);

  // Sync map with location
  useEffect(() => {
    if (!mapReady || !location) return;
    sendToMap({ 
      type: 'updateUserPosition', 
      lat: location.lat, 
      lon: location.lon, 
      heading: trackingState.heading 
    });
  }, [location, mapReady, trackingState.heading, sendToMap]);

  // Sync role with map
  useEffect(() => {
    if (mapReady) {
      sendToMap({ type: 'initRole', isDriver });
    }
  }, [mapReady, isDriver, sendToMap]);

  // Sync driver position with map (passenger view)
  useEffect(() => {
    if (!mapReady || !activeRide || isDriver) return;
    
    const driverLat = Number(activeRide.driver_latitude);
    const driverLon = Number(activeRide.driver_longitude);
    
    if (driverLat && driverLon) {
      sendToMap({
        type: 'updateDriverPosition',
        lat: driverLat,
        lon: driverLon,
      });
    }
  }, [activeRide, mapReady, isDriver, sendToMap]);

  // Sync departure marker
  useEffect(() => {
    if (!mapReady || !departCoords) return;
    sendToMap({ 
      type: 'setDepartMarker', 
      lat: departCoords.lat, 
      lon: departCoords.lon 
    });
  }, [departCoords, mapReady, sendToMap]);

  // Sync destination marker
  useEffect(() => {
    if (!mapReady || !destCoords) return;
    sendToMap({ 
      type: 'setDestMarker', 
      lat: destCoords.lat, 
      lon: destCoords.lon 
    });
  }, [destCoords, mapReady, sendToMap]);

  // Load route when coordinates are available
  useEffect(() => {
    if (!mapReady || !departCoords || !destCoords) return;
    loadRoute(departCoords, destCoords);
  }, [departCoords, destCoords, mapReady, loadRoute]);

  // Sync routes with map
  useEffect(() => {
    if (!mapReady || routes.length === 0) return;
    sendToMap({ 
      type: 'drawRoutes', 
      routes, 
      activeIndex: activeRouteIndex 
    });
  }, [routes, activeRouteIndex, mapReady, sendToMap]);

  // Turn-by-turn guidance and voice prompts
  const activeRoute = routes[activeRouteIndex];
  const activeStep = useMemo(() => {
    if (!activeRoute?.steps || activeRoute.steps.length === 0 || !location) return null;
    
    let minDistance = Infinity;
    let index = 0;
    activeRoute.steps.forEach((step, idx) => {
      const dist = getDistanceInKm(location.lat, location.lon, step.lat, step.lon);
      if (dist < minDistance) {
        minDistance = dist;
        index = idx;
      }
    });
    
    return activeRoute.steps[index];
  }, [activeRoute, location]);

  useEffect(() => {
    if (activeStep?.instruction && activeRide?.status === 'started') {
      const instr = activeStep.instruction;
      if (instr !== lastSpokenInstructionRef.current) {
        speakText(instr);
        lastSpokenInstructionRef.current = instr;
      }
    }
  }, [activeStep, activeRide, speakText]);

  // ============================================================
  // RENDER HELPERS
  // ============================================================

  const getEtaStr = useCallback((durationSeconds: number): string => {
    const now = new Date();
    const etaDate = new Date(now.getTime() + durationSeconds * 1000);
    const hours = String(etaDate.getHours()).padStart(2, '0');
    const minutes = String(etaDate.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }, []);

  // ============================================================
  // GOOGLE MAPS HTML
  // ============================================================

  const googleMapHtml = useMemo(() => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body, html, #map { width: 100%; height: 100%; }

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
      z-index: 1000;
    }

    .compass-beam {
      position: absolute;
      width: 80px;
      height: 80px;
      background: radial-gradient(circle, rgba(66, 133, 244, 0.4) 0%, rgba(66, 133, 244, 0) 70%);
      clip-path: polygon(50% 50%, 25% 0%, 75% 0%);
      transform-origin: 50% 50%;
      pointer-events: none;
      display: block;
      transition: transform 0.2s ease-out;
    }

    .compass-beam-driver {
      background: radial-gradient(circle, rgba(16, 185, 129, 0.4) 0%, rgba(16, 185, 129, 0) 70%);
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
      
      var fillColor = type === 'driver' ? '#10B981' : '#2563EB';
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
        zoom: 18,
        center: { lat: ${DEFAULT_LAT}, lng: ${DEFAULT_LON} },
        disableDefaultUI: true,
        tilt: 60,
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
        preserveViewport: true,
        polylineOptions: {
          strokeColor: '#3B82F6',
          strokeOpacity: 0.9,
          strokeWeight: 6
        }
      });

      map.addListener('tilesloaded', function() {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
        }
      });

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
          map.setZoom(18);
          map.setTilt(60);
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

        if (autoCenter) {
          var shouldFollow = false;
          if (isDriverRole) {
            shouldFollow = true;
          } else if (!driverMarker) {
            shouldFollow = true;
          }

          if (shouldFollow) {
            map.panTo(pos);
            map.setZoom(18);
            map.setTilt(60);
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

        if (autoCenter && !isDriverRole) {
          map.panTo(pos);
          map.setZoom(18);
          map.setTilt(60);
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
    src="https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_KEY}&callback=initMap">
  </script>
</body>
</html>
  `, [GOOGLE_MAPS_KEY]);

  // ============================================================
  // RENDER
  // ============================================================

  if (!activeRide) return null;

  // Minimized state
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

  // Main modal
  return (
    <>
      <StatusBar barStyle="light-content" />
      <Modal 
        visible={visible} 
        animationType="slide" 
        transparent
        statusBarTranslucent
      >
        <View style={styles.overlayFull}>
          {/* WebView Map */}
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

          {/* Guidance Card */}
          {mapReady && (
            <Animated.View 
              style={[
                styles.guidageContainer,
                {
                  transform: [{
                    translateY: slideAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-100, 0],
                    }),
                  }],
                },
              ]}
            >
              <View style={styles.guidageMain}>
                <Animated.View style={[styles.guidageIconContainer, { transform: [{ scale: pulseAnim }] }]}>
                  <Ionicons name="arrow-up" size={32} color={theme.colors.white} />
                </Animated.View>
                <View style={styles.guidageTextContainer}>
                  <Text style={styles.guidageInstruction} numberOfLines={2}>
                    {activeRide.status === 'started' && activeStep?.instruction
                      ? activeStep.instruction
                      : activeRide.status === 'started'
                      ? `Continuer vers l'arrivée à ${activeRide.arrival_location.split(',')[0]}`
                      : `Démarrer le trajet vers ${activeRide.arrival_location.split(',')[0]}`}
                  </Text>
                  <Text style={styles.guidageDistance}>
                    {activeStep?.distanceText ? `Dans ${activeStep.distanceText}` : 'Suivre le tracé bleu Zemy'}
                  </Text>
                </View>
              </View>
              <View style={styles.guidageSecondary}>
                <Ionicons name="arrow-redo" size={16} color={theme.colors.white} />
                <Text style={styles.guidageSecondaryText}>Puis fin de votre voyage</Text>
              </View>
            </Animated.View>
          )}

          {/* Right Controls */}
          {mapReady && (
            <View style={styles.rightControlsContainer}>
              <TouchableOpacity 
                style={styles.navRoundBtn} 
                onPress={() => sendToMap({ type: 'recenter' })} 
                activeOpacity={0.8}
              >
                <Ionicons name="compass" size={24} color="#EF4444" />
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.navRoundBtn} 
                onPress={() => sendToMap({ type: 'recenter' })} 
                activeOpacity={0.8}
              >
                <Ionicons name="locate" size={24} color={theme.colors.primary} />
              </TouchableOpacity>

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

              {!isDriver && (
                <TouchableOpacity 
                  style={styles.navRoundBtn} 
                  onPress={openGoogleMaps}
                  activeOpacity={0.8}
                >
                  <Ionicons name="navigate" size={24} color="#4285F4" />
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Speedometer */}
          {mapReady && (
            <View style={[styles.speedometerContainer, { bottom: Math.max(120, insets.bottom + 104) }]}>
              <Text style={styles.speedValue}>{trackingState.speed}</Text>
              <Text style={styles.speedUnit}>km/h</Text>
            </View>
          )}

          {/* Ride Actions */}
          {mapReady && (
            <View style={[styles.rideControlFabContainer, { bottom: Math.max(120, insets.bottom + 104) }]}>
              {activeRide.status === 'active' && isDriver ? (
                <TouchableOpacity style={styles.startFab} onPress={handleStartRide} activeOpacity={0.8}>
                  <Ionicons name="play" size={20} color={theme.colors.white} />
                  <Text style={styles.rideControlFabText}>DÉMARRER</Text>
                </TouchableOpacity>
              ) : activeRide.status === 'started' ? (
                <TouchableOpacity 
                  style={styles.completeFab} 
                  onPress={isDriver ? handleCompleteRide : handlePassengerComplete}
                  activeOpacity={0.8}
                >
                  <Ionicons name="checkmark-sharp" size={20} color={theme.colors.white} />
                  <Text style={styles.rideControlFabText}>TERMINER</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          )}

          {/* Bottom Panel */}
          {mapReady && (
            <Animated.View 
              style={[
                styles.bottomNavPanel, 
                { 
                  bottom: Math.max(24, insets.bottom + 12),
                  transform: [{
                    translateY: slideAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [100, 0],
                    }),
                  }],
                }
              ]}
            >
              <TouchableOpacity 
                style={styles.bottomNavCloseBtn} 
                onPress={() => { setVisible(false); setIsMinimized(true); }}
                activeOpacity={0.8}
              >
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>

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

              <TouchableOpacity 
                style={styles.bottomNavReportBtn} 
                onPress={() => setShowReportModal(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="warning-outline" size={22} color={theme.colors.error} />
              </TouchableOpacity>
            </Animated.View>
          )}
        </View>
      </Modal>

      {/* Report Modal */}
      <Modal visible={showReportModal} transparent animationType="fade">
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
          style={styles.reportOverlay}
        >
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
              <TouchableOpacity 
                style={styles.reportCancelBtn} 
                onPress={() => { setShowReportModal(false); setProblemText(''); }}
              >
                <Text style={styles.reportCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.reportSendBtn, !problemText.trim() && styles.reportSendBtnDisabled]}
                onPress={handleSendReport}
                disabled={sendingReport || !problemText.trim()}
              >
                {sendingReport 
                  ? <ActivityIndicator size="small" color={theme.colors.white} /> 
                  : <Text style={styles.reportSendText}>Envoyer</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
  floatingBubble: {
    position: 'absolute',
    bottom: 160,
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
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.success,
  },
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
    left: 0, right: 0, top: 0, bottom: 0,
    backgroundColor: '#FAFAFA',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 99,
  },
  mapLoaderText: {
    marginTop: 12,
    fontSize: 14,
    color: theme.colors.textLight,
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
  reportOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  reportCard: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  reportTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  reportSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
    lineHeight: 20,
  },
  reportInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    color: '#111827',
    minHeight: 100,
    backgroundColor: '#F9FAFB',
    marginBottom: 16,
  },
  reportActions: {
    flexDirection: 'row',
    gap: 12,
  },
  reportCancelBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  reportCancelText: {
    fontSize: 15,
    color: '#4B5563',
    fontWeight: '600',
  },
  reportSendBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportSendBtnDisabled: {
    backgroundColor: '#FCA5A5',
  },
  reportSendText: {
    fontSize: 15,
    color: '#FFF',
    fontWeight: 'bold',
  },
});
