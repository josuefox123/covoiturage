/**
 * ==============================================================
 * Fichier :
 * [id].tsx
 *
 * Description :
 * Composant ou logique de l'application Zemy.
 *
 * Projet :
 * Zemy
 * ==============================================================
 */
import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, ActivityIndicator, Image, RefreshControl, Linking } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { useAuth } from '../../src/context/AuthContext';
import { Ride, Booking } from '../../src/types';
import { CustomAlert } from '../../src/utils/CustomAlert';

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
  dangerLight: '#FEF2F2'
};

/**
 * Composant RideDetailScreen.
 *
 * Responsabilités :
 * - Affichage et gestion de l'état lié à RideDetailScreen.
 */
export default function RideDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { authFetch, user } = useAuth();

  const [ride, setRide] = useState<Ride | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasBooked, setHasBooked] = useState(false);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [parcels, setParcels] = useState<any[]>([]);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);

  const fetchRide = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const data: Ride = await authFetch(`/rides/${id}/`);
      setRide(data);

      if (user) {
        if (data.driver_details?.id === user.id) {
          const allBookings: Booking[] = await authFetch(`/bookings/?ride=${id}`);
          setBookings(Array.isArray(allBookings) ? allBookings : (allBookings as any)?.results || []);
          if (data.accepts_parcels) {
            const allParcels = await authFetch(`/parcels/?ride=${id}`);
            setParcels(Array.isArray(allParcels) ? allParcels : allParcels.results || []);
          }
        } else {
          const passengerBookings: Booking[] = await authFetch(`/bookings/?passenger=${user.id}`);
          const myBooking = passengerBookings.find((b) =>
            b.status !== 'cancelled' && b.payment_status !== 'pending' && (typeof b.ride === 'object' && b.ride !== null
              ? String(b.ride.id) === String(id)
              : String(b.ride) === String(id))
          );
          if (myBooking) {
            setHasBooked(true);
            setBookingId(myBooking.id);
          } else {
            setHasBooked(false);
            setBookingId(null);
          }
        }
      }
    } catch (error) {
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    fetchRide(true);

    // Poll every 10 seconds for real-time database updates
    const interval = setInterval(() => {
      fetchRide(false);
    }, 10000);

    return () => clearInterval(interval);
  }, [id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchRide(false);
    setRefreshing(false);
  };

  const openChat = async () => {
    setChatLoading(true);
    try {
      const conv = await authFetch('/conversations/ride-chat/', {
        method: 'POST',
        body: JSON.stringify({ ride_id: id }),
      });
      router.push(`/chat/${conv.id}`);
    } catch (error: any) {
      CustomAlert.alert('Messagerie', error.message || 'Impossible d\'ouvrir la conversation.');
    } finally {
      setChatLoading(false);
    }
  };

  const handleChatWithPassenger = async (passengerId: string) => {
    try {
      setChatLoading(true);
      const conversationsList = await authFetch('/conversations/');
      const convs = Array.isArray(conversationsList) ? conversationsList : conversationsList.results || [];

      const match = convs.find((c: any) =>
        String(c.ride) === String(id) &&
        (String(c.participant_1) === String(passengerId) || String(c.participant_2) === String(passengerId))
      );

      if (match) {
        router.push(`/chat/${match.id}`);
      } else {
        const newConv = await authFetch('/conversations/', {
          method: 'POST',
          body: JSON.stringify({
            conversation_type: 'ride',
            ride: id,
            participant_1: passengerId,
            participant_2: user?.id
          })
        });
        router.push(`/chat/${newConv.id}`);
      }
    } catch (error: any) {
      CustomAlert.alert('Erreur', 'Impossible d\'ouvrir la discussion.');
    } finally {
      setChatLoading(false);
    }
  };

  const handleCallPassenger = (phone?: string) => {
    if (!phone) {
      CustomAlert.alert('Erreur', 'Numéro de téléphone non disponible.');
      return;
    }
    Linking.openURL(`tel:${phone}`);
  };

  const getBookingStatusDisplay = (status: string) => {
    switch (status) {
      case 'confirmed':
      case 'active':
      case 'pending':
        return { text: 'Confirmée', color: COLORS.success, bg: '#F0FDF4' };
      case 'completed':
        return { text: 'Arrivé(e)', color: COLORS.primary, bg: '#EFF6FF' };
      case 'cancelled':
        return { text: 'Annulée', color: COLORS.error, bg: '#FEF2F2' };
      case 'rejected':
        return { text: 'Rejetée', color: COLORS.error, bg: '#FEF2F2' };
      default:
        return { text: status.toUpperCase(), color: COLORS.textLight, bg: COLORS.grayLight };
    }
  };

  const performBooking = async () => {
    let currentBookingId: string | null = null;
    try {
      setBookingLoading(true);

      // 1. Create booking (Pending)
      const res = await authFetch('/bookings/', {
        method: 'POST',
        body: JSON.stringify({ ride: id, seats_booked: 1 })
      });
      currentBookingId = res.id;

      // 2. Initialiser le paiement
      const payRes = await authFetch(`/bookings/${currentBookingId}/pay/`, {
        method: 'POST'
      });

      if (payRes.url) {
        // 3. Ouvrir le navigateur FedaPay
        const result = await WebBrowser.openBrowserAsync(payRes.url);

        // 4. Une fois fermé, on vérifie le paiement
        CustomAlert.alert(
          'Vérification du paiement',
          'Veuillez patienter pendant que nous validons votre transaction...',
          []
        );

        const verifyRes = await authFetch(`/bookings/${currentBookingId}/verify-payment/`, {
          method: 'POST',
          body: JSON.stringify({ transaction_id: payRes.transaction_id })
        });

        setBookingId(currentBookingId);
        setHasBooked(true);
        await fetchRide(false);

        CustomAlert.alert(
          'Réservation confirmée ! 🎉',
          `Votre place a été réservée. Vous avez payé la commission. Vous paierez le reste du montant directement à ${ride?.driver_details?.full_name || 'votre conducteur'} lors du trajet.`,
          [
            { text: 'Discuter maintenant', onPress: openChat },
            { text: 'Fermer', style: 'cancel' }
          ]
        );
      }
    } catch (error: any) {
      if (currentBookingId) {
        // Supprimer la réservation en attente si erreur ou abandon
        try {
          await authFetch(`/bookings/${currentBookingId}/`, { method: 'DELETE' });
        } catch (e) { }
      }
      CustomAlert.alert('Erreur', error.message || "Le paiement n'a pas été finalisé. Veuillez réessayer.");
    } finally {
      setBookingLoading(false);
    }
  };

  const handleBooking = async () => {
    if (!user?.is_verified) {
      CustomAlert.alert('Compte non vérifié', 'Votre compte doit être vérifié pour effectuer une réservation.');
      return;
    }

    CustomAlert.alert(
      'Conditions de réservation',
      'Pour valider votre place, vous allez régler les frais de réservation en ligne.\n\nLe reste du montant sera à payer directement au conducteur lors du trajet (en espèces ou Mobile Money).',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'J\'accepte et je réserve', onPress: performBooking }
      ]
    );
  };

  const handleCancelBooking = () => {
    if (!bookingId) return;
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
                      try {
                        setBookingLoading(true);
                        await authFetch(`/bookings/${bookingId}/cancel/`, { method: 'POST' });
                        setHasBooked(false);
                        setBookingId(null);
                        await fetchRide(false);
                        CustomAlert.alert('Succès', 'Votre réservation a été annulée. Si vous êtes éligible, votre demande de remboursement est en cours de traitement.');
                      } catch (error: any) {
                        CustomAlert.alert('Erreur', error.message || 'Impossible d\'annuler la réservation.');
                      } finally {
                        setBookingLoading(false);
                      }
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
  const driverAvatar = (driverName || '??').split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();
  const isOwnRide = user?.id === ride.driver_details?.id;
  const canChat = hasBooked || isOwnRide;
  const isCompleted = ride.status === 'completed';
  const isStarted = ride.status === 'started';

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity activeOpacity={0.85} style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
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

        {/* Big Date */}
        <Text style={styles.dateText}>
          {new Date(ride.departure_date).toLocaleDateString('fr-FR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
          })}
        </Text>

        {/* Timeline Route Card */}
        <View style={styles.card}>
          <View style={styles.timelineItem}>
            <View style={styles.timelineDotStart} />
            <View style={styles.timelineContent}>
              <Text style={styles.locationText}>{ride.departure_location}</Text>
              <Text style={styles.timeText}>{ride.departure_time?.substring(0, 5) ?? '--:--'}</Text>
            </View>
          </View>

          <View style={styles.timelineLink}>
            <View style={styles.timelineLine} />
            <Text style={styles.distanceText}>{ride.distance_km ? `${ride.distance_km} km` : 'Trajet direct'}</Text>
          </View>

          <View style={styles.timelineItem}>
            <Ionicons name="location" size={20} color={COLORS.error} style={styles.timelineIconEnd} />
            <View style={styles.timelineContent}>
              <Text style={styles.locationText}>{ride.arrival_location}</Text>
              <Text style={styles.timeText}>Estimation {ride.distance_km ? '~' + Math.round(ride.distance_km / 60) + 'h' : '--:--'}</Text>
            </View>
          </View>
        </View>

        {/* Pricing Card */}
        <View style={styles.card}>
          <View style={styles.priceRow}>
            <View>
              <Text style={styles.priceLabel}>Prix total</Text>
              <View style={styles.seatsBadge}>
                <Ionicons name="people" size={16} color={COLORS.textLight} />
                <Text style={styles.seatsValue}>{ride.seats_available} places restantes</Text>
              </View>
            </View>
            <View style={styles.priceAmountBlock}>
              <Text style={styles.priceValue}>{ride.price_per_seat?.toLocaleString() ?? "0"}</Text>
              <Text style={styles.priceCurrency}>FCFA</Text>
              <Text style={styles.priceUnit}>par place</Text>
            </View>
          </View>
        </View>

        {/* Parcel Info Card */}
        {ride.accepts_parcels && (
          <View style={[styles.card, { borderColor: '#10B981', backgroundColor: '#F0FDF4' }]}>
            <View style={styles.priceRow}>
              <View>
                <Text style={[styles.priceLabel, { color: '#047857', fontWeight: '700' }]}>Transport de Colis</Text>
                <View style={[styles.seatsBadge, { backgroundColor: '#D1FAE5' }]}>
                  <Ionicons name="cube" size={16} color="#047857" />
                  <Text style={[styles.seatsValue, { color: '#047857' }]}>{ride.parcels_available ?? ride.max_parcels} places restantes</Text>
                </View>
                <Text style={{ fontSize: 12, color: '#065F46', marginTop: 4 }}>
                  Poids max: {ride.max_weight_per_parcel}kg • Taille: {ride.max_dimensions}
                </Text>
              </View>
              <View style={styles.priceAmountBlock}>
                <Text style={[styles.priceValue, { color: '#047857' }]}>{ride.price_per_parcel?.toLocaleString() ?? "0"}</Text>
                <Text style={[styles.priceCurrency, { color: '#047857' }]}>FCFA</Text>
                <Text style={[styles.priceUnit, { color: '#065F46' }]}>par colis</Text>
              </View>
            </View>
            {!isOwnRide && !isCompleted && !isStarted && (
              <TouchableOpacity
                style={{ backgroundColor: '#10B981', borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 12 }}
                onPress={() => router.push(`/ride/book-parcel?rideId=${id}`)}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 15 }}>Envoyer un colis</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Driver Profile or Passengers */}
        {!isOwnRide ? (
          <>
            <Text style={styles.sectionTitle}>Votre conducteur</Text>
            <View style={styles.driverCard}>
              <View style={styles.driverProfileHeader}>
                {ride.driver_details?.avatar ? (
                  <Image source={{ uri: ride.driver_details.avatar }} style={styles.driverAvatarImage} />
                ) : (
                  <View style={styles.driverAvatarPlaceholder}>
                    <Text style={styles.driverAvatarText}>{driverAvatar}</Text>
                  </View>
                )}
                <View style={styles.driverHeaderInfo}>
                  <Text style={styles.driverNameText}>{driverName}</Text>
                  <View style={styles.ratingRow}>
                    <Ionicons name="star" size={16} color={COLORS.warning} />
                    <Text style={styles.ratingValueText}>
                      {ride.driver_details?.rating ? ride.driver_details.rating.toFixed(1) : '5.0'}
                    </Text>
                    <Text style={styles.ridesCountText}>
                      • {ride.driver_details?.rides_count ?? 0} trajet(s) complété(s)
                    </Text>
                  </View>
                  {ride.driver_details?.is_verified && (
                    <View style={styles.verifiedBadgeRow}>
                      <Ionicons name="shield-checkmark" size={14} color={COLORS.success} />
                      <Text style={styles.verifiedTextSmall}>Profil vérifié</Text>
                    </View>
                  )}
                </View>
              </View>

              <View style={styles.divider} />

              {/* Real-time Vehicle Info from driver profile */}
              <Text style={styles.subSectionTitle}>Véhicule</Text>
              {ride.driver_details?.vehicles && ride.driver_details.vehicles.length > 0 ? (
                <View style={styles.vehicleDetailsRow}>
                  <Ionicons name="car-sport-outline" size={24} color={COLORS.primary} />
                  <View style={styles.vehicleTextContainer}>
                    <Text style={styles.vehicleModelText}>
                      {ride.driver_details.vehicles[0].brand_model}
                    </Text>
                    <Text style={styles.vehiclePlateText}>
                      Couleur : {ride.driver_details.vehicles[0].color} • Immatriculation : {ride.driver_details.vehicles[0].license_plate}
                    </Text>
                    <Text style={styles.vehicleTypeText}>
                      Type : {ride.driver_details.vehicles[0].vehicle_type.toUpperCase()}
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={styles.vehicleDetailsRow}>
                  <Ionicons name="car-outline" size={24} color={COLORS.textLight} />
                  <View style={styles.vehicleTextContainer}>
                    <Text style={styles.noVehicleText}>Aucun véhicule enregistré dans le profil.</Text>
                  </View>
                </View>
              )}

              <View style={styles.divider} />

              {/* Driver Preferences */}
              {ride.driver_details?.preference && (
                <View style={styles.preferencesSection}>
                  <Text style={styles.subSectionTitle}>Préférences de voyage</Text>
                  <View style={styles.prefTagsContainer}>
                    <View style={styles.prefTagItem}>
                      <Text style={styles.prefTagText}>🎵 {ride.driver_details.preference.music ? "Musique autorisée" : "Pas de musique"}</Text>
                    </View>
                    <View style={styles.prefTagItem}>
                      <Text style={styles.prefTagText}>{ride.driver_details.preference.smoking ? "🚬 Fumeur" : "Non-fumeur"}</Text>
                    </View>
                    <View style={styles.prefTagItem}>
                      <Text style={styles.prefTagText}>💬 {ride.driver_details.preference.chatty ? "Discussion" : "Calme"}</Text>
                    </View>
                    <View style={styles.prefTagItem}>
                      <Text style={styles.prefTagText}>❄️ {ride.driver_details.preference.air_conditioner ? "Climatisation" : "Pas de clim"}</Text>
                    </View>
                    <View style={styles.prefTagItem}>
                      <Text style={styles.prefTagText}>🐾 {ride.driver_details.preference.pets_allowed ? "Animaux admis" : "Sans animaux"}</Text>
                    </View>
                    <View style={styles.prefTagItem}>
                      <Text style={styles.prefTagText}>💼 {ride.driver_details.preference.luggage_allowed ? "Bagages admis" : "Bagages limités"}</Text>
                    </View>
                    <View style={styles.prefTagItem}>
                      <Text style={styles.prefTagText}>📍 {ride.driver_details.preference.stops_allowed ? "Arrêts possibles" : "Direct (sans arrêts)"}</Text>
                    </View>
                  </View>
                  {ride.driver_details.preference.notes ? (
                    <View style={styles.notesContainer}>
                      <Text style={styles.notesLabel}>Notes complémentaires :</Text>
                      <Text style={styles.notesText}>"{ride.driver_details.preference.notes}"</Text>
                    </View>
                  ) : null}
                </View>
              )}

              <View style={styles.divider} />

              {/* Contact Button */}
              <TouchableOpacity
                style={styles.contactDriverBtn}
                onPress={() => {
                  if (isOwnRide) {
                    router.push('/(tabs)/messages');
                  } else {
                    openChat();
                  }
                }}
                disabled={chatLoading}
              >
                {chatLoading ? (
                  <ActivityIndicator color={COLORS.white} size="small" />
                ) : (
                  <>
                    <Ionicons name="chatbubble-ellipses" size={20} color={COLORS.white} />
                    <Text style={styles.contactDriverBtnText}>Contacter le conducteur</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            <Text style={styles.sectionTitle}>Passagers ({bookings.filter(b => ['confirmed', 'active', 'pending', 'completed'].includes(b.status)).length})</Text>
            {bookings.filter(b => ['confirmed', 'active', 'pending', 'completed'].includes(b.status)).length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="people" size={40} color={COLORS.border} />
                <Text style={styles.emptyText}>Aucun passager pour l'instant</Text>
              </View>
            ) : (
              bookings.filter(b => ['confirmed', 'active', 'pending', 'completed'].includes(b.status)).map((booking) => (
                <View key={booking.id} style={styles.passengerCard}>
                  <View style={styles.passengerHeader}>
                    {booking.passenger_details?.avatar ? (
                      <Image source={{ uri: booking.passenger_details.avatar }} style={styles.passengerAvatarImage} />
                    ) : (
                      <View style={styles.passengerAvatar}>
                        <Text style={styles.passengerAvatarText}>
                          {booking.passenger_details?.full_name?.substring(0, 2).toUpperCase() || 'PA'}
                        </Text>
                      </View>
                    )}
                    <View style={styles.passengerDetails}>
                      <Text style={styles.passengerName}>{booking.passenger_details?.full_name}</Text>
                      <Text style={styles.passengerPhone}>{booking.passenger_details?.phone || 'Numéro masqué'}</Text>
                      <View style={styles.ratingRow}>
                        <Ionicons name="star" size={12} color={COLORS.warning} />
                        <Text style={styles.ratingTextSmall}>4.8</Text>
                        <Text style={styles.seatBadge}>{booking.seats_booked} place(s)</Text>
                        {(() => {
                          const badge = getBookingStatusDisplay(booking.status);
                          return (
                            <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                              <Text style={[styles.statusBadgeText, { color: badge.color }]}>{badge.text}</Text>
                            </View>
                          );
                        })()}
                      </View>
                    </View>
                  </View>

                  <View style={styles.passengerActions}>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => {
                      const pId = booking.passenger_details?.id;
                      if (pId) handleChatWithPassenger(pId);
                    }}>
                      <Ionicons name="chatbubble-outline" size={20} color={COLORS.primary} />
                      <Text style={[styles.actionBtnText, { color: COLORS.primary }]}>Message</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => handleCallPassenger(booking.passenger_details?.phone)}>
                      <Ionicons name="call-outline" size={20} color={COLORS.success} />
                      <Text style={[styles.actionBtnText, { color: COLORS.success }]}>Appeler</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}

            {/* Parcels (Driver Side) */}
            {ride.accepts_parcels && (
              <>
                <Text style={styles.sectionTitle}>Colis à transporter ({parcels.length})</Text>
                {parcels.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Ionicons name="cube" size={40} color={COLORS.border} />
                    <Text style={styles.emptyText}>Aucun colis pour l'instant</Text>
                  </View>
                ) : (
                  parcels.map((parcel) => (
                    <View key={parcel.id} style={styles.passengerCard}>
                      <View style={styles.passengerHeader}>
                        <View style={[styles.passengerAvatar, { backgroundColor: '#D1FAE5' }]}>
                          <Ionicons name="cube" size={24} color="#10B981" />
                        </View>
                        <View style={styles.passengerDetails}>
                          <Text style={styles.passengerName}>Colis: {parcel.description}</Text>
                          <Text style={styles.passengerPhone}>Destinataire: {parcel.receiver_name} ({parcel.receiver_phone})</Text>
                          <View style={styles.ratingRow}>
                            <Text style={styles.seatBadge}>{parcel.parcel_type}</Text>
                            {(() => {
                              let bg = COLORS.grayLight, color = COLORS.textLight, text = parcel.status;
                              if (['pending', 'accepted'].includes(text)) { bg = '#F0FDF4'; color = COLORS.success; }
                              if (text === 'picked_up') { bg = '#EFF6FF'; color = COLORS.primary; }
                              if (text === 'delivered') { bg = '#F0FDF4'; color = COLORS.success; }
                              return (
                                <View style={[styles.statusBadge, { backgroundColor: bg }]}>
                                  <Text style={[styles.statusBadgeText, { color }]}>{text.toUpperCase()}</Text>
                                </View>
                              );
                            })()}
                          </View>
                        </View>
                      </View>
                      <View style={styles.passengerActions}>
                        <TouchableOpacity style={styles.actionBtn} onPress={() => handleCallPassenger(parcel.receiver_phone)}>
                          <Ionicons name="call-outline" size={20} color={COLORS.success} />
                          <Text style={[styles.actionBtnText, { color: COLORS.success }]}>Appeler</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.actionBtn, { borderColor: '#10B981' }]} onPress={() => router.push(`/ride/scan-qr?parcelId=${parcel.id}`)}>
                          <Ionicons name="qr-code-outline" size={20} color="#10B981" />
                          <Text style={[styles.actionBtnText, { color: '#10B981' }]}>Scanner QR</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                )}
              </>
            )}

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Véhicule & Préférences</Text>

              {ride.driver_details?.vehicles && ride.driver_details.vehicles.length > 0 ? (
                <View style={styles.vehicleDetailsRow}>
                  <Ionicons name="car-sport-outline" size={24} color={COLORS.primary} />
                  <View style={styles.vehicleTextContainer}>
                    <Text style={styles.vehicleModelText}>
                      {ride.driver_details.vehicles[0].brand_model}
                    </Text>
                    <Text style={styles.vehiclePlateText}>
                      Couleur : {ride.driver_details.vehicles[0].color} • Immatriculation : {ride.driver_details.vehicles[0].license_plate}
                    </Text>
                    <Text style={styles.vehicleTypeText}>
                      Type : {ride.driver_details.vehicles[0].vehicle_type.toUpperCase()}
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={styles.vehicleDetailsRow}>
                  <Ionicons name="car-outline" size={24} color={COLORS.textLight} />
                  <View style={styles.vehicleTextContainer}>
                    <Text style={styles.noVehicleText}>Aucun véhicule enregistré dans le profil.</Text>
                  </View>
                </View>
              )}

              <View style={styles.divider} />

              {ride.driver_details?.preference && (
                <View style={styles.preferencesSection}>
                  <Text style={styles.subSectionTitle}>Préférences de voyage</Text>
                  <View style={styles.prefTagsContainer}>
                    <View style={styles.prefTagItem}>
                      <Text style={styles.prefTagText}>🎵 {ride.driver_details.preference.music ? "Musique autorisée" : "Pas de musique"}</Text>
                    </View>
                    <View style={styles.prefTagItem}>
                      <Text style={styles.prefTagText}>{ride.driver_details.preference.smoking ? "🚬 Fumeur" : "Non-fumeur"}</Text>
                    </View>
                    <View style={styles.prefTagItem}>
                      <Text style={styles.prefTagText}>💬 {ride.driver_details.preference.chatty ? "Discussion" : "Calme"}</Text>
                    </View>
                    <View style={styles.prefTagItem}>
                      <Text style={styles.prefTagText}>❄️ {ride.driver_details.preference.air_conditioner ? "Climatisation" : "Pas de clim"}</Text>
                    </View>
                    <View style={styles.prefTagItem}>
                      <Text style={styles.prefTagText}>🐾 {ride.driver_details.preference.pets_allowed ? "Animaux admis" : "Sans animaux"}</Text>
                    </View>
                    <View style={styles.prefTagItem}>
                      <Text style={styles.prefTagText}>💼 {ride.driver_details.preference.luggage_allowed ? "Bagages admis" : "Bagages limités"}</Text>
                    </View>
                    <View style={styles.prefTagItem}>
                      <Text style={styles.prefTagText}>📍 {ride.driver_details.preference.stops_allowed ? "Arrêts possibles" : "Direct (sans arrêts)"}</Text>
                    </View>
                  </View>
                  {ride.driver_details.preference.notes ? (
                    <View style={styles.notesContainer}>
                      <Text style={styles.notesLabel}>Notes complémentaires :</Text>
                      <Text style={styles.notesText}>"{ride.driver_details.preference.notes}"</Text>
                    </View>
                  ) : null}
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* Modern Footer Action Block */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.messageBtn, !canChat && styles.messageBtnDisabled]}
          onPress={() => {
            if (!canChat) {
              CustomAlert.alert("Messagerie", "Vous devez réserver ce trajet avant de pouvoir discuter.");
            } else if (isOwnRide) {
              router.push('/(tabs)/messages');
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

        {!isOwnRide ? (
          hasBooked ? (
            ride.status === 'active' ? (
              <TouchableOpacity
                style={[styles.bookBtn, styles.cancelBtn, bookingLoading && { opacity: 0.7 }]}
                onPress={handleCancelBooking}
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
            ) : (
              <View style={[styles.bookBtn, styles.bookedBtn, { opacity: 0.8 }]}>
                <View style={styles.btnRow}>
                  <Ionicons name="checkmark-circle" size={20} color={COLORS.white} />
                  <Text style={styles.bookBtnText}>Place Réservée ({ride.status.toUpperCase()})</Text>
                </View>
              </View>
            )
          ) : (
            <TouchableOpacity
              style={[styles.bookBtn, (bookingLoading || isCompleted || isStarted) && { opacity: 0.7 }]}
              onPress={handleBooking}
              disabled={bookingLoading || isCompleted || isStarted}
              activeOpacity={0.85}
            >
              {bookingLoading ? (
                <ActivityIndicator color={COLORS.white} />
              ) : isCompleted ? (
                <Text style={styles.bookBtnText}>Trajet Terminé</Text>
              ) : isStarted ? (
                <Text style={styles.bookBtnText}>Trajet en cours (Complet)</Text>
              ) : (
                <View style={styles.btnRow}>
                  <Text style={styles.bookBtnText}>Réserver 1 place</Text>
                  <Ionicons name="arrow-forward" size={20} color={COLORS.white} />
                </View>
              )}
            </TouchableOpacity>
          )
        ) : (
          <View style={[styles.bookBtn, { backgroundColor: COLORS.border }]}>
            <Text style={[styles.bookBtnText, { color: COLORS.textLight }]}>Votre trajet</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  backButton: { width: 44, height: 44, justifyContent: 'center', alignItems: 'flex-start' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },

  scrollContent: { padding: 16, paddingBottom: 120 },

  completedBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0FDF4', padding: 12, borderRadius: 12, marginBottom: 16, justifyContent: 'center', gap: 8 },
  completedText: { color: COLORS.success, fontSize: 16, fontWeight: '700' },

  dateText: { fontSize: 20, fontWeight: '800', color: COLORS.text, marginBottom: 16 },

  card: { backgroundColor: COLORS.white, borderRadius: 16, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2, marginBottom: 16, borderWidth: 1, borderColor: COLORS.border },

  timelineItem: { flexDirection: 'row', alignItems: 'flex-start' },
  timelineDotStart: { width: 14, height: 14, borderRadius: 7, backgroundColor: COLORS.text, marginTop: 4, marginLeft: 3 },
  timelineIconEnd: { marginLeft: -1, marginTop: 2 },
  timelineContent: { marginLeft: 16, flex: 1 },
  locationText: { fontSize: 17, color: COLORS.text, fontWeight: '700' },
  timeText: { fontSize: 14, color: COLORS.textLight, marginTop: 4 },

  timelineLink: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  timelineLine: { width: 2, height: 40, backgroundColor: COLORS.border, marginLeft: 9 },
  distanceText: { fontSize: 13, color: COLORS.textLight, marginLeft: 24, fontWeight: '500' },

  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  priceLabel: { fontSize: 14, color: COLORS.textLight, marginBottom: 8 },
  seatsBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.grayLight, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
  seatsValue: { fontSize: 13, fontWeight: '600', color: COLORS.text },

  priceAmountBlock: { alignItems: 'flex-end' },
  priceValue: { fontSize: 32, fontWeight: '800', color: COLORS.text },
  priceCurrency: { fontSize: 14, fontWeight: '700', color: COLORS.text, marginTop: -4 },
  priceUnit: { fontSize: 11, color: COLORS.textLight, marginTop: 2 },

  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 16 },

  sectionTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 12, marginLeft: 4 },

  // Driver Card Styles
  driverCard: { backgroundColor: COLORS.white, borderRadius: 16, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2, marginBottom: 16, borderWidth: 1, borderColor: COLORS.border },
  driverProfileHeader: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  driverAvatarImage: { width: 64, height: 64, borderRadius: 32 },
  driverAvatarPlaceholder: { width: 64, height: 64, borderRadius: 32, backgroundColor: COLORS.primaryLight, justifyContent: 'center', alignItems: 'center' },
  driverAvatarText: { color: COLORS.primary, fontSize: 22, fontWeight: '700' },
  driverHeaderInfo: { flex: 1, gap: 4 },
  driverNameText: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingValueText: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  ridesCountText: { fontSize: 13, color: COLORS.textLight },
  verifiedBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  verifiedTextSmall: { fontSize: 12, fontWeight: '600', color: COLORS.success },

  subSectionTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text, marginBottom: 12 },

  // Vehicle Info Styles
  vehicleDetailsRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 4 },
  vehicleTextContainer: { flex: 1, gap: 4 },
  vehicleModelText: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  vehiclePlateText: { fontSize: 13, color: COLORS.textLight },
  vehicleTypeText: { fontSize: 12, fontWeight: '600', color: COLORS.primary, textTransform: 'uppercase' },
  noVehicleText: { fontSize: 14, color: COLORS.textLight, fontStyle: 'italic' },

  // Preferences Styles
  preferencesSection: { paddingHorizontal: 4 },
  prefTagsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  prefTagItem: { backgroundColor: COLORS.grayLight, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  prefTagText: { fontSize: 12, color: COLORS.text, fontWeight: '500' },
  notesContainer: { backgroundColor: COLORS.primaryLight, borderRadius: 12, padding: 12, marginTop: 8 },
  notesLabel: { fontSize: 12, fontWeight: '700', color: COLORS.primary, marginBottom: 4 },
  notesText: { fontSize: 13, color: COLORS.text, fontStyle: 'italic' },

  contactDriverBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 14, gap: 8, marginTop: 8 },
  contactDriverBtnText: { color: COLORS.white, fontSize: 14, fontWeight: '700' },

  // Footer Actions Styles
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.border, padding: 16, flexDirection: 'row', gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 10 },
  messageBtn: { width: 56, height: 56, borderRadius: 16, backgroundColor: COLORS.primaryLight, justifyContent: 'center', alignItems: 'center' },
  messageBtnDisabled: { backgroundColor: COLORS.grayLight },
  bookBtn: { flex: 1, height: 56, backgroundColor: COLORS.primary, borderRadius: 16, justifyContent: 'center', alignItems: 'center', shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 3 },
  bookedBtn: { backgroundColor: COLORS.success, shadowColor: COLORS.success },
  cancelBtn: { backgroundColor: COLORS.error, shadowColor: COLORS.error },
  btnRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bookBtnText: { fontSize: 15, fontWeight: '700', color: COLORS.white },

  emptyState: { backgroundColor: COLORS.white, padding: 32, borderRadius: 16, alignItems: 'center', marginBottom: 24 },
  emptyText: { color: COLORS.textLight, marginTop: 12, fontSize: 15 },

  passengerCard: { backgroundColor: COLORS.white, borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  passengerHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  passengerAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#E0F2FE', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  passengerAvatarText: { color: COLORS.primary, fontSize: 16, fontWeight: '700' },
  passengerAvatarImage: { width: 44, height: 44, borderRadius: 22, marginRight: 12 },
  passengerDetails: { flex: 1 },
  passengerName: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 2 },
  passengerPhone: { fontSize: 13, color: COLORS.textLight, marginBottom: 4 },
  ratingTextSmall: { fontSize: 13, fontWeight: '600', color: COLORS.text, marginLeft: 4, marginRight: 8 },
  seatBadge: { backgroundColor: COLORS.grayLight, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, fontSize: 12, color: COLORS.text, overflow: 'hidden' },

  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginLeft: 8 },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },

  passengerActions: { flexDirection: 'row', gap: 12 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 10, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border, gap: 8 },
  actionBtnText: { fontSize: 14, fontWeight: '600' },
});
