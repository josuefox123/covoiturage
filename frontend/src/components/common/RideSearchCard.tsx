/**
 * ==============================================================
 * Fichier :
 * RideSearchCard.tsx
 *
 * Description :
 * Composant ou logique de l'application Zemy.
 *
 * Projet :
 * Zemy
 * ==============================================================
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../theme';
import { Ride } from '../../types/ride';
import ProfileAvatar from './ProfileAvatar';

const PRIMARY_COLOR = theme.colors.primary;

export interface RideSearchCardProps {
  ride: Ride;
  onPress: () => void;
  index?: number;
  animated?: boolean;
}

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

/**
 * Composant RideSearchCard.
 *
 * Responsabilités :
 * - Affichage et gestion de l'état lié à RideSearchCard.
 */
export default function RideSearchCard({ ride, onPress, index = 0, animated = true }: RideSearchCardProps) {
  const fadeAnim = useRef(new Animated.Value(animated ? 0 : 1)).current;
  const translateY = useRef(new Animated.Value(animated ? 30 : 0)).current;

  useEffect(() => {
    if (animated) {
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
    }
  }, [animated, index]);

  const driverName = ride.driver_details?.full_name || 'Conducteur';
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
              <ProfileAvatar name={driverName} url={ride.driver_details?.photo} size={48} showBorder={false} />
              <View style={{ marginLeft: 12 }}>
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
              <Ionicons name={ride.status === 'started' || ride.status === 'completed' ? "car-sport-outline" : "people-outline"} size={14} color={PRIMARY_COLOR} />
              <Text style={styles.seatsText}>
                {ride.status === 'started' ? 'En cours' : ride.status === 'completed' ? 'Terminé' : `${seatsLeft} place${seatsLeft > 1 ? 's' : ''} disponible${seatsLeft > 1 ? 's' : ''}`}
              </Text>
              {ride.accepts_parcels && (
                <View style={{flexDirection: 'row', alignItems: 'center', marginLeft: 12, backgroundColor: '#ECFDF5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6}}>
                  <Ionicons name="cube-outline" size={14} color="#10B981" />
                  <Text style={{fontSize: 12, color: '#10B981', marginLeft: 4, fontWeight: '700'}}>Colis</Text>
                </View>
              )}
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
}

const styles = StyleSheet.create({
  rideCardWrapper: {
    marginBottom: 16,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 4,
  },
  rideCard: {
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  rideHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  driverSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  driverName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    marginLeft: 4,
  },
  reviewCount: {
    fontSize: 12,
    color: '#9CA3AF',
    marginLeft: 4,
  },
  priceSection: {
    alignItems: 'flex-end',
  },
  priceValue: {
    fontSize: 22,
    fontWeight: '800',
    color: PRIMARY_COLOR,
  },
  priceUnit: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
    marginTop: -2,
  },
  routeSection: {
    flexDirection: 'row',
    marginBottom: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  timeline: {
    width: 24,
    alignItems: 'center',
    marginRight: 12,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 4,
    borderRadius: 1,
  },
  routeDetails: {
    flex: 1,
    justifyContent: 'space-between',
  },
  routePoint: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    minHeight: 32,
  },
  locationName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
    marginRight: 12,
  },
  routeTime: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  routeDate: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  rideFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  seatsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  seatsText: {
    fontSize: 13,
    fontWeight: '600',
    color: PRIMARY_COLOR,
    marginLeft: 6,
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: PRIMARY_COLOR,
    marginRight: 4,
  },
});
