/**
 * ==============================================================
 * LocationPicker.tsx — Superposition Absolue Immuable (Fix Clavier Android)
 * ==============================================================
 *
 * Solution Clavier & Déplacement :
 * 1. Utilisation d'un conteneur Overlay Absolu (au lieu d'un Dialog Modal Native Android).
 * 2. Empêche à 100% Android d'effectuer un "adjustPan" qui fait sauter le haut de l'écran.
 * 3. L'en-tête et la case de recherche restent TOUJOURS sous la barre de statut (incurvable).
 * 4. La liste des départs récents & lieux populaires s'affiche de manière fluide sous la recherche.
 * 5. Glissement tactile PanResponder (baisser / élever / fermer) maintenu.
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StatusBar,
  Platform,
  Keyboard,
  Dimensions,
  ScrollView,
  TouchableWithoutFeedback,
  PanResponder,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import Fuse from 'fuse.js';

import { fetchApi } from '../services/api';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export interface LocationData {
  latitude: number;
  longitude: number;
  name: string;
  address?: string;
  city?: string;
  country?: string;
}

interface LocationPickerProps {
  onLocationSelected: (location: LocationData) => void;
  onCancel: () => void;
  initialLocation?: LocationData;
  title?: string;
}

const DEFAULT_LAT = 6.3703;
const DEFAULT_LON = 2.3912;
const RECENT_LOCATIONS_KEY = '@zemy_recent_locations';

const DEFAULT_POPULAR_BENIN: LocationData[] = [
  { name: 'Cotonou', city: 'Cotonou', address: 'Littoral, Bénin', latitude: 6.3703, longitude: 2.3912 },
  { name: 'Porto-Novo', city: 'Porto-Novo', address: 'Ouémé, Bénin', latitude: 6.4969, longitude: 2.6289 },
  { name: 'Abomey-Calavi', city: 'Abomey-Calavi', address: 'Atlantique, Bénin', latitude: 6.4482, longitude: 2.3557 },
  { name: 'Parakou', city: 'Parakou', address: 'Borgou, Bénin', latitude: 9.3371, longitude: 2.6303 },
  { name: 'Bohicon', city: 'Bohicon', address: 'Zou, Bénin', latitude: 7.1783, longitude: 2.0667 },
  { name: 'Ouidah', city: 'Ouidah', address: 'Atlantique, Bénin', latitude: 6.3631, longitude: 2.0851 },
  { name: 'Natitingou', city: 'Natitingou', address: 'Atacora, Bénin', latitude: 10.3042, longitude: 1.3796 },
  { name: 'Godomey', city: 'Abomey-Calavi', address: 'Atlantique, Bénin', latitude: 6.3861, longitude: 2.3364 },
  { name: 'Akpakpa', city: 'Cotonou', address: 'Cotonou, Bénin', latitude: 6.3683, longitude: 2.4439 },
  { name: 'Cadjehoun', city: 'Cotonou', address: 'Cotonou, Bénin', latitude: 6.3575, longitude: 2.3891 },
  { name: 'Étoile Rouge', city: 'Cotonou', address: 'Cotonou, Bénin', latitude: 6.3768, longitude: 2.4143 },
];

export default function LocationPicker({
  onLocationSelected,
  onCancel,
  initialLocation,
  title = 'Choisir un lieu',
}: LocationPickerProps) {
  const insets = useSafeAreaInsets();
  const webviewRef = useRef<WebView>(null);
  const searchInputRef = useRef<TextInput>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const [recentLocations, setRecentLocations] = useState<LocationData[]>([]);
  const [popularPlaces, setPopularPlaces] = useState<LocationData[]>(DEFAULT_POPULAR_BENIN);

  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(initialLocation || null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);

  const [mapReady, setMapReady] = useState(false);
  const [isLoadingAddress, setIsLoadingAddress] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [customLocationName, setCustomLocationName] = useState('');

  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const searchAbort = useRef<AbortController | null>(null);
  const lastReverseRef = useRef({ lat: 0, lon: 0 });

  // ── GESTION PAN RESPONDER (GLISSEMENT POUR BAISSER / ÉLEVER / FERMER) ──
  const panY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const [snapState, setSnapState] = useState<'expanded' | 'lowered'>('expanded');
  const currentSnapRef = useRef<'expanded' | 'lowered'>('expanded');

  useEffect(() => {
    Animated.spring(panY, {
      toValue: 0,
      tension: 65,
      friction: 11,
      useNativeDriver: true,
    }).start();
  }, [panY]);

  const snapTo = useCallback(
    (target: 'expanded' | 'lowered' | 'closed') => {
      let toValue = 0;
      if (target === 'lowered') {
        toValue = SCREEN_HEIGHT * 0.36;
      } else if (target === 'closed') {
        toValue = SCREEN_HEIGHT;
      }

      Animated.spring(panY, {
        toValue,
        tension: 75,
        friction: 12,
        useNativeDriver: true,
      }).start(() => {
        if (target === 'closed') {
          onCancel();
        } else {
          setSnapState(target);
          currentSnapRef.current = target;
        }
      });
    },
    [panY, onCancel]
  );

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 5;
      },
      onPanResponderMove: (_, gestureState) => {
        const baseOffset = currentSnapRef.current === 'lowered' ? SCREEN_HEIGHT * 0.36 : 0;
        const newY = baseOffset + gestureState.dy;
        if (newY > -30) {
          panY.setValue(newY);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        const baseOffset = currentSnapRef.current === 'lowered' ? SCREEN_HEIGHT * 0.36 : 0;
        const finalY = baseOffset + gestureState.dy;

        if (gestureState.vy > 0.9 || finalY > SCREEN_HEIGHT * 0.55) {
          snapTo('closed');
        } else if (finalY > SCREEN_HEIGHT * 0.18) {
          snapTo('lowered');
        } else {
          snapTo('expanded');
        }
      },
    })
  ).current;

  const handleFocusSearch = () => {
    setIsSearchFocused(true);
    if (currentSnapRef.current === 'lowered') {
      snapTo('expanded');
    }
  };

  useEffect(() => {
    loadRecentLocations();
    fetchPopularPlaces();
    initializeLocation();

    return () => {
      searchAbort.current?.abort();
      abortRef.current?.abort();
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      if (dragTimeoutRef.current) clearTimeout(dragTimeoutRef.current);
    };
  }, []);

  const loadRecentLocations = async () => {
    try {
      const stored = await AsyncStorage.getItem(RECENT_LOCATIONS_KEY);
      if (stored) {
        setRecentLocations(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Error loading recent locations:', error);
    }
  };

  const saveRecentLocation = async (loc: LocationData) => {
    try {
      const stored = await AsyncStorage.getItem(RECENT_LOCATIONS_KEY);
      let list: LocationData[] = stored ? JSON.parse(stored) : [];

      list = list.filter(
        (item) => item.name.trim().toLowerCase() !== loc.name.trim().toLowerCase()
      );
      list.unshift(loc);
      list = list.slice(0, 10);

      await AsyncStorage.setItem(RECENT_LOCATIONS_KEY, JSON.stringify(list));
      setRecentLocations(list);
    } catch (error) {
      console.error('Error saving recent location:', error);
    }
  };

  const clearRecentLocations = async () => {
    try {
      await AsyncStorage.removeItem(RECENT_LOCATIONS_KEY);
      setRecentLocations([]);
    } catch (error) {
      console.error('Error clearing recent locations:', error);
    }
  };

  const fetchPopularPlaces = async () => {
    try {
      const data = await fetchApi('/popular-places/');
      const apiResults = Array.isArray(data) ? data : data?.results || [];

      if (apiResults.length > 0) {
        const formatted: LocationData[] = apiResults.map((item: any) => ({
          name: item.name,
          city: item.city || '',
          address: item.city ? `${item.city}, Bénin` : 'Bénin',
          latitude: Number(item.latitude || DEFAULT_LAT),
          longitude: Number(item.longitude || DEFAULT_LON),
        }));

        const combined = [...formatted];
        DEFAULT_POPULAR_BENIN.forEach((def) => {
          if (!combined.some((c) => c.name.toLowerCase() === def.name.toLowerCase())) {
            combined.push(def);
          }
        });
        setPopularPlaces(combined);
      }
    } catch (err) {}
  };

  const initializedRef = useRef(false);

  const initializeLocation = async () => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const location = { lat: loc.coords.latitude, lon: loc.coords.longitude };
      setUserLocation(location);

      if (!initialLocation) {
        setSelectedLocation({
          latitude: location.lat,
          longitude: location.lon,
          name: 'Position actuelle',
        });
      }
    } catch (error) {
      console.error('Error getting user position:', error);
    }
  };

  const sendToMap = useCallback((message: object) => {
    webviewRef.current?.injectJavaScript(
      `window.handleMessage && window.handleMessage(${JSON.stringify(message)}); true;`
    );
  }, []);

  useEffect(() => {
    if (!mapReady) return;

    if (selectedLocation) {
      sendToMap({
        type: 'setView',
        lat: selectedLocation.latitude,
        lon: selectedLocation.longitude,
        zoom: 15,
      });
    } else if (userLocation) {
      sendToMap({ type: 'setView', lat: userLocation.lat, lon: userLocation.lon, zoom: 14 });
      sendToMap({ type: 'setUserMarker', lat: userLocation.lat, lon: userLocation.lon });
      reverseGeocode(userLocation.lat, userLocation.lon);
    }
  }, [mapReady, sendToMap]);

  const reverseGeocode = async (lat: number, lon: number) => {
    if (
      Math.abs(lastReverseRef.current.lat - lat) < 0.00001 &&
      Math.abs(lastReverseRef.current.lon - lon) < 0.00001
    ) {
      return;
    }

    lastReverseRef.current = { lat, lon };
    setIsLoadingAddress(true);

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1&accept-language=fr`,
        {
          signal: abortRef.current.signal,
          headers: { 'User-Agent': 'CovoitBeninApp/1.0' },
        }
      );

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();

      if (data?.address) {
        const address = data.address;
        let name = '';
        if (address.road) name = address.road;
        else if (address.pedestrian) name = address.pedestrian;
        else if (address.footway) name = address.footway;
        else if (address.neighbourhood) name = address.neighbourhood;
        else if (address.suburb) name = address.suburb;
        else name = 'Position choisie';

        if (address.house_number) name = `${address.house_number} ${name}`;

        const city = address.city || address.town || address.village || '';
        const country = address.country || 'Bénin';

        setSelectedLocation({
          latitude: lat,
          longitude: lon,
          name: name,
          address: [address.suburb, address.district].filter(Boolean).join(', '),
          city: city,
          country: country,
        });
      } else if (data.display_name) {
        const parts = data.display_name.split(',');
        setSelectedLocation({
          latitude: lat,
          longitude: lon,
          name: parts[0],
          address: parts.slice(1, 3).join(',').trim(),
          city: parts[2]?.trim(),
          country: parts[parts.length - 1]?.trim(),
        });
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Reverse geocoding error:', error);
      }
    } finally {
      setIsLoadingAddress(false);
    }
  };

  const searchPlaces = async (query: string) => {
    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    searchAbort.current?.abort();
    searchAbort.current = new AbortController();

    try {
      let localResults: any[] = [];
      try {
        const localData = await fetchApi(
          `/popular-places/?search=${encodeURIComponent(query)}`
        );
        localResults = Array.isArray(localData) ? localData : localData?.results || [];
      } catch (err) {}

      const photonResponse = await fetch(
        `https://photon.komoot.io/api/?q=${encodeURIComponent(`${query} Benin`)}&limit=15`,
        { signal: searchAbort.current.signal }
      );

      if (!photonResponse.ok) throw new Error(`HTTP ${photonResponse.status}`);
      const photonData = await photonResponse.json();

      const photonResults =
        photonData?.features?.map((feature: any) => ({
          id: feature.properties.osm_id,
          lat: feature.geometry.coordinates[1],
          lon: feature.geometry.coordinates[0],
          name: feature.properties.name || feature.properties.street || 'Lieu',
          city: feature.properties.city || feature.properties.county || '',
          country: feature.properties.country || '',
          display_name: [feature.properties.name, feature.properties.city, feature.properties.country]
            .filter(Boolean)
            .join(', '),
        })) || [];

      photonResults.sort((a: any, b: any) => {
        const aBenin = a.country?.toLowerCase().includes('benin') ? 1 : 0;
        const bBenin = b.country?.toLowerCase().includes('benin') ? 1 : 0;
        return bBenin - aBenin;
      });

      const combinedResults = [...localResults, ...photonResults];
      const fuse = new Fuse(combinedResults, {
        keys: ['name', 'display_name', 'city'],
        threshold: 0.3,
      });

      const fuzzyResults = fuse.search(query);
      setSearchResults(fuzzyResults.map((r) => r.item));
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Search error:', error);
      }
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchChange = useCallback((text: string) => {
    setSearchQuery(text);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (text.trim().length === 0) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    searchTimeoutRef.current = setTimeout(() => {
      searchPlaces(text);
    }, 350);
  }, []);

  const handleSelectSuggestion = useCallback(
    (loc: LocationData) => {
      Keyboard.dismiss();
      setIsSearchFocused(false);
      setSearchQuery(loc.name);
      setSelectedLocation(loc);

      sendToMap({
        type: 'setView',
        lat: loc.latitude,
        lon: loc.longitude,
        zoom: 16,
      });
    },
    [sendToMap]
  );

  const handleSelectSearchResult = useCallback(
    (item: any) => {
      Keyboard.dismiss();
      setIsSearchFocused(false);

      if (item.latitude !== undefined && item.longitude !== undefined) {
        const loc: LocationData = {
          latitude: Number(item.latitude),
          longitude: Number(item.longitude),
          name: item.name,
          address: item.city ? `${item.city}, Bénin` : 'Bénin',
          city: item.city || '',
          country: 'Bénin',
        };
        setSearchQuery(loc.name);
        setSelectedLocation(loc);
        sendToMap({ type: 'setView', lat: loc.latitude, lon: loc.longitude, zoom: 16 });
        return;
      }

      const lat = Number(item.lat);
      const lon = Number(item.lon);
      const parts = (item.display_name || '').split(',');
      const name = item.name || parts[0] || 'Lieu choisi';
      const address = parts.slice(1, 3).join(',').trim();
      const city = item.city || parts[2]?.trim() || '';

      const loc: LocationData = {
        latitude: lat,
        longitude: lon,
        name,
        address,
        city,
        country: 'Bénin',
      };
      setSearchQuery(loc.name);
      setSelectedLocation(loc);
      sendToMap({ type: 'setView', lat, lon, zoom: 16 });
    },
    [sendToMap]
  );

  const goToMyLocation = useCallback(() => {
    if (userLocation) {
      sendToMap({ type: 'setView', lat: userLocation.lat, lon: userLocation.lon, zoom: 15 });
      sendToMap({ type: 'setUserMarker', lat: userLocation.lat, lon: userLocation.lon });
      reverseGeocode(userLocation.lat, userLocation.lon);
    }
  }, [userLocation, sendToMap]);

  const handleConfirmLocation = useCallback(() => {
    if (selectedLocation) {
      const finalLoc: LocationData = {
        ...selectedLocation,
        name: customLocationName.trim() || selectedLocation.name,
      };
      saveRecentLocation(finalLoc);
      onLocationSelected(finalLoc);
    } else {
      const fallbackLoc: LocationData = {
        latitude: DEFAULT_LAT,
        longitude: DEFAULT_LON,
        name: customLocationName.trim() || 'Position choisie',
      };
      saveRecentLocation(fallbackLoc);
      onLocationSelected(fallbackLoc);
    }
  }, [selectedLocation, customLocationName, onLocationSelected]);

  const onMapMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'centerChanged') {
        const currentLat = selectedLocation?.latitude ?? DEFAULT_LAT;
        const currentLon = selectedLocation?.longitude ?? DEFAULT_LON;

        if (
          Math.abs(data.lat - currentLat) < 0.00001 &&
          Math.abs(data.lon - currentLon) < 0.00001 &&
          !isDragging
        ) {
          return;
        }

        setSelectedLocation((prev) => ({
          latitude: data.lat,
          longitude: data.lon,
          name: prev?.name ?? 'Recherche du lieu...',
          address: prev?.address,
          city: prev?.city,
          country: prev?.country,
        }));

        setIsDragging(true);
        if (dragTimeoutRef.current) clearTimeout(dragTimeoutRef.current);

        dragTimeoutRef.current = setTimeout(() => {
          reverseGeocode(data.lat, data.lon);
          setIsDragging(false);
        }, 700);
      } else if (data.type === 'ready') {
        setMapReady(true);
      }
    } catch (error) {
      console.error('Map message error:', error);
    }
  };

  const leafletHtml = useMemo(
    () => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body, html, #map { width: 100%; height: 100%; background: #f0f4f8; }
    .center-marker {
      position: absolute; top: 50%; left: 50%;
      transform: translate(-50%, -50%); z-index: 1000;
      pointer-events: none; transition: transform 0.2s ease;
    }
    .center-marker.dragging { transform: translate(-50%, -50%) scale(0.85); }
    .marker-pin {
      width: 36px; height: 36px; border-radius: 50% 50% 50% 0;
      background: #0066FF; position: absolute; transform: rotate(-45deg);
      left: 50%; top: 50%; margin: -18px 0 0 -18px;
      box-shadow: 0 4px 14px rgba(0,102,255,0.4); border: 3px solid white;
    }
    .marker-pin::after {
      content: ''; width: 12px; height: 12px; margin: 9px 0 0 9px;
      background: white; position: absolute; border-radius: 50%;
    }
    .pulse {
      width: 64px; height: 64px; background: rgba(0,102,255,0.25);
      border-radius: 50%; position: absolute; left: 50%; top: 50%;
      margin: -32px 0 0 -32px; animation: pulse 1.6s infinite;
    }
    @keyframes pulse {
      0% { transform: scale(0.4); opacity: 1; }
      100% { transform: scale(1.6); opacity: 0; }
    }
    .user-marker {
      width: 18px; height: 18px; background: #10B981;
      border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    }
    .leaflet-control-attribution, .leaflet-control-zoom { display: none !important; }
  </style>
</head>
<body>
  <div id="map"></div>
  <div class="center-marker" id="centerMarker">
    <div class="marker-pin"></div>
    <div class="pulse"></div>
  </div>
  <script>
    var map = L.map('map', { zoomControl: false }).setView([${DEFAULT_LAT}, ${DEFAULT_LON}], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '© OpenStreetMap', detectRetina: true, crossOrigin: true
    }).addTo(map);
    var userMarker = null;
    var markerElement = document.getElementById('centerMarker');
    map.on('movestart', function() {
      if (markerElement) markerElement.classList.add('dragging');
    });
    map.on('moveend', function() {
      setTimeout(function() {
        if (markerElement) markerElement.classList.remove('dragging');
        var center = map.getCenter();
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'centerChanged', lat: center.lat, lon: center.lng
        }));
      }, 120);
    });
    map.whenReady(function() {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
    });
    window.handleMessage = function(msg) {
      if (msg.type === 'setView') {
        map.flyTo([msg.lat, msg.lon], msg.zoom || 15, { animate: true, duration: 0.6 });
      } else if (msg.type === 'setUserMarker') {
        var userIcon = L.divIcon({
          className: '', html: '<div class="user-marker"></div>', iconSize: [18, 18], iconAnchor: [9, 9]
        });
        if (userMarker) userMarker.setLatLng([msg.lat, msg.lon]);
        else userMarker = L.marker([msg.lat, msg.lon], { icon: userIcon, zIndexOffset: 200 }).addTo(map);
      } else if (msg.type === 'zoomIn') { map.zoomIn(); }
      else if (msg.type === 'zoomOut') { map.zoomOut(); }
    };
  </script>
</body>
</html>`,
    []
  );

  const showSuggestions = isSearchFocused || searchQuery.length > 0;
  const isQueryEmpty = searchQuery.trim().length === 0;

  const cardTopMargin = Math.max(insets.top + 10, Platform.OS === 'ios' ? 44 : 24);

  return (
    <View style={styles.overlayContainer}>
      <TouchableWithoutFeedback onPress={() => snapTo('closed')}>
        <View style={styles.backdropTouch} />
      </TouchableWithoutFeedback>

      {/* ── FENÊTRE MODALE ANCRÉE SOUS LA BARRE DE STATUT (IMMOBILE) ── */}
      <Animated.View
        style={[
          styles.modalContentCard,
          {
            top: cardTopMargin,
            transform: [
              {
                translateY: panY.interpolate({
                  inputRange: [-100, 0, SCREEN_HEIGHT],
                  outputRange: [-25, 0, SCREEN_HEIGHT],
                  extrapolate: 'clamp',
                }),
              },
            ],
          },
        ]}
      >
        {/* 1. EN-TÊTE FIXE IMMOBILE (Poignée + Titre + Fermer) */}
        <View {...panResponder.panHandlers} style={styles.fixedHeaderArea}>
          <TouchableOpacity
            style={styles.modalHandleTouchContainer}
            onPress={() => snapTo(snapState === 'expanded' ? 'lowered' : 'expanded')}
            activeOpacity={0.7}
          >
            <View style={styles.modalHandleBar} />
            <Text style={styles.dragHintText}>
              {snapState === 'expanded' ? 'Glissez vers le bas pour baisser' : 'Glissez vers le haut pour agrandir'}
            </Text>
          </TouchableOpacity>

          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderTitleRow}>
              <Ionicons name="map" size={22} color="#0066FF" />
              <Text style={styles.modalHeaderTitle}>{title}</Text>
            </View>
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => snapTo('closed')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-circle" size={26} color="#9CA3AF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* 2. CASE DE RECHERCHE FIXE EN HAUT (Toujours parfaitement visible) */}
        <View style={styles.fixedSearchArea}>
          <View style={[styles.searchBox, isSearchFocused && styles.searchBoxActive]}>
            <Ionicons name="search" size={20} color="#6B7280" style={{ marginRight: 8 }} />
            <TextInput
              ref={searchInputRef}
              style={styles.searchInput}
              placeholder="Rechercher une ville, quartier, lieu..."
              placeholderTextColor="#9CA3AF"
              value={searchQuery}
              onChangeText={handleSearchChange}
              onFocus={handleFocusSearch}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {isSearching ? (
              <ActivityIndicator size="small" color="#0066FF" style={{ marginLeft: 6 }} />
            ) : searchQuery.length > 0 ? (
              <TouchableOpacity onPress={() => handleSearchChange('')}>
                <Ionicons name="close-circle" size={18} color="#9CA3AF" />
              </TouchableOpacity>
            ) : isSearchFocused ? (
              <TouchableOpacity onPress={() => { Keyboard.dismiss(); setIsSearchFocused(false); }}>
                <Ionicons name="chevron-up" size={20} color="#0066FF" />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* 3. CORPS DYNAMIQUE : SUGGESTIONS OU CARTE INTERACTIVE */}
        {showSuggestions ? (
          /* MODE SUGGESTIONS (S'AFFICHE DIRECTEMENT SOUS LA RECHERCHE) */
          <View style={styles.suggestionsFullBody}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
            >
              {/* Départs récents */}
              {recentLocations.length > 0 && isQueryEmpty && (
                <View style={styles.dropdownSection}>
                  <View style={styles.dropdownSectionHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Ionicons name="time-outline" size={16} color="#0066FF" style={{ marginRight: 6 }} />
                      <Text style={styles.dropdownSectionTitle}>Départs récents</Text>
                    </View>
                    <TouchableOpacity onPress={clearRecentLocations} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Text style={styles.clearHistoryText}>Effacer</Text>
                    </TouchableOpacity>
                  </View>

                  {recentLocations.map((item, index) => (
                    <TouchableOpacity
                      key={`recent-${index}-${item.name}`}
                      style={[
                        styles.suggestionItem,
                        index === recentLocations.length - 1 && styles.suggestionItemLast,
                      ]}
                      onPress={() => handleSelectSuggestion(item)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.recentIconBadge}>
                        <Ionicons name="time" size={16} color="#0066FF" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.suggestionTitle} numberOfLines={1}>
                          {item.name}
                        </Text>
                        {item.address || item.city ? (
                          <Text style={styles.suggestionSubtitle} numberOfLines={1}>
                            {item.address || item.city}
                          </Text>
                        ) : null}
                      </View>
                      <Ionicons name="chevron-forward" size={16} color="#D1D5DB" />
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Lieux populaires au Bénin */}
              {isQueryEmpty && (
                <View style={styles.dropdownSection}>
                  <View style={styles.dropdownSectionHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Ionicons name="sparkles-outline" size={16} color="#F59E0B" style={{ marginRight: 6 }} />
                      <Text style={styles.dropdownSectionTitle}>Lieux populaires au Bénin</Text>
                    </View>
                  </View>

                  {popularPlaces.map((item, index) => (
                    <TouchableOpacity
                      key={`popular-${index}-${item.name}`}
                      style={[
                        styles.suggestionItem,
                        index === popularPlaces.length - 1 && styles.suggestionItemLast,
                      ]}
                      onPress={() => handleSelectSuggestion(item)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.popularIconBadge}>
                        <Ionicons name="location-sharp" size={16} color="#0066FF" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.suggestionTitle} numberOfLines={1}>
                          {item.name}
                        </Text>
                        {item.address || item.city ? (
                          <Text style={styles.suggestionSubtitle} numberOfLines={1}>
                            {item.address || item.city}
                          </Text>
                        ) : null}
                      </View>
                      <Ionicons name="chevron-forward" size={16} color="#D1D5DB" />
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Résultats en direct lors de la saisie */}
              {!isQueryEmpty && (
                <View>
                  {searchResults.map((item, index) => {
                    let itemTitle = '';
                    let itemSubtitle = '';

                    if (item.latitude !== undefined) {
                      itemTitle = item.name;
                      itemSubtitle = item.city ? `${item.city}, Bénin` : 'Bénin';
                    } else {
                      const displayName = item.display_name || '';
                      const parts = displayName.split(',');
                      itemTitle = item.name || parts[0] || 'Lieu';
                      itemSubtitle = parts.slice(1, 4).join(',').trim();
                    }

                    return (
                      <TouchableOpacity
                        key={item.id || item.place_id?.toString() || `search-${index}`}
                        style={[
                          styles.suggestionItem,
                          index === searchResults.length - 1 && styles.suggestionItemLast,
                        ]}
                        onPress={() => handleSelectSearchResult(item)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.searchIconBadge}>
                          <Ionicons name="navigate-outline" size={16} color="#0066FF" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.suggestionTitle} numberOfLines={1}>
                            {itemTitle}
                          </Text>
                          {itemSubtitle ? (
                            <Text style={styles.suggestionSubtitle} numberOfLines={1}>
                              {itemSubtitle}
                            </Text>
                          ) : null}
                        </View>
                        <Ionicons name="chevron-forward" size={16} color="#D1D5DB" />
                      </TouchableOpacity>
                    );
                  })}

                  {!isSearching && searchResults.length === 0 && (
                    <View style={styles.emptySearchContainer}>
                      <Ionicons name="search-outline" size={36} color="#9CA3AF" />
                      <Text style={styles.emptySearchTitle}>Aucun résultat trouvé</Text>
                      <Text style={styles.emptySearchSubtitle}>
                        Vérifiez l'orthographe ou choisissez sur la carte.
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* Bouton pour fermer les suggestions et voir la carte */}
              <TouchableOpacity
                style={styles.seeMapBtn}
                onPress={() => { Keyboard.dismiss(); setIsSearchFocused(false); }}
              >
                <Ionicons name="map-outline" size={18} color="#0066FF" style={{ marginRight: 6 }} />
                <Text style={styles.seeMapBtnText}>Voir la carte en grand</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        ) : (
          /* MODE CARTE INTERACTIVE */
          <View style={{ flex: 1 }}>
            <View style={styles.mapFullContainer}>
              <WebView
                ref={webviewRef}
                originWhitelist={['*']}
                source={{ html: leafletHtml }}
                onMessage={onMapMessage}
                javaScriptEnabled
                domStorageEnabled
                cacheEnabled
                style={styles.mapWebView}
                scrollEnabled={false}
                androidLayerType="hardware"
                mixedContentMode="compatibility"
                allowsInlineMediaPlayback
              />

              {!mapReady && (
                <View style={styles.mapLoadingOverlay}>
                  <ActivityIndicator size="large" color="#0066FF" />
                  <Text style={styles.mapLoadingText}>Chargement de la carte...</Text>
                </View>
              )}

              {/* Bouton Ma Position Flottant */}
              <TouchableOpacity style={styles.myLocationFloatingBtn} onPress={goToMyLocation} activeOpacity={0.8}>
                <Ionicons name="locate" size={22} color="#1F2937" />
              </TouchableOpacity>
            </View>

            {/* Footer de Confirmation au Bas de la Carte */}
            <View style={styles.floatingFooterCard}>
              <View style={styles.locationSummaryCard}>
                <View style={styles.locationIconCircle}>
                  <Ionicons name="location" size={22} color="#0066FF" />
                </View>
                <View style={{ flex: 1 }}>
                  {isLoadingAddress ? (
                    <View>
                      <ActivityIndicator size="small" color="#0066FF" style={{ alignSelf: 'flex-start' }} />
                      <Text style={styles.loadingAddrText}>Détermination de l'adresse...</Text>
                    </View>
                  ) : (
                    <>
                      <Text style={styles.summaryTitle} numberOfLines={1}>
                        {selectedLocation?.name || 'Déplacez la carte pour choisir'}
                      </Text>
                      {selectedLocation?.address ? (
                        <Text style={styles.summarySubtitle} numberOfLines={1}>
                          {selectedLocation.address}
                        </Text>
                      ) : null}
                    </>
                  )}
                </View>
              </View>

              {/* Saisie précision optionnelle */}
              <View style={styles.customNoteInputRow}>
                <Ionicons name="create-outline" size={16} color="#6B7280" />
                <TextInput
                  style={styles.customNoteInput}
                  placeholder="Précision ou repère (ex: devant la pharmacie)"
                  placeholderTextColor="#9CA3AF"
                  value={customLocationName}
                  onChangeText={setCustomLocationName}
                />
              </View>

              {/* Bouton de confirmation principal */}
              <TouchableOpacity
                style={[styles.confirmLocationBtn, isLoadingAddress && styles.confirmBtnDisabled]}
                onPress={handleConfirmLocation}
                disabled={isLoadingAddress}
                activeOpacity={0.85}
              >
                <Text style={styles.confirmBtnText}>Confirmer cet emplacement</Text>
                <Ionicons name="arrow-forward" size={18} color="#FFFFFF" style={{ marginLeft: 6 }} />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 99999,
    elevation: 99999,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
  },
  backdropTouch: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContentCard: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 16,
    overflow: 'hidden',
  },
  fixedHeaderArea: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  modalHandleTouchContainer: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
  },
  modalHandleBar: {
    width: 42,
    height: 5,
    backgroundColor: '#CBD5E1',
    borderRadius: 3,
  },
  dragHintText: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 3,
    fontWeight: '500',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  modalHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalHeaderTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1F2937',
  },
  modalCloseBtn: {
    padding: 2,
  },
  fixedSearchArea: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFF',
    paddingHorizontal: 14,
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchBoxActive: {
    borderColor: '#0066FF',
    backgroundColor: '#FFFFFF',
    shadowColor: '#0066FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  suggestionsFullBody: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingTop: 8,
  },
  dropdownSection: {
    marginBottom: 14,
    backgroundColor: '#F8FAFF',
    borderRadius: 16,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dropdownSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 2,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    marginBottom: 6,
  },
  dropdownSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1F2937',
  },
  clearHistoryText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#EF4444',
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 10,
  },
  suggestionItemLast: {
    borderBottomWidth: 0,
  },
  recentIconBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  popularIconBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchIconBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F0FDF4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  suggestionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  suggestionSubtitle: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 1,
  },
  seeMapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: '#EFF6FF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginTop: 8,
  },
  seeMapBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0066FF',
  },
  emptySearchContainer: {
    paddingVertical: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySearchTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
    marginTop: 8,
  },
  emptySearchSubtitle: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 2,
  },
  mapFullContainer: {
    flex: 1,
    position: 'relative',
    width: '100%',
  },
  mapWebView: {
    ...StyleSheet.absoluteFillObject,
  },
  mapLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
  },
  mapLoadingText: {
    marginTop: 12,
    fontSize: 13,
    color: '#6B7280',
  },
  myLocationFloatingBtn: {
    position: 'absolute',
    right: 16,
    bottom: 185,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 90,
  },
  floatingFooterCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
  locationSummaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFF',
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 10,
    marginBottom: 8,
  },
  locationIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingAddrText: {
    fontSize: 12,
    color: '#0066FF',
    marginTop: 2,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
  },
  summarySubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 1,
  },
  customNoteInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 40,
    marginBottom: 10,
    gap: 8,
  },
  customNoteInput: {
    flex: 1,
    fontSize: 13,
    color: '#1F2937',
  },
  confirmLocationBtn: {
    backgroundColor: '#0066FF',
    height: 48,
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#0066FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  confirmBtnDisabled: {
    opacity: 0.6,
  },
  confirmBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});