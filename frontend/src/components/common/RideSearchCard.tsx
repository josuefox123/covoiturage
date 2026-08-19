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
  /* Commenté pour afficher le trajet initial du conducteur au lieu de la recherche
  if (searchedDeparture) {
    const searchDepCity = extractCity(searchedDeparture);
    const rideDepCity = extractCity(ride.departure_location);
    if (searchDepCity && rideDepCity && searchDepCity !== rideDepCity) {
      displayDeparture = searchedDeparture;
      isIntermediatePickup = true;
    }
  }
  */

  // Déterminer si l'arrivée recherchée est un arrêt intermédiaire dans une autre ville
  let displayArrival = ride.arrival_location || 'Arrivée';
  let isIntermediateDropoff = false;
  /* Commenté pour afficher le trajet initial du conducteur au lieu de la recherche
  if (searchedDestination) {
    const searchDestCity = extractCity(searchedDestination);
    const rideDestCity = extractCity(ride.arrival_location);
    if (searchDestCity && rideDestCity && searchDestCity !== rideDestCity) {
      displayArrival = searchedDestination;
      isIntermediateDropoff = true;
    }
  }
  */

  const isSegment = !!(ride.price_per_seat && ride.original_price_per_seat && ride.price_per_seat !== ride.original_price_per_seat);
  // Trajet intermédiaire : la ville recherchée diffère de la ville de départ/arrivée du conducteur
  const isIntermediate = !!(
    (searchedDeparture && (extractCity(searchedDeparture) !== extractCity(ride.departure_location))) ||
    (searchedDestination && (extractCity(searchedDestination) !== extractCity(ride.arrival_location))) ||
    isSegment
  );

  const getArrivalTime = () => getArrivalTimeHelper(ride.departure_time, ride.duration_min);
  const getDurationText = () => getDurationTextHelper(ride.duration_min);
  const arrivalTime = getArrivalTime();
  const durationText = getDurationText();

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
      <TouchableOpacity onPress={onPress} activeOpacity={0.95}>
        <View style={styles.rideCard}>
          {/* Main Row : Timeline à gauche, Prix à droite */}
          <View style={styles.mainRow}>
            <View style={styles.routeContainer}>
              {/* Colonne des heures et durées */}
              <View style={styles.timeColumn}>
                <Text style={styles.timeText}>{departureTime}</Text>
                {durationText ? <Text style={styles.durationText}>{durationText}</Text> : <View style={{ height: 20 }} />}
                <Text style={styles.timeText}>{arrivalTime}</Text>
              </View>

              {/* Colonne de la ligne de timeline */}
              <View style={styles.timelineColumn}>
                <View style={[styles.timelineDot, { borderColor: PRIMARY_COLOR }]} />
                <View style={[styles.timelineLine, { backgroundColor: PRIMARY_COLOR }]} />
                <View style={[styles.timelineDot, { borderColor: '#10B981' }]} />
              </View>

              {/* Colonne des villes */}
              <View style={styles.cityColumn}>
                <Text style={styles.cityText} numberOfLines={1}>
                  {displayDeparture}
                </Text>
                <View style={{ height: 18 }} />
                <Text style={styles.cityText} numberOfLines={1}>
                  {displayArrival}
                </Text>
              </View>
            </View>

            {/* Zone de prix */}
            <View style={styles.priceContainer}>
              {isIntermediate ? (
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.priceText, { fontSize: 13, color: '#D97706', fontWeight: '800' }]}>À confirmer</Text>
                  <Text style={{ fontSize: 9, color: '#9CA3AF', fontWeight: '600', marginTop: 2 }}>
                    avec le chauffeur
                  </Text>
                </View>
              ) : (
                <>
                  <Text style={styles.priceText}>{price} FCFA</Text>
                  <Text style={styles.priceSub}>{priceUnit}</Text>
                </>
              )}
            </View>
          </View>

          {/* Date de départ sous forme de badge discret */}
          <View style={styles.dateBarSimple}>
            <Ionicons name="calendar-outline" size={12} color="#64748B" />
            <Text style={styles.dateTextSimple}>
              {formatFullDate(ride.departure_date)}
            </Text>
          </View>



          {/* Séparateur horizontal */}
          <View style={styles.divider} />

          {/* Bottom Row : Conducteur, Étoiles et Icônes de confort */}
          <View style={styles.driverRow}>
            <View style={styles.driverLeft}>
              {/* Type de véhicule à gauche */}
              {(() => {
                const vType = (ride.driver_details?.vehicles?.[0]?.vehicle_type || (ride as any).vehicle_type || 'voiture').toLowerCase();
                const icon = vType === 'moto' ? 'bicycle-outline' : vType === 'tricycle' ? 'car-sport-outline' : 'car-outline';
                return <Ionicons name={icon} size={18} color="#64748B" style={{ marginRight: 2 }} />;
              })()}

              <ProfileAvatar name={driverName} url={ride.driver_details?.avatar} size={32} showBorder={false} />
              
              <View style={styles.driverInfoStack}>
                <Text style={styles.driverNameText}>{driverName}</Text>
                <View style={styles.ratingRow}>
                  <Ionicons name="star" size={11} color="#EAB308" />
                  <Text style={styles.ratingText}>
                    {ride.driver_details?.rating ? Number(ride.driver_details.rating).toFixed(1) : '5.0'}
                  </Text>
                  {(ride.driver_details?.rides_count ?? 0) > 10 && (
                    <View style={styles.superDriverBadge}>
                      <Text style={styles.superDriverText}>Super Chauffeur</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>

            {/* Badges de confort (Places dispo, etc.) */}
            <View style={styles.driverRight}>
              {searchedSeats !== undefined && searchedSeats > 0 && seatsLeft < searchedSeats ? (
                <View style={styles.warningSeatsBadge}>
                  <Ionicons name="warning-outline" size={12} color="#DC2626" />
                  <Text style={styles.warningSeatsText}>
                    {seatsLeft} pl.
                  </Text>
                </View>
              ) : (
                <View style={styles.seatsBadge}>
                  <Ionicons 
                    name={ride.status === 'started' || ride.status === 'completed' ? "car-sport-outline" : "people-outline"} 
                    size={13} 
                    color={PRIMARY_COLOR} 
                  />
                  <Text style={styles.seatsText}>
                    {ride.status === 'started' 
                      ? 'En cours' 
                      : ride.status === 'completed' 
                        ? 'Terminé' 
                        : seatsLeft > 0 
                          ? `${seatsLeft} pl.` 
                          : 'Complet'}
                  </Text>
                </View>
              )}

              {/* Éclat ou réservation instantanée */}
              <Ionicons name="flash" size={16} color="#EAB308" />
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// Fonction de calcul de l'heure d'arrivée
function getArrivalTimeHelper(depTime: string | undefined, durationMin: number | undefined) {
  if (!depTime) return '--:--';
  try {
    const [h, m] = depTime.split(':').map(Number);
    const duration = durationMin || 0;
    const totalMinutes = h * 60 + m + duration;
    const arrH = Math.floor(totalMinutes / 60) % 24;
    const arrM = totalMinutes % 60;
    return `${String(arrH).padStart(2, '0')}:${String(arrM).padStart(2, '0')}`;
  } catch (e) {
    return '--:--';
  }
}

// Fonction de formatage de la durée
function getDurationTextHelper(durationMin: number | undefined) {
  if (!durationMin) return '';
  const h = Math.floor(durationMin / 60);
  const m = durationMin % 60;
  return h > 0 ? `${h}h${m > 0 ? String(m).padStart(2, '0') : ''}` : `${m}min`;
}

const styles = StyleSheet.create({
  rideCardWrapper: {
    marginBottom: 12,
    marginHorizontal: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 3,
  },
  rideCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
  },
  mainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  routeContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  timeColumn: {
    width: 48,
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  timeText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  durationText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
    marginVertical: 4,
  },
  timelineColumn: {
    width: 16,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 2,
    backgroundColor: '#FFFFFF',
  },
  timelineLine: {
    width: 2,
    flex: 1,
    marginVertical: 2,
    borderRadius: 1,
  },
  cityColumn: {
    flex: 1,
    paddingLeft: 10,
    justifyContent: 'space-between',
    paddingVertical: 1,
  },
  cityText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
    lineHeight: 18,
  },
  priceContainer: {
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    marginLeft: 10,
  },
  priceText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  priceSub: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 2,
  },
  dateBarSimple: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
    paddingLeft: 2,
  },
  dateTextSimple: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  stopoversContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
    paddingLeft: 2,
  },
  stopoversLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  stopoverChip: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  stopoverText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#D97706',
  },
  intermediateBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 10,
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
    fontSize: 11,
    fontWeight: '500',
    color: '#78350F',
    flex: 1,
    lineHeight: 16,
  },
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 8,
  },
  driverRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
  },
  driverLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  driverInfoStack: {
    flexDirection: 'column',
  },
  driverNameText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 1,
  },
  ratingText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  superDriverBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
    marginLeft: 6,
  },
  superDriverText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  driverRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  warningSeatsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 4,
  },
  warningSeatsText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
  },
  seatsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  seatsText: {
    fontSize: 11,
    fontWeight: '600',
    color: PRIMARY_COLOR,
    marginLeft: 4,
  },
});
