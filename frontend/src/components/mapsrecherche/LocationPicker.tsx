import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Keyboard,
  Dimensions,
  TouchableWithoutFeedback,
  TouchableOpacity,
  PanResponder,
  Animated,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';

import { fetchApi } from '../../services/api';
import { LocationData, LocationPickerProps } from './types';
import { getGoogleMapsHtml } from './GoogleMapsHtml';
import FloatingSearchCard from './FloatingSearchCard';
import FloatingSuggestionsPanel from './FloatingSuggestionsPanel';
import FloatingFooterCard from './FloatingFooterCard';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const DEFAULT_LAT = 6.3703;
const DEFAULT_LON = 2.3912;
const RECENT_LOCATIONS_KEY = '@zemy_recent_locations';

const DEFAULT_POPULAR_BENIN: LocationData[] = [
  { name: 'Cotonou', city: 'Cotonou', address: 'Littoral, Bénin', latitude: 6.3703, longitude: 2.3912 },
  { name: 'Porto-Novo', city: 'Porto-Novo', address: 'Ouémé, Bénin', latitude: 6.4969, longitude: 2.6289 },
  { name: 'Abomey-Calavi', city: 'Abomey-Calavi', address: 'Atlantique, Bénin', latitude: 6.4482, longitude: 2.3557 },
  { name: 'Parakou', city: 'Parakou', address: 'Borgou, Bénin', latitude: 9.3371, longitude: 2.6303 },
  { name: 'Bohicon', city: 'Bohicon', address: 'Zou, Bénin', latitude: 7.1783, longitude: 2.0667 },
];

export default function LocationPicker({
  onLocationSelected,
  onCancel,
  initialLocation,
  title = 'Choisir un lieu',
}: LocationPickerProps) {
  const insets = useSafeAreaInsets();
  const webviewRef = useRef<WebView>(null);
  const searchInputRef = useRef<any>(null);
  const placeCache = useRef<{ [placeId: string]: any }>({});

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

  const [isLoadingGPS, setIsLoadingGPS] = useState(false);
  const [nearbySuggestions, setNearbySuggestions] = useState<any[]>([]);
  const [isFavorite, setIsFavorite] = useState(false);
  const gpsRotateAnim = useRef(new Animated.Value(0)).current;

  const [showFilters, setShowFilters] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'cities' | 'establishments'>('all');
  const [filterRadius, setFilterRadius] = useState<number>(50);

  const gpsRotation = gpsRotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const searchTimeoutRef = useRef<any>(null);
  const dragTimeoutRef = useRef<any>(null);
  const abortRef = useRef<AbortController | null>(null);
  const searchAbort = useRef<AbortController | null>(null);
  const lastReverseRef = useRef({ lat: 0, lon: 0 });
  const searchVersionRef = useRef(0);
  const isProgrammaticPanningRef = useRef(false);

  // Animation Pan / Sliders
  const panY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const [snapState, setSnapState] = useState<'expanded' | 'lowered'>('expanded');
  const currentSnapRef = useRef<'expanded' | 'lowered'>('expanded');

  const snapTo = useCallback(
    (target: 'expanded' | 'lowered' | 'closed') => {
      let toValue = 0;
      if (target === 'lowered') {
        toValue = SCREEN_HEIGHT * 0.38;
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
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 5,
      onPanResponderMove: (_, gestureState) => {
        const baseOffset = currentSnapRef.current === 'lowered' ? SCREEN_HEIGHT * 0.38 : 0;
        const newY = baseOffset + gestureState.dy;
        const clampedY = Math.max(-120, Math.min(SCREEN_HEIGHT * 0.38, newY));
        panY.setValue(clampedY);
      },
      onPanResponderRelease: (_, gestureState) => {
        const baseOffset = currentSnapRef.current === 'lowered' ? SCREEN_HEIGHT * 0.38 : 0;
        const finalY = baseOffset + gestureState.dy;

        if (gestureState.vy > 0.4) {
          snapTo('lowered');
        } else if (gestureState.vy < -0.4) {
          snapTo('expanded');
        } else if (finalY > SCREEN_HEIGHT * 0.19) {
          snapTo('lowered');
        } else {
          snapTo('expanded');
        }
      },
    })
  ).current;

  // Mount logic
  useEffect(() => {
    Animated.spring(panY, {
      toValue: 0,
      tension: 65,
      friction: 11,
      useNativeDriver: true,
    }).start();

    loadRecentLocations();
    fetchPopularPlaces();
    initializeLocation();

    const focusTimer = setTimeout(() => {
      setIsSearchFocused(true);
      searchInputRef.current?.focus();
    }, 200);

    return () => {
      searchAbort.current?.abort();
      abortRef.current?.abort();
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      if (dragTimeoutRef.current) clearTimeout(dragTimeoutRef.current);
      clearTimeout(focusTimer);
    };
  }, []);

  // Sync nearby recommendations
  useEffect(() => {
    if (selectedLocation) {
      const selectedLat = selectedLocation.latitude;
      const selectedLon = selectedLocation.longitude;
      const sorted = [...DEFAULT_POPULAR_BENIN]
        .map(p => {
          const dLat = p.latitude - selectedLat;
          const dLon = p.longitude - selectedLon;
          const distKm = Math.sqrt(dLat*dLat + dLon*dLon) * 111;
          return { ...p, distKm };
        })
        .filter(p => p.name.toLowerCase() !== selectedLocation.name.toLowerCase())
        .sort((a, b) => a.distKm - b.distKm);

      const suggested = sorted.slice(0, 3).map(p => ({
        ...p,
        distanceText: p.distKm < 1 ? `${Math.round(p.distKm * 1000)} m` : `${p.distKm.toFixed(1)} km`,
      }));

      setNearbySuggestions(suggested);
    }
  }, [selectedLocation]);

  const sendToMap = useCallback((msg: any) => {
    if (webviewRef.current) {
      webviewRef.current.postMessage(JSON.stringify(msg));
    }
  }, []);

  const loadRecentLocations = async () => {
    try {
      const stored = await AsyncStorage.getItem(RECENT_LOCATIONS_KEY);
      if (stored) setRecentLocations(JSON.parse(stored));
    } catch (e) {}
  };

  const saveRecentLocation = async (loc: LocationData) => {
    try {
      const stored = await AsyncStorage.getItem(RECENT_LOCATIONS_KEY);
      let list: LocationData[] = stored ? JSON.parse(stored) : [];
      list = list.filter(item => item.name.trim().toLowerCase() !== loc.name.trim().toLowerCase());
      list.unshift(loc);
      list = list.slice(0, 10);
      await AsyncStorage.setItem(RECENT_LOCATIONS_KEY, JSON.stringify(list));
      setRecentLocations(list);
    } catch (e) {}
  };

  const clearRecentLocations = async () => {
    try {
      await AsyncStorage.removeItem(RECENT_LOCATIONS_KEY);
      setRecentLocations([]);
    } catch (e) {}
  };

  const fetchPopularPlaces = async () => {
    try {
      const data = await fetchApi('/popular-places/');
      const apiResults = Array.isArray(data) ? data : data?.results || [];
      if (apiResults.length > 0) {
        const formatted: LocationData[] = apiResults.map((item: any) => ({
          name: item.name,
          city: item.city || '',
          address: item.address || '',
          latitude: Number(item.latitude),
          longitude: Number(item.longitude),
        }));
        setPopularPlaces(formatted);
      }
    } catch (e) {}
  };

  const initializeLocation = async () => {
    if (initialLocation) {
      setSelectedLocation(initialLocation);
      setCustomLocationName(initialLocation.name);
      return;
    }
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coords = { lat: loc.coords.latitude, lon: loc.coords.longitude };
      setUserLocation(coords);
      if (!selectedLocation) {
        sendToMap({ type: 'setView', ...coords, zoom: 14 });
        reverseGeocode(coords.lat, coords.lon);
      }
    } catch (e) {}
  };

  const goToMyLocation = async () => {
    setIsLoadingGPS(true);
    Animated.loop(
      Animated.timing(gpsRotateAnim, { toValue: 1, duration: 1000, useNativeDriver: true })
    ).start();

    try {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const coords = { lat: loc.coords.latitude, lon: loc.coords.longitude };
      sendToMap({ type: 'setView', ...coords, zoom: 16 });
      sendToMap({ type: 'setUserMarker', ...coords });
      reverseGeocode(coords.lat, coords.lon);
    } catch (e) {
      Alert.alert('Erreur GPS', 'Impossible de récupérer votre position actuelle.');
    } finally {
      gpsRotateAnim.setValue(0);
      setIsLoadingGPS(false);
    }
  };

  const reverseGeocode = async (lat: number, lon: number) => {
    const dLat = Math.abs(lastReverseRef.current.lat - lat);
    const dLon = Math.abs(lastReverseRef.current.lon - lon);
    if (dLat < 0.0001 && dLon < 0.0001) return;

    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setIsLoadingAddress(true);

    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`;
      const res = await fetch(url, { signal: abortRef.current.signal, headers: { 'User-Agent': 'ZemyMobile/1.0' } });
      const data = await res.json();
      if (data && data.display_name) {
        lastReverseRef.current = { lat, lon };
        const address = data.address;
        const name = address.road || address.suburb || address.neighbourhood || address.city || 'Lieu ciblé';
        const formatted: LocationData = {
          latitude: lat,
          longitude: lon,
          name,
          address: data.display_name,
          city: address.city || address.town || address.village || '',
          country: address.country || '',
        };
        setSelectedLocation(formatted);
        setCustomLocationName(name);
      }
    } catch (e) {
    } finally {
      setIsLoadingAddress(false);
    }
  };

  const searchPlaces = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    searchAbort.current?.abort();
    searchAbort.current = new AbortController();
    setIsSearching(true);
    const version = ++searchVersionRef.current;

    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=bj&limit=8`;
      const res = await fetch(url, { signal: searchAbort.current.signal });
      const data = await res.json();
      if (version === searchVersionRef.current) {
        setSearchResults(data);
      }
    } catch (e) {
    } finally {
      if (version === searchVersionRef.current) setIsSearching(false);
    }
  };

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => searchPlaces(text), 400);
  };

  const handleFocusSearch = () => {
    setIsSearchFocused(true);
    if (currentSnapRef.current === 'lowered') snapTo('expanded');
  };

  const handleSelectSuggestion = (loc: LocationData) => {
    setSelectedLocation(loc);
    setCustomLocationName(loc.name);
    sendToMap({ type: 'setView', lat: loc.latitude, lon: loc.longitude, zoom: 16 });
    setIsSearchFocused(false);
  };

  const handleSelectSearchResult = (item: any) => {
    const lat = Number(item.lat);
    const lon = Number(item.lon);
    const parts = (item.display_name || '').split(',');
    const name = item.name || parts[0] || 'Lieu sélectionné';
    const loc: LocationData = {
      latitude: lat,
      longitude: lon,
      name,
      address: item.display_name,
      city: item.address?.city || item.address?.town || '',
    };
    setSelectedLocation(loc);
    setCustomLocationName(name);
    sendToMap({ type: 'setView', lat, lon, zoom: 16 });
    setIsSearchFocused(false);
  };

  const handleConfirmLocation = () => {
    if (selectedLocation) {
      const confirmed = { ...selectedLocation, name: customLocationName || selectedLocation.name };
      saveRecentLocation(confirmed);
      onLocationSelected(confirmed);
    }
  };

  const selectShortcut = async (type: string) => {
    const key = `@zemy_shortcut_${type.toLowerCase()}`;
    try {
      const saved = await AsyncStorage.getItem(key);
      if (saved) {
        const loc = JSON.parse(saved);
        setSelectedLocation(loc);
        setCustomLocationName(loc.name);
        sendToMap({ type: 'setView', lat: loc.latitude, lon: loc.longitude, zoom: 16 });
      } else if (selectedLocation) {
        await AsyncStorage.setItem(key, JSON.stringify(selectedLocation));
        Alert.alert('Raccourci enregistré', `Votre position actuelle a été enregistrée pour "${type}".`);
      } else {
        Alert.alert('Sélectionnez un lieu', "Veuillez d'abord cibler un lieu sur la carte.");
      }
    } catch (e) {}
  };

  const onMapMessage = (e: any) => {
    try {
      const data = JSON.parse(e.nativeEvent.data);
      if (data.type === 'ready') {
        setMapReady(true);
        if (selectedLocation) {
          sendToMap({ type: 'setView', lat: selectedLocation.latitude, lon: selectedLocation.longitude, zoom: 16 });
        } else if (userLocation) {
          sendToMap({ type: 'setView', lat: userLocation.lat, lon: userLocation.lon, zoom: 14 });
        }
      } else if (data.type === 'centerChanged') {
        if (!isProgrammaticPanningRef.current) {
          reverseGeocode(data.lat, data.lon);
        }
        isProgrammaticPanningRef.current = false;
      }
    } catch (err) {}
  };

  const googleMapsHtml = useMemo(() => getGoogleMapsHtml(DEFAULT_LAT, DEFAULT_LON), []);
  const showSuggestions = isSearchFocused;
  const isQueryEmpty = searchQuery.trim().length === 0;
  const cardTopMargin = Math.max(insets.top + 10, Platform.OS === 'ios' ? 44 : 24);

  return (
    <View style={styles.overlayContainer}>
      {/* Map WebView */}
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
          androidLayerType="hardware"
        />

        {/* Loading Overlay */}
        {!mapReady && (
          <View style={styles.mapLoadingOverlay}>
            <ActivityIndicator size="large" color="#0066FF" />
          </View>
        )}

        {/* Center pin marker */}
        <View style={styles.centerPinContainer} pointerEvents="none">
          <View style={styles.markerPin} />
          <View style={styles.markerShadow} />
        </View>
      </View>

      {/* Floating GPS Button */}
      {!isSearchFocused && (
        <TouchableOpacity
          style={[styles.myLocationFloatingBtn, { bottom: snapState === 'lowered' ? insets.bottom + 200 : insets.bottom + 480 }]}
          onPress={goToMyLocation}
          activeOpacity={0.8}
        >
          <Animated.View style={isLoadingGPS ? { transform: [{ rotate: gpsRotation }] } : null}>
            <Ionicons name="navigate" size={22} color="#0066FF" />
          </Animated.View>
        </TouchableOpacity>
      )}

      {/* Floating Search overlay */}
      <FloatingSearchCard
        cardTopMargin={cardTopMargin}
        isSearchFocused={isSearchFocused}
        setIsSearchFocused={setIsSearchFocused}
        searchQuery={searchQuery}
        handleSearchChange={handleSearchChange}
        handleFocusSearch={handleFocusSearch}
        isSearching={isSearching}
        setShowFilters={setShowFilters}
        searchInputRef={searchInputRef}
        snapTo={snapTo}
      />

      {/* Floating Dropdown Suggestions */}
      <FloatingSuggestionsPanel
        showSuggestions={showSuggestions}
        isQueryEmpty={isQueryEmpty}
        recentLocations={recentLocations}
        popularPlaces={popularPlaces}
        searchResults={searchResults}
        isSearching={isSearching}
        panY={panY}
        cardTopMargin={cardTopMargin}
        clearRecentLocations={clearRecentLocations}
        handleSelectSuggestion={handleSelectSuggestion}
        handleSelectSearchResult={handleSelectSearchResult}
      />

      {/* Floating Footer confirmation card */}
      {!isSearchFocused && (
        <FloatingFooterCard
          panY={panY}
          panResponder={panResponder}
          isLoadingAddress={isLoadingAddress}
          selectedLocation={selectedLocation}
          isFavorite={isFavorite}
          setIsFavorite={setIsFavorite}
          customLocationName={customLocationName}
          setCustomLocationName={setCustomLocationName}
          handleConfirmLocation={handleConfirmLocation}
          selectShortcut={selectShortcut}
          nearbySuggestions={nearbySuggestions}
          setSelectedLocation={setSelectedLocation}
          sendToMap={sendToMap}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 99999,
    elevation: 99999,
    backgroundColor: '#FFFFFF',
  },
  mapFullContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: SCREEN_HEIGHT * 0.22,
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
  centerPinContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -12,
    marginTop: -24,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  markerPin: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#0066FF',
    borderWidth: 3.5,
    borderColor: '#FFFFFF',
    shadowColor: '#0066FF',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
    elevation: 6,
  },
  markerShadow: {
    width: 12,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    marginTop: 8,
    alignSelf: 'center',
  },
  myLocationFloatingBtn: {
    position: 'absolute',
    right: 16,
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
});
