/**
 * ==============================================================
 * Fichier :
 * LocationPicker.tsx
 *
 * Description :
 * Composant ou logique de l'application Zemy.
 *
 * Projet :
 * Zemy
 * ==============================================================
 */
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList,
  ActivityIndicator, StatusBar, Platform, Keyboard, Dimensions,
  Animated, Modal, KeyboardAvoidingView
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../styles/theme';
import * as Location from 'expo-location';
import { fetchApi } from '../services/api';
import Fuse from 'fuse.js';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

interface LocationData {
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

/**
 * Composant LocationPicker.
 *
 * Responsabilités :
 * - Affichage et gestion de l'état lié à LocationPicker.
 */
export default function LocationPicker({
  onLocationSelected,
  onCancel,
  initialLocation,
  title = 'Choisir un lieu',
}: LocationPickerProps) {
  const webviewRef = useRef<WebView>(null);
  const searchInputRef = useRef<TextInput>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(initialLocation || null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);

  const [mapReady, setMapReady] = useState(false);
  const [isLoadingAddress, setIsLoadingAddress] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [customLocationName, setCustomLocationName] = useState('');

  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const bottomSheetAnim = useRef(new Animated.Value(0)).current;

  // Abort controllers for network requests
  const abortRef = useRef<AbortController | null>(null);
  const searchAbort = useRef<AbortController | null>(null);

  // Prevent duplicate reverse geocoding
  const lastReverseRef = useRef({ lat: 0, lon: 0 });

  useEffect(() => {
    initializeLocation();
    animateBottomSheet();

    return () => {
      searchAbort.current?.abort();
      abortRef.current?.abort();
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      if (dragTimeoutRef.current) clearTimeout(dragTimeoutRef.current);
    };
  }, []);

  const animateBottomSheet = () => {
    Animated.spring(bottomSheetAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
  };

  const initializedRef = useRef(false);

  const initializeLocation = async () => {
    if (initializedRef.current) return;

    initializedRef.current = true;

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const location = { lat: loc.coords.latitude, lon: loc.coords.longitude };
      setUserLocation(location);

      if (!initialLocation) {
        setCustomLocationName('');
        setSelectedLocation({ latitude: location.lat, longitude: location.lon, name: 'Position actuelle' });
      }
    } catch (error) {
      console.error('Error getting location:', error);
    }
  };

  const sendToMap = useCallback((message: object) => {
    webviewRef.current?.injectJavaScript(
      `window.handleMessage && window.handleMessage(${JSON.stringify(message)}); true;`
    );
  }, []);

  // Handle map ready explicitly via useEffect instead of inside event directly
  useEffect(() => {
    if (!mapReady) return;

    if (initialLocation) {
      sendToMap({ type: 'setView', lat: initialLocation.latitude, lon: initialLocation.longitude, zoom: 15 });
    } else if (userLocation) {
      sendToMap({ type: 'setView', lat: userLocation.lat, lon: userLocation.lon, zoom: 14 });
      sendToMap({ type: 'setUserMarker', lat: userLocation.lat, lon: userLocation.lon });
      reverseGeocode(userLocation.lat, userLocation.lon);
    }
  }, [mapReady, initialLocation, userLocation, sendToMap]);

  const reverseGeocode = async (lat: number, lon: number) => {
    if (
      Math.abs(lastReverseRef.current.lat - lat) < 0.00001 &&
      Math.abs(lastReverseRef.current.lon - lon) < 0.00001
    ) {
      return; // Already reversed this location
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

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

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

        const city = address.city || address.town || address.village;
        const country = address.country;

        setCustomLocationName('');
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
        setCustomLocationName('');
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
      setShowResults(false);
      return;
    }

    setIsSearching(true);

    searchAbort.current?.abort();
    searchAbort.current = new AbortController();

    try {
      // ===========================
      // 1. Lieux populaires Zemy
      // ===========================
      let localResults: any[] = [];
      try {
        const localData = await fetchApi(
          `/popular-places/?search=${encodeURIComponent(query)}`
        );
        localResults = Array.isArray(localData)
          ? localData
          : localData?.results || [];
      } catch (err) {
        console.log('Popular places error', err);
      }

      // ===========================
      // 2. Photon
      // ===========================
      const photonResponse = await fetch(
        `https://photon.komoot.io/api/?q=${encodeURIComponent(
          `${query} Benin`
        )}&limit=15`,
        {
          signal: searchAbort.current.signal,
        }
      );

      if (!photonResponse.ok) {
        throw new Error(`HTTP ${photonResponse.status}`);
      }

      const photonData = await photonResponse.json();

      const photonResults =
        photonData?.features?.map((feature: any) => ({
          id: feature.properties.osm_id,
          lat: feature.geometry.coordinates[1],
          lon: feature.geometry.coordinates[0],
          name:
            feature.properties.name ||
            feature.properties.street ||
            'Lieu',
          city:
            feature.properties.city ||
            feature.properties.county ||
            '',
          country:
            feature.properties.country ||
            '',
          display_name: [
            feature.properties.name,
            feature.properties.city,
            feature.properties.country,
          ]
            .filter(Boolean)
            .join(', '),
          source: 'photon',
        })) || [];

      // ===========================
      // Priorité Bénin
      // ===========================
      photonResults.sort((a: any, b: any) => {
        const aBenin = a.country
          ?.toLowerCase()
          .includes('benin')
          ? 1
          : 0;
        const bBenin = b.country
          ?.toLowerCase()
          .includes('benin')
          ? 1
          : 0;
        return bBenin - aBenin;
      });

      // ===========================
      // Fusion & Fuzzy Search
      // ===========================
      const combinedResults = [
        ...localResults,
        ...photonResults,
      ];

      const fuse = new Fuse(combinedResults, {
        keys: ['name', 'display_name', 'city'],
        threshold: 0.3,
      });

      const fuzzyResults = fuse.search(query);
      const finalResults = fuzzyResults.map(r => r.item);

      setSearchResults(finalResults);
      setShowResults(finalResults.length > 0);

    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Search error:', error);
      }
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearch = useCallback((text: string) => {
    setSearchQuery(text);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      searchPlaces(text);
    }, 400);
  }, []);

  const handleSelectResult = useCallback((item: any) => {
    setSearchQuery('');
    setShowResults(false);
    Keyboard.dismiss();

    if (item.latitude !== undefined && item.longitude !== undefined) {
      setCustomLocationName('');
      setSelectedLocation({
        latitude: Number(item.latitude),
        longitude: Number(item.longitude),
        name: item.name,
        address: item.city ? `${item.city}, Bénin` : 'Bénin',
        city: item.city || '',
        country: 'Bénin'
      });
      sendToMap({ type: 'setView', lat: item.latitude, lon: item.longitude, zoom: 16 });
      return;
    }

    const lat = Number(item.lat);
    const lon = Number(item.lon);

    const displayName = item.display_name || '';
    const parts = displayName.split(',');
    const name = parts[0] || 'Position choisie';
    const address = parts.slice(1, 3).join(',').trim();
    const city = parts[2]?.trim();
    const country = parts[parts.length - 1]?.trim();

    setCustomLocationName('');
    setSelectedLocation({
      latitude: lat,
      longitude: lon,
      name: name,
      address: address,
      city: city,
      country: country,
    });

    sendToMap({ type: 'setView', lat, lon, zoom: 16 });
  }, [sendToMap]);

  const goToMyLocation = useCallback(() => {
    if (userLocation) {
      sendToMap({ type: 'setView', lat: userLocation.lat, lon: userLocation.lon, zoom: 15 });
      sendToMap({ type: 'setUserMarker', lat: userLocation.lat, lon: userLocation.lon });
      reverseGeocode(userLocation.lat, userLocation.lon);
    }
  }, [userLocation, sendToMap]);

  const handleConfirmPress = () => {
    setCustomLocationName('');
    setShowConfirmModal(true);
  };

  const confirmLocation = useCallback(() => {
    setShowConfirmModal(false);

    if (selectedLocation) {
      onLocationSelected({
        ...selectedLocation,
        name: customLocationName.trim() || selectedLocation.name,
      });
    } else {
      onLocationSelected({
        latitude: DEFAULT_LAT,
        longitude: DEFAULT_LON,
        name: customLocationName.trim() || 'Position choisie',
      });
    }
  }, [selectedLocation, customLocationName, onLocationSelected]);

  const zoomIn = useCallback(() => {
    sendToMap({ type: 'zoomIn' });
  }, [sendToMap]);

  const zoomOut = useCallback(() => {
    sendToMap({ type: 'zoomOut' });
  }, [sendToMap]);

  const onMapMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      if (data.type === 'centerChanged') {
        const currentLat = selectedLocation?.latitude ?? DEFAULT_LAT;
        const currentLon = selectedLocation?.longitude ?? DEFAULT_LON;

        const latDiff = Math.abs(data.lat - currentLat);
        const lonDiff = Math.abs(data.lon - currentLon);

        if (latDiff < 0.00001 && lonDiff < 0.00001 && !isDragging) {
          return;
        }

        // Optimistically update location coordinates while dragging
        setSelectedLocation(prev => ({
          latitude: data.lat,
          longitude: data.lon,
          name: prev?.name ?? 'Recherche en cours...',
          address: prev?.address,
          city: prev?.city,
          country: prev?.country,
        }));

        setIsDragging(true);

        if (dragTimeoutRef.current) {
          clearTimeout(dragTimeoutRef.current);
        }

        dragTimeoutRef.current = setTimeout(() => {
          reverseGeocode(data.lat, data.lon);
          setIsDragging(false);
        }, 800);

      } else if (data.type === 'ready') {
        setMapReady(true);
      }
    } catch (error) {
      console.error('Map message error:', error);
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
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body, html, #map { width: 100%; height: 100%; background: #f0f0f0; }
    
    .center-marker {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 1000;
      pointer-events: none;
      transition: transform 0.2s ease;
    }
    
    .center-marker.dragging {
      transform: translate(-50%, -50%) scale(0.8);
    }
    
    .marker-pin {
      width: 32px;
      height: 32px;
      border-radius: 50% 50% 50% 0;
      background: #FF4444;
      position: absolute;
      transform: rotate(-45deg);
      left: 50%;
      top: 50%;
      margin: -16px 0 0 -16px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.3);
      border: 3px solid white;
      transition: all 0.2s ease;
    }
    
    .center-marker.dragging .marker-pin {
      transform: rotate(-45deg) scale(0.8);
      opacity: 0.7;
    }
    
    .marker-pin::after {
      content: '';
      width: 10px;
      height: 10px;
      margin: 7px 0 0 8px;
      background: white;
      position: absolute;
      border-radius: 50%;
    }
    
    .pulse {
      width: 60px;
      height: 60px;
      background: rgba(255,68,68,0.3);
      border-radius: 50%;
      position: absolute;
      left: 50%;
      top: 50%;
      margin: -30px 0 0 -30px;
      animation: pulse 1.5s infinite;
    }
    
    @keyframes pulse {
      0% { transform: scale(0.5); opacity: 1; }
      100% { transform: scale(1.5); opacity: 0; }
    }
    
    .user-marker {
      width: 16px;
      height: 16px;
      background: #4285F4;
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    }
    
    .leaflet-control-attribution { display: none !important; }
    .leaflet-control-zoom { display: none !important; }
  </style>
</head>
<body>
  <div id="map"></div>
  <div class="center-marker" id="centerMarker">
    <div class="marker-pin"></div>
    <div class="pulse"></div>
  </div>
  
  <script>
    var map = L.map('map', { 
      zoomControl: false
    }).setView([${DEFAULT_LAT}, ${DEFAULT_LON}], 12);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors',
      detectRetina: true,
      crossOrigin: true
    }).addTo(map);
    
    var userMarker = null;
    var isMoving = false;
    var markerElement = document.getElementById('centerMarker');
    
    map.on('movestart', function() {
      isMoving = true;
      if (markerElement) {
        markerElement.classList.add('dragging');
      }
    });
    
    map.on('moveend', function() {
      setTimeout(function() {
        isMoving = false;
        if (markerElement) {
          markerElement.classList.remove('dragging');
        }
        var center = map.getCenter();
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'centerChanged',
          lat: center.lat,
          lon: center.lng
        }));
      }, 100);
    });
    
    map.whenReady(function() {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
    });
    
    window.handleMessage = function(msg) {
      if (msg.type === 'setView') {
        map.flyTo([msg.lat, msg.lon], msg.zoom || 15, { animate: true, duration: 0.6 });
      } else if (msg.type === 'setUserMarker') {
        var userIcon = L.divIcon({
          className: '',
          html: '<div class="user-marker"></div>',
          iconSize: [16, 16],
          iconAnchor: [8, 8]
        });
        
        if (userMarker) {
          userMarker.setLatLng([msg.lat, msg.lon]);
        } else {
          userMarker = L.marker([msg.lat, msg.lon], { icon: userIcon, zIndexOffset: 200 }).addTo(map);
        }
      } else if (msg.type === 'zoomIn') {
        map.zoomIn();
      } else if (msg.type === 'zoomOut') {
        map.zoomOut();
      }
    };
  </script>
</body>
</html>`, []);

  const htmlRef = useRef(leafletHtml);

  const bottomSheetTransform = {
    transform: [{
      translateY: bottomSheetAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [300, 0],
      }),
    }],
  };



  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.transparent} translucent />

      <WebView
        ref={webviewRef}
        originWhitelist={['*']}
        source={{ html: htmlRef.current }}
        onMessage={onMapMessage}
        javaScriptEnabled
        domStorageEnabled
        cacheEnabled
        style={styles.map}
        scrollEnabled={false}
        androidLayerType="hardware"
        mixedContentMode="compatibility"
        allowsInlineMediaPlayback
      />

      {!mapReady && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Chargement de la carte...</Text>
        </View>
      )}

      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onCancel}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>

        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={theme.colors.textMuted} style={styles.searchIcon} />
          <TextInput
            ref={searchInputRef}
            style={styles.searchInput}
            placeholder="Rechercher un lieu..."
            placeholderTextColor={theme.colors.textMuted}
            value={searchQuery}
            onChangeText={handleSearch}
            returnKeyType="search"
            autoCapitalize="none"
          />
          {isSearching && (
            <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginRight: 8 }} />
          )}
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => {
              setSearchQuery('');
              setSearchResults([]);
              setShowResults(false);
            }}>
              <Ionicons name="close-circle" size={20} color={theme.colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.zoomControls}>
        <TouchableOpacity style={styles.zoomButton} onPress={zoomIn}>
          <Ionicons name="add" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <View style={styles.zoomDivider} />
        <TouchableOpacity style={styles.zoomButton} onPress={zoomOut}>
          <Ionicons name="remove" size={24} color={theme.colors.text} />
        </TouchableOpacity>
      </View>

      {showResults && (
        <View style={styles.resultsContainer}>
          <FlatList
            data={searchResults}
            initialNumToRender={8}
            removeClippedSubviews={true}
            keyboardShouldPersistTaps="handled"
            keyExtractor={(item) => item.id || item.place_id?.toString() || (item.latitude !== undefined ? `${item.latitude}-${item.longitude}` : `${item.lat}-${item.lon}`)}
            renderItem={({ item, index }) => {
              let title = '';
              let subtitle = '';

              if (item.latitude !== undefined) {
                // Local popular place match
                title = item.name;
                subtitle = item.city ? `${item.city}, Bénin` : 'Bénin';
              } else {
                // Nominatim match
                const displayName = item.display_name || '';
                const parts = displayName.split(',');
                title = parts[0] || 'Lieu sans nom';
                subtitle = parts.slice(1, 4).join(',').trim();
              }

              return (
                <TouchableOpacity
                  style={[
                    styles.resultItem,
                    index === searchResults.length - 1 && styles.resultItemLast
                  ]}
                  onPress={() => handleSelectResult(item)}
                >
                  <View style={styles.resultIconContainer}>
                    <Ionicons name="location-outline" size={20} color={theme.colors.primary} />
                  </View>
                  <View style={styles.resultContent}>
                    <Text style={styles.resultTitle} numberOfLines={1}>
                      {title}
                    </Text>
                    <Text style={styles.resultSubtitle} numberOfLines={1}>
                      {subtitle}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={theme.colors.border} />
                </TouchableOpacity>
              );
            }}
          />
        </View>
      )}

      <TouchableOpacity style={styles.myLocationButton} onPress={goToMyLocation}>
        <Ionicons name="locate" size={22} color={theme.colors.text} />
      </TouchableOpacity>

      <Animated.View style={[styles.bottomSheet, bottomSheetTransform]}>
        <View style={styles.bottomSheetHandle} />

        <View style={styles.locationInfo}>
          <View style={styles.locationIconContainer}>
            <Ionicons name="location" size={24} color={theme.colors.primary} />
          </View>

          <View style={styles.locationDetails}>
            {isLoadingAddress ? (
              <>
                <View style={styles.skeletonText} />
                <View style={[styles.skeletonText, styles.skeletonTextSmall]} />
              </>
            ) : (
              <>
                <Text style={styles.locationName} numberOfLines={2}>
                  {selectedLocation?.name || 'Déplacez la carte pour choisir un lieu'}
                </Text>
                {selectedLocation?.address && (
                  <Text style={styles.locationAddress} numberOfLines={1}>
                    {selectedLocation.address}
                  </Text>
                )}
                {selectedLocation?.city && (
                  <Text style={styles.locationCity} numberOfLines={1}>
                    {selectedLocation.city}
                  </Text>
                )}
              </>
            )}
          </View>
        </View>

        <TouchableOpacity
          style={[styles.confirmButton, isLoadingAddress && styles.confirmButtonDisabled]}
          onPress={handleConfirmPress}
          disabled={isLoadingAddress}
        >
          <Text style={styles.confirmButtonText}>Confirmer l'emplacement</Text>
          <Ionicons name="arrow-forward" size={20} color={theme.colors.white} style={styles.confirmButtonIcon} />
        </TouchableOpacity>
      </Animated.View>

      <Modal
        visible={showConfirmModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowConfirmModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalIcon}>
              <Ionicons name="location" size={48} color={theme.colors.primary} />
            </View>

            <Text style={styles.modalTitle}>Confirmer l'emplacement</Text>

            <View style={styles.modalLocationInfo}>
              <Ionicons name="navigate-circle" size={20} color={theme.colors.primary} />
              <Text style={styles.modalLocationName} numberOfLines={2}>
                {selectedLocation?.name || 'Chargement...'}
              </Text>
            </View>

            <View style={[styles.modalLocationInfo, { marginTop: -4, backgroundColor: theme.colors.white, borderWidth: 1, borderColor: theme.colors.border }]}>
              <Ionicons name="pencil" size={16} color={theme.colors.textMuted} />
              <TextInput
                style={[styles.modalLocationName, { padding: 0, margin: 0, height: 40 }]}
                value={customLocationName}
                onChangeText={setCustomLocationName}
                placeholder="Description suplemantaire"
                placeholderTextColor={theme.colors.textMuted}
                returnKeyType="done"
              />
            </View>

            {selectedLocation?.address && (
              <Text style={styles.modalLocationAddress} numberOfLines={2}>
                {selectedLocation.address}
              </Text>
            )}

            {selectedLocation?.city && (
              <Text style={styles.modalLocationCity}>
                {[selectedLocation.city, selectedLocation.country].filter(Boolean).join(', ')}
              </Text>
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setShowConfirmModal(false)}
              >
                <Text style={styles.modalButtonCancelText}>Annuler</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={confirmLocation}
              >
                <Text style={styles.modalButtonConfirmText}>Confirmer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.white },
  map: { flex: 1 },
  loadingContainer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: theme.colors.white, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 14, color: theme.colors.textMuted },
  header: { position: 'absolute', top: Platform.OS === 'ios' ? 50 : 40, left: 16, right: 16, flexDirection: 'row', alignItems: 'center', gap: 12, zIndex: 10 },
  backButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.white, justifyContent: 'center', alignItems: 'center', shadowColor: theme.colors.black, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4 },
  searchContainer: { flex: 1, height: 44, flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.white, borderRadius: 12, paddingHorizontal: 12, shadowColor: theme.colors.black, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 16, color: theme.colors.text },
  zoomControls: { position: 'absolute', right: 16, bottom: SCREEN_HEIGHT * 0.35, backgroundColor: theme.colors.white, borderRadius: 12, overflow: 'hidden', shadowColor: theme.colors.black, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 4, zIndex: 10 },
  zoomButton: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.white },
  zoomDivider: { height: 1, backgroundColor: theme.colors.background },
  resultsContainer: { position: 'absolute', top: Platform.OS === 'ios' ? 110 : 100, left: 16, right: 16, backgroundColor: theme.colors.white, borderRadius: 12, maxHeight: SCREEN_HEIGHT * 0.5, shadowColor: theme.colors.black, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 8, zIndex: 10 },
  resultItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.background },
  resultItemLast: { borderBottomWidth: 0 },
  resultIconContainer: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.colors.primaryLight, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  resultContent: { flex: 1 },
  resultTitle: { fontSize: 15, fontWeight: '600', color: theme.colors.text, marginBottom: 2 },
  resultSubtitle: { fontSize: 13, color: theme.colors.textMuted },
  myLocationButton: { position: 'absolute', right: 16, bottom: SCREEN_HEIGHT * 0.45, width: 48, height: 48, borderRadius: 24, backgroundColor: theme.colors.white, justifyContent: 'center', alignItems: 'center', shadowColor: theme.colors.black, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 4, zIndex: 10 },
  bottomSheet: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: theme.colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 12, paddingBottom: Platform.OS === 'ios' ? 34 : 20, paddingHorizontal: 20, shadowColor: theme.colors.black, shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 8 },
  bottomSheetHandle: { width: 40, height: 4, backgroundColor: theme.colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  locationInfo: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 12 },
  locationIconContainer: { width: 48, height: 48, borderRadius: 24, backgroundColor: theme.colors.primaryLight, justifyContent: 'center', alignItems: 'center' },
  locationDetails: { flex: 1 },
  locationName: { fontSize: 16, fontWeight: '600', color: theme.colors.text, marginBottom: 2 },
  locationAddress: { fontSize: 13, color: theme.colors.textLight, marginBottom: 2 },
  locationCity: { fontSize: 12, color: theme.colors.textMuted },
  skeletonText: { height: 20, backgroundColor: theme.colors.background, borderRadius: 4, marginBottom: 8, width: '80%' },
  skeletonTextSmall: { height: 16, width: '60%', marginBottom: 0 },
  confirmButton: { backgroundColor: theme.colors.primary, borderRadius: 12, height: 52, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', shadowColor: theme.colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  confirmButtonDisabled: { opacity: 0.7 },
  confirmButtonText: { fontSize: 16, fontWeight: '700', color: theme.colors.white, marginRight: 8 },
  confirmButtonIcon: { marginLeft: 4 },
  modalOverlay: { flex: 1, backgroundColor: theme.colors.overlay, justifyContent: 'center', alignItems: 'center' },
  modalContainer: { backgroundColor: theme.colors.white, borderRadius: 24, padding: 24, width: SCREEN_WIDTH - 48, alignItems: 'center', shadowColor: theme.colors.black, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.25, shadowRadius: 20, elevation: 10 },
  modalIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: theme.colors.primaryLight, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: theme.colors.text, marginBottom: 20 },
  modalLocationInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, backgroundColor: theme.colors.background, padding: 12, borderRadius: 12, width: '100%' },
  modalLocationName: { flex: 1, fontSize: 15, fontWeight: '600', color: theme.colors.text },
  modalLocationAddress: { fontSize: 13, color: theme.colors.textLight, marginBottom: 8, textAlign: 'center' },
  modalLocationCity: { fontSize: 12, color: theme.colors.textMuted, marginBottom: 20 },
  modalButtons: { flexDirection: 'row', gap: 12, width: '100%' },
  modalButton: { flex: 1, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  modalButtonCancel: { backgroundColor: '#f5f5f5' },
  modalButtonCancelText: { fontSize: 15, fontWeight: '600', color: theme.colors.textLight },
  modalButtonConfirm: { backgroundColor: theme.colors.primary },
  modalButtonConfirmText: { fontSize: 15, fontWeight: '600', color: theme.colors.white },
});