import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
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
import { LocationData, LocationPickerProps, SearchLocationResult } from './types';
import { getGoogleMapsHtml } from './GoogleMapsHtml';
import FloatingSearchCard from './FloatingSearchCard';
import FloatingSuggestionsPanel from './FloatingSuggestionsPanel';
import FloatingFooterCard from './FloatingFooterCard';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const DEFAULT_LAT = 6.3703;
const DEFAULT_LON = 2.3912;
const RECENT_LOCATIONS_KEY = '@zemy_recent_locations';
const GOOGLE_MAPS_KEY = 'AIzaSyDeQDN8_mfUVNcb37Tg1FsiMaBoCuYOgrc';

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
  const [userLocationData, setUserLocationData] = useState<LocationData | null>(null);

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

  const isPlusCode = (text: string): boolean => {
    if (!text) return false;
    const trimmed = text.trim();
    return /^[A-Z0-9]{2,8}\+[A-Z0-9]{2,4}/i.test(trimmed) || /^[A-Z0-9]{4}\+[A-Z0-9]{2,4}/i.test(trimmed) || trimmed.includes('+');
  };

  const sanitizeAddress = (text: string): string => {
    if (!text) return '';
    const parts = text.split(',').map(p => p.trim()).filter(p => p.length > 0 && !isPlusCode(p));
    return parts.join(', ');
  };

  const getGeocodedLocation = async (lat: number, lon: number, signal?: AbortSignal): Promise<LocationData | null> => {
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lon}&key=${GOOGLE_MAPS_KEY}&language=fr`;
      const res = await fetch(url, { signal });
      const data = await res.json();
      if (data && data.results && data.results.length > 0) {
        let name = '';
        let city = '';
        let route = '';
        let streetNum = '';
        let neighborhood = '';

        for (const item of data.results) {
          const types = item.types || [];
          const candidate = item.name || item.formatted_address?.split(',')[0] || '';
          if (
            (types.includes('point_of_interest') || types.includes('establishment') || types.includes('premise')) &&
            candidate && !isPlusCode(candidate)
          ) {
            name = candidate;
            break;
          }
        }

        const primaryResult = data.results.find((r: any) => r.formatted_address && !isPlusCode(r.formatted_address.split(',')[0])) || data.results[0];
        for (const comp of primaryResult.address_components || []) {
          const types = comp.types || [];
          const compName = comp.long_name || '';
          if (isPlusCode(compName)) continue;

          if (types.includes('street_number')) streetNum = compName;
          if (types.includes('route')) route = compName;
          if (types.includes('neighborhood') || types.includes('sublocality') || types.includes('sublocality_level_1')) {
            neighborhood = compName;
          }
          if (types.includes('locality')) city = compName;
        }

        if (!name || isPlusCode(name)) {
          if (streetNum && route) {
            name = `${streetNum} ${route}`;
          } else if (route) {
            name = neighborhood ? `${route}, ${neighborhood}` : route;
          } else if (neighborhood) {
            name = neighborhood;
          } else if (city) {
            name = city;
          } else {
            const cleanAddr = sanitizeAddress(primaryResult.formatted_address);
            name = cleanAddr.split(',')[0] || city || 'Position sélectionnée';
          }
        }

        const fullAddress = sanitizeAddress(primaryResult.formatted_address) || `${name}, ${city || 'Bénin'}`;

        return {
          latitude: lat,
          longitude: lon,
          name: name.trim(),
          address: fullAddress,
          city: city || 'Bénin',
          country: 'Bénin',
        };
      }
    } catch (e) {}
    return null;
  };

  const initializeLocation = async () => {
    if (initialLocation) {
      setSelectedLocation(initialLocation);
      setCustomLocationName(initialLocation.name);
      setSearchQuery(initialLocation.name);
      return;
    }
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coords = { lat: loc.coords.latitude, lon: loc.coords.longitude };
      setUserLocation(coords);
      sendToMap({ type: 'setView', ...coords, zoom: 14 });

      // Precise geocoding for user position card
      const gpsLoc = await getGeocodedLocation(coords.lat, coords.lon);
      if (gpsLoc) {
        setUserLocationData(gpsLoc);
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
      setUserLocation(coords);
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

  const handleSelectCurrentLocation = async () => {
    if (userLocationData) {
      handleSelectSuggestion(userLocationData);
    } else {
      try {
        setIsLoadingGPS(true);
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission refusée', 'Veuillez autoriser la géolocalisation pour utiliser votre position.');
          return;
        }
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        const coords = { lat: loc.coords.latitude, lon: loc.coords.longitude };
        setUserLocation(coords);
        sendToMap({ type: 'setView', ...coords, zoom: 16 });
        sendToMap({ type: 'setUserMarker', ...coords });

        const gpsLoc = await getGeocodedLocation(coords.lat, coords.lon);
        if (gpsLoc) {
          setUserLocationData(gpsLoc);
          handleSelectSuggestion(gpsLoc);
        } else {
          const fallbackLoc: LocationData = {
            latitude: coords.lat,
            longitude: coords.lon,
            name: 'Ma position actuelle',
            address: 'Position GPS de l\'appareil',
            city: 'Bénin',
          };
          setUserLocationData(fallbackLoc);
          handleSelectSuggestion(fallbackLoc);
        }
      } catch (e) {
        Alert.alert('Erreur GPS', 'Impossible de récupérer votre position actuelle.');
      } finally {
        setIsLoadingGPS(false);
      }
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
      const formatted = await getGeocodedLocation(lat, lon, abortRef.current.signal);
      if (formatted) {
        lastReverseRef.current = { lat, lon };
        setSelectedLocation(formatted);
        setCustomLocationName('');
        // Also update userLocationData if this matches user location
        if (userLocation && Math.abs(userLocation.lat - lat) < 0.001 && Math.abs(userLocation.lon - lon) < 0.001) {
          setUserLocationData(formatted);
        }
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
      const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&components=country:bj&key=${GOOGLE_MAPS_KEY}&language=fr`;
      const res = await fetch(url, { signal: searchAbort.current.signal });
      const data = await res.json();
      if (version === searchVersionRef.current) {
        const predictions = data.predictions || [];
        const formatted = predictions.map((p: any) => ({
          place_id: p.place_id,
          name: p.structured_formatting?.main_text || p.description,
          display_name: p.description,
          address: {
            city: p.structured_formatting?.secondary_text || '',
          }
        }));
        setSearchResults(formatted);
      }
    } catch (e) {
    } finally {
      if (version === searchVersionRef.current) setIsSearching(false);
    }
  };

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    if (!isSearchFocused) {
      setIsSearchFocused(true);
    }
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => searchPlaces(text), 400);
  };

  const handleFocusSearch = () => {
    setIsSearchFocused(true);
    if (currentSnapRef.current === 'lowered') snapTo('expanded');
  };

  const handleSelectSuggestion = (loc: LocationData) => {
    setSelectedLocation(loc);
    setSearchQuery(loc.name);
    setCustomLocationName('');
    sendToMap({ type: 'setView', lat: loc.latitude, lon: loc.longitude, zoom: 16 });
    setIsSearchFocused(false);
  };

  const handleSelectSearchResult = async (item: any) => {
    let lat = Number(item.lat);
    let lon = Number(item.lon);
    
    if (item.place_id && (isNaN(lat) || isNaN(lon))) {
      try {
        const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${item.place_id}&key=${GOOGLE_MAPS_KEY}`;
        const res = await fetch(detailsUrl);
        const detailsData = await res.json();
        const geom = detailsData.result?.geometry?.location;
        if (geom) {
          lat = geom.lat;
          lon = geom.lng;
        }
      } catch (e) {
        Alert.alert("Erreur", "Impossible de récupérer les coordonnées de ce lieu.");
        return;
      }
    }

    if (isNaN(lat) || isNaN(lon)) return;

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
    setSearchQuery(name);
    setCustomLocationName('');
    sendToMap({ type: 'setView', lat, lon, zoom: 16 });
    setIsSearchFocused(false);
  };

  const handleConfirmLocation = () => {
    if (selectedLocation) {
      const confirmed = {
        ...selectedLocation,
        // Garde le nom original de la position
        // La note personnalisée est stockée séparément
        note: customLocationName.trim() || undefined,
      };
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
        setCustomLocationName('');
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
        if (!isProgrammaticPanningRef.current && !isSearchFocused) {
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
          <View style={styles.pinWrapper}>
            <View style={styles.pinBubble}>
              <Ionicons name="location" size={20} color="#FFFFFF" />
            </View>
            <View style={styles.pinPoint} />
          </View>
          <View style={styles.markerShadow} />
        </View>
      </View>

      {/* Floating GPS Button */}
      {!isSearchFocused && (
        <TouchableOpacity
          style={[styles.myLocationFloatingBtn, { bottom: snapState === 'lowered' ? insets.bottom + 200 : insets.bottom + 480 }]}
          onPress={goToMyLocation}
          activeOpacity={0.85}
        >
          <Animated.View style={[{ flexDirection: 'row', alignItems: 'center' }, isLoadingGPS ? { transform: [{ rotate: gpsRotation }] } : null]}>
            <Ionicons name="navigate-circle" size={22} color="#0066FF" style={{ marginRight: 6 }} />
            <Text style={styles.gpsBtnText}>Ma position</Text>
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
        userLocationData={userLocationData}
        onSelectCurrentLocation={handleSelectCurrentLocation}
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
          handleFocusSearch={handleFocusSearch}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  overlayContainer: {
    ...StyleSheet.absoluteFill,
    zIndex: 99999,
    elevation: 99999,
    backgroundColor: '#FFFFFF',
  },
  mapFullContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: SCREEN_HEIGHT * 0.42,
  },
  mapWebView: {
    ...StyleSheet.absoluteFill,
  },
  mapLoadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
  },
  centerPinContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -20,
    marginTop: -44,
    width: 40,
    height: 48,
    alignItems: 'center',
    justifyContent: 'flex-end',
    zIndex: 10,
  },
  pinWrapper: {
    alignItems: 'center',
  },
  pinBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0066FF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    shadowColor: '#0066FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 6,
    elevation: 8,
  },
  pinPoint: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#0066FF',
    marginTop: -2,
  },
  markerShadow: {
    width: 16,
    height: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    marginTop: 2,
  },
  myLocationFloatingBtn: {
    position: 'absolute',
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 90,
  },
  gpsBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1F2937',
  },
});
