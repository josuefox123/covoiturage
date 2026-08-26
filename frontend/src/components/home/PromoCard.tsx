/**
 * PromoCard — connectée à l'API /promotions/ (ou affiche une bannée par défaut si vide)
 */
import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import { getMediaUrl } from '../../utils/media';

interface Promotion {
  id: string | number;
  title?: string;
  description?: string;
  discount_percent?: number;
  image?: string | null;
}

export default function PromoCard() {
  const { authFetch } = useAuth();
  const scale = useRef(new Animated.Value(1)).current;
  const [promotions, setPromotions] = useState<Promotion[]>([]);

  const fetchPromos = useCallback(async () => {
    try {
      const data = await authFetch('/promotions/');
      const list: Promotion[] = Array.isArray(data) ? data : data?.results || [];
      setPromotions(list.slice(0, 1)); // Show first promo
    } catch {
      // Fail silently – the default banner will show
    }
  }, [authFetch]);

  useEffect(() => {
    fetchPromos();
  }, [fetchPromos]);

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.96, duration: 80, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, tension: 200, friction: 10, useNativeDriver: true }),
    ]).start();
  };

  // If the API returned a promo with an image, show it
  if (promotions.length > 0 && promotions[0].image) {
    const promo = promotions[0];
    const imageUrl = getMediaUrl(promo.image);
    return (
      <View style={styles.container}>
        <Animated.View style={{ transform: [{ scale }] }}>
          <TouchableOpacity activeOpacity={0.9} onPress={handlePress} style={{ borderRadius: 20, overflow: 'hidden' }}>
            <Image source={{ uri: imageUrl }} style={styles.promoImage} resizeMode="cover" />
          </TouchableOpacity>
        </Animated.View>
      </View>
    );
  }

  // Default gradient promo banner
  const promo = promotions[0];

  return (
    <View style={styles.container}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <TouchableOpacity activeOpacity={0.95} onPress={handlePress}>
          <LinearGradient
            colors={['#059669', '#047857']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.card}
          >
            <View style={styles.blob} />
            <View style={styles.blob2} />
            <View style={styles.left}>
              <View style={styles.badge}>
                <Ionicons name="gift" size={12} color="#059669" />
                <Text style={styles.badgeText}>Promotion</Text>
              </View>
              <Text style={styles.discountText}>
                {promo?.discount_percent != null ? `-${promo.discount_percent}%` : '-10%'}
              </Text>
              <Text style={styles.descText}>
                {promo?.description || 'sur votre premier trajet'}
              </Text>
            </View>
            <View style={styles.right}>
              <TouchableOpacity style={styles.btn} onPress={handlePress} activeOpacity={0.85}>
                <Text style={styles.btnText}>Profiter</Text>
                <Ionicons name="arrow-forward" size={14} color="#059669" />
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  promoImage: { width: '100%', height: 140, borderRadius: 20 },
  card: {
    borderRadius: 16,
    padding: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  blob: {
    position: 'absolute', width: 140, height: 140, borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.08)', top: -40, right: -20,
  },
  blob2: {
    position: 'absolute', width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.06)', bottom: -30, left: 80,
  },
  left: { flex: 1 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#FFFFFF', paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 20, alignSelf: 'flex-start', marginBottom: 8,
  },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#059669' },
  discountText: {
    fontSize: 38, fontWeight: '900', color: '#FFFFFF',
    lineHeight: 42, letterSpacing: -1,
  },
  descText: { fontSize: 13, color: 'rgba(255,255,255,0.9)', fontWeight: '500' },
  right: { alignItems: 'flex-end' },
  btn: {
    backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center',
    gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12, shadowRadius: 8, elevation: 4,
  },
  btnText: { fontSize: 14, fontWeight: '700', color: '#059669' },
});
