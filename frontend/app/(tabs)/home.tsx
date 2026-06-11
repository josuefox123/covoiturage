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
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { useAuth } from '../../src/context/AuthContext';
import LocationPicker from '../../src/components/LocationPicker';
import { Ride } from '../../src/types';

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

// Données des offres promotionnelles
const PROMO_DATA = [
  { id: '1', title: '-50% sur le 1er trajet', subtitle: 'Utilisez le code BIENVENUE', color: PRIMARY_COLOR, icon: 'gift-outline', image: require('../../assets/images/promo_car.png') },
  { id: '2', title: 'Voyagez confortablement', subtitle: 'Découvrez de nouveaux horizons', color: '#10B981', icon: 'star-outline', image: require('../../assets/images/promo_passengers.png') },
  { id: '3', title: 'Parrainage Zemy', subtitle: 'Gagnez 2000 FCFA', color: '#F59E0B', icon: 'people-outline', image: require('../../assets/images/promo_gift.png') },
];

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

interface RideCardProps {
  ride: Ride;
  onPress: () => void;
  index: number;
}

const RideCard: React.FC<RideCardProps> = ({ ride, onPress, index }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        delay: index * 100,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        delay: index * 100,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const driverName = ride.driver_details?.full_name || 'Conducteur';
  const avatarInitials = driverName.charAt(0).toUpperCase();
  const price = ride.price_per_seat?.toLocaleString() || '0';
  const departureTime = ride.departure_time?.substring(0, 5) || '--:--';
  const seatsLeft = ride.seats_available || 0;

  return (
    <Animated.View
      style={[
        styles.rideCardWrapper,
        {
          opacity: fadeAnim,
          transform: [{ translateY }],
        },
      ]}
    >
      <TouchableOpacity onPress={onPress} activeOpacity={0.9}>
        <LinearGradient
          colors={['#FFFFFF', '#F9FAFB']}
          style={styles.rideCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {/* En-tête avec conducteur et prix */}
          <View style={styles.rideHeader}>
            <View style={styles.driverSection}>
              <LinearGradient
                colors={[PRIMARY_COLOR, '#1E40AF']}
                style={styles.driverAvatar}
              >
                <Text style={styles.driverInitial}>{avatarInitials}</Text>
              </LinearGradient>
              <View>
                <Text style={styles.driverName}>{driverName}</Text>
                <View style={styles.ratingContainer}>
                  <Ionicons name="star" size={12} color="#F59E0B" />
                  <Text style={styles.ratingText}>{ride.driver_details?.rating || '4.9'}</Text>
                  <Text style={styles.reviewCount}>(12 avis)</Text>
                </View>
              </View>
            </View>
            <View style={styles.priceSection}>
              <Text style={styles.priceValue}>{price}</Text>
              <Text style={styles.priceUnit}>FCFA</Text>
            </View>
          </View>

          {/* Trajet */}
          <View style={styles.routeSection}>
            <View style={styles.timeline}>
              <View style={[styles.timelineDot, { backgroundColor: PRIMARY_COLOR }]} />
              <View style={styles.timelineLine} />
              <View style={[styles.timelineDot, { backgroundColor: '#10B981' }]} />
            </View>
            <View style={styles.routeDetails}>
              <View style={styles.routePoint}>
                <Text style={styles.locationName} numberOfLines={1}>
                  {ride.departure_location || 'Départ'}
                </Text>
                <Text style={styles.routeTime}>{departureTime}</Text>
              </View>
              <View style={styles.routePoint}>
                <Text style={styles.locationName} numberOfLines={1}>
                  {ride.arrival_location || 'Arrivée'}
                </Text>
                <Text style={styles.routeDate}>
                  {formatFullDate(ride.departure_date)}
                </Text>
              </View>
            </View>
          </View>

          {/* Footer avec places dispo */}
          <View style={styles.rideFooter}>
            <View style={styles.seatsContainer}>
              <Ionicons name="people-outline" size={14} color={PRIMARY_COLOR} />
              <Text style={styles.seatsText}>
                {seatsLeft} place{seatsLeft > 1 ? 's' : ''} disponible{seatsLeft > 1 ? 's' : ''}
              </Text>
            </View>
            <View style={styles.viewButton}>
              <Text style={styles.viewButtonText}>Voir détail</Text>
              <Ionicons name="arrow-forward" size={14} color={PRIMARY_COLOR} />
            </View>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
};

export default function HomeScreen() {
  const router = useRouter();
  const { user, authFetch } = useAuth();

  const [departure, setDeparture] = useState('');
  const [destination, setDestination] = useState('');
  const [pickingLocationFor, setPickingLocationFor] = useState<'departure' | 'arrival' | null>(null);
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('recommended');
  const [searchFocused, setSearchFocused] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

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

  useEffect(() => {
    fetchRides();

    // Fetch branding pour le logo
    authFetch('/branding/')
      .then(data => {
        if (data && data.logo) {
          setLogoUrl(data.logo);
        }
      })
      .catch(err => console.log("Erreur branding:", err));
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentPromoIndex((prev) => {
        const nextIndex = (prev + 1) % PROMO_DATA.length;
        if (carouselRef.current) {
          carouselRef.current.scrollToIndex({ index: nextIndex, animated: true });
        }
        return nextIndex;
      });
    }, 5000);
    return () => clearInterval(timer);
  }, []);

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

  useEffect(() => {
    fetchRides();
  }, []);

  const fetchRides = async () => {
    try {
      setLoading(true);
      const data = await authFetch('/rides/');
      setRides(Array.isArray(data) ? data : data?.results || []);
    } catch (error) {
      console.error('Erreur:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchRides();
    setRefreshing(false);
  };

  const handleRidePress = useCallback((ride: Ride) => {
    if (user && ride.driver === user.id) {
      router.push(`/ride-management/${ride.id}`);
    } else {
      router.push(`/ride/${ride.id}`);
    }
  }, [router, user]);

  const filteredRides = useMemo(() => {
    let filtered = [...rides];

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
    <RideCard ride={item} onPress={() => handleRidePress(item)} index={index} />
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
            <Animated.View style={{ transform: [{ scale: titleScale }], alignItems: 'flex-start' }}>
              {logoUrl ? (
                <Image source={{ uri: logoUrl }} style={styles.headerLogo} resizeMode="contain" />
              ) : (
                <Image source={require('../../assets/images/logozemy.png')} style={{ height: 32, width: 100, tintColor: '#FFFFFF', marginBottom: 4 }} resizeMode="contain" />
              )}
              <Text style={styles.greeting}>
                Bonjour, <Text style={styles.userName}>{userName}</Text> 👋
              </Text>
            </Animated.View>
            <View style={styles.headerActions}>
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

            {/* ─── Carte Météo ─── */}
            <Animated.View style={[{ transform: [{ scale: weatherPulse }] }, styles.weatherSection]}>
              {weatherLoading ? (
                <View style={styles.weatherSkeleton}>
                  <ActivityIndicator color={PRIMARY_COLOR} />
                  <Text style={styles.weatherSkeletonText}>Chargement météo…</Text>
                </View>
              ) : weather ? (() => {
                const wmo = getWmo(weather.code);
                return (
                  <LinearGradient
                    colors={wmo.gradient as any}
                    style={styles.weatherCard}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    {/* Header */}
                    <View style={styles.weatherHeader}>
                      <View>
                        <View style={styles.weatherCityRow}>
                          <Ionicons name="location" size={14} color="#374151" />
                          <Text style={styles.weatherCity}>{weather.city}</Text>
                        </View>
                        <Text style={styles.weatherCondition}>{wmo.label}</Text>
                      </View>
                      <TouchableOpacity onPress={fetchWeather} style={styles.weatherRefreshBtn} disabled={weatherStale}>
                        {weatherStale
                          ? <ActivityIndicator size="small" color="#6B7280" />
                          : <Ionicons name="refresh" size={16} color="#6B7280" />}
                      </TouchableOpacity>
                    </View>

                    {/* Temp + icon */}
                    <View style={styles.weatherMain}>
                      <Text style={styles.weatherIcon}>{wmo.icon}</Text>
                      <View>
                        <Text style={styles.weatherTemp}>{weather.temp}°C</Text>
                        <Text style={styles.weatherFeels}>Ressenti {weather.feelsLike}°C</Text>
                      </View>
                    </View>

                    {/* Details row */}
                    <View style={styles.weatherDetails}>
                      <View style={styles.weatherDetailItem}>
                        <Text style={styles.weatherDetailIcon}>💧</Text>
                        <Text style={styles.weatherDetailVal}>{weather.humidity}%</Text>
                        <Text style={styles.weatherDetailLabel}>Humidité</Text>
                      </View>
                      <View style={styles.weatherDetailSep} />
                      <View style={styles.weatherDetailItem}>
                        <Text style={styles.weatherDetailIcon}>🌬</Text>
                        <Text style={styles.weatherDetailVal}>{weather.windSpeed} km/h</Text>
                        <Text style={styles.weatherDetailLabel}>Vent</Text>
                      </View>
                      <View style={styles.weatherDetailSep} />
                      <View style={styles.weatherDetailItem}>
                        <Text style={styles.weatherDetailIcon}>☁️</Text>
                        <Text style={styles.weatherDetailVal}>{getWmo(weather.code).icon}</Text>
                        <Text style={styles.weatherDetailLabel}>État</Text>
                      </View>
                    </View>

                    {/* 4-day forecast */}
                    <View style={styles.forecastRow}>
                      {weather.forecast.map((day, i) => (
                        <View key={i} style={styles.forecastDay}>
                          <Text style={styles.forecastDayName}>{day.date}</Text>
                          <Text style={styles.forecastIcon}>{getWmo(day.code).icon}</Text>
                          <Text style={styles.forecastMax}>{day.tempMax}°</Text>
                          <Text style={styles.forecastMin}>{day.tempMin}°</Text>
                          {day.rain > 0 && (
                            <Text style={styles.forecastRain}>💧{day.rain}mm</Text>
                          )}
                        </View>
                      ))}
                    </View>

                    {/* Travel tip */}
                    {weather.code >= 61 && (
                      <View style={styles.weatherAlert}>
                        <Ionicons name="warning" size={14} color="#B45309" />
                        <Text style={styles.weatherAlertText}>
                          Pluie prévue — prévoyez un imperméable pour les longs trajets
                        </Text>
                      </View>
                    )}
                    {weather.code >= 95 && (
                      <View style={[styles.weatherAlert, { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' }]}>
                        <Ionicons name="thunderstorm" size={14} color="#DC2626" />
                        <Text style={[styles.weatherAlertText, { color: '#DC2626' }]}>
                          Orage — prudence sur la route !
                        </Text>
                      </View>
                    )}
                  </LinearGradient>
                );
              })() : null}
            </Animated.View>

            {/* Promotions */}
            <View style={styles.promoSection}>
              <Text style={styles.sectionLabel}>Offres spéciales</Text>
              <FlatList
                ref={carouselRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.promoScroll}
                data={PROMO_DATA}
                keyExtractor={(item) => item.id}
                snapToInterval={280 + 12}
                decelerationRate="fast"
                getItemLayout={(data, index) => ({ length: 280 + 12, offset: (280 + 12) * index, index })}
                renderItem={({ item }) => (
                  <TouchableOpacity activeOpacity={0.9}>
                    <View style={styles.promoCardContainer}>
                      <Image source={item.image} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                      <LinearGradient
                        colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.8)']}
                        style={StyleSheet.absoluteFillObject}
                      />
                      <View style={styles.promoCardContent}>
                        <Ionicons name={item.icon as any} size={24} color="#FFFFFF" style={styles.promoIcon} />
                        <View>
                          <Text style={styles.promoTitle}>{item.title}</Text>
                          <Text style={styles.promoSubtitle}>{item.subtitle}</Text>
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                )}
              />
            </View>

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

      <Modal visible={pickingLocationFor !== null} animationType="slide" transparent={false}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
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

  // ── Weather styles ────────────────────────────────────────────────────────
  weatherSection: {
    marginBottom: 24,
  },
  weatherSkeleton: {
    height: 80,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  weatherSkeletonText: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  weatherCard: {
    borderRadius: 20,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 4,
  },
  weatherHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  weatherCityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  weatherCity: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
  },
  weatherCondition: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
    fontWeight: '500',
  },
  weatherRefreshBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  weatherMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
  },
  weatherIcon: {
    fontSize: 52,
  },
  weatherTemp: {
    fontSize: 44,
    fontWeight: '900',
    color: '#111827',
    lineHeight: 48,
  },
  weatherFeels: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
    marginTop: 2,
  },
  weatherDetails: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderRadius: 14,
    paddingVertical: 10,
    marginBottom: 14,
  },
  weatherDetailItem: {
    alignItems: 'center',
    flex: 1,
  },
  weatherDetailSep: {
    width: 1,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  weatherDetailIcon: {
    fontSize: 16,
    marginBottom: 2,
  },
  weatherDetailVal: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
  },
  weatherDetailLabel: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 1,
  },
  forecastRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.45)',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 8,
    marginBottom: 10,
  },
  forecastDay: {
    alignItems: 'center',
    flex: 1,
  },
  forecastDayName: {
    fontSize: 11,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  forecastIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  forecastMax: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },
  forecastMin: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  forecastRain: {
    fontSize: 10,
    color: '#3B82F6',
    marginTop: 2,
    fontWeight: '600',
  },
  weatherAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFBEB',
    borderRadius: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginTop: 4,
  },
  weatherAlertText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#B45309',
  },
});