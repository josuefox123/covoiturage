import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  Dimensions, ActivityIndicator, DeviceEventEmitter, Vibration,
  KeyboardAvoidingView, Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../styles/theme';
import { useAuth } from '../context/AuthContext';
import * as Speech from 'expo-speech';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface BookingData {
  id: string;
  passenger_details?: {
    full_name?: string;
    phone?: string;
  };
  departure_location: string;
  arrival_location: string;
  seats_booked: number;
  total_amount: number;
  created_at: string;
}

export default function BookingRequestModal() {
  const { user, token, authFetch } = useAuth();
  const [visible, setVisible] = useState(false);
  const [booking, setBooking] = useState<BookingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState<string>('15:00');
  
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const speechIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const vibrationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeBookingId = useRef<string | null>(null);

  // Fonction pour démarrer la synthèse vocale et les alertes continues
  const startAlerts = (passengerName: string, from: string, to: string) => {
    // Nettoyer les alertes précédentes au cas où
    stopAlerts();

    const speakText = `Vous avez une nouvelle demande de réservation de ${passengerName} pour le trajet ${from.split(',')[0]} vers ${to.split(',')[0]}.`;
    
    // Premier appel immédiat
    Speech.speak(speakText, { language: 'fr', pitch: 1.0, rate: 0.9 });
    Vibration.vibrate([0, 500, 200, 500, 200, 500]);

    // Répétition toutes les 8 secondes (sonore + vocal + vibration)
    speechIntervalRef.current = setInterval(() => {
      Speech.speak(speakText, { language: 'fr', pitch: 1.0, rate: 0.9 });
    }, 8000);

    vibrationIntervalRef.current = setInterval(() => {
      Vibration.vibrate([0, 500, 200, 500]);
    }, 3000);
  };

  const stopAlerts = () => {
    if (speechIntervalRef.current) clearInterval(speechIntervalRef.current);
    if (vibrationIntervalRef.current) clearInterval(vibrationIntervalRef.current);
    Speech.stop();
  };

  const openModal = (data: BookingData) => {
    setBooking(data);
    activeBookingId.current = data.id;
    setVisible(true);
    
    // Nom à énoncer
    const passengerName = data.passenger_details?.full_name || 'un passager';
    startAlerts(passengerName, data.departure_location, data.arrival_location);

    // Initialiser le compte à rebours de 15 minutes
    if (timerRef.current) clearInterval(timerRef.current);
    
    const createdAtTime = new Date(data.created_at).getTime();
    
    timerRef.current = setInterval(() => {
      const now = new Date().getTime();
      const diffMs = now - createdAtTime;
      const totalDurationMs = 15 * 60 * 1000; // 15 minutes
      const remainingMs = totalDurationMs - diffMs;

      if (remainingMs <= 0) {
        // Expiré
        if (timerRef.current) clearInterval(timerRef.current);
        stopAlerts();
        setVisible(false);
        setBooking(null);
        activeBookingId.current = null;
      } else {
        const minutes = Math.floor(remainingMs / 60000);
        const seconds = Math.floor((remainingMs % 60000) / 1000);
        setTimeLeft(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
      }
    }, 1000);
  };

  // Fermer le modal proprement
  const closeModal = () => {
    stopAlerts();
    if (timerRef.current) clearInterval(timerRef.current);
    setVisible(false);
    setBooking(null);
    activeBookingId.current = null;
  };

  // Répondre à la demande (Accept / Reject)
  const handleResponse = async (statusType: 'accept' | 'reject') => {
    if (!booking) return;
    setLoading(true);
    try {
      const response = await authFetch(`/bookings/${booking.id}/${statusType}/`, {
        method: 'POST',
      });
      if (response && !response.error) {
        closeModal();
      } else {
        closeModal();
      }
    } catch (error) {
      closeModal();
    } finally {
      setLoading(false);
    }
  };

  // Écouter les événements de notification et le polling des réservations en attente
  useEffect(() => {
    // 1. Écouteur d'événement local déclenché par useNotifications
    const sub = DeviceEventEmitter.addListener('showBookingRequest', (data: BookingData) => {
      openModal(data);
    });

    // 2. Polling régulier si l'utilisateur est connecté et est conducteur
    let isMounted = true;
    let pollInterval: ReturnType<typeof setInterval> | null = null;

    if (token && user) {
      pollInterval = setInterval(async () => {
        try {
          // Récupérer les bookings en attente dont le conducteur est l'utilisateur connecté
          const data = await authFetch(`/bookings/?ride_driver=${user.id}`);
          const list = Array.isArray(data) ? data : data?.results || [];
          
          // Chercher une demande de statut 'pending'
          const pendingRequest = list.find((b: any) => b.status === 'pending');
          
          if (pendingRequest && isMounted) {
            // Si le modal n'est pas déjà affiché pour cette réservation
            if (activeBookingId.current !== pendingRequest.id) {
              openModal({
                id: pendingRequest.id,
                passenger_details: pendingRequest.passenger_details,
                departure_location: pendingRequest.departure_location,
                arrival_location: pendingRequest.arrival_location,
                seats_booked: pendingRequest.seats_booked,
                total_amount: pendingRequest.portion_price || pendingRequest.total_amount,
                created_at: pendingRequest.created_at,
              });
            }
          } else if (!pendingRequest && visible && isMounted) {
            // Si la réservation n'est plus en attente (annulée ou validée par ailleurs), fermer
            closeModal();
          }
        } catch (error) {
          // Silencieux
        }
      }, 10000); // Polling toutes les 10 secondes
    }

    return () => {
      isMounted = false;
      sub.remove();
      if (pollInterval) clearInterval(pollInterval);
      stopAlerts();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [token, user, visible]);

  if (!visible || !booking) return null;

  return (
    <Modal
      transparent
      animationType="slide"
      visible={visible}
      onRequestClose={closeModal}
    >
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.container}
        >
          <View style={styles.card}>
            {/* Header d'alerte agressive */}
            <View style={styles.header}>
              <View style={styles.bellIconCircle}>
                <Ionicons name="notifications" size={32} color="#FFFFFF" />
              </View>
              <Text style={styles.headerTitle}>Nouvelle Demande !</Text>
              <Text style={styles.timerText}>Expire dans : {timeLeft}</Text>
            </View>

            {/* Corps de la demande */}
            <View style={styles.body}>
              <Text style={styles.passengerName}>
                {booking.passenger_details?.full_name || 'Passager anonyme'}
              </Text>
              <Text style={styles.wantsToBook}>souhaite réserver sur votre trajet :</Text>

              {/* Trajet du passager */}
              <View style={styles.trajectoryCard}>
                <View style={styles.trajectoryRow}>
                  <Ionicons name="radio-button-on" size={20} color="#0066FF" />
                  <Text style={styles.locationText} numberOfLines={2}>
                    {booking.departure_location}
                  </Text>
                </View>
                <View style={styles.trajectoryLine} />
                <View style={styles.trajectoryRow}>
                  <Ionicons name="location" size={20} color="#FF3B30" />
                  <Text style={styles.locationText} numberOfLines={2}>
                    {booking.arrival_location}
                  </Text>
                </View>
              </View>

              {/* Détails places & prix */}
              <View style={styles.detailsRow}>
                <View style={styles.detailBox}>
                  <Text style={styles.detailLabel}>Places</Text>
                  <Text style={styles.detailValue}>{booking.seats_booked}</Text>
                </View>
                <View style={styles.detailBox}>
                  <Text style={styles.detailLabel}>Tarif</Text>
                  <Text style={styles.detailValuePrice}>{booking.total_amount} FCFA</Text>
                </View>
              </View>
            </View>

            {/* Boutons d'action accept/reject */}
            <View style={styles.footer}>
              {loading ? (
                <ActivityIndicator size="large" color="#0066FF" />
              ) : (
                <>
                  <TouchableOpacity
                    style={[styles.btn, styles.btnReject]}
                    onPress={() => handleResponse('reject')}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="close-circle" size={20} color="#FF3B30" />
                    <Text style={styles.btnTextReject}>Refuser</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.btn, styles.btnAccept]}
                    onPress={() => handleResponse('accept')}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                    <Text style={styles.btnTextAccept}>Accepter</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '90%',
    maxWidth: 400,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    backgroundColor: '#FF3B30', // Rouge agressif pour l'alerte
    alignItems: 'center',
    paddingVertical: 20,
  },
  bellIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  timerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 4,
    opacity: 0.9,
  },
  body: {
    padding: 24,
    alignItems: 'center',
  },
  passengerName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1F2937',
  },
  wantsToBook: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
    marginBottom: 16,
  },
  trajectoryCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 14,
    width: '100%',
    gap: 8,
  },
  trajectoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  locationText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    flex: 1,
  },
  trajectoryLine: {
    width: 2,
    height: 16,
    backgroundColor: '#CBD5E1',
    marginLeft: 9,
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 16,
    gap: 12,
  },
  detailBox: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  detailValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1F2937',
    marginTop: 2,
  },
  detailValuePrice: {
    fontSize: 16,
    fontWeight: '800',
    color: '#10B981',
    marginTop: 2,
  },
  footer: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    padding: 16,
    gap: 12,
    justifyContent: 'center',
  },
  btn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  btnReject: {
    backgroundColor: '#FFF5F5',
    borderWidth: 1.5,
    borderColor: '#FEE2E2',
  },
  btnAccept: {
    backgroundColor: '#0066FF',
  },
  btnTextReject: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FF3B30',
  },
  btnTextAccept: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
