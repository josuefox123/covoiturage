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
  const [customLocationName, setCustomLocationName] = useState(initialLocation?.name || '');

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

  const hasCenteredRef = useRef(false);
  const isProgrammaticPanningRef = useRef(false);

  useEffect(() => {
    if (!mapReady) return;

    if (userLocation) {
      sendToMap({ type: 'setUserMarker', lat: userLocation.lat, lon: userLocation.lon });
    }

    if (hasCenteredRef.current) return;

    if (initialLocation) {
      isProgrammaticPanningRef.current = true;
      sendToMap({
        type: 'setView',
        lat: initialLocation.latitude,
        lon: initialLocation.longitude,
        zoom: 15,
      });
      hasCenteredRef.current = true;
    } else if (userLocation) {
      sendToMap({
        type: 'setView',
        lat: userLocation.lat,
        lon: userLocation.lon,
        zoom: 15,
      });
      reverseGeocode(userLocation.lat, userLocation.lon);
      hasCenteredRef.current = true;
    }
  }, [mapReady, userLocation, initialLocation, sendToMap]);

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

    const GOOGLE_API_KEY = 'AIzaSyDeQDN8_mfUVNcb37Tg1FsiMaBoCuYOgrc';

    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lon}&key=${GOOGLE_API_KEY}&language=fr`,
        { signal: abortRef.current.signal }
      );

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();

      if (data.status === 'OK' && data.results?.length > 0) {
        const result = data.results[0];
        const components: any[] = result.address_components || [];

        const getComp = (type: string) =>
          components.find((c: any) => c.types.includes(type))?.long_name || '';

        const streetNumber = getComp('street_number');
        const route = getComp('route');
        const neighborhood =
          getComp('neighborhood') ||
          getComp('sublocality_level_1') ||
          getComp('sublocality');
        const city =
          getComp('locality') ||
          getComp('administrative_area_level_2') ||
          getComp('administrative_area_level_1');
        const country = getComp('country') || 'Bénin';

        let name = '';
        if (route) name = streetNumber ? `${streetNumber} ${route}` : route;
        else if (neighborhood) name = neighborhood;
        else name = result.formatted_address?.split(',')[0] || 'Position choisie';

        setSelectedLocation({
          latitude: lat,
          longitude: lon,
          name,
          address:
            neighborhood ||
            result.formatted_address?.split(',').slice(1, 3).join(',').trim() ||
            '',
          city,
          country,
        });
        setCustomLocationName(name);
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Reverse geocoding error:', error);
      }
    } finally {
      setIsLoadingAddress(false);
    }
  };

  const GOOGLE_API_KEY = 'AIzaSyDeQDN8_mfUVNcb37Tg1FsiMaBoCuYOgrc';

  const fetchPlaceDetails = async (placeId: string): Promise<{ lat: number; lon: number; address: string; city: string } | null> => {
    try {
      const resp = await fetch(
        `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=geometry,address_components,formatted_address&key=${GOOGLE_API_KEY}&language=fr`
      );
      const data = await resp.json();
      if (data.status === 'OK' && data.result?.geometry?.location) {
        const loc = data.result.geometry.location;
        const components: any[] = data.result.address_components || [];
        const getComp = (type: string) =>
          components.find((c: any) => c.types.includes(type))?.long_name || '';
        const city =
          getComp('locality') ||
          getComp('administrative_area_level_2') ||
          getComp('administrative_area_level_1') ||
          '';
        const address = data.result.formatted_address || '';
        return { lat: loc.lat, lon: loc.lng, address, city };
      }
    } catch (e) {}
    return null;
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
      // Local popular places from backend
      let localResults: any[] = [];
      try {
        const localData = await fetchApi(
          `/popular-places/?search=${encodeURIComponent(query)}`
        );
        localResults = Array.isArray(localData) ? localData : localData?.results || [];
      } catch (err) {}

      // Google Places Autocomplete — fast, route-aware, precise
      const locationBias = userLocation
        ? `&location=${userLocation.lat},${userLocation.lon}&radius=500000`
        : '&location=6.3703,2.3912&radius=600000';

      const acResp = await fetch(
        `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&key=${GOOGLE_API_KEY}&language=fr&components=country:bj${locationBias}&types=geocode|establishment`,
        { signal: searchAbort.current.signal }
      );

      if (!acResp.ok) throw new Error(`HTTP ${acResp.status}`);
      const acData = await acResp.json();

      const googleResults: any[] =
        (acData?.predictions || []).map((pred: any) => ({
          id: pred.place_id,
          place_id: pred.place_id,
          name: pred.structured_formatting?.main_text || pred.description?.split(',')[0] || pred.description,
          city: pred.structured_formatting?.secondary_text?.split(',')[0]?.trim() || '',
          display_name: pred.description,
          // lat/lon not yet resolved — will be fetched on selection
          lat: null,
          lon: null,
        }));

      // Merge: local (with known coords) + Google Autocomplete (place_id-based)
      const combined: any[] = [];

      // Local results first (already have lat/lon)
      localResults.forEach((r: any) => {
        if (!combined.some((c) => c.name?.toLowerCase() === r.name?.toLowerCase())) {
          combined.push({ ...r, _source: 'local' });
        }
      });

      // Google autocomplete results
      googleResults.forEach((r) => {
        if (!combined.some((c) => c.name?.toLowerCase() === r.name?.toLowerCase())) {
          combined.push({ ...r, _source: 'google' });
        }
      });

      setSearchResults(combined);
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
    }, 300);
  }, [userLocation]);

  const handleSelectSuggestion = useCallback(
    (loc: LocationData) => {
      Keyboard.dismiss();
      setIsSearchFocused(false);
      setSearchQuery(loc.name);
      setSelectedLocation(loc);
      setCustomLocationName(loc.name);

      isProgrammaticPanningRef.current = true;
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
    async (item: any) => {
      Keyboard.dismiss();
      setIsSearchFocused(false);

      // Case 1: local result with known coordinates
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
        setCustomLocationName(loc.name);
        isProgrammaticPanningRef.current = true;
        sendToMap({ type: 'setView', lat: loc.latitude, lon: loc.longitude, zoom: 16 });
        return;
      }

      // Case 2: Google Autocomplete result — resolve place_id for exact coords
      if (item.place_id) {
        setIsLoadingAddress(true);
        setSearchQuery(item.name);
        try {
          const details = await fetchPlaceDetails(item.place_id);
          if (details) {
            const loc: LocationData = {
              latitude: details.lat,
              longitude: details.lon,
              name: item.name,
              address: details.address,
              city: details.city,
              country: 'Bénin',
            };
            setSelectedLocation(loc);
            setCustomLocationName(item.name);
            isProgrammaticPanningRef.current = true;
            sendToMap({ type: 'setView', lat: details.lat, lon: details.lon, zoom: 16 });
          }
        } finally {
          setIsLoadingAddress(false);
        }
        return;
      }

      // Case 3: fallback with raw lat/lon
      const lat = Number(item.lat);
      const lon = Number(item.lon);
      if (!lat || !lon) return;

      const parts = (item.display_name || '').split(',');
      const name = item.name || parts[0] || 'Lieu choisi';
      const address = parts.slice(1, 3).join(',').trim();
      const city = item.city || parts[2]?.trim() || '';

      const loc: LocationData = { latitude: lat, longitude: lon, name, address, city, country: 'Bénin' };
      setSearchQuery(loc.name);
      setSelectedLocation(loc);
      setCustomLocationName(name);
      isProgrammaticPanningRef.current = true;
      sendToMap({ type: 'setView', lat, lon, zoom: 16 });
    },
    [sendToMap, fetchPlaceDetails]
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
        if (isProgrammaticPanningRef.current) {
          isProgrammaticPanningRef.current = false;
          return;
        }

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

  const googleMapsHtml = useMemo(
    () => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body, html, #map { width: 100%; height: 100%; background: #f0f4f8; }
    .center-marker {
      position: absolute; top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      z-index: 1000; pointer-events: none; transition: transform 0.18s ease;
    }
    .center-marker.dragging { transform: translate(-50%, -60%) scale(1.12); }
    .marker-pin {
      width: 36px; height: 36px; border-radius: 50% 50% 50% 0;
      background: #0066FF; position: absolute; transform: rotate(-45deg);
      left: 50%; top: 50%; margin: -18px 0 0 -18px;
      box-shadow: 0 4px 14px rgba(0,102,255,0.45); border: 3px solid white;
    }
    .marker-pin::after {
      content: ''; width: 12px; height: 12px; margin: 9px 0 0 9px;
      background: white; position: absolute; border-radius: 50%;
    }
    .pulse {
      width: 64px; height: 64px; background: rgba(0,102,255,0.2);
      border-radius: 50%; position: absolute; left: 50%; top: 50%;
      margin: -32px 0 0 -32px; animation: pulse 1.6s infinite;
    }
    @keyframes pulse {
      0% { transform: scale(0.4); opacity: 1; }
      100% { transform: scale(1.6); opacity: 0; }
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <div class="center-marker" id="centerMarker">
    <div class="marker-pin"></div>
    <div class="pulse"></div>
  </div>
  <script>
    var map, userMarker, previewMarker, moveTimeout;
    var markerEl = document.getElementById('centerMarker');

    function initMap() {
      map = new google.maps.Map(document.getElementById('map'), {
        center: { lat: ${DEFAULT_LAT}, lng: ${DEFAULT_LON} },
        zoom: 13,
        disableDefaultUI: true,
        gestureHandling: 'greedy',
        mapTypeId: 'roadmap',
        styles: [
          { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
          { featureType: 'transit', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] }
        ]
      });

      map.addListener('dragstart', function() {
        if (markerEl) markerEl.classList.add('dragging');
        clearTimeout(moveTimeout);
      });

      map.addListener('idle', function() {
        clearTimeout(moveTimeout);
        moveTimeout = setTimeout(function() {
          if (markerEl) markerEl.classList.remove('dragging');
          var c = map.getCenter();
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'centerChanged', lat: c.lat(), lon: c.lng()
          }));
        }, 120);
      });

      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
    }

    window.handleMessage = function(msg) {
      if (!map) return;
      if (msg.type === 'setView') {
        map.panTo({ lat: msg.lat, lng: msg.lon });
        if (msg.zoom) map.setZoom(msg.zoom);
      } else if (msg.type === 'previewLocation') {
        var pos = { lat: msg.lat, lng: msg.lon };
        if (previewMarker) {
          previewMarker.setPosition(pos);
        } else {
          previewMarker = new google.maps.Marker({
            position: pos, map: map,
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 11, fillColor: '#FFAA00', fillOpacity: 0.9,
              strokeColor: 'white', strokeWeight: 2.5
            },
            animation: google.maps.Animation.DROP,
            zIndex: 150
          });
        }
        map.panTo(pos);
      } else if (msg.type === 'clearPreview') {
        if (previewMarker) { previewMarker.setMap(null); previewMarker = null; }
      } else if (msg.type === 'setUserMarker') {
        var uPos = { lat: msg.lat, lng: msg.lon };
        if (userMarker) { userMarker.setPosition(uPos); }
        else {
          userMarker = new google.maps.Marker({
            position: uPos, map: map,
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 8, fillColor: '#10B981', fillOpacity: 1,
              strokeColor: 'white', strokeWeight: 3
            },
            zIndex: 200
          });
        }
      } else if (msg.type === 'zoomIn') { map.setZoom(map.getZoom() + 1); }
      else if (msg.type === 'zoomOut') { map.setZoom(map.getZoom() - 1); }
    };
  </script>
  <script async defer
    src="https://maps.googleapis.com/maps/api/js?key=AIzaSyDeQDN8_mfUVNcb37Tg1FsiMaBoCuYOgrc&callback=initMap">
  </script>
</body>
</html>`,
    []
  );

  const showSuggestions = isSearchFocused;
  const isQueryEmpty = searchQuery.trim().length === 0;

  // ── Preview dynamique: 1er résultat affiché sur la carte au fur et à mesure ──
  useEffect(() => {
    if (!mapReady) return;
    if (searchResults.length === 0) {
      sendToMap({ type: 'clearPreview' });
      return;
    }
    const first = searchResults[0];
    const lat = first.lat ?? first.latitude;
    const lon = first.lon ?? first.longitude;
    if (lat && lon) {
      isProgrammaticPanningRef.current = true;
      sendToMap({ type: 'previewLocation', lat, lon });
    }
  }, [searchResults, mapReady, sendToMap]);

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

        {/* 3. CARTE TOUJOURS VISIBLE + suggestions flottantes par-dessus */}
        <View style={{ flex: 1 }}>
          <View style={styles.mapFullContainer}>
            <WebView
              ref={webviewRef}
              originWhitelist={['*']}
              source={{ html: googleMapsHtml }}
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
            {!isSearchFocused && (
              <TouchableOpacity style={styles.myLocationFloatingBtn} onPress={goToMyLocation} activeOpacity={0.8}>
                <Ionicons name="locate" size={22} color="#1F2937" />
              </TouchableOpacity>
            )}

            {/* ── PANEL SUGGESTIONS FLOTTANT PAR-DESSUS LA CARTE ── */}
            {showSuggestions && (
              <View style={styles.floatingSuggestionsPanel}>
                <ScrollView
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 16 }}
                >
                  {/* Départs récents */}
                  {recentLocations.length > 0 && isQueryEmpty && (
                    <View style={styles.dropdownSection}>
                      <View style={styles.dropdownSectionHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Ionicons name="time-outline" size={15} color="#0066FF" style={{ marginRight: 5 }} />
                          <Text style={styles.dropdownSectionTitle}>Départs récents</Text>
                        </View>
                        <TouchableOpacity onPress={clearRecentLocations} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <Text style={styles.clearHistoryText}>Effacer</Text>
                        </TouchableOpacity>
                      </View>
                      {recentLocations.map((item, index) => (
                        <TouchableOpacity
                          key={`recent-${index}-${item.name}`}
                          style={[styles.suggestionItem, index === recentLocations.length - 1 && styles.suggestionItemLast]}
                          onPress={() => { sendToMap({ type: 'clearPreview' }); handleSelectSuggestion(item); }}
                          activeOpacity={0.7}
                        >
                          <View style={styles.recentIconBadge}>
                            <Ionicons name="time" size={15} color="#0066FF" />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.suggestionTitle} numberOfLines={1}>{item.name}</Text>
                            {(item.address || item.city) ? (
                              <Text style={styles.suggestionSubtitle} numberOfLines={1}>{item.address || item.city}</Text>
                            ) : null}
                          </View>
                          <Ionicons name="chevron-forward" size={15} color="#D1D5DB" />
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  {/* Lieux populaires */}
                  {isQueryEmpty && (
                    <View style={styles.dropdownSection}>
                      <View style={styles.dropdownSectionHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Ionicons name="sparkles-outline" size={15} color="#F59E0B" style={{ marginRight: 5 }} />
                          <Text style={styles.dropdownSectionTitle}>Lieux populaires au Bénin</Text>
                        </View>
                      </View>
                      {popularPlaces.map((item, index) => (
                        <TouchableOpacity
                          key={`popular-${index}-${item.name}`}
                          style={[styles.suggestionItem, index === popularPlaces.length - 1 && styles.suggestionItemLast]}
                          onPress={() => { sendToMap({ type: 'clearPreview' }); handleSelectSuggestion(item); }}
                          activeOpacity={0.7}
                        >
                          <View style={styles.popularIconBadge}>
                            <Ionicons name="location-sharp" size={15} color="#0066FF" />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.suggestionTitle} numberOfLines={1}>{item.name}</Text>
                            {(item.address || item.city) ? (
                              <Text style={styles.suggestionSubtitle} numberOfLines={1}>{item.address || item.city}</Text>
                            ) : null}
                          </View>
                          <Ionicons name="chevron-forward" size={15} color="#D1D5DB" />
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  {/* Résultats de recherche en direct */}
                  {!isQueryEmpty && (
                    <View>
                      {isSearching && searchResults.length === 0 && (
                        <View style={styles.searchingRow}>
                          <ActivityIndicator size="small" color="#0066FF" />
                          <Text style={styles.searchingText}>Recherche en cours...</Text>
                        </View>
                      )}
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
                              index === 0 && styles.suggestionItemFirst,
                              index === searchResults.length - 1 && styles.suggestionItemLast,
                            ]}
                            onPress={() => { sendToMap({ type: 'clearPreview' }); handleSelectSearchResult(item); }}
                            activeOpacity={0.7}
                          >
                            <View style={[styles.searchIconBadge, index === 0 && styles.searchIconBadgeTop]}>
                              <Ionicons name={index === 0 ? 'location' : 'navigate-outline'} size={15} color={index === 0 ? '#0066FF' : '#6B7280'} />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.suggestionTitle, index === 0 && styles.suggestionTitleTop]} numberOfLines={1}>{itemTitle}</Text>
                              {itemSubtitle ? (
                                <Text style={styles.suggestionSubtitle} numberOfLines={1}>{itemSubtitle}</Text>
                              ) : null}
                            </View>
                            {index === 0 && (
                              <View style={styles.previewBadge}>
                                <Text style={styles.previewBadgeText}>Aperçu</Text>
                              </View>
                            )}
                          </TouchableOpacity>
                        );
                      })}
                      {!isSearching && searchResults.length === 0 && (
                        <View style={styles.emptySearchContainer}>
                          <Ionicons name="search-outline" size={30} color="#9CA3AF" />
                          <Text style={styles.emptySearchTitle}>Aucun résultat</Text>
                          <Text style={styles.emptySearchSubtitle}>Essayez un autre terme ou glissez la carte.</Text>
                        </View>
                      )}
                    </View>
                  )}
                </ScrollView>
              </View>
            )}
          </View>

          {/* Footer de Confirmation (caché pendant la recherche) */}
          {!isSearchFocused && (
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
                  placeholder="Nom du lieu ou repère (ex: Carrefour, Gare, Pharmacie...)"
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
          )}
        </View>
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
  // ── Panel suggestions flottant par-dessus la carte ──
  floatingSuggestionsPanel: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    maxHeight: '78%',
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 12,
    zIndex: 50,
    paddingTop: 6,
  },
  dropdownSection: {
    marginBottom: 10,
    backgroundColor: '#F8FAFF',
    borderRadius: 14,
    padding: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dropdownSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
    paddingHorizontal: 2,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    marginBottom: 4,
  },
  dropdownSectionTitle: {
    fontSize: 12,
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
  suggestionItemFirst: {
    backgroundColor: '#F0F7FF',
    borderRadius: 10,
    paddingHorizontal: 8,
    marginBottom: 2,
  },
  suggestionItemLast: {
    borderBottomWidth: 0,
  },
  recentIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  popularIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F0FDF4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchIconBadgeTop: {
    backgroundColor: '#DBEAFE',
  },
  suggestionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
  },
  suggestionTitleTop: {
    fontSize: 14,
    color: '#1D4ED8',
  },
  suggestionSubtitle: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 1,
  },
  previewBadge: {
    backgroundColor: '#FFAA00',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  previewBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  searchingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 10,
  },
  searchingText: {
    fontSize: 13,
    color: '#6B7280',
  },
  emptySearchContainer: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySearchTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    marginTop: 6,
  },
  emptySearchSubtitle: {
    fontSize: 11,
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
  // suggestionsFullBody kept for backward compat (unused)
  suggestionsFullBody: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingTop: 8,
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
});