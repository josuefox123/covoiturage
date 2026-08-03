import React, { useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Linking } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../../src/context/AuthContext';
import { useBooking } from '../../../src/hooks/useBooking';
import { CustomAlert } from '../../../src/utils/CustomAlert';
import { getRideAction } from '../../../src/utils/bookingState';

// Subcomponents & Hooks
import { useRideDetails } from './hooks/useRideDetails';
import { RideMap } from './components/RideMap';
import { StopoverTimeline } from './components/StopoverTimeline';
import { DriverCard } from './components/DriverCard';
import { PassengerCard } from './components/PassengerCard';
import { BookingConfirmModal } from './modals/BookingConfirmModal';
import { BookingSuccessModal } from './modals/BookingSuccessModal';
import { PassengerNegotiationModal } from './modals/PassengerNegotiationModal';

const COLORS = {
  primary: '#2F80ED',
  success: '#16A34A',
  error: '#DC2626',
  warning: '#F59E0B',
  white: '#FFFFFF',
  background: '#F9FAFB',
  card: '#FFFFFF',
  text: '#1F2937',
  textLight: '#6B7280',
  border: '#E5E7EB',
  grayLight: '#F3F4F6',
  primaryLight: '#EFF6FF',
};

export default function RideDetailScreen() {
  const { 
    id, 
    departure, 
    destination, 
    passenger_dep_lat, 
    passenger_dep_lon, 
    passenger_arr_lat, 
    passenger_arr_lon,
    dep_waypoint_order,
    arr_waypoint_order 
  } = useLocalSearchParams<{
    id: string;
    departure?: string;
    destination?: string;
    passenger_dep_lat?: string;
    passenger_dep_lon?: string;
    passenger_arr_lat?: string;
    passenger_arr_lon?: string;
    dep_waypoint_order?: string;
    arr_waypoint_order?: string;
  }>();

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { authFetch, user } = useAuth();
  const { createBooking } = useBooking();

  const {
    ride,
    loading,
    refreshing,
    hasBooked,
    bookingId,
    myBooking,
    bookings,
    bookingLoading,
    chatLoading,
    bookingState,
    portionMetrics,
    onRefresh,
    openChat,
    handleChatWithPassenger,
    performBooking,
    handlePassengerAccept,
    handlePassengerReject,
    handleCancelBooking,
    fetchRide,
  } = useRideDetails(
    id as string,
    departure,
    destination,
    passenger_dep_lat,
    passenger_dep_lon,
    passenger_arr_lat,
    passenger_arr_lon,
    dep_waypoint_order,
    arr_waypoint_order,
    authFetch,
    user,
    createBooking
  );

  const [showBookingConfirmModal, setShowBookingConfirmModal] = useState(false);
  const [showBookingSuccessModal, setShowBookingSuccessModal] = useState(false);
  const [showPassengerNegotiationModal, setShowPassengerNegotiationModal] = useState(false);

  const getIsIntermediate = () => {
    if (!ride) return false;
    const isSegment = !!(ride.price_per_seat && (ride as any).original_price_per_seat && ride.price_per_seat !== (ride as any).original_price_per_seat);
    if (isSegment) return true;

    if (departure) {
      const startClean = departure.split(',')[0].trim().toLowerCase();
      const rideStartClean = ride.departure_location.split(',')[0].trim().toLowerCase();
      if (startClean !== rideStartClean) return true;
    }
    if (destination) {
      const endClean = destination.split(',')[0].trim().toLowerCase();
      const rideEndClean = ride.arrival_location.split(',')[0].trim().toLowerCase();
      if (endClean !== rideEndClean) return true;
    }
    
    if (myBooking && myBooking.departure_location && myBooking.arrival_location) {
      const startClean = myBooking.departure_location.split(',')[0].trim().toLowerCase();
      const endClean = myBooking.arrival_location.split(',')[0].trim().toLowerCase();
      const rideStartClean = ride.departure_location.split(',')[0].trim().toLowerCase();
      const rideEndClean = ride.arrival_location.split(',')[0].trim().toLowerCase();
      if (startClean !== rideStartClean || endClean !== rideEndClean) {
        return true;
      }
    }
    return false;
  };

  const getHaversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  let approachText = '';
  if (departure && passenger_dep_lat && passenger_dep_lon && ride?.departure_latitude && ride?.departure_longitude) {
    const lat1 = parseFloat(passenger_dep_lat);
    const lon1 = parseFloat(passenger_dep_lon);
    const lat2 = parseFloat(ride.departure_latitude as any);
    const lon2 = parseFloat(ride.departure_longitude as any);
    if (!isNaN(lat1) && !isNaN(lon1) && !isNaN(lat2) && !isNaN(lon2)) {
      const dist = getHaversineDistance(lat2, lon2, lat1, lon1);
      if (dist > 0.5) {
        const durationMin = Math.max(1, Math.round((dist / 30.0) * 60.0));
        approachText = `Le conducteur débute son trajet à ${ride.departure_location.split(',')[0]}. Vous le rejoindrez en chemin à ${departure.split(',')[0]} (environ ${dist.toFixed(1)} km du départ initial, soit ~${durationMin} min en moto/voiture).`;
      }
    }
  }

  const handleBooking = () => {
    if (bookingLoading || hasBooked) return;
    if (!user?.is_verified) {
      CustomAlert.alert('Compte non vérifié', 'Votre compte doit être vérifié pour effectuer une réservation.');
      return;
    }
    setShowBookingConfirmModal(true);
  };

  const handleRetryPayment = () => {
    if (!bookingId || !myBooking) return;
    const amount = (myBooking as any).portion_price || myBooking.amount_paid_online || (ride ? ride.price_per_seat : 0);
    router.push({
      pathname: '/payment',
      params: {
        booking_id: String(bookingId),
        amount: String(amount)
      }
    });
  };

  const handleCancel = () => {
    CustomAlert.alert(
      'Annuler ma réservation',
      'Voulez-vous vraiment annuler votre réservation ? Cette action libérera immédiatement votre place.\n\nRappel : la commission de réservation n\'est généralement pas remboursable.',
      [
        { text: 'Non, garder', style: 'cancel' },
        {
          text: 'Oui, annuler',
          style: 'destructive',
          onPress: () => {
            setTimeout(() => {
              CustomAlert.alert(
                'Confirmation définitive',
                'Le conducteur en sera notifié. Selon le délai, une demande de remboursement sera automatiquement générée si vous y êtes éligible.',
                [
                  { text: 'Retour', style: 'cancel' },
                  {
                    text: 'Confirmer l\'annulation',
                    style: 'destructive',
                    onPress: async () => {
                      await handleCancelBooking();
                    }
                  }
                ]
              );
            }, 500);
          }
        }
      ]
    );
  };

  if (loading || !ride) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <ActivityIndicator color={COLORS.primary} size="large" />
        <Text style={{ color: COLORS.textLight, fontSize: 15, fontWeight: '600', marginTop: 12 }}>
          Chargement du trajet...
        </Text>
      </SafeAreaView>
    );
  }

  const driverName = ride.driver_details?.full_name || 'Inconnu';
  const isOwnRide = user?.id === ride.driver_details?.id;
  const canChat = hasBooked || isOwnRide;
  const isCompleted = ride.status === 'completed';
  const isStarted = ride.status === 'started';
  const rideAction = getRideAction(bookingState);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.dragHandler}>
        <View style={styles.dragBar} />
      </View>

      <View style={styles.header}>
        <TouchableOpacity activeOpacity={0.85} style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="close" size={26} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Détails du trajet</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
        }
      >
        <RideMap
          ride={ride}
          passenger_dep_lat={passenger_dep_lat}
          passenger_dep_lon={passenger_dep_lon}
          passenger_arr_lat={passenger_arr_lat}
          passenger_arr_lon={passenger_arr_lon}
          departure={departure}
          destination={destination}
        />

        <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
          {isCompleted && (
            <View style={styles.completedBadge}>
              <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
              <Text style={styles.completedText}>Trajet terminé</Text>
            </View>
          )}

          {isStarted && (
            <View style={[styles.completedBadge, { backgroundColor: '#EFF6FF' }]}>
              <Ionicons name="car-sport" size={20} color={COLORS.primary} />
              <Text style={[styles.completedText, { color: COLORS.primary }]}>Trajet en cours</Text>
            </View>
          )}

          <Text style={styles.dateText}>
            {new Date(ride.departure_date).toLocaleDateString('fr-FR', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric'
            })}
          </Text>

          {/* Portion de voyage recherchée */}
          {departure && destination && !isOwnRide && !hasBooked && (
            <View style={[styles.card, { borderColor: COLORS.primary, borderWidth: 1.5, marginBottom: 16, overflow: 'hidden' }]}>
              <View style={styles.portionHeader}>
                <Ionicons name="car-outline" size={18} color={COLORS.primary} />
                <Text style={styles.portionHeaderText}>
                  VOTRE PORTION DE VOYAGE (SÉLECTIONNÉE)
                </Text>
              </View>
              <View style={{ padding: 16 }}>
                <View style={styles.timelineItem}>
                  <View style={[styles.timelineDotStart, { backgroundColor: COLORS.success }]} />
                  <View style={styles.timelineContent}>
                    <Text style={[styles.locationText, { fontWeight: '700' }]}>{departure}</Text>
                    <Text style={{ fontSize: 11, color: COLORS.success, fontWeight: '700', marginTop: 2 }}>
                      VOTRE EMBARQUEMENT (Rendez-vous){bookingState?.estimated_departure_time ? ` · Passage estimé à ${bookingState.estimated_departure_time}` : ''}
                    </Text>
                  </View>
                </View>
                
                <View style={styles.timelineLink}>
                  <View style={[styles.timelineLine, { backgroundColor: COLORS.primary }]} />
                  <Text style={styles.distanceText}> Portion covoiturage · Prix ajusté</Text>
                </View>

                {portionMetrics && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 24, marginBottom: 12 }}>
                    <Ionicons name="git-commit-outline" size={16} color={COLORS.textLight} />
                    <Text style={{ fontSize: 13, color: COLORS.textLight, fontWeight: '600' }}>
                      Portion : {portionMetrics.distanceKm} km (~{portionMetrics.durationMin} min de route)
                    </Text>
                  </View>
                )}

                {approachText ? (
                  <View style={styles.approachBox}>
                    <Ionicons name="information-circle-outline" size={18} color={COLORS.primary} style={{ marginTop: 1 }} />
                    <Text style={{ fontSize: 12, color: '#1E40AF', flex: 1, lineHeight: 16 }}>
                      {approachText}
                    </Text>
                  </View>
                ) : null}
                
                <View style={styles.timelineItem}>
                  <Ionicons name="location" size={20} color={COLORS.error} style={styles.timelineIconEnd} />
                  <View style={styles.timelineContent}>
                    <Text style={[styles.locationText, { fontWeight: '700' }]}>{destination}</Text>
                    <Text style={{ fontSize: 11, color: COLORS.error, fontWeight: '700', marginTop: 2 }}>
                      VOTRE ARRIVÉE (Dépose)
                    </Text>
                  </View>
                </View>

                <View style={[styles.divider, { marginVertical: 12 }]} />

                <View style={{ marginVertical: 6 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: COLORS.text }}>Tarif portion :</Text>
                    <Text style={{ fontSize: 18, fontWeight: '800', color: '#D97706' }}>
                      À confirmer
                    </Text>
                  </View>
                  <Text style={{ fontSize: 11, color: COLORS.textLight, marginTop: 4, textAlign: 'right', fontWeight: '600' }}>
                    Le conducteur proposera le tarif après votre demande
                  </Text>
                </View>

                <View style={[styles.divider, { marginVertical: 12 }]} />

                <View style={styles.warningBox}>
                  <Ionicons name="information-circle" size={20} color="#D97706" style={{ marginTop: 1 }} />
                  <Text style={{ fontSize: 12, color: '#B45309', flex: 1, lineHeight: 16 }}>
                    <Text style={{ fontWeight: '700' }}>Étape de validation requise : </Text>
                    Votre demande de réservation sera transmise à {driverName} pour approbation. Vous ne réglerez le tarif en ligne qu'après son acceptation.
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Trajet direct de bout en bout */}
          {(!departure || !destination) && !isOwnRide && !hasBooked && (
            <View style={[styles.card, { borderColor: COLORS.primary, borderWidth: 1.5, marginBottom: 16, overflow: 'hidden' }]}>
              <View style={styles.portionHeader}>
                <Ionicons name="car-outline" size={18} color={COLORS.primary} />
                <Text style={styles.portionHeaderText}>
                  VOTRE TRAJET DE COVOITURAGE (COMPLET)
                </Text>
              </View>
              <View style={{ padding: 16 }}>
                <View style={styles.timelineItem}>
                  <View style={[styles.timelineDotStart, { backgroundColor: COLORS.success }]} />
                  <View style={styles.timelineContent}>
                    <Text style={[styles.locationText, { fontWeight: '700' }]}>{departure || ride.departure_location}</Text>
                    <Text style={{ fontSize: 11, color: COLORS.success, fontWeight: '700', marginTop: 2 }}>
                      POINT DE DÉPART (Embarquement)
                    </Text>
                  </View>
                </View>
                
                <View style={styles.timelineLink}>
                  <View style={[styles.timelineLine, { backgroundColor: COLORS.primary }]} />
                  <Text style={styles.distanceText}> Trajet direct </Text>
                </View>
                
                <View style={styles.timelineItem}>
                  <Ionicons name="location" size={20} color={COLORS.error} style={styles.timelineIconEnd} />
                  <View style={styles.timelineContent}>
                    <Text style={[styles.locationText, { fontWeight: '700' }]}>{destination || ride.arrival_location}</Text>
                    <Text style={{ fontSize: 11, color: COLORS.error, fontWeight: '700', marginTop: 2 }}>
                      POINT D'ARRIVÉE (Dépose)
                    </Text>
                  </View>
                </View>

                <View style={[styles.divider, { marginVertical: 12 }]} />

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 6 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: COLORS.text }}>Tarif :</Text>
                  <Text style={{ fontSize: 20, fontWeight: '900', color: getIsIntermediate() ? '#D97706' : COLORS.primary }}>
                    {getIsIntermediate() ? 'À confirmer' : `${ride.price_per_seat?.toLocaleString() ?? "0"} FCFA`}
                  </Text>
                </View>

                {getIsIntermediate() && (
                  <View style={styles.warningBox}>
                    <Ionicons name="information-circle" size={20} color="#D97706" style={{ marginTop: 1 }} />
                    <Text style={{ fontSize: 12, color: '#B45309', flex: 1, lineHeight: 16 }}>
                      <Text style={{ fontWeight: '700' }}>Étape de validation requise : </Text>
                      Votre demande de réservation sera transmise à {driverName} pour approbation. Vous ne réglerez le tarif en ligne qu'après son acceptation.
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {departure && destination ? (
            <Text style={styles.sectionTitle}>Itinéraire complet du conducteur</Text>
          ) : null}

          <StopoverTimeline ride={ride} />

          {/* Pricing Info Card */}
          <View style={styles.card}>
            <View style={styles.priceRow}>
              <View>
                <Text style={styles.priceLabel}>
                  {departure && destination ? "Prix du tronçon" : "Prix total"}
                </Text>
                <View style={styles.seatsBadge}>
                  <Ionicons name="people" size={16} color={COLORS.textLight} />
                  <Text style={styles.seatsValue}>{ride.seats_available} places restantes</Text>
                </View>
              </View>
              <View style={styles.priceAmountBlock}>
                {getIsIntermediate() ? (
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.priceValue, { fontSize: 18, color: '#D97706' }]}>
                      À confirmer
                    </Text>
                    <Text style={styles.priceUnit}>par place</Text>
                  </View>
                ) : (
                  <>
                    <Text style={styles.priceValue}>{ride.price_per_seat?.toLocaleString() ?? '0'}</Text>
                    <Text style={styles.priceCurrency}>FCFA</Text>
                    <Text style={styles.priceUnit}>par place</Text>
                  </>
                )}
              </View>
            </View>

            {departure && destination && (
              <View style={styles.segmentExplanationBanner}>
                <Ionicons name="information-circle" size={18} color="#0284C7" style={{ marginRight: 8, marginTop: 1 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.segmentExplanationText}>
                    Ce tarif correspond uniquement à votre portion de voyage recherchée : <Text style={{ fontWeight: '800' }}>{departure.split(',')[0]} ➔ {destination.split(',')[0]}</Text>.
                  </Text>
                  {ride.original_price_per_seat && (
                    <Text style={styles.segmentExplanationSubText}>
                      (Le tarif complet de bout en bout du conducteur est de {ride.original_price_per_seat.toLocaleString()} FCFA).
                    </Text>
                  )}
                </View>
              </View>
            )}
          </View>

          {ride.description ? (
            <>
              <Text style={styles.sectionTitle}>Description du trajet</Text>
              <View style={styles.descriptionCard}>
                <Text style={styles.descriptionText}>"{ride.description}"</Text>
              </View>
            </>
          ) : null}

          {/* Conducteur / Passagers section */}
          {!isOwnRide ? (
            <>
              <Text style={styles.sectionTitle}>Votre conducteur</Text>
              <DriverCard ride={ride} chatLoading={chatLoading} openChat={openChat} />
            </>
          ) : (
            <>
              <Text style={styles.sectionTitle}>
                Passagers ({bookings.filter(b => b.payment_status !== 'pending' && ['confirmed', 'active', 'completed'].includes(b.status)).length})
              </Text>
              
              {bookings.filter(b => b.payment_status !== 'pending' && ['confirmed', 'active', 'completed'].includes(b.status)).length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="people" size={40} color={COLORS.border} />
                  <Text style={styles.emptyText}>Aucun passager pour l'instant</Text>
                </View>
              ) : (
                bookings.filter(b => b.payment_status !== 'pending' && ['confirmed', 'active', 'completed'].includes(b.status)).map((booking) => (
                  <PassengerCard
                    key={booking.id}
                    booking={booking}
                    onMessage={handleChatWithPassenger}
                    onCall={(phone) => {
                      if (!phone) {
                        CustomAlert.alert('Erreur', 'Numéro de téléphone non disponible.');
                        return;
                      }
                      Linking.openURL(`tel:${phone}`);
                    }}
                  />
                ))
              )}
            </>
          )}
        </View>
      </ScrollView>

      {/* Footer principal avec boutons pilotés par l'état */}
      <View style={[styles.footer, { paddingBottom: Math.max(16, insets.bottom + 12) }]}>
        <TouchableOpacity
          style={[styles.messageBtn, !canChat && styles.messageBtnDisabled]}
          onPress={() => {
            if (!canChat) {
              CustomAlert.alert("Messagerie", "Vous devez réserver ce trajet avant de pouvoir discuter.");
            } else {
              openChat();
            }
          }}
          disabled={chatLoading}
          activeOpacity={0.85}
        >
          {chatLoading ? (
            <ActivityIndicator color={COLORS.primary} size="small" />
          ) : (
            <Ionicons name="chatbubble-ellipses" size={24} color={canChat ? COLORS.primary : COLORS.textLight} />
          )}
        </TouchableOpacity>

        {(() => {
          switch (rideAction.action) {
            case 'own_ride':
              return (
                <View style={[styles.bookBtn, { backgroundColor: COLORS.border }]}>
                  <Text style={[styles.bookBtnText, { color: COLORS.textLight }]}>Votre trajet</Text>
                </View>
              );

            case 'completed':
              return (
                <View style={[styles.bookBtn, { backgroundColor: COLORS.border, opacity: 0.7 }]}>
                  <Text style={[styles.bookBtnText, { color: COLORS.white }]}>Trajet Terminé</Text>
                </View>
              );

            case 'reserve':
            case 'expired':
            case 'cancelled':
              return (
                <TouchableOpacity
                  style={[styles.bookBtn, (bookingLoading || isStarted) && { opacity: 0.7 }]}
                  onPress={handleBooking}
                  disabled={bookingLoading || isStarted}
                  activeOpacity={0.85}
                >
                  {bookingLoading ? (
                    <ActivityIndicator color={COLORS.white} />
                  ) : isStarted ? (
                    <Text style={styles.bookBtnText}>Trajet en cours</Text>
                  ) : (
                    <View style={styles.btnRow}>
                      <Text style={styles.bookBtnText}>Réserver</Text>
                      <Ionicons name="arrow-forward" size={20} color={COLORS.white} />
                    </View>
                  )}
                </TouchableOpacity>
              );

            case 'waiting_driver':
              return (
                <TouchableOpacity
                  style={[styles.bookBtn, { backgroundColor: '#F59E0B', opacity: 0.95 }]}
                  onPress={() => CustomAlert.alert("En attente", "Le conducteur doit approuver votre demande avant que vous ne puissiez effectuer le paiement.")}
                  activeOpacity={0.85}
                >
                  <View style={styles.btnRow}>
                    <Ionicons name="time" size={20} color={COLORS.white} />
                    <Text style={styles.bookBtnText}>En attente de validation...</Text>
                  </View>
                </TouchableOpacity>
              );

            case 'offer_received':
              return (
                <TouchableOpacity
                  style={[styles.bookBtn, { backgroundColor: '#F59E0B' }]}
                  onPress={() => setShowPassengerNegotiationModal(true)}
                  activeOpacity={0.85}
                >
                  <View style={styles.btnRow}>
                    <Ionicons name="alert-circle" size={20} color={COLORS.white} />
                    <Text style={styles.bookBtnText}>Proposition reçue (OUI / NON)</Text>
                  </View>
                </TouchableOpacity>
              );

            case 'pay':
              return (
                <TouchableOpacity
                  style={[styles.bookBtn, { backgroundColor: COLORS.primary }, bookingLoading && { opacity: 0.7 }]}
                  onPress={handleRetryPayment}
                  disabled={bookingLoading}
                  activeOpacity={0.85}
                >
                  {bookingLoading ? (
                    <ActivityIndicator color={COLORS.white} />
                  ) : (
                    <View style={styles.btnRow}>
                      <Ionicons name="card" size={20} color={COLORS.white} />
                      <Text style={styles.bookBtnText}>{rideAction.label}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );

            case 'payment_processing':
              return (
                <View style={[styles.bookBtn, { backgroundColor: '#F59E0B', opacity: 0.8 }]}>
                  <View style={styles.btnRow}>
                    <ActivityIndicator color={COLORS.white} style={{ marginRight: 8 }} />
                    <Text style={styles.bookBtnText}>Validation du paiement...</Text>
                  </View>
                </View>
              );

            case 'confirmed':
              return (
                <TouchableOpacity
                  style={[styles.bookBtn, styles.cancelBtn, bookingLoading && { opacity: 0.7 }]}
                  onPress={handleCancel}
                  disabled={bookingLoading}
                  activeOpacity={0.85}
                >
                  {bookingLoading ? (
                    <ActivityIndicator color={COLORS.white} />
                  ) : (
                    <View style={styles.btnRow}>
                      <Ionicons name="close-circle" size={20} color={COLORS.white} />
                      <Text style={styles.bookBtnText}>Annuler ma réservation</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );

            default:
              return null;
          }
        })()}
      </View>

      {/* Confirmation de réservation */}
      <BookingConfirmModal
        visible={showBookingConfirmModal}
        ride={ride}
        departure={departure}
        destination={destination}
        bookingLoading={bookingLoading}
        onClose={() => setShowBookingConfirmModal(false)}
        onConfirm={async (seats, customPrice, msg) => {
          const success = await performBooking(seats, customPrice, msg);
          if (success) {
            setShowBookingConfirmModal(false);
            setShowBookingSuccessModal(true);
          }
        }}
      />

      {/* Succès de la demande */}
      <BookingSuccessModal
        visible={showBookingSuccessModal}
        driverName={driverName}
        onClose={() => {
          setShowBookingSuccessModal(false);
          fetchRide(true);
        }}
      />

      {/* Négociation passager */}
      <PassengerNegotiationModal
        visible={showPassengerNegotiationModal}
        myBooking={myBooking}
        driverName={driverName}
        departure={departure}
        destination={destination}
        bookingLoading={bookingLoading}
        onClose={() => setShowPassengerNegotiationModal(false)}
        onAccept={async () => {
          if (myBooking) {
            const success = await handlePassengerAccept(myBooking.id);
            if (success) setShowPassengerNegotiationModal(false);
          }
        }}
        onReject={async () => {
          if (myBooking) {
            const success = await handlePassengerReject(myBooking.id);
            if (success) setShowPassengerNegotiationModal(false);
          }
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { justifyContent: 'center', alignItems: 'center' },
  dragHandler: { alignItems: 'center', paddingTop: 8, backgroundColor: COLORS.white, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  dragBar: { width: 44, height: 5, borderRadius: 2.5, backgroundColor: '#E5E7EB' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  backButton: { width: 44, height: 44, justifyContent: 'center', alignItems: 'flex-start' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  scrollContent: { paddingBottom: 160 },
  completedBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0FDF4', padding: 12, borderRadius: 12, marginBottom: 16, justifyContent: 'center', gap: 8 },
  completedText: { color: COLORS.success, fontSize: 16, fontWeight: '700' },
  dateText: { fontSize: 20, fontWeight: '800', color: COLORS.text, marginBottom: 16 },
  card: { backgroundColor: COLORS.white, borderRadius: 16, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2, marginBottom: 16, borderWidth: 1, borderColor: COLORS.border },
  portionHeader: { backgroundColor: '#EFF6FF', padding: 12, flexDirection: 'row', alignItems: 'center', gap: 6, borderBottomWidth: 1, borderBottomColor: '#BFDBFE' },
  portionHeaderText: { fontSize: 13, fontWeight: '800', color: COLORS.primary },
  timelineItem: { flexDirection: 'row', alignItems: 'flex-start' },
  timelineDotStart: { width: 14, height: 14, borderRadius: 7, backgroundColor: COLORS.text, marginTop: 4, marginLeft: 3 },
  timelineIconEnd: { marginLeft: -1, marginTop: 2 },
  timelineContent: { marginLeft: 16, flex: 1 },
  locationText: { fontSize: 17, color: COLORS.text, fontWeight: '700' },
  timelineLink: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  timelineLine: { width: 2, height: 40, backgroundColor: COLORS.border, marginLeft: 9 },
  distanceText: { fontSize: 13, color: COLORS.textLight, marginLeft: 24, fontWeight: '500' },
  approachBox: { backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE', borderRadius: 8, padding: 10, marginLeft: 24, marginBottom: 12, flexDirection: 'row', gap: 6 },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 16 },
  warningBox: { flexDirection: 'row', gap: 8, backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A', borderRadius: 12, padding: 12 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  priceLabel: { fontSize: 14, color: COLORS.textLight, marginBottom: 8 },
  seatsBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.grayLight, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
  seatsValue: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  priceAmountBlock: { alignItems: 'flex-end' },
  priceValue: { fontSize: 32, fontWeight: '800', color: COLORS.text },
  priceCurrency: { fontSize: 14, fontWeight: '700', color: COLORS.text, marginTop: -4 },
  priceUnit: { fontSize: 11, color: COLORS.textLight, marginTop: 2 },
  segmentExplanationBanner: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#F0F9FF', borderWidth: 1, borderColor: '#BAE6FD', borderRadius: 12, padding: 12, marginTop: 12 },
  segmentExplanationText: { fontSize: 12, color: '#0369A1', lineHeight: 16 },
  segmentExplanationSubText: { fontSize: 11, color: '#0284C7', marginTop: 4, fontStyle: 'italic' },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 12, marginLeft: 4 },
  descriptionCard: { backgroundColor: COLORS.white, borderRadius: 16, padding: 16, marginBottom: 16, borderLeftWidth: 4, borderLeftColor: COLORS.primary, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2, borderWidth: 1, borderColor: COLORS.border },
  descriptionText: { fontSize: 14, color: COLORS.text, lineHeight: 20, fontStyle: 'italic' },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.border, padding: 16, flexDirection: 'row', gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 10 },
  messageBtn: { width: 56, height: 56, borderRadius: 16, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' },
  messageBtnDisabled: { backgroundColor: COLORS.grayLight },
  bookBtn: { flex: 1, height: 56, backgroundColor: COLORS.primary, borderRadius: 16, justifyContent: 'center', alignItems: 'center', shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 3 },
  cancelBtn: { backgroundColor: COLORS.error, shadowColor: COLORS.error },
  btnRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bookBtnText: { fontSize: 15, fontWeight: '700', color: COLORS.white },
  emptyState: { backgroundColor: COLORS.white, padding: 32, borderRadius: 16, alignItems: 'center', marginBottom: 24 },
  emptyText: { color: COLORS.textLight, marginTop: 12, fontSize: 15 },
});
