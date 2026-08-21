import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  Dimensions, ActivityIndicator, DeviceEventEmitter, Vibration,
  KeyboardAvoidingView, Platform, TextInput
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
  negotiation_message?: string;
  pricing_breakdown?: {
    driver_price?: number;
    commission?: number;
    total_to_pay?: number;
    driver_amount?: number;
    zemy_amount?: number;
    seats?: number;
  };
  pickup_surcharge?: number;
  dropoff_surcharge?: number;
  pickup_location_extra?: string;
  dropoff_location_extra?: string;
}

export default function BookingRequestModal() {
  const { user, token, authFetch } = useAuth();
  const [visible, setVisible] = useState(false);
  const [booking, setBooking] = useState<BookingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState<string>('72h 00m');
  const [pricePerSeatInput, setPricePerSeatInput] = useState<string>('');
  
  const [queue, setQueue] = useState<BookingData[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  
  const queueRef = useRef<BookingData[]>([]);
  const currentIndexRef = useRef<number>(0);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const speechIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const vibrationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeBookingId = useRef<string | null>(null);

  // Mettre à jour les refs à chaque rendu pour le polling/notifications sans re-render d'écouteurs
  useEffect(() => {
    queueRef.current = queue;
    currentIndexRef.current = currentIndex;
  }, [queue, currentIndex]);

  // Fonction pour démarrer la synthèse vocale et les alertes continues
  const startAlerts = (passengerName: string, from: string, to: string) => {
    stopAlerts();

    const speakText = `Vous avez une nouvelle demande de réservation de ${passengerName} pour le trajet ${from.split(',')[0]} vers ${to.split(',')[0]}.`;
    
    Speech.speak(speakText, { language: 'fr', pitch: 1.0, rate: 0.9 });
    Vibration.vibrate([0, 500, 200, 500, 200, 500]);

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

  const initTimer = (createdAt: string) => {
    if (timerRef.current) clearInterval(timerRef.current);
    const createdAtTime = new Date(createdAt).getTime();
    
    const updateTime = () => {
      const now = new Date().getTime();
      const diffMs = now - createdAtTime;
      const totalDurationMs = 72 * 60 * 60 * 1000; // 72 heures
      const remainingMs = totalDurationMs - diffMs;

      if (remainingMs <= 0) {
        setTimeLeft('Expiré');
      } else {
        const hours = Math.floor(remainingMs / 3600000);
        const minutes = Math.floor((remainingMs % 3600000) / 60000);
        const seconds = Math.floor((remainingMs % 60000) / 1000);
        if (hours > 0) {
          setTimeLeft(`${hours}h ${minutes.toString().padStart(2, '0')}m`);
        } else {
          setTimeLeft(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
        }
      }
    };

    updateTime();
    timerRef.current = setInterval(updateTime, 1000);
  };

  const updateQueue = (newList: BookingData[]) => {
    if (newList.length === 0) {
      if (queueRef.current.length > 0) {
        closeModal();
      }
      return;
    }

    const currentIds = queueRef.current.map(b => b.id).join(',');
    const newIds = newList.map(b => b.id).join(',');
    
    if (currentIds !== newIds) {
      setQueue(newList);
      setVisible(true);

      let newIdx = currentIndexRef.current;
      if (newIdx >= newList.length) {
        newIdx = newList.length - 1;
        setCurrentIndex(newIdx);
      }

      const currentBooking = newList[newIdx];
      if (currentBooking) {
        activeBookingId.current = currentBooking.id;
        
        const defaultSurcharge = (currentBooking.pickup_surcharge || 0) + (currentBooking.dropoff_surcharge || 0);
        setPricePerSeatInput(String(defaultSurcharge));

        if (booking?.id !== currentBooking.id) {
          setBooking(currentBooking);
          const passengerName = currentBooking.passenger_details?.full_name || 'un passager';
          startAlerts(passengerName, currentBooking.departure_location, currentBooking.arrival_location);
          initTimer(currentBooking.created_at);
        }
      }
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      const newIdx = currentIndex - 1;
      setCurrentIndex(newIdx);
      const targetBooking = queue[newIdx];
      if (targetBooking) {
        setBooking(targetBooking);
        activeBookingId.current = targetBooking.id;
        const defaultSurcharge = (targetBooking.pickup_surcharge || 0) + (targetBooking.dropoff_surcharge || 0);
        setPricePerSeatInput(String(defaultSurcharge));
        const passengerName = targetBooking.passenger_details?.full_name || 'un passager';
        startAlerts(passengerName, targetBooking.departure_location, targetBooking.arrival_location);
        initTimer(targetBooking.created_at);
      }
    }
  };

  const handleNext = () => {
    if (currentIndex < queue.length - 1) {
      const newIdx = currentIndex + 1;
      setCurrentIndex(newIdx);
      const targetBooking = queue[newIdx];
      if (targetBooking) {
        setBooking(targetBooking);
        activeBookingId.current = targetBooking.id;
        const defaultSurcharge = (targetBooking.pickup_surcharge || 0) + (targetBooking.dropoff_surcharge || 0);
        setPricePerSeatInput(String(defaultSurcharge));
        const passengerName = targetBooking.passenger_details?.full_name || 'un passager';
        startAlerts(passengerName, targetBooking.departure_location, targetBooking.arrival_location);
        initTimer(targetBooking.created_at);
      }
    }
  };

  // Fermer le modal proprement
  const closeModal = () => {
    stopAlerts();
    if (timerRef.current) clearInterval(timerRef.current);
    setVisible(false);
    setBooking(null);
    setQueue([]);
    setCurrentIndex(0);
    activeBookingId.current = null;
  };

  // Répondre à la demande (Accept / Reject)
  const handleResponse = async (statusType: 'accept' | 'reject', customPrice?: number) => {
    if (!booking) return;
    setLoading(true);
    try {
      const payload: any = {};
      if (customPrice !== undefined && !isNaN(customPrice)) {
        if (booking.pickup_location_extra && booking.dropoff_location_extra) {
          payload.pickup_surcharge = customPrice;
          payload.dropoff_surcharge = 0;
        } else if (booking.pickup_location_extra) {
          payload.pickup_surcharge = customPrice;
        } else if (booking.dropoff_location_extra) {
          payload.dropoff_surcharge = customPrice;
        } else {
          payload.pickup_surcharge = customPrice;
        }
      }
      const bodyPayload = statusType === 'accept' ? JSON.stringify(payload) : undefined;
      const response = await authFetch(`/bookings/${booking.id}/${statusType}/`, {
        method: 'POST',
        body: bodyPayload
      });
      
      const filteredQueue = queue.filter(b => b.id !== booking.id);
      if (filteredQueue.length === 0) {
        closeModal();
      } else {
        let newIdx = currentIndex;
        if (newIdx >= filteredQueue.length) {
          newIdx = filteredQueue.length - 1;
        }
        setCurrentIndex(newIdx);
        setQueue(filteredQueue);
        const nextBooking = filteredQueue[newIdx];
        setBooking(nextBooking);
        activeBookingId.current = nextBooking.id;
        
        const defaultSurcharge = (nextBooking.pickup_surcharge || 0) + (nextBooking.dropoff_surcharge || 0);
        setPricePerSeatInput(String(defaultSurcharge));
        
        const passengerName = nextBooking.passenger_details?.full_name || 'un passager';
        startAlerts(passengerName, nextBooking.departure_location, nextBooking.arrival_location);
        initTimer(nextBooking.created_at);
      }
    } catch (error) {
      closeModal();
    } finally {
      setLoading(false);
    }
  };

  // Écouter les événements de notification et le polling des réservations en attente
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('showBookingRequest', (data: BookingData) => {
      setQueue((prev) => {
        if (prev.some(b => b.id === data.id)) return prev;
        const updated = [...prev, data];
        updateQueue(updated);
        return updated;
      });
    });

    let isMounted = true;
    let pollInterval: ReturnType<typeof setInterval> | null = null;

    if (token && user) {
      pollInterval = setInterval(async () => {
        try {
          const data = await authFetch(`/bookings/?ride_driver=${user.id}`);
          const list = Array.isArray(data) ? data : data?.results || [];
          
          const pendingRequests = list.filter((b: any) => b.status === 'pending').map((b: any) => ({
            id: b.id,
            passenger_details: b.passenger_details,
            departure_location: b.departure_location || b.ride?.departure_location || '',
            arrival_location: b.arrival_location || b.ride?.arrival_location || '',
            seats_booked: b.seats_booked,
            total_amount: b.pricing_breakdown?.driver_price ?? b.passenger_proposed_price ?? b.portion_price ?? b.total_amount,
            created_at: b.created_at,
            negotiation_message: b.negotiation_message || '',
            pricing_breakdown: b.pricing_breakdown,
            pickup_surcharge: b.pickup_surcharge,
            dropoff_surcharge: b.dropoff_surcharge,
            pickup_location_extra: b.pickup_location_extra,
            dropoff_location_extra: b.dropoff_location_extra,
          }));

          if (isMounted) {
            updateQueue(pendingRequests);
          }
        } catch (error) {
        }
      }, 10000);
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

  const driverPrice = booking.pricing_breakdown?.driver_price ?? 
    (booking.total_amount ? (booking.total_amount > 50000 ? Math.round(booking.total_amount / booking.seats_booked) : booking.total_amount) : 100);

  return (
    <Modal
      transparent
      animationType="slide"
      visible={visible}
      onRequestClose={closeModal}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
      >
        <View style={styles.overlay}>
          <View style={styles.container}>
            <View style={styles.card}>
            {/* Header d'alerte agressive */}
            <View style={styles.header}>
              <View style={styles.bellIconCircle}>
                <Ionicons name="notifications" size={32} color="#FFFFFF" />
              </View>
              <Text style={styles.headerTitle}>
                Nouvelle Demande ! {queue.length > 1 ? `(${currentIndex + 1}/${queue.length})` : ''}
              </Text>
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

              {/* Message de négociation du passager */}
              {!!booking.negotiation_message && (
                <View style={{
                  marginTop: 12,
                  backgroundColor: '#FFF7ED',
                  borderWidth: 1,
                  borderColor: '#FED7AA',
                  borderRadius: 12,
                  padding: 12,
                  width: '100%',
                }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#92400E', textTransform: 'uppercase', marginBottom: 4 }}>
                    Message du passager
                  </Text>
                  <Text style={{ fontSize: 13, color: '#78350F', lineHeight: 18 }}>
                    {booking.negotiation_message}
                  </Text>
                </View>
              )}

              {/* Navigation entre plusieurs demandes */}
              {queue.length > 1 && (
                <View style={styles.navigationRow}>
                  <TouchableOpacity
                    style={[styles.navButton, currentIndex === 0 && styles.navButtonDisabled]}
                    onPress={handlePrev}
                    disabled={currentIndex === 0}
                  >
                    <Ionicons name="chevron-back" size={20} color={currentIndex === 0 ? "#A1A1AA" : "#0066FF"} />
                    <Text style={[styles.navButtonText, currentIndex === 0 && styles.navButtonTextDisabled]}>Précédente</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.navButton, currentIndex === queue.length - 1 && styles.navButtonDisabled]}
                    onPress={handleNext}
                    disabled={currentIndex === queue.length - 1}
                  >
                    <Text style={[styles.navButtonText, currentIndex === queue.length - 1 && styles.navButtonTextDisabled]}>Suivante</Text>
                    <Ionicons name="chevron-forward" size={20} color={currentIndex === queue.length - 1 ? "#A1A1AA" : "#0066FF"} />
                  </TouchableOpacity>
                </View>
              )}

              {/* Détails places & prix */}
              <View style={styles.detailsRow}>
                <View style={styles.detailBox}>
                  <Text style={styles.detailLabel}>Places</Text>
                  <Text style={styles.detailValue}>{booking.seats_booked}</Text>
                </View>
                <View style={[styles.detailBox, { flex: 2, alignItems: 'center' }]}>
                  <Text style={styles.detailLabel}>Transport (FCFA)</Text>
                  <Text style={[styles.detailValue, { color: '#475569', fontWeight: '800', marginTop: 6 }]}>
                    {driverPrice.toLocaleString()}
                  </Text>
                </View>
                <View style={[styles.detailBox, { flex: 2.2, alignItems: 'center' }]}>
                  <Text style={styles.detailLabel}>Surcoût Option</Text>
                  <TextInput
                    style={{
                      fontSize: 16,
                      fontWeight: '800',
                      color: '#D97706',
                      textAlign: 'center',
                      borderWidth: 1.5,
                      borderColor: '#F59E0B',
                      borderRadius: 10,
                      paddingHorizontal: 12,
                      paddingVertical: 4,
                      minWidth: 90,
                      marginTop: 4,
                      backgroundColor: '#FFFBEB'
                    }}
                    keyboardType="numeric"
                    value={pricePerSeatInput}
                    onChangeText={setPricePerSeatInput}
                  />
                </View>
              </View>

              <View style={{ marginTop: 12, alignItems: 'center' }}>
                <Text style={{ fontSize: 13, color: '#1E293B', fontWeight: '700' }}>
                  Total proposé : {((driverPrice * booking.seats_booked) + (parseInt(pricePerSeatInput) || 0)).toLocaleString()} FCFA
                </Text>
                <Text style={{ fontSize: 11, color: '#D97706', fontWeight: '700', fontStyle: 'italic', marginTop: 4, textAlign: 'center', paddingHorizontal: 16 }}>
                  (Modifiez le surcoût de l'option ci-dessus pour proposer votre tarif final de trajet personnalisé au passager)
                </Text>
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
                    onPress={() => {
                      const p = parseInt(pricePerSeatInput) || 0;
                      if (isNaN(p) || p < 0) {
                        Vibration.vibrate(200);
                      } else {
                        handleResponse('accept', p);
                      }
                    }}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                    <Text style={styles.btnTextAccept}>Accepter</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
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
  navigationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginTop: 12,
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 8,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 4,
  },
  navButtonDisabled: {
    opacity: 0.5,
  },
  navButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0066FF',
  },
  navButtonTextDisabled: {
    color: '#A1A1AA',
  },
});
