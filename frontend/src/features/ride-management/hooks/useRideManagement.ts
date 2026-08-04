import { useState, useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { Ride, Booking } from '../../../../src/types';
import { CustomAlert } from '../../../../src/utils/CustomAlert';

export function useRideManagement(id: string, authFetch: any, user: any) {
  const router = useRouter();
  const [ride, setRide] = useState<Ride | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [customPriceText, setCustomPriceText] = useState('');

  const statusAnim = useRef(new Animated.Value(1)).current;

  const loadData = async (showLoading = true) => {
    if (!authFetch) return;
    try {
      if (showLoading) setLoading(true);
      const [rideData, bookingsData] = await Promise.all([
        authFetch(`/rides/${id}/`),
        authFetch(`/bookings/?ride=${id}`)
      ]);
      setRide(rideData);
      setBookings(Array.isArray(bookingsData) ? bookingsData : bookingsData?.results || []);
    } catch (error: any) {
      if (showLoading) {
        CustomAlert.alert('Erreur', error.message || 'Impossible de charger le trajet.');
        router.back();
      }
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    loadData(true);

    const interval = setInterval(() => {
      loadData(false);
    }, 10000);

    return () => clearInterval(interval);
  }, [id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData(false);
    setRefreshing(false);
  };

  const playStatusAnimation = () => {
    Animated.sequence([
      Animated.timing(statusAnim, { toValue: 1.2, duration: 200, useNativeDriver: true }),
      Animated.spring(statusAnim, { toValue: 1, friction: 3, useNativeDriver: true })
    ]).start();
  };

  const handleAcceptBooking = async (bookingId: string, customPrice?: number) => {
    if (!authFetch) return;
    try {
      setLoading(true);
      const payload: any = {};
      if (customPrice !== undefined && !isNaN(customPrice)) {
        payload.custom_price = customPrice;
      }
      await authFetch(`/bookings/${bookingId}/accept/`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      CustomAlert.alert('Succès', 'La réservation a été acceptée. Le passager va procéder au paiement.');
      setEditingBooking(null);
      await loadData(false);
    } catch (error: any) {
      CustomAlert.alert('Erreur', error.message || "Impossible d'accepter la réservation.");
    } finally {
      setLoading(false);
    }
  };

  const handleRejectBooking = async (bookingId: string) => {
    if (!authFetch) return;
    CustomAlert.alert(
      'Refuser la réservation',
      'Voulez-vous vraiment refuser cette demande ?',
      [
        { text: 'Non', style: 'cancel' },
        {
          text: 'Oui, refuser',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await authFetch(`/bookings/${bookingId}/reject/`, { method: 'POST' });
              CustomAlert.alert('Succès', 'La demande a été déclinée.');
              await loadData(false);
            } catch (error: any) {
              CustomAlert.alert('Erreur', error.message || "Impossible de refuser la réservation.");
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleCancelRide = () => {
    if (!authFetch) return;
    CustomAlert.alert(
      'Annuler le trajet',
      'Êtes-vous sûr de vouloir annuler ce trajet ? Tous les passagers seront notifiés.',
      [
        { text: 'Non', style: 'cancel' },
        { 
          text: 'Oui, annuler', 
          style: 'destructive',
          onPress: async () => {
            try {
              await authFetch(`/rides/${id}/cancel/`, { method: 'POST' });
              setRide(prev => prev ? { ...prev, status: 'cancelled' } : null);
              playStatusAnimation();
              CustomAlert.alert('Succès', 'Le trajet a été annulé.');
            } catch (error: any) {
              CustomAlert.alert('Erreur', error.message || 'Impossible d\'annuler le trajet.');
            }
          }
        }
      ]
    );
  };

  const handleCompleteRide = () => {
    if (!authFetch) return;
    CustomAlert.alert(
      'Terminer le trajet',
      'Confirmez-vous que ce trajet est terminé avec succès ?',
      [
        { text: 'Non', style: 'cancel' },
        { 
          text: 'Oui, terminé', 
          onPress: async () => {
            try {
              await authFetch(`/rides/${id}/complete/`, { method: 'POST' });
              setRide(prev => prev ? { ...prev, status: 'completed' } : null);
              playStatusAnimation();
              CustomAlert.alert('Succès', 'Le trajet est marqué comme terminé.');
            } catch (error: any) {
              CustomAlert.alert('Erreur', error.message || 'Impossible de terminer le trajet.');
            }
          }
        }
      ]
    );
  };

  const handleChatWithPassenger = async (passengerId: string) => {
    if (!authFetch) return;
    try {
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
    }
  };

  return {
    ride,
    bookings,
    loading,
    refreshing,
    editingBooking,
    customPriceText,
    statusAnim,
    setEditingBooking,
    setCustomPriceText,
    onRefresh,
    handleAcceptBooking,
    handleRejectBooking,
    handleCancelRide,
    handleCompleteRide,
    handleChatWithPassenger,
  };
}
