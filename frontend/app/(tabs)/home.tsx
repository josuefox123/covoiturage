/**
 * ==============================================================
 * Fichier :
 * home.tsx
 *
 * Description :
 * Composant ou logique de l'application Zemy.
 *
 * Projet :
 * Zemy
 * ==============================================================
 */
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  Animated,
  RefreshControl,
  Dimensions,
  TextInput,
  ScrollView,
  Modal,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { useAuth } from '../../src/context/AuthContext';
import LocationPicker from '../../src/components/LocationPicker';
import { AppBottomSheet } from '../../src/components/AppBottomSheet';
import VerificationModal from '../../src/components/VerificationModal';
import { Ride } from '../../src/types';
import RideSearchCard from '../../src/components/common/RideSearchCard';

// ─── Weather helpers ───────────────────────────────────────────────────────────
interface WeatherDay {
  date: string;        // "Lun", "Mar", …
  tempMax: number;
  tempMin: number;
  code: number;        // WMO weather code
  rain: number;        // mm
}

interface WeatherData {
  city: string;
  temp: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  code: number;
  forecast: WeatherDay[];
}

const WMO_ICONS: Record<number, { icon: string; label: string; gradient: string[] }> = {
  0:  { icon: '☀️',  label: 'Ciel dégagé',    gradient: ['#FEF3C7', '#FDE68A'] },
  1:  { icon: '🌤',  label: 'Peu nuageux',    gradient: ['#FEF3C7', '#FDE68A'] },
  2:  { icon: '⛅',  label: 'Partiellement nuageux', gradient: ['#E0F2FE', '#BAE6FD'] },
  3:  { icon: '☁️',  label: 'Couvert',         gradient: ['#E5E7EB', '#D1D5DB'] },
  45: { icon: '🌫',  label: 'Brouillard',      gradient: ['#E5E7EB', '#D1D5DB'] },
  51: { icon: '🌦',  label: 'Bruine légère',   gradient: ['#DBEAFE', '#BFDBFE'] },
  61: { icon: '🌧',  label: 'Pluie légère',    gradient: ['#DBEAFE', '#93C5FD'] },
  63: { icon: '🌧',  label: 'Pluie modérée',   gradient: ['#BFDBFE', '#60A5FA'] },
  65: { icon: '🌧',  label: 'Forte pluie',     gradient: ['#93C5FD', '#3B82F6'] },
  80: { icon: '🌦',  label: 'Averses',         gradient: ['#DBEAFE', '#93C5FD'] },
  95: { icon: '⛈',  label: 'Orage',           gradient: ['#818CF8', '#4338CA'] },
  99: { icon: '⛈',  label: 'Orage violent',   gradient: ['#6D28D9', '#4338CA'] },
};

const getWmo = (code: number) =>
  WMO_ICONS[code] ??
  WMO_ICONS[Object.keys(WMO_ICONS)
    .map(Number)
    .filter(k => k <= code)
    .sort((a, b) => b - a)[0]] ??
  { icon: '🌡', label: 'Inconnu', gradient: ['#E5E7EB', '#D1D5DB'] };

const DAY_NAMES = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
// ──────────────────────────────────────────────────────────────────────────────

const { width, height } = Dimensions.get('window');
const PRIMARY_COLOR = '#2563EB';
const HEADER_MAX_HEIGHT = 280;
const HEADER_MIN_HEIGHT = 150;

const formatFullDate = (dateString: string | undefined) => {
  if (!dateString) return 'Date inconnue';
  try {
    const d = new Date(dateString);
    let formatted = new Intl.DateTimeFormat('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(d);
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  } catch (e) {
    return dateString;
  }
};

// Menu principal retiré comme demandé

/**
 * Composant HomeScreen.
 *
 * Responsabilités :
 * - Affichage et gestion de l'état lié à HomeScreen.
 */
export default function HomeScreen() {
  const router = useRouter();
  const { user, authFetch, refreshUser } = useAuth();

  const [departure, setDeparture] = useState('');
  const [destination, setDestination] = useState('');
  const [pickingLocationFor, setPickingLocationFor] = useState<'departure' | 'arrival' | null>(null);
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('recommended');
  const [searchFocused, setSearchFocused] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [searchType, setSearchType] = useState<'passenger' | 'parcel'>('passenger');

  const [promotions, setPromotions] = useState<any[]>([]);
  const [showPromotions, setShowPromotions] = useState(true);

  // ── Vérification utilisateur ───────────────────────────────────────────────
  // Le modal s'affiche uniquement si verification_status === 'not_verified'.
  // Dès que l'utilisateur soumet sa demande, le statut passe à 'pending'
  // et le modal disparaît définitivement (plus besoin de snooze).
  const shouldShowVerificationModal =
    !!user &&
    !user.is_verified &&
    (user.verification_status === 'not_verified' || user.verification_status === undefined);

  const [showVerifModal, setShowVerifModal] = useState(false);

  useEffect(() => {
    setShowVerifModal(shouldShowVerificationModal);
  }, [shouldShowVerificationModal]);

  const handleVerifDismiss = () => {
    setShowVerifModal(false);
    // On re-affiche seulement si le statut n'a pas changé (toujours not_verified)
    setTimeout(() => {
      setShowVerifModal(shouldShowVerificationModal);
    }, 30000);
  };

  const handleVerifGo = () => {
    setShowVerifModal(false);
    router.push('/verify-identity');
  };
  // ──────────────────────────────────────────────────────────────────────────

  const carouselRef = useRef<FlatList>(null);
  const [currentPromoIndex, setCurrentPromoIndex] = useState(0);

  // ── Weather state ─────────────────────────────────────────────────────────────
  const WEATHER_CACHE_KEY = '@zemy_weather_cache';
  const [weather, setWeather] = useState<WeatherData | null>(null);
  // Start as false: cache may fill it instantly, no skeleton needed
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherStale, setWeatherStale] = useState(false); // small badge when refreshing
  const weatherPulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    initWeather();
  }, []);

  /** STEP 1 – show cache instantly, then refresh in background */
  const initWeather = async () => {
    try {
      const cached = await AsyncStorage.getItem(WEATHER_CACHE_KEY);
      if (cached) {
        setWeather(JSON.parse(cached));   // ← instant render from cache
        setWeatherStale(true);            // indicate background refresh
        refreshWeatherBackground();       // fire-and-forget
      } else {
        setWeatherLoading(true);          // first launch: show spinner
        await refreshWeatherBackground();
        setWeatherLoading(false);
      }
    } catch (_) {
      setWeatherLoading(true);
      await refreshWeatherBackground();
      setWeatherLoading(false);
    }
  };

  /** Actual network fetch — GPS + API in parallel, 5 s timeout */
  const refreshWeatherBackground = async () => {
    try {
      // ── GPS: use last-known position (instant) first, request fresh in bg
      let lat = 6.3703; // Cotonou fallback
      let lon = 2.3764;
      let city = 'Cotonou';

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        // getLastKnownPositionAsync is near-instant (no GPS warm-up)
        const last = await Location.getLastKnownPositionAsync();
        if (last) {
          lat = last.coords.latitude;
          lon = last.coords.longitude;
        } else {
          // Only block if we truly have no cached GPS fix
          const fresh = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Low,   // faster than Balanced
          });
          lat = fresh.coords.latitude;
          lon = fresh.coords.longitude;
        }
        // Reverse geocode (non-blocking, best-effort)
        Location.reverseGeocodeAsync({ latitude: lat, longitude: lon })
          .then(geo => {
            const name = geo[0]?.city || geo[0]?.district || geo[0]?.subregion;
            if (name) setWeather(prev => prev ? { ...prev, city: name } : prev);
          })
          .catch(() => {});
      }

      // ── Fetch with 5 s abort timeout
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);

      const url =
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
        `&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code` +
        `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum` +
        `&timezone=auto&forecast_days=5&timeformat=unixtime`;

      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      const json = await res.json();

      const cur = json.current;
      const daily = json.daily;

      const forecast: WeatherDay[] = daily.time.slice(1, 5).map((_: number, i: number) => ({
        date: DAY_NAMES[new Date(daily.time[i + 1] * 1000).getDay()],
        tempMax: Math.round(daily.temperature_2m_max[i + 1]),
        tempMin: Math.round(daily.temperature_2m_min[i + 1]),
        code: daily.weather_code[i + 1],
        rain: Math.round((daily.precipitation_sum[i + 1] ?? 0) * 10) / 10,
      }));

      const newWeather: WeatherData = {
        city,
        temp: Math.round(cur.temperature_2m),
        feelsLike: Math.round(cur.apparent_temperature),
        humidity: cur.relative_humidity_2m,
        windSpeed: Math.round(cur.wind_speed_10m),
        code: cur.weather_code,
        forecast,
      };

      setWeather(newWeather);
      setWeatherStale(false);

      // Persist to cache
      await AsyncStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(newWeather));

      // Subtle pulse to signal fresh data
      Animated.sequence([
        Animated.timing(weatherPulse, { toValue: 1.02, duration: 150, useNativeDriver: true }),
        Animated.spring(weatherPulse, { toValue: 1, friction: 5, useNativeDriver: true }),
      ]).start();
    } catch (e: any) {
      if (e?.name !== 'AbortError') console.log('Weather refresh error:', e);
      setWeatherStale(false); // stop spinner badge on error
    }
  };

  const fetchWeather = () => {
    setWeatherStale(true);
    refreshWeatherBackground();
  };
  // ─────────────────────────────────────────────────────────────────────────────

  // Les chargements initiaux ont été déplacés dans useFocusEffect pour éviter les appels redondants

  const fetchPromotionsAndSettings = async () => {
    try {
      const [promoRes, settingsRes] = await Promise.all([
        authFetch('/promotions/').catch(() => []),
        authFetch('/mobile-settings/').catch(() => null)
      ]);
      const promoList = Array.isArray(promoRes) ? promoRes : promoRes?.results || [];
      setPromotions(promoList);
      
      if (settingsRes && settingsRes.show_promotions !== undefined) {
        setShowPromotions(settingsRes.show_promotions);
      }
    } catch (e) {
    }
  };

  useEffect(() => {
    if (promotions.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentPromoIndex((prev) => {
        const nextIndex = (prev + 1) % promotions.length;
        if (carouselRef.current) {
          carouselRef.current.scrollToIndex({ index: nextIndex, animated: true });
        }
        return nextIndex;
      });
    }, 5000);
    return () => clearInterval(timer);
  }, [promotions.length]);

  const scrollY = useRef(new Animated.Value(0)).current;
  const headerHeight = scrollY.interpolate({
    inputRange: [0, HEADER_MAX_HEIGHT - HEADER_MIN_HEIGHT],
    outputRange: [HEADER_MAX_HEIGHT, HEADER_MIN_HEIGHT],
    extrapolate: 'clamp',
  });
  const headerOpacity = scrollY.interpolate({
    inputRange: [0, HEADER_MAX_HEIGHT - HEADER_MIN_HEIGHT],
    outputRange: [1, 0.95],
    extrapolate: 'clamp',
  });
  const titleScale = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [1, 0.8],
    extrapolate: 'clamp',
  });

  // ── Mini widget météo : disparaît au scroll et laisse place à l'icône ──
  const WEATHER_WIDGET_SCROLL = 60;
  const weatherWidgetOpacity = scrollY.interpolate({
    inputRange: [0, WEATHER_WIDGET_SCROLL],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });
  const weatherWidgetTranslate = scrollY.interpolate({
    inputRange: [0, WEATHER_WIDGET_SCROLL],
    outputRange: [0, -20],
    extrapolate: 'clamp',
  });
  const weatherIconOpacity = scrollY.interpolate({
    inputRange: [WEATHER_WIDGET_SCROLL * 0.6, WEATHER_WIDGET_SCROLL],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  // Charge et rafraîchit toutes les données lorsque l'écran d'accueil gagne le focus
  useFocusEffect(
    useCallback(() => {
      fetchRides();
      fetchPromotionsAndSettings();
      refreshUser();

      authFetch('/branding/')
        .then(data => {
          if (data && data.logo) {
            setLogoUrl(data.logo);
          }
        })
        .catch(err => console.log("Erreur branding:", err));
    }, [])
  );

  const fetchRides = async () => {
    try {
      setLoading(true);
      const data = await authFetch(`/rides/?type=${searchType}`);
      setRides(Array.isArray(data) ? data : data?.results || []);
    } catch (error) {
      console.error('Erreur:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRides();
  }, [searchType]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      fetchRides(),
      fetchPromotionsAndSettings()
    ]);
    setRefreshing(false);
  };

  const handleRidePress = useCallback((ride: Ride) => {
    router.push(`/ride/${ride.id}`);
  }, [router]);

  const filteredRides = useMemo(() => {
    const now = new Date();

    let filtered = rides.filter(r => {
      // Masquer les trajets sans places disponibles
      if ((r.seats_available ?? 1) <= 0) return false;

      // Masquer les trajets dont la date/heure de départ est déjà passée
      if (r.departure_date && r.departure_time) {
        const [h, m] = (r.departure_time as string).split(':').map(Number);
        const dep = new Date(r.departure_date);
        dep.setHours(h, m, 0, 0);
        if (dep < now) return false;
      } else if (r.departure_date) {
        // Pas d'heure connue : on masque si la date est strictement dans le passé
        const dep = new Date(r.departure_date);
        dep.setHours(23, 59, 59, 999);
        if (dep < now) return false;
      }

      return true;
    });

    if (departure) {
      filtered = filtered.filter(r =>
        r.departure_location?.toLowerCase().includes(departure.toLowerCase())
      );
    }
    if (destination) {
      filtered = filtered.filter(r =>
        r.arrival_location?.toLowerCase().includes(destination.toLowerCase())
      );
    }

    if (selectedFilter === 'price_asc') {
      filtered.sort((a, b) => (a.price_per_seat || 0) - (b.price_per_seat || 0));
    } else if (selectedFilter === 'price_desc') {
      filtered.sort((a, b) => (b.price_per_seat || 0) - (a.price_per_seat || 0));
    } else if (selectedFilter === 'earliest') {
      filtered.sort((a, b) => {
        const dateA = a.departure_date ? new Date(a.departure_date).getTime() : 0;
        const dateB = b.departure_date ? new Date(b.departure_date).getTime() : 0;
        return dateA - dateB;
      });
    }

    return filtered;
  }, [rides, departure, destination, selectedFilter]);

  const renderRideItem = useCallback(({ item, index }: { item: Ride; index: number }) => (
    <RideSearchCard ride={item} onPress={() => handleRidePress(item)} index={index} />
  ), [handleRidePress]);

  const filters = [
    { id: 'recommended', label: 'Recommandés', icon: 'thumbs-up-outline' },
    { id: 'price_asc', label: 'Prix croissant', icon: 'trending-up-outline' },
    { id: 'price_desc', label: 'Prix décroissant', icon: 'trending-down-outline' },
    { id: 'earliest', label: 'Les plus proches', icon: 'time-outline' },
  ];

  const userName = user?.full_name?.split(' ')[0] || 'Voyageur';

  return (
    <View style={styles.container}>
      {/* Header animé */}
      <Animated.View style={[styles.header, { height: headerHeight, opacity: headerOpacity }]}>
        <Image
          source={require('../../assets/images/promo_car.png')}
          style={[StyleSheet.absoluteFillObject, { opacity: 0.85 }]}
          resizeMode="cover"
        />
        <LinearGradient
          colors={['rgba(37, 99, 235, 0.3)', 'rgba(30, 64, 175, 0.8)']}
          style={StyleSheet.absoluteFillObject}
        />
        <SafeAreaView style={styles.headerSafeArea} edges={['top']}>
          <View style={styles.headerContent}>
            <Animated.View style={{ transform: [{ scale: titleScale }], alignItems: 'flex-start', flex: 1 }}>
              {logoUrl ? (
                <Image source={{ uri: logoUrl }} style={styles.headerLogo} resizeMode="contain" />
              ) : (
                <Image source={require('../../assets/images/logozemy.png')} style={{ height: 32, width: 100, tintColor: '#FFFFFF', marginBottom: 4 }} resizeMode="contain" />
              )}
              <Text style={styles.greeting}>
                Bonjour, <Text style={styles.userName}>{userName}</Text> 👋
              </Text>

              {/* ── Mini widget météo sous Bonjour ── */}
              {weather && (() => {
                const wmo = getWmo(weather.code);
                return (
                  <Animated.View
                    style={[
                      styles.weatherMiniWidget,
                      {
                        opacity: weatherWidgetOpacity,
                        transform: [{ translateY: weatherWidgetTranslate }],
                      },
                    ]}
                  >
                    <TouchableOpacity
                      style={styles.weatherMiniInner}
                      onPress={() => router.push('/weather')}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.weatherMiniIcon}>{wmo.icon}</Text>
                      <Text style={styles.weatherMiniTemp}>{weather.temp}°C</Text>
                      <Text style={styles.weatherMiniCity} numberOfLines={1}>{weather.city}</Text>
                      <View style={styles.weatherMiniSep} />
                      <Text style={styles.weatherMiniConsult}>Consulter →</Text>
                    </TouchableOpacity>
                  </Animated.View>
                );
              })()}
            </Animated.View>

            <View style={styles.headerActions}>
              {/* Icône météo qui apparaît au scroll */}
              {weather && (
                <Animated.View style={{ opacity: weatherIconOpacity }}>
                  <TouchableOpacity
                    style={styles.headerIcon}
                    onPress={() => router.push('/weather')}
                  >
                    <Text style={{ fontSize: 18 }}>{getWmo(weather.code).icon}</Text>
                  </TouchableOpacity>
                </Animated.View>
              )}
              <TouchableOpacity style={styles.headerIcon} onPress={() => router.push('/notifications')}>
                <Ionicons name="notifications-outline" size={22} color="#FFFFFF" />
                <View style={styles.notificationDot} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.headerIcon} onPress={() => router.push('/(tabs)/profile')}>
                <Ionicons name="person-outline" size={22} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </Animated.View>

      <Animated.FlatList
        data={filteredRides}
        renderItem={renderRideItem}
        keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={Platform.OS === 'android'}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={PRIMARY_COLOR}
            colors={[PRIMARY_COLOR]}
          />
        }
        ListHeaderComponent={
          <>
            {/* Toggle Recherche */}
            <View style={{ flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 12, marginHorizontal: 16, marginTop: -20, marginBottom: 16, padding: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2, zIndex: 10 }}>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: 10, alignItems: 'center', backgroundColor: searchType === 'passenger' ? PRIMARY_COLOR : 'transparent', borderRadius: 8 }}
                onPress={() => setSearchType('passenger')}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="people-outline" size={16} color={searchType === 'passenger' ? '#FFFFFF' : '#6B7280'} style={{ marginRight: 6 }} />
                  <Text style={{ fontWeight: '600', color: searchType === 'passenger' ? '#FFFFFF' : '#6B7280' }}>Passager</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: 10, alignItems: 'center', backgroundColor: searchType === 'parcel' ? PRIMARY_COLOR : 'transparent', borderRadius: 8 }}
                onPress={() => setSearchType('parcel')}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="cube-outline" size={16} color={searchType === 'parcel' ? '#FFFFFF' : '#6B7280'} style={{ marginRight: 6 }} />
                  <Text style={{ fontWeight: '600', color: searchType === 'parcel' ? '#FFFFFF' : '#6B7280' }}>Colis</Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Barre de recherche */}
            <View style={styles.searchSection}>
              <View style={[styles.searchCard, searchFocused && styles.searchCardFocused]}>
                <View style={styles.searchRow}>
                  <View style={styles.searchIcon}>
                    <Ionicons name="swap-vertical" size={20} color={PRIMARY_COLOR} />
                  </View>
                  <View style={styles.searchInputs}>
                    <View style={styles.searchInputWrapper}>
                      <TouchableOpacity
                        style={styles.searchInput}
                        onPress={() => setPickingLocationFor('departure')}
                      >
                        <Text style={!departure ? styles.searchPlaceholder : styles.searchValue}>
                          {departure || 'Départ'}
                        </Text>
                      </TouchableOpacity>
                      {departure ? (
                        <TouchableOpacity onPress={() => setDeparture('')} style={styles.clearIcon}>
                          <Ionicons name="close-circle" size={16} color="#9CA3AF" />
                        </TouchableOpacity>
                      ) : null}
                    </View>
                    <View style={styles.searchSeparator} />
                    <View style={styles.searchInputWrapper}>
                      <TouchableOpacity
                        style={styles.searchInput}
                        onPress={() => setPickingLocationFor('arrival')}
                      >
                        <Text style={!destination ? styles.searchPlaceholder : styles.searchValue}>
                          {destination || 'Arrivée'}
                        </Text>
                      </TouchableOpacity>
                      {destination ? (
                        <TouchableOpacity onPress={() => setDestination('')} style={styles.clearIcon}>
                          <Ionicons name="close-circle" size={16} color="#9CA3AF" />
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>
                  <TouchableOpacity style={styles.searchButton} onPress={fetchRides}>
                    <Ionicons name="search" size={20} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* ─── Carte Météo supprimée → mini widget dans header ─── */}

            {/* Promotions */}
            {showPromotions && promotions.length > 0 && (
              <View style={styles.promoSection}>
                <Text style={styles.sectionLabel}>Offres spéciales</Text>
                <FlatList
                  ref={carouselRef}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.promoScroll}
                  data={promotions}
                  keyExtractor={(item) => item.id.toString()}
                  snapToInterval={280 + 12}
                  decelerationRate="fast"
                  getItemLayout={(data, index) => ({ length: 280 + 12, offset: (280 + 12) * index, index })}
                  renderItem={({ item }) => (
                    <TouchableOpacity activeOpacity={0.9}>
                      <View style={styles.promoCardContainer}>
                        <Image source={{ uri: item.image }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                      </View>
                    </TouchableOpacity>
                  )}
                />
              </View>
            )}

            {/* Filtres */}
            <View style={styles.filtersSection}>
              <View style={styles.filtersHeader}>
                <Text style={styles.sectionLabel}>Trajets disponibles</Text>
                <Text style={styles.ridesCount}>{filteredRides.length} trajets</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersScroll}>
                {filters.map((filter) => (
                  <TouchableOpacity
                    key={filter.id}
                    style={[styles.filterChip, selectedFilter === filter.id && styles.filterChipActive]}
                    onPress={() => setSelectedFilter(filter.id)}
                  >
                    <Ionicons
                      name={filter.icon as any}
                      size={14}
                      color={selectedFilter === filter.id ? '#FFFFFF' : PRIMARY_COLOR}
                    />
                    <Text style={[styles.filterChipText, selectedFilter === filter.id && styles.filterChipTextActive]}>
                      {filter.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </>
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="car-outline" size={64} color="#D1D5DB" />
              <Text style={styles.emptyTitle}>Aucun trajet trouvé</Text>
              <Text style={styles.emptyText}>
                {departure || destination
                  ? "Aucun trajet ne correspond à vos critères"
                  : "Aucun trajet disponible pour le moment"}
              </Text>
            </View>
          ) : (
            <View style={styles.loaderContainer}>
              <ActivityIndicator size="large" color={PRIMARY_COLOR} />
            </View>
          )
        }
      />

      <Modal
        visible={pickingLocationFor !== null}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setPickingLocationFor(null)}
      >
        <LocationPicker
          title={pickingLocationFor === 'departure' ? 'Lieu de départ' : "Lieu d'arrivée"}
          onLocationSelected={(loc) => {
            if (pickingLocationFor === 'departure') setDeparture(loc.name);
            else setDestination(loc.name);
            setPickingLocationFor(null);
          }}
          onCancel={() => setPickingLocationFor(null)}
        />
      </Modal>

      {/* ── Modal de vérification obligatoire ── */}
      <VerificationModal
        visible={showVerifModal}
        onDismiss={handleVerifDismiss}
        onVerify={handleVerifGo}
        userName={user?.full_name?.split(' ')[0]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  locationPickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  locationPickerSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    minHeight: '75%',
    maxHeight: '95%',
    paddingBottom: 20,
  },
  locationPickerHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    overflow: 'hidden',
  },
  headerSafeArea: {
    flex: 1,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
  },
  appName: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 2,
    marginBottom: 4,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  headerLogo: {
    width: 100,
    height: 40,
    marginBottom: 6,
  },
  greeting: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.95)',
    fontWeight: '500',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  userName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  notificationDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  listContent: {
    paddingTop: HEADER_MAX_HEIGHT + 20,
    paddingBottom: 30,
    paddingHorizontal: 16,
  },
  searchSection: {
    marginBottom: 24,
  },
  searchCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  searchCardFocused: {
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 6,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: `${PRIMARY_COLOR}10`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  searchInputs: {
    flex: 1,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  searchInput: {
    paddingVertical: 8,
    flex: 1,
  },
  clearIcon: {
    padding: 4,
  },
  searchSeparator: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 4,
  },
  searchPlaceholder: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  searchValue: {
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '500',
  },
  searchButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: PRIMARY_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
    shadowColor: PRIMARY_COLOR,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  menuSection: {
    marginBottom: 32,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  menuGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  menuItem: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  menuIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  menuLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  promoSection: {
    marginBottom: 32,
  },
  promoScroll: {
    gap: 12,
    paddingHorizontal: 16,
  },
  promoCardContainer: {
    width: 280,
    height: 140,
    borderRadius: 16,
    overflow: 'hidden',
    marginRight: 12,
  },
  promoCardContent: {
    flex: 1,
    padding: 16,
    justifyContent: 'space-between',
  },
  promoIcon: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.2)',
    padding: 6,
    borderRadius: 8,
  },
  promoTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  promoSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  filtersSection: {
    marginBottom: 20,
  },
  filtersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  ridesCount: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  filtersScroll: {
    gap: 10,
    paddingHorizontal: 4,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterChipActive: {
    backgroundColor: PRIMARY_COLOR,
    borderColor: PRIMARY_COLOR,
  },
  filterChipText: {
    fontSize: 13,
    color: '#4B5563',
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  rideCardWrapper: {
    marginBottom: 16,
  },
  rideCard: {
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  rideHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  driverSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  driverAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  driverInitial: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  driverName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  ratingText: {
    fontSize: 12,
    color: '#4B5563',
    fontWeight: '600',
  },
  reviewCount: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  priceSection: {
    alignItems: 'flex-end',
  },
  priceValue: {
    fontSize: 20,
    fontWeight: '800',
    color: PRIMARY_COLOR,
  },
  priceUnit: {
    fontSize: 10,
    color: '#9CA3AF',
  },
  routeSection: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  timeline: {
    alignItems: 'center',
    width: 24,
    marginRight: 12,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 4,
  },
  routeDetails: {
    flex: 1,
    gap: 16,
  },
  routePoint: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  locationName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
    flex: 1,
  },
  routeTime: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '600',
  },
  routeDate: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  rideFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  seatsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: `${PRIMARY_COLOR}10`,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  seatsText: {
    fontSize: 12,
    color: PRIMARY_COLOR,
    fontWeight: '600',
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  viewButtonText: {
    fontSize: 13,
    color: PRIMARY_COLOR,
    fontWeight: '700',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  emptyButton: {
    backgroundColor: PRIMARY_COLOR,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  loaderContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },

  // ── Mini Weather Widget styles ─────────────────────────────────────────────
  weatherMiniWidget: {
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  weatherMiniInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: 30,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  weatherMiniIcon: {
    fontSize: 18,
  },
  weatherMiniTemp: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  weatherMiniCity: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '500',
    maxWidth: 90,
  },
  weatherMiniSep: {
    width: 1,
    height: 16,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  weatherMiniConsult: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '700',
  },
});