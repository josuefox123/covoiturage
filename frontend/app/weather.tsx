/**
 * ==============================================================
 * Fichier :
 * weather.tsx
 *
 * Description :
 * Composant ou logique de l'application Zemy.
 *
 * Projet :
 * Zemy
 * ==============================================================
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');
const PRIMARY = '#2563EB';

// ── Types ────────────────────────────────────────────────────────────────────
interface WeatherDay {
  date: string;
  tempMax: number;
  tempMin: number;
  code: number;
  rain: number;
}

interface WeatherData {
  city: string;
  temp: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  code: number;
  sunrise: string;
  sunset: string;
  forecast: WeatherDay[];
}

// ── Weather Mapping ──────────────────────────────────────────────────────────
const getWeatherIcon = (code: number): keyof typeof Ionicons.glyphMap => {
  if (code === 0) return 'sunny';
  if (code <= 2) return 'partly-sunny';
  if (code <= 45) return 'cloud';
  if (code <= 65) return 'rainy';
  if (code <= 95) return 'thunderstorm';
  return 'cloud-outline';
};

const getWmo = (code: number) => {
  if (code === 0) return { label: 'Ciel dégagé', bgMain: ['#FF8C00', '#FFD700'], bgCard: '#FFF8DC', animType: 'spin' };
  if (code <= 2) return { label: 'Peu nuageux', bgMain: ['#42A5F5', '#90CAF9'], bgCard: '#E3F2FD', animType: 'float' };
  if (code <= 45) return { label: 'Nuageux / Brouillard', bgMain: ['#90A4AE', '#B0BEC5'], bgCard: '#ECEFF1', animType: 'float' };
  if (code <= 65) return { label: 'Pluie', bgMain: ['#78909C', '#546E7A'], bgCard: '#CFD8DC', animType: 'swing' };
  if (code <= 99) return { label: 'Orage', bgMain: ['#5C6BC0', '#3949AB'], bgCard: '#C5CAE9', animType: 'swing' };
  return { label: 'Inconnu', bgMain: ['#9CA3AF', '#D1D5DB'], bgCard: '#F3F4F6', animType: 'float' };
};

const getDriveQuality = (code: number) => {
  if (code >= 95) return { stars: '★★☆☆☆', text: 'Mauvais', color: '#EF4444' };
  if (code >= 61) return { stars: '★★★☆☆', text: 'Bon', color: '#F59E0B' };
  if (code >= 3) return { stars: '★★★★☆', text: 'Très Bon', color: '#10B981' };
  return { stars: '★★★★★', text: 'Excellent', color: '#10B981' };
};

const getSecurityIndicator = (code: number) => {
  if (code >= 95) return { label: 'Déconseillées', color: '#EF4444' };
  if (code >= 61) return { label: 'Prudence', color: '#F59E0B' };
  return { label: 'Favorables', color: '#10B981' };
};

const getTravelTips = (code: number) => {
  if (code >= 95) {
    return [
      { icon: 'warning-outline', color: '#EF4444', title: 'Orage', text: 'Les conditions météorologiques sont défavorables. Limitez les déplacements.' },
      { icon: 'car-outline', color: '#F59E0B', title: 'Conduite', text: 'Réduisez votre vitesse et augmentez les distances de sécurité.' },
      { icon: 'shield-checkmark-outline', color: '#2563EB', title: 'Sécurité', text: 'Assurez-vous que votre véhicule est en bon état.' },
    ];
  }
  if (code >= 61) {
    return [
      { icon: 'umbrella-outline', color: '#2563EB', title: 'Pluie', text: 'Emportez un parapluie et allumez vos feux de croisement.' },
      { icon: 'car-outline', color: '#F59E0B', title: 'Chaussée glissante', text: 'Routes mouillées, anticipez vos freinages.' },
      { icon: 'time-outline', color: '#10B981', title: 'Trajet', text: 'Prévoyez 10 min supplémentaires pour votre déplacement.' },
    ];
  }
  if (code >= 3) {
    return [
      { icon: 'cloud-outline', color: '#6B7280', title: 'Nuageux', text: 'Visibilité potentiellement réduite.' },
      { icon: 'checkmark-circle-outline', color: '#10B981', title: 'Conduite', text: 'Conditions de conduite acceptables.' },
    ];
  }
  return [
    { icon: 'sunny-outline', color: '#F59E0B', title: 'Soleil', text: 'Excellentes conditions. Pensez à vos lunettes de soleil.' },
    { icon: 'happy-outline', color: '#10B981', title: 'Agréable', text: 'Profitez d\'un trajet confortable en covoiturage !' },
  ];
};

const DAY_NAMES = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const WEATHER_CACHE_KEY = '@zemy_weather_cache';

/**
 * Composant WeatherScreen.
 *
 * Responsabilités :
 * - Affichage et gestion de l'état lié à WeatherScreen.
 */
export default function WeatherScreen() {
  const router = useRouter();
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const tempScale = useRef(new Animated.Value(0.5)).current;
  const weatherAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadWeather();
  }, []);

  const animateIn = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 8, useNativeDriver: true }),
      Animated.spring(tempScale, { toValue: 1, friction: 6, useNativeDriver: true }),
    ]).start();

    // Loop animation for icon
    Animated.loop(
      Animated.sequence([
        Animated.timing(weatherAnim, { toValue: 1, duration: 4000, useNativeDriver: true }),
        Animated.timing(weatherAnim, { toValue: 0, duration: 4000, useNativeDriver: true }),
      ])
    ).start();
  };

  const loadWeather = async () => {
    try {
      const cached = await AsyncStorage.getItem(WEATHER_CACHE_KEY);
      if (cached) {
        setWeather(JSON.parse(cached));
        setLoading(false);
        animateIn();
      }
      await refreshWeather();
    } catch (e) {
      setLoading(false);
    }
  };

  const formatTime = (ts: number) => {
    if (!ts) return '--:--';
    const d = new Date(ts * 1000);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const refreshWeather = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude: lat, longitude: lon } = loc.coords;

      const [place] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
      const city = place?.city || place?.subregion || place?.region || 'Ma position';

      const url =
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
        `&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code` +
        `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,sunrise,sunset` +
        `&timezone=auto&forecast_days=7&timeformat=unixtime`;

      const res = await fetch(url);
      const json = await res.json();

      const cur = json.current;
      const daily = json.daily;

      const forecast: WeatherDay[] = daily.time.slice(1, 7).map((_: number, i: number) => ({
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
        sunrise: formatTime(daily.sunrise[0]),
        sunset: formatTime(daily.sunset[0]),
        forecast,
      };

      setWeather(newWeather);
      setLastUpdated(new Date());
      await AsyncStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(newWeather));
      animateIn();
    } catch (e) {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    refreshWeather();
  };

  const wmo = weather ? getWmo(weather.code) : null;
  const tips = weather ? getTravelTips(weather.code) : [];
  const driveQuality = weather ? getDriveQuality(weather.code) : null;
  const security = weather ? getSecurityIndicator(weather.code) : null;

  const getAnimStyle = () => {
    if (!wmo) return {};
    if (wmo.animType === 'spin') {
      const rotate = weatherAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
      return { transform: [{ rotate }] };
    }
    if (wmo.animType === 'float') {
      const translateY = weatherAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -10] });
      return { transform: [{ translateY }] };
    }
    if (wmo.animType === 'swing') {
      const rotate = weatherAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['-5deg', '5deg', '-5deg'] });
      return { transform: [{ rotate }] };
    }
    return {};
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#1F2937" />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Météo actuelle</Text>
            {weather && <Text style={styles.headerSubCity}>{weather.city}</Text>}
          </View>
          <View style={{ width: 42 }} />
        </View>
      </SafeAreaView>

      {loading && !weather ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={PRIMARY} />
          <Text style={styles.loadingText}>Localisation en cours…</Text>
        </View>
      ) : weather && wmo ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PRIMARY} />}
        >
          {/* ── DATE DE MISE A JOUR ───────────────────────────────── */}
          {lastUpdated && (
            <View style={styles.updateRow}>
              <Ionicons name="time-outline" size={14} color="#6B7280" />
              <Text style={styles.updateText}>
                Dernière mise à jour : {lastUpdated.getHours()}:{String(lastUpdated.getMinutes()).padStart(2, '0')}
              </Text>
            </View>
          )}

          {/* ── CARTE PRINCIPALE ──────────────────────────────────── */}
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
            <LinearGradient
              colors={wmo.bgMain as [string, string]}
              style={styles.mainCard}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.mainTempRow}>
                <Animated.View style={[getAnimStyle(), { transform: [...(getAnimStyle().transform || []), { scale: tempScale }] }]}>
                  <Ionicons name={getWeatherIcon(weather.code)} size={80} color="#FFFFFF" />
                </Animated.View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.mainTemp}>{weather.temp}°C</Text>
                  <Text style={styles.conditionLabel}>{wmo.label}</Text>
                  <Text style={styles.feelsLike}>Ressenti {weather.feelsLike}°C</Text>
                </View>
              </View>

              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Ionicons name="water-outline" size={22} color="#FFFFFF" />
                  <Text style={styles.statVal}>{weather.humidity}%</Text>
                  <Text style={styles.statLabel}>Humidité</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Ionicons name="speedometer-outline" size={22} color="#FFFFFF" />
                  <Text style={styles.statVal}>{weather.windSpeed} km/h</Text>
                  <Text style={styles.statLabel}>Vent</Text>
                </View>
              </View>
            </LinearGradient>
          </Animated.View>

          {/* ── INDICATEURS ZEMY ──────────────────────────────────── */}
          <Animated.View style={[styles.section, { opacity: fadeAnim }]}>
            <Text style={styles.sectionTitle}>
              <Ionicons name="car-sport-outline" size={22} color={PRIMARY} /> Informations Covoiturage
            </Text>
            <View style={styles.indicatorGrid}>
              <View style={[styles.indicatorCard, { borderColor: driveQuality?.color }]}>
                <Text style={styles.indicatorLabel}>Conditions de circulation</Text>
                <Text style={[styles.indicatorStars, { color: driveQuality?.color }]}>{driveQuality?.stars}</Text>
                <Text style={[styles.indicatorText, { color: driveQuality?.color }]}>{driveQuality?.text}</Text>
              </View>
              <View style={[styles.indicatorCard, { borderColor: security?.color }]}>
                <Text style={styles.indicatorLabel}>Conditions du trajet</Text>
                <Text style={[styles.indicatorText, { color: security?.color, fontSize: 16, marginTop: 8 }]}>{security?.label}</Text>
              </View>
            </View>
          </Animated.View>

          {/* ── CONSEILS VOYAGE ───────────────────────────────────── */}
          <Animated.View style={[styles.section, { opacity: fadeAnim }]}>
            <Text style={styles.sectionTitle}>
              <Ionicons name="bulb-outline" size={22} color={PRIMARY} /> Conseils météo
            </Text>
            {tips.map((tip: any, i) => (
              <View key={i} style={styles.tipRow}>
                <View style={[styles.tipIconBg, { backgroundColor: tip.color + '20' }]}>
                  <Ionicons name={tip.icon} size={22} color={tip.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.tipTitle, { color: tip.color }]}>{tip.title}</Text>
                  <Text style={styles.tipText}>{tip.text}</Text>
                </View>
              </View>
            ))}
          </Animated.View>

          {/* ── PRÉVISIONS 6 JOURS ────────────────────────────────── */}
          <Animated.View style={[styles.section, { opacity: fadeAnim }]}>
            <Text style={styles.sectionTitle}>
              <Ionicons name="calendar-outline" size={22} color={PRIMARY} /> Prévisions sur 6 jours
            </Text>
            <View style={styles.forecastGrid}>
              {weather.forecast.map((day, i) => {
                const dayWmo = getWmo(day.code);
                return (
                  <View key={i} style={styles.forecastRow}>
                    <Text style={styles.forecastDay}>{day.date}</Text>
                    <Ionicons name={getWeatherIcon(day.code)} size={26} color="#6B7280" style={{ width: 40, textAlign: 'center' }} />
                    <View style={styles.forecastTemps}>
                      <Text style={styles.forecastTempMax}>{day.tempMax}°</Text>
                      <Text style={styles.forecastTempMin}>{day.tempMin}°</Text>
                    </View>
                    <View style={{ width: 50, alignItems: 'flex-end' }}>
                      {day.rain > 0 ? (
                        <Text style={styles.forecastRainText}>{day.rain} mm</Text>
                      ) : (
                        <Text style={styles.forecastRainText}>-</Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          </Animated.View>

          {/* ── INFOS SOLEIL ET DETAILLEES ─────────────────────── */}
          <Animated.View style={[styles.section, { opacity: fadeAnim }]}>
            <Text style={styles.sectionTitle}>
              <Ionicons name="information-circle-outline" size={22} color={PRIMARY} /> Informations détaillées
            </Text>
            <View style={styles.infoGrid}>
              <View style={styles.infoCard}>
                <Feather name="sunrise" size={28} color="#F59E0B" />
                <Text style={styles.infoVal}>{weather.sunrise}</Text>
                <Text style={styles.infoLabel}>Lever du soleil</Text>
              </View>
              <View style={styles.infoCard}>
                <Feather name="sunset" size={28} color="#F59E0B" />
                <Text style={styles.infoVal}>{weather.sunset}</Text>
                <Text style={styles.infoLabel}>Coucher du soleil</Text>
              </View>
              <View style={styles.infoCard}>
                <Ionicons name="thermometer-outline" size={28} color="#EF4444" />
                <Text style={styles.infoVal}>{weather.temp}°C</Text>
                <Text style={styles.infoLabel}>Température</Text>
              </View>
              <View style={styles.infoCard}>
                <Ionicons name="water-outline" size={28} color="#3B82F6" />
                <Text style={styles.infoVal}>{weather.humidity}%</Text>
                <Text style={styles.infoLabel}>Humidité</Text>
              </View>
            </View>
          </Animated.View>

          <View style={{ height: 40 }} />
        </ScrollView>
      ) : (
        <View style={styles.loadingContainer}>
          <Ionicons name="cloud-offline-outline" size={60} color="#9CA3AF" />
          <Text style={styles.errorText}>Impossible de récupérer les données météo.</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={loadWeather}>
            <Text style={styles.retryText}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  safeArea: {
    backgroundColor: 'transparent',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  headerSubCity: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1F2937',
    textAlign: 'center',
  },
  updateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 16,
  },
  updateText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 15,
    color: '#6B7280',
    marginTop: 8,
  },
  // ── Main Card ───────────────────────────────────────────────
  mainCard: {
    borderRadius: 28,
    padding: 24,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
  mainTempRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  mainTemp: {
    fontSize: 56,
    fontWeight: '900',
    color: '#FFFFFF',
    lineHeight: 64,
  },
  conditionLabel: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '700',
  },
  feelsLike: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 8,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  statVal: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 4,
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
  },
  // ── Section ─────────────────────────────────────────────────
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1F2937',
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  // ── Indicators Zemy ─────────────────────────────────────────
  indicatorGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  indicatorCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  indicatorLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  indicatorStars: {
    fontSize: 18,
    marginBottom: 4,
  },
  indicatorText: {
    fontSize: 14,
    fontWeight: '800',
  },
  // ── Tips ────────────────────────────────────────────────────
  tipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  tipIconBg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tipTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  tipText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
    lineHeight: 18,
  },
  // ── Forecast List ────────────────────────────────────────────
  forecastGrid: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  forecastRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  forecastDay: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  forecastTemps: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 70,
    justifyContent: 'flex-end',
    gap: 8,
  },
  forecastTempMax: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
  },
  forecastTempMin: {
    fontSize: 14,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  forecastRainText: {
    fontSize: 13,
    color: '#3B82F6',
    fontWeight: '600',
  },
  // ── Info Grid ───────────────────────────────────────────────
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  infoCard: {
    width: (width - 32 - 12) / 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
    gap: 8,
  },
  infoVal: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  infoLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
  },
  // ── Error ───────────────────────────────────────────────────
  errorText: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  retryBtn: {
    backgroundColor: PRIMARY,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
    marginTop: 16,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
