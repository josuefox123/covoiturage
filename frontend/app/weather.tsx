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
import { Ionicons } from '@expo/vector-icons';
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
  forecast: WeatherDay[];
}

// ── WMO map ──────────────────────────────────────────────────────────────────
const WMO_ICONS: Record<number, { icon: string; label: string; gradient: string[]; bg: string }> = {
  0:  { icon: '☀️',  label: 'Ciel dégagé',           gradient: ['#FF8C00', '#FFD700'], bg: '#FFF8DC' },
  1:  { icon: '🌤',  label: 'Peu nuageux',            gradient: ['#FFA500', '#FFE066'], bg: '#FFFDE7' },
  2:  { icon: '⛅',  label: 'Partiellement nuageux',  gradient: ['#64B5F6', '#1E88E5'], bg: '#E3F2FD' },
  3:  { icon: '☁️',  label: 'Couvert',                gradient: ['#78909C', '#546E7A'], bg: '#ECEFF1' },
  45: { icon: '🌫',  label: 'Brouillard',             gradient: ['#90A4AE', '#607D8B'], bg: '#ECEFF1' },
  51: { icon: '🌦',  label: 'Bruine légère',          gradient: ['#42A5F5', '#1565C0'], bg: '#E3F2FD' },
  61: { icon: '🌧',  label: 'Pluie légère',           gradient: ['#2196F3', '#0D47A1'], bg: '#BBDEFB' },
  63: { icon: '🌧',  label: 'Pluie modérée',          gradient: ['#1976D2', '#0D47A1'], bg: '#90CAF9' },
  65: { icon: '🌧',  label: 'Forte pluie',            gradient: ['#1565C0', '#0A237A'], bg: '#64B5F6' },
  80: { icon: '🌦',  label: 'Averses',                gradient: ['#42A5F5', '#1565C0'], bg: '#BBDEFB' },
  95: { icon: '⛈',  label: 'Orage',                  gradient: ['#5C6BC0', '#283593'], bg: '#C5CAE9' },
  99: { icon: '⛈',  label: 'Orage violent',          gradient: ['#4527A0', '#1A0B7A'], bg: '#B39DDB' },
};

const getWmo = (code: number) =>
  WMO_ICONS[code] ??
  WMO_ICONS[Object.keys(WMO_ICONS).map(Number).filter(k => k <= code).sort((a, b) => b - a)[0]] ??
  { icon: '🌡', label: 'Inconnu', gradient: ['#607D8B', '#37474F'], bg: '#ECEFF1' };

const DAY_NAMES = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const WEATHER_CACHE_KEY = '@zemy_weather_cache';

// ── Tip messages ─────────────────────────────────────────────────────────────
const getTravelTips = (code: number) => {
  if (code >= 95) return [
    { icon: '⚠️', text: 'Évitez les déplacements non essentiels', color: '#EF4444' },
    { icon: '🚗', text: 'Si vous devez sortir, ralentissez et gardez vos distances', color: '#F59E0B' },
    { icon: '📱', text: 'Informez quelqu\'un de votre itinéraire', color: '#6366F1' },
  ];
  if (code >= 61) return [
    { icon: '☂️', text: 'Emportez un parapluie pour le trajet', color: '#3B82F6' },
    { icon: '🛣️', text: 'Routes mouillées, prudence au freinage', color: '#F59E0B' },
    { icon: '⏱️', text: 'Prévoyez 10-15 min supplémentaires', color: '#10B981' },
  ];
  if (code >= 3) return [
    { icon: '🌂', text: 'Nuages possibles, pas de pluie prévue', color: '#6B7280' },
    { icon: '✅', text: 'Conditions de conduite acceptables', color: '#10B981' },
  ];
  return [
    { icon: '🌞', text: 'Excellentes conditions pour voyager !', color: '#F59E0B' },
    { icon: '😎', text: 'Profitez du beau temps sur la route', color: '#10B981' },
  ];
};

export default function WeatherScreen() {
  const router = useRouter();
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const tempScale = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    loadWeather();
  }, []);

  const animateIn = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 8, useNativeDriver: true }),
      Animated.spring(tempScale, { toValue: 1, friction: 6, useNativeDriver: true }),
    ]).start();
  };

  const loadWeather = async () => {
    try {
      // 1. Tenter le cache
      const cached = await AsyncStorage.getItem(WEATHER_CACHE_KEY);
      if (cached) {
        setWeather(JSON.parse(cached));
        setLoading(false);
        animateIn();
      }
      // 2. Rafraîchir en arrière-plan
      await refreshWeather();
    } catch (e) {
      setLoading(false);
    }
  };

  const refreshWeather = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude: lat, longitude: lon } = loc.coords;

      // Ville via reverse geocoding
      const [place] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
      const city = place?.city || place?.subregion || place?.region || 'Ma position';

      const url =
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
        `&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code` +
        `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum` +
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
        forecast,
      };

      setWeather(newWeather);
      setLastUpdated(new Date());
      await AsyncStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(newWeather));
      animateIn();
    } catch (e) {
      console.log('Weather error:', e);
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

  return (
    <View style={styles.container}>
      {/* Background gradient */}
      {wmo && (
        <LinearGradient
          colors={[wmo.gradient[0] + '33', wmo.gradient[1] + '11', '#F3F4F6']}
          style={StyleSheet.absoluteFillObject}
        />
      )}

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#1F2937" />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Météo</Text>
            {lastUpdated && (
              <Text style={styles.headerSub}>
                Mis à jour à {lastUpdated.getHours()}:{String(lastUpdated.getMinutes()).padStart(2, '0')}
              </Text>
            )}
          </View>
          <TouchableOpacity onPress={onRefresh} style={styles.refreshBtn} disabled={refreshing}>
            {refreshing
              ? <ActivityIndicator size="small" color={PRIMARY} />
              : <Ionicons name="refresh" size={22} color={PRIMARY} />}
          </TouchableOpacity>
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
          {/* ── CARTE PRINCIPALE ──────────────────────────────────── */}
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
            <LinearGradient
              colors={wmo.gradient as any}
              style={styles.mainCard}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              {/* Ville */}
              <View style={styles.cityRow}>
                <Ionicons name="location" size={16} color="rgba(255,255,255,0.9)" />
                <Text style={styles.cityText}>{weather.city}</Text>
              </View>

              {/* Icône + Température */}
              <View style={styles.mainTempRow}>
                <Animated.Text style={[styles.bigIcon, { transform: [{ scale: tempScale }] }]}>
                  {wmo.icon}
                </Animated.Text>
                <View>
                  <Text style={styles.mainTemp}>{weather.temp}°C</Text>
                  <Text style={styles.conditionLabel}>{wmo.label}</Text>
                </View>
              </View>

              {/* Ressenti */}
              <Text style={styles.feelsLike}>Ressenti {weather.feelsLike}°C</Text>

              {/* Stats row */}
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statIcon}>💧</Text>
                  <Text style={styles.statVal}>{weather.humidity}%</Text>
                  <Text style={styles.statLabel}>Humidité</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statIcon}>🌬</Text>
                  <Text style={styles.statVal}>{weather.windSpeed} km/h</Text>
                  <Text style={styles.statLabel}>Vent</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statIcon}>☁️</Text>
                  <Text style={styles.statVal}>{wmo.icon}</Text>
                  <Text style={styles.statLabel}>État</Text>
                </View>
              </View>
            </LinearGradient>
          </Animated.View>

          {/* ── ALERTES ───────────────────────────────────────────── */}
          {weather.code >= 61 && (
            <Animated.View style={[styles.alertCard, { opacity: fadeAnim }]}>
              <LinearGradient
                colors={weather.code >= 95 ? ['#FEE2E2', '#FECACA'] : ['#FFFBEB', '#FEF3C7']}
                style={styles.alertGradient}
              >
                <Ionicons
                  name={weather.code >= 95 ? 'thunderstorm' : 'warning'}
                  size={20}
                  color={weather.code >= 95 ? '#DC2626' : '#D97706'}
                />
                <Text style={[styles.alertText, { color: weather.code >= 95 ? '#DC2626' : '#92400E' }]}>
                  {weather.code >= 95
                    ? 'Risque d\'orage — Limitez vos déplacements !'
                    : 'Pluie attendue — Prévoyez un imperméable'}
                </Text>
              </LinearGradient>
            </Animated.View>
          )}

          {/* ── PRÉVISIONS 6 JOURS ────────────────────────────────── */}
          <Animated.View style={[styles.section, { opacity: fadeAnim }]}>
            <Text style={styles.sectionTitle}>📅 Prévisions 6 jours</Text>
            <View style={styles.forecastGrid}>
              {weather.forecast.map((day, i) => {
                const dayWmo = getWmo(day.code);
                return (
                  <LinearGradient
                    key={i}
                    colors={[dayWmo.bg, '#FFFFFF']}
                    style={styles.forecastCard}
                  >
                    <Text style={styles.forecastDay}>{day.date}</Text>
                    <Text style={styles.forecastEmoji}>{dayWmo.icon}</Text>
                    <Text style={styles.forecastTempMax}>{day.tempMax}°</Text>
                    <Text style={styles.forecastTempMin}>{day.tempMin}°</Text>
                    {day.rain > 0 && (
                      <View style={styles.forecastRainBadge}>
                        <Text style={styles.forecastRainText}>{day.rain}mm</Text>
                      </View>
                    )}
                  </LinearGradient>
                );
              })}
            </View>
          </Animated.View>

          {/* ── CONSEILS VOYAGE ───────────────────────────────────── */}
          <Animated.View style={[styles.section, { opacity: fadeAnim }]}>
            <Text style={styles.sectionTitle}>🚗 Conseils pour votre trajet</Text>
            {tips.map((tip, i) => (
              <View key={i} style={styles.tipRow}>
                <View style={[styles.tipIconBg, { backgroundColor: tip.color + '20' }]}>
                  <Text style={styles.tipEmoji}>{tip.icon}</Text>
                </View>
                <Text style={styles.tipText}>{tip.text}</Text>
              </View>
            ))}
          </Animated.View>

          {/* ── QUALITÉ DE L'AIR / INFOS SUP ─────────────────────── */}
          <Animated.View style={[styles.section, { opacity: fadeAnim }]}>
            <Text style={styles.sectionTitle}>ℹ️ Informations détaillées</Text>
            <View style={styles.infoGrid}>
              <View style={styles.infoCard}>
                <Text style={styles.infoEmoji}>🌡️</Text>
                <Text style={styles.infoVal}>{weather.temp}°C</Text>
                <Text style={styles.infoLabel}>Température</Text>
              </View>
              <View style={styles.infoCard}>
                <Text style={styles.infoEmoji}>🤔</Text>
                <Text style={styles.infoVal}>{weather.feelsLike}°C</Text>
                <Text style={styles.infoLabel}>Ressenti</Text>
              </View>
              <View style={styles.infoCard}>
                <Text style={styles.infoEmoji}>💧</Text>
                <Text style={styles.infoVal}>{weather.humidity}%</Text>
                <Text style={styles.infoLabel}>Humidité</Text>
              </View>
              <View style={styles.infoCard}>
                <Text style={styles.infoEmoji}>🌬️</Text>
                <Text style={styles.infoVal}>{weather.windSpeed}</Text>
                <Text style={styles.infoLabel}>Vent km/h</Text>
              </View>
            </View>
          </Animated.View>

          <View style={{ height: 30 }} />
        </ScrollView>
      ) : (
        <View style={styles.loadingContainer}>
          <Text style={styles.errorEmoji}>📍</Text>
          <Text style={styles.errorText}>Impossible d'obtenir la météo</Text>
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
    paddingVertical: 16,
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
    fontSize: 20,
    fontWeight: '800',
    color: '#1F2937',
    textAlign: 'center',
  },
  headerSub: {
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  refreshBtn: {
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
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  cityText: {
    fontSize: 15,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.95)',
  },
  mainTempRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    marginBottom: 8,
  },
  bigIcon: {
    fontSize: 80,
  },
  mainTemp: {
    fontSize: 64,
    fontWeight: '900',
    color: '#FFFFFF',
    lineHeight: 72,
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  conditionLabel: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '600',
  },
  feelsLike: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 20,
    fontWeight: '500',
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.3)',
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
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  statIcon: {
    fontSize: 20,
  },
  statVal: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  statLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
  },
  // ── Alert ───────────────────────────────────────────────────
  alertCard: {
    marginBottom: 16,
    borderRadius: 18,
    overflow: 'hidden',
  },
  alertGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 16,
  },
  alertText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
  },
  // ── Section ─────────────────────────────────────────────────
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1F2937',
    marginBottom: 14,
  },
  // ── Forecast Grid ────────────────────────────────────────────
  forecastGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  forecastCard: {
    width: (width - 32 - 30) / 3,
    borderRadius: 18,
    padding: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    gap: 4,
  },
  forecastDay: {
    fontSize: 12,
    fontWeight: '800',
    color: '#374151',
    textTransform: 'uppercase',
  },
  forecastEmoji: {
    fontSize: 28,
    marginVertical: 4,
  },
  forecastTempMax: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111827',
  },
  forecastTempMin: {
    fontSize: 14,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  forecastRainBadge: {
    backgroundColor: '#DBEAFE',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 2,
  },
  forecastRainText: {
    fontSize: 10,
    color: '#2563EB',
    fontWeight: '700',
  },
  // ── Tips ────────────────────────────────────────────────────
  tipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  tipIconBg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tipEmoji: {
    fontSize: 20,
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
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
    borderRadius: 18,
    padding: 18,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    gap: 6,
  },
  infoEmoji: {
    fontSize: 28,
  },
  infoVal: {
    fontSize: 22,
    fontWeight: '900',
    color: '#111827',
  },
  infoLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  // ── Error ───────────────────────────────────────────────────
  errorEmoji: {
    fontSize: 48,
  },
  errorText: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '600',
  },
  retryBtn: {
    backgroundColor: PRIMARY,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
    marginTop: 8,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
