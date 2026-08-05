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
  searchedDeparture?: string;
  searchedDestination?: string;
  searchedSeats?: number;
}

const extractCity = (locStr: string | undefined): string => {
  if (!locStr) return '';
  const parts = locStr.replace(/\//g, ',').split(',').map((p) => p.trim());
  const ignore = new Set(['bénin', 'benin', 'togo', 'nigeria', 'ghana', 'burkina', 'france']);
  const cleanParts = parts.filter((p) => p && !ignore.has(p.toLowerCase()));
  return cleanParts.length ? cleanParts[cleanParts.length - 1].toLowerCase() : (parts[0] || '').toLowerCase();
};

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
export default function RideSearchCard({
  ride,
  onPress,
  index = 0,
  animated = true,
  searchedDeparture,
  searchedDestination,
  searchedSeats,
}: RideSearchCardProps) {
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
  
  const calcCommission = (driverPayout: number) => {
    const pct = 10;
    const minC = 100;
    let comm = Math.floor(driverPayout * (pct / 100));
    if (comm < minC) comm = minC;
    return comm;
  };

  const getDisplayPrice = () => {
    const isSegment = searchedDeparture && searchedDestination && (ride.price_per_seat !== ride.original_price_per_seat);
    if (isSegment) {
      const comm = calcCommission(ride.price_per_seat);
      return ride.price_per_seat + comm;
    }
    return ride.original_price_per_seat ?? ride.price_per_seat;
  };

  const price = getDisplayPrice().toLocaleString() || '0';
  const priceUnit = 'par place';
  const departureTime = ride.departure_time?.substring(0, 5) || '--:--';
  const seatsLeft = ride.seats_available || 0;

  // Déterminer si le départ recherché est un arrêt intermédiaire dans une autre ville
  let displayDeparture = ride.departure_location || 'Départ';
  let isIntermediatePickup = false;
  if (searchedDeparture) {
    const searchDepCity = extractCity(searchedDeparture);
    const rideDepCity = extractCity(ride.departure_location);
    if (searchDepCity && rideDepCity && searchDepCity !== rideDepCity) {
      displayDeparture = searchedDeparture;
      isIntermediatePickup = true;
    }
  }

  // Déterminer si l'arrivée recherchée est un arrêt intermédiaire dans une autre ville
  let displayArrival = ride.arrival_location || 'Arrivée';
  let isIntermediateDropoff = false;
  if (searchedDestination) {
    const searchDestCity = extractCity(searchedDestination);
    const rideDestCity = extractCity(ride.arrival_location);
    if (searchDestCity && rideDestCity && searchDestCity !== rideDestCity) {
      displayArrival = searchedDestination;
      isIntermediateDropoff = true;
    }
  }

  const isSegment = !!(ride.price_per_seat && ride.original_price_per_seat && ride.price_per_seat !== ride.original_price_per_seat);
  const isIntermediate = !!(
    (searchedDeparture && (extractCity(searchedDeparture) !== extractCity(ride.departure_location))) ||
    (searchedDestination && (extractCity(searchedDestination) !== extractCity(ride.arrival_location))) ||
    isSegment
  );

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
              <ProfileAvatar name={driverName} url={ride.driver_details?.avatar} size={48} showBorder={false} />
              <View style={styles.driverMeta}>
                <Text style={styles.driverName} numberOfLines={1}>{driverName}</Text>
                <View style={styles.ratingContainer}>
                  {ride.driver_details?.rating ? (
                    <>
                      <Ionicons name="star" size={12} color="#F59E0B" />
                      <Text style={styles.ratingText}>
                        {Number(ride.driver_details.rating).toFixed(1)}
                      </Text>
                    </>
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle" size={12} color="#16A34A" />
                      <Text style={[styles.ratingText, { color: '#16A34A', fontWeight: '700' }]}>Vérifié</Text>
                    </>
                  )}
                  <Text style={styles.reviewCount} numberOfLines={1}>
                    • {ride.driver_details?.rides_count ?? 0} trajet{(ride.driver_details?.rides_count ?? 0) > 1 ? 's' : ''}
                  </Text>
                </View>
              </View>
            </View>
            <View style={styles.priceSection}>
              {isIntermediate ? (
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.priceValue, { fontSize: 13, color: '#D97706', fontWeight: '800' }]}>À confirmer</Text>
                  <Text style={{ fontSize: 10, color: '#9CA3AF', fontWeight: '600', marginTop: 2 }}>
                    avec le chauffeur
                  </Text>
                </View>
              ) : (
                <>
                  <Text style={styles.priceValue}>{price} FCFA</Text>
                  <Text style={styles.priceUnit}>{priceUnit}</Text>
                </>
              )}
            </View>
          </View>

          {/* Date de départ */}
          <View style={styles.dateBar}>
            <Ionicons name="calendar-outline" size={14} color={PRIMARY_COLOR} />
            <Text style={styles.dateText}>
              {formatFullDate(ride.departure_date)}
            </Text>
          </View>

          {/* Trajet */}
          <View style={styles.routeSection}>
            <View style={styles.timeline}>
              <View style={[styles.timelineDot, { backgroundColor: PRIMARY_COLOR }]} />
              <View style={styles.timelineLine} />
              <View style={[styles.timelineDot, { backgroundColor: '#10B981' }]} />
            </View>
            <View style={styles.routeDetails}>
              {/* Point de départ */}
              <View style={styles.routePoint}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.locationLabel}>DÉPART</Text>
                  <Text style={styles.locationName} numberOfLines={1}>
                    {displayDeparture}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
                  <Text style={styles.routeTime}>{departureTime}</Text>
                </View>
              </View>
              
              <View style={{ height: 16 }} />
              
              {/* Point d'arrivée */}
              <View style={styles.routePoint}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.locationLabel}>ARRIVÉE</Text>
                  <Text style={styles.locationName} numberOfLines={1}>
                    {displayArrival}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Stopovers List */}
          {ride.stopovers && Array.isArray(ride.stopovers) && ride.stopovers.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 8, marginBottom: 12, paddingLeft: 18 }}>
              <Ionicons name="location-outline" size={12} color="#D97706" />
              <Text style={{ fontSize: 11, fontWeight: '600', color: '#6B7280' }}>Via :</Text>
              {ride.stopovers.map((stop: any, idx: number) => (
                <View key={idx} style={{ backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, borderWidth: 1, borderColor: '#FDE68A' }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: '#D97706' }}>{stop.name}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Bannière d'arrêt intermédiaire */}
          {(isIntermediatePickup || isIntermediateDropoff) && (
            <View style={styles.intermediateBanner}>
              <View style={styles.intermediateBannerLeft}>
                <Ionicons name="information-circle" size={15} color="#D97706" />
                <Text style={styles.intermediateBannerNB}>NB</Text>
              </View>
              <Text style={styles.intermediateBannerText}>
                {isIntermediatePickup && isIntermediateDropoff
                  ? `Arrêts intermédiaires sur le trajet ${ride.departure_location} ➔ ${ride.arrival_location}`
                  : isIntermediatePickup
                    ? `Votre départ n'est pas l'origine du trajet (Départ initial : ${ride.departure_location})`
                    : `Votre arrivée n'est pas la destination finale (Destination : ${ride.arrival_location})`}
              </Text>
            </View>
          )}

          {/* Footer avec places dispo et type de véhicule */}
          <View style={styles.rideFooter}>
            <View style={styles.badgesContainer}>
              {searchedSeats && seatsLeft < searchedSeats ? (
                <View style={styles.warningSeatsBadge}>
                  <Ionicons name="warning-outline" size={13} color="#DC2626" />
                  <Text style={styles.warningSeatsText}>
                    {seatsLeft} place{seatsLeft > 1 ? 's' : ''} dispo.
                  </Text>
                </View>
              ) : (
                <View style={styles.seatsContainer}>
                  <Ionicons 
                    name={ride.status === 'started' || ride.status === 'completed' ? "car-sport-outline" : "people-outline"} 
                    size={14} 
                    color={PRIMARY_COLOR} 
                  />
                  <Text style={styles.seatsText}>
                    {ride.status === 'started' 
                      ? 'En cours' 
                      : ride.status === 'completed' 
                        ? 'Terminé' 
                        : seatsLeft > 0 
                          ? `${seatsLeft} place${seatsLeft > 1 ? 's' : ''}` 
                          : 'Complet'}
                  </Text>
                </View>
              )}

              {/* Badge type de véhicule (Voiture, Moto, Tricycle) */}
              {(() => {
                const vType = (ride.driver_details?.vehicles?.[0]?.vehicle_type || (ride as any).vehicle_type || 'voiture').toLowerCase();
                const label = vType === 'moto' ? 'Moto' : vType === 'tricycle' ? 'Tricycle' : 'Voiture';
                const icon = vType === 'moto' ? 'bicycle-outline' : vType === 'tricycle' ? 'car-sport-outline' : 'car-outline';
                return (
                  <View style={styles.vehicleBadgeContainer}>
                    <Ionicons name={icon} size={13} color="#4B5563" />
                    <Text style={styles.vehicleBadgeText}>{label}</Text>
                  </View>
                );
              })()}

              {/* Badge Kilométrage et Durée */}
              {ride.distance_km ? (
                <View style={styles.vehicleBadgeContainer}>
                  <Ionicons name="map-outline" size={13} color="#4B5563" />
                  <Text style={styles.vehicleBadgeText}>
                    {ride.distance_km} km
                    {ride.duration_min ? ` (${Math.floor(ride.duration_min / 60) > 0 ? `${Math.floor(ride.duration_min / 60)}h` : ''}${ride.duration_min % 60}m)` : ''}
                  </Text>
                </View>
              ) : null}
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
    alignItems: 'center',
    marginBottom: 16,
  },
  driverSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  driverMeta: {
    flex: 1,
    marginLeft: 12,
    marginRight: 4,
  },
  driverName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
    marginLeft: 3,
  },
  reviewCount: {
    fontSize: 11,
    color: '#9CA3AF',
    marginLeft: 3,
    flexShrink: 1,
  },
  priceSection: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingLeft: 4,
  },
  priceValue: {
    fontSize: 18,
    fontWeight: '900',
    color: PRIMARY_COLOR,
  },
  priceUnit: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '600',
    marginTop: 1,
  },
  dateBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginBottom: 16,
    gap: 8,
  },
  dateText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
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
  },
  routePoint: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  locationLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9CA3AF',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  locationName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
    marginRight: 12,
  },
  routeTime: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  rideFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  badgesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    flexWrap: 'wrap',
    gap: 8,
    marginRight: 8,
  },
  seatsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  seatsText: {
    fontSize: 12,
    fontWeight: '600',
    color: PRIMARY_COLOR,
    marginLeft: 4,
  },
  parcelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  parcelBadgeText: {
    fontSize: 12,
    color: '#10B981',
    marginLeft: 4,
    fontWeight: '700',
  },
  vehicleBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  vehicleBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#374151',
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
  viewButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: PRIMARY_COLOR,
    marginRight: 4,
  },
  intermediateBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FCD34D',
    gap: 10,
  },
  intermediateBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingTop: 1,
  },
  intermediateBannerNB: {
    fontSize: 11,
    fontWeight: '900',
    color: '#D97706',
    letterSpacing: 0.5,
  },
  intermediateBannerText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#78350F',
    flex: 1,
    lineHeight: 17,
  },
  warningSeatsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  warningSeatsText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
  },
});
