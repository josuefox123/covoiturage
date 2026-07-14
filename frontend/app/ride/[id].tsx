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
import { useFocusEffect } from '@react-navigation/native';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, ActivityIndicator, Image, RefreshControl, Linking, Modal } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import * as ExpoLinking from 'expo-linking';
import { useAuth } from '../../src/context/AuthContext';
import { Ride, Booking } from '../../src/types';
import { CustomAlert } from '../../src/utils/CustomAlert';
import { WebView } from 'react-native-webview';
import { getMediaUrl } from '../../src/utils/media';
import { useBooking } from '../../src/hooks/useBooking';
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
  const { createBooking } = useBooking();

  const [ride, setRide] = useState<Ride | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasBooked, setHasBooked] = useState(false);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [myBooking, setMyBooking] = useState<Booking | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);

  const [financialSettings, setFinancialSettings] = useState<any>(null);

  const fetchRide = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const [data, settingsData] = await Promise.all([
        authFetch(`/rides/${id}/`),
        authFetch('/financial-settings/')
      ]);
      setRide(data);
      if (settingsData && settingsData.length > 0) {
        setFinancialSettings(settingsData[0]);
      }

      if (user) {
        if (data.driver_details?.id === user.id) {
          const allBookings: Booking[] = await authFetch(`/bookings/?ride=${id}`);
          setBookings(Array.isArray(allBookings) ? allBookings : (allBookings as any)?.results || []);
        } else {
          const passengerBookings: Booking[] = await authFetch(`/bookings/?passenger=${user.id}`);
          const myBooking = passengerBookings.find((b) =>
            b.status !== 'cancelled' && (typeof b.ride === 'object' && b.ride !== null
              ? String(b.ride.id) === String(id)
              : String(b.ride) === String(id))
          );
          if (myBooking) {
            setHasBooked(true);
            setBookingId(myBooking.id);
            setMyBooking(myBooking);
          } else {
            setHasBooked(false);
            setBookingId(null);
            setMyBooking(null);
          }
        }
      }
    } catch (error) {
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchRide(true);
    }, [id])
  );

  useEffect(() => {
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
    if (bookingLoading || hasBooked) return;
    try {
      setBookingLoading(true);
      const res = await createBooking(id as string, 1);
      if (res && res.id) {
        setBookingId(res.id);
        setHasBooked(true);
        
        // Estimer le montant (frais de service en ligne)
        const commission = ride ? Math.max(100, Math.floor((ride.price_per_seat || 0) * 0.1)) : 100;
        
        // Rediriger vers l'écran de paiement
        router.push({
          pathname: '/payment',
          params: {
            booking_id: String(res.id),
            amount: String(res.amount_paid_online || commission)
          }
        });
      }
    } catch (error: any) {
      CustomAlert.alert('Erreur', error.message || "Impossible de créer la réservation. Veuillez réessayer.");
    } finally {
      setBookingLoading(false);
    }
  };

  /**
   * Reprendre le paiement pour une réservation existante en statut pending_payment.
   */
  const handleRetryPayment = async () => {
    if (!bookingId) return;
    const commission = ride ? Math.max(100, Math.floor((ride.price_per_seat || 0) * 0.1)) : 100;
    router.push({
      pathname: '/payment',
      params: {
        booking_id: String(bookingId),
        amount: String(myBooking?.amount_paid_online || commission)
      }
    });
  };

  const handleBooking = async () => {
    if (bookingLoading || hasBooked) return;
    
    if (!user?.is_verified) {
      CustomAlert.alert('Compte non vérifié', 'Votre compte doit être vérifié pour effectuer une réservation.');
      return;
    }

    CustomAlert.alert(
      'Conditions et règles de remboursement',
      'Pour valider votre place, vous allez régler les frais de réservation en ligne. Le reste du montant sera à régler directement au conducteur lors du trajet.\n\nRègles de remboursement :\n• Annulation par le conducteur : Remboursement intégral (100%).\n• Annulation par vous à plus de 5h du départ (si montant ≥ 1 000 FCFA) : Éligible à un remboursement (soumis à validation).\n• Annulation par vous à moins de 5h du départ ou montant < 1 000 FCFA : Aucun remboursement possible.',
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

  const mapHtml = (ride.departure_latitude && ride.departure_longitude && ride.arrival_latitude && ride.arrival_longitude) ? `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    body, html, #map { width: 100%; height: 100%; margin: 0; padding: 0; background: #f3f4f6; }
    .loading-overlay {
      position: absolute; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(249, 250, 251, 0.9); display: flex;
      align-items: center; justify-content: center; z-index: 9999;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 14px; color: #4b5563; font-weight: 500;
      flex-direction: column; gap: 10px;
    }
    .spinner {
      width: 32px; height: 32px; border: 3px solid #e5e7eb;
      border-top-color: #0066FF; border-radius: 50%;
      animation: spin 0.8s cubic-bezier(0.4, 0, 0.2, 1) infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    /* Leaflet customized zoom buttons */
    .leaflet-bar { border: none !important; box-shadow: 0 4px 12px rgba(0,0,0,0.1) !important; }
    .leaflet-bar a { background-color: #ffffff !important; color: #1f2937 !important; border-bottom: 1px solid #f3f4f6 !important; width: 34px !important; height: 34px !important; line-height: 34px !important; font-size: 18px !important; }
    .leaflet-bar a:first-child { border-top-left-radius: 8px !important; border-top-right-radius: 8px !important; }
    .leaflet-bar a:last-child { border-bottom-left-radius: 8px !important; border-bottom-right-radius: 8px !important; border-bottom: none !important; }
  </style>
</head>
<body>
  <div id="map"></div>
  <div class="loading-overlay" id="loader">
    <div class="spinner"></div>
    <span>Chargement de l'itinéraire...</span>
  </div>
  <script>
    const depLat = ${ride.departure_latitude};
    const depLon = ${ride.departure_longitude};
    const arrLat = ${ride.arrival_latitude};
    const arrLon = ${ride.arrival_longitude};

    // ZoomControl enabled so user can manually adjust zoom
    const map = L.map('map', { zoomControl: true, attributionControl: false });
    
    // Position zoom control in bottom-right
    map.zoomControl.setPosition('bottomright');

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 18
    }).addTo(map);

    // Initial center bounds with maxZoom cap to avoid empty maps
    const bounds = L.latLngBounds([[depLat, depLon], [arrLat, arrLon]]);
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 13 });

    // === Custom Marker Icons ===
    const depIcon = L.divIcon({
      className: '',
      html: \`<div style="
        width: 24px; height: 24px;
        background: #0066FF;
        border: 4px solid white; border-radius: 50%;
        box-shadow: 0 4px 10px rgba(0,102,255,0.45);
        display: flex; align-items: center; justify-content: center;
      "><div style="width: 6px; height: 6px; background: white; border-radius: 50%;"></div></div>\`,
      iconSize: [24, 24], iconAnchor: [12, 12]
    });

    const arrIcon = L.divIcon({
      className: '',
      html: \`<div style="
        width: 24px; height: 24px;
        background: #EF4444;
        border: 4px solid white; border-radius: 50%;
        box-shadow: 0 4px 10px rgba(239,68,68,0.45);
        display: flex; align-items: center; justify-content: center;
      "><div style="width: 6px; height: 6px; background: white; border-radius: 50%;"></div></div>\`,
      iconSize: [24, 24], iconAnchor: [12, 12]
    });

    const depMarker = L.marker([depLat, depLon], { icon: depIcon }).addTo(map);
    const arrMarker = L.marker([arrLat, arrLon], { icon: arrIcon }).addTo(map);

    // === Fetch Route from Valhalla ===
    async function fetchRoute() {
      try {
        const body = JSON.stringify({
          locations: [
            { lon: depLon, lat: depLat },
            { lon: arrLon, lat: arrLat }
          ],
          costing: 'auto',
          shape_format: 'geojson',
          directions_options: { units: 'kilometers' }
        });

        const res = await fetch('https://valhalla1.openstreetmap.de/route', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body
        });

        if (!res.ok) throw new Error('API error');
        const json = await res.json();

        const legs = json?.trip?.legs;
        if (legs && legs.length > 0) {
          const coords = legs[0].shape;
          if (coords && coords.length >= 2) {
            const latLngs = coords.map(c => [c[1], c[0]]);

            // Outer route line shadow
            L.polyline(latLngs, {
              color: '#0066FF', weight: 8, opacity: 0.18
            }).addTo(map);

            // Inner route line
            L.polyline(latLngs, {
              color: '#0066FF', weight: 4, opacity: 0.9,
              lineJoin: 'round', lineCap: 'round'
            }).addTo(map);

            // Zoom bounds and prevent zooming in too much (maxZoom: 13)
            map.fitBounds(L.polyline(latLngs).getBounds(), { padding: [50, 50], maxZoom: 13 });
            document.getElementById('loader').style.display = 'none';
            return;
          }
        }
        throw new Error('No route shape');
      } catch (e) {
        drawFallback();
      }
    }

    function drawFallback() {
      L.polyline([[depLat, depLon], [arrLat, arrLon]], {
        color: '#0066FF', weight: 3, opacity: 0.8, dashArray: '8, 8'
      }).addTo(map);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 13 });
      document.getElementById('loader').style.display = 'none';
    }

    fetchRoute();
  </script>
</body>
</html>
  ` : null;

  return (
    <SafeAreaView style={styles.container}>
      {/* Modal top drag handler for visuals */}
      <View style={{ alignItems: 'center', paddingTop: 8, backgroundColor: COLORS.white, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
        <View style={{ width: 44, height: 5, borderRadius: 2.5, backgroundColor: '#E5E7EB' }} />
      </View>

      {/* Header */}
      <View style={[styles.header, { borderTopLeftRadius: 0, borderTopRightRadius: 0, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }]}>
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
        {mapHtml && (
          <View style={{ marginBottom: 20 }}>
            <View style={{
              height: 250,
              width: '100%',
              borderRadius: 20,
              overflow: 'hidden',
              backgroundColor: COLORS.white,
              borderWidth: 1,
              borderColor: COLORS.border,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.05,
              shadowRadius: 10,
              elevation: 3,
              position: 'relative'
            }}>
              <WebView
                originWhitelist={['*']}
                source={{ html: mapHtml }}
                scrollEnabled={false}
                showsVerticalScrollIndicator={false}
                showsHorizontalScrollIndicator={false}
                style={{ flex: 1 }}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                mixedContentMode="always"
              />
              {/* Floating Itinerary Pill overlay */}
              <View style={{
                position: 'absolute',
                top: 12,
                left: 12,
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: 'rgba(229, 231, 235, 0.8)',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.05,
                shadowRadius: 4,
                elevation: 2,
                gap: 6
              }}>
                <Ionicons name="map" size={14} color={COLORS.primary} />
                <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.text, letterSpacing: 0.3 }}>
                  Aperçu de la route
                </Text>
              </View>
            </View>

            {/* Google Maps Button */}
            <TouchableOpacity
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#FFFFFF',
                borderWidth: 1.5,
                borderColor: COLORS.border,
                borderRadius: 14,
                paddingVertical: 12,
                marginTop: 10,
                gap: 8,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.02,
                shadowRadius: 4,
                elevation: 1
              }}
              onPress={() => {
                const url = `https://www.google.com/maps/dir/?api=1&origin=${ride.departure_latitude},${ride.departure_longitude}&destination=${ride.arrival_latitude},${ride.arrival_longitude}&travelmode=driving`;
                Linking.openURL(url).catch(() => {
                  CustomAlert.alert("Erreur", "Impossible d'ouvrir Google Maps.");
                });
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="logo-google" size={16} color="#4285F4" />
              <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.text }}>
                Ouvrir l'itinéraire dans Google Maps
              </Text>
            </TouchableOpacity>
          </View>
        )}

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



        {/* Bouton Fixe Réserver */}
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



        {/* Description du trajet */}
        {ride.description ? (
          <>
            <Text style={styles.sectionTitle}>Description du trajet</Text>
            <View style={styles.descriptionCard}>
              <Text style={styles.descriptionText}>"{ride.description}"</Text>
            </View>
          </>
        ) : null}

        {/* Driver Profile or Passengers */}
        {!isOwnRide ? (
          <>
            <Text style={styles.sectionTitle}>Votre conducteur</Text>
            <View style={styles.driverCard}>
              <View style={styles.driverProfileHeader}>
                {ride.driver_details?.avatar ? (
                  <Image source={{ uri: getMediaUrl(ride.driver_details.avatar) }} style={styles.driverAvatarImage} />
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
              {ride.driver_details?.vehicles && ride.driver_details.vehicles.length > 0 ? (
                <>
                  <Text style={styles.subSectionTitle}>
                    {ride.driver_details.vehicles[0].vehicle_type.charAt(0).toUpperCase() + ride.driver_details.vehicles[0].vehicle_type.slice(1)}
                  </Text>
                  <View style={styles.vehicleDetailsRow}>
                    <Ionicons 
                      name={
                        ride.driver_details.vehicles[0].vehicle_type === 'moto' ? 'bicycle-outline' :
                        ride.driver_details.vehicles[0].vehicle_type === 'tricycle' ? 'car-outline' :
                        'car-sport-outline'
                      } 
                      size={24} 
                      color={COLORS.primary} 
                    />
                    <View style={styles.vehicleTextContainer}>
                      <Text style={styles.vehicleModelText}>
                        {ride.driver_details.vehicles[0].brand_model}
                      </Text>
                      <Text style={styles.vehiclePlateText}>
                        Couleur : {ride.driver_details.vehicles[0].color} • Immatriculation : {ride.driver_details.vehicles[0].license_plate}
                      </Text>
                    </View>
                  </View>
                </>
              ) : (
                <>
                  <Text style={styles.subSectionTitle}>Véhicule</Text>
                  <View style={styles.vehicleDetailsRow}>
                    <Ionicons name="car-outline" size={24} color={COLORS.textLight} />
                    <View style={styles.vehicleTextContainer}>
                      <Text style={styles.noVehicleText}>Aucun véhicule enregistré dans le profil.</Text>
                    </View>
                  </View>
                </>
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
                      <Image source={{ uri: getMediaUrl(booking.passenger_details.avatar) }} style={styles.passengerAvatarImage} />
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
            myBooking?.payment_status === 'pending' ? (
              // Réservation créée mais paiement pas encore validé — relancer le checkout FeexPay
              <TouchableOpacity
                style={[styles.bookBtn, { backgroundColor: '#D97706' }, bookingLoading && { opacity: 0.7 }]}
                onPress={handleRetryPayment}
                disabled={bookingLoading}
                activeOpacity={0.85}
              >
                {bookingLoading ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <View style={styles.btnRow}>
                    <Ionicons name="card" size={20} color={COLORS.white} />
                    <Text style={styles.bookBtnText}>Compléter le paiement</Text>
                  </View>
                )}
              </TouchableOpacity>
            ) : ride.status === 'active' ? (
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
                  <Text style={styles.bookBtnText}>Place Réservée ✅</Text>
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
  descriptionCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  descriptionText: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
    fontStyle: 'italic',
  },
});
