import { useState, useEffect, useCallback, useRef } from 'react';
import { DeviceEventEmitter } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Ride, Booking } from '../../../src/types';
import { CustomAlert } from '../../../src/utils/CustomAlert';
import { BookingWebSocketService } from '../../../src/services/websocketService';
import { API_URL } from '../../../src/services/api';

export function useRideDetails(
  id: string,
  departure?: string,
  destination?: string,
  passenger_dep_lat?: string,
  passenger_dep_lon?: string,
  passenger_arr_lat?: string,
  passenger_arr_lon?: string,
  dep_waypoint_order?: string,
  arr_waypoint_order?: string,
  authFetch?: any,
  user?: any,
  createBooking?: any
) {
  const router = useRouter();
  const [ride, setRide] = useState<Ride | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasBooked, setHasBooked] = useState(false);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [myBooking, setMyBooking] = useState<Booking | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [bookingState, setBookingState] = useState<any>(null);
  const [portionMetrics, setPortionMetrics] = useState<{ distanceKm: number; durationMin: number } | null>(null);
  const bookingWsRef = useRef<BookingWebSocketService | null>(null);

  // Fetch portion metrics (OSRM)
  useEffect(() => {
    const fetchMetrics = async () => {
      if (passenger_dep_lat && passenger_dep_lon && passenger_arr_lat && passenger_arr_lon) {
        try {
          const lat1 = parseFloat(passenger_dep_lat);
          const lon1 = parseFloat(passenger_dep_lon);
          const lat2 = parseFloat(passenger_arr_lat);
          const lon2 = parseFloat(passenger_arr_lon);
          if (!isNaN(lat1) && !isNaN(lon1) && !isNaN(lat2) && !isNaN(lon2)) {
            const url = `https://router.project-osrm.org/route/v1/driving/${lon1},${lat1};${lon2},${lat2}?overview=false`;
            const resp = await fetch(url);
            const data = await resp.json();
            if (data.routes && data.routes.length > 0) {
              const r = data.routes[0];
              setPortionMetrics({
                distanceKm: Math.round(r.distance / 1000),
                durationMin: Math.round(r.duration / 60)
              });
            }
          }
        } catch (err) {
          console.warn("Failed fetching portion metrics:", err);
        }
      }
    };
    fetchMetrics();
  }, [passenger_dep_lat, passenger_dep_lon, passenger_arr_lat, passenger_arr_lon]);

  const fetchRide = useCallback(async (showLoading = true) => {
    if (!authFetch) return;
    try {
      if (showLoading) setLoading(true);
      const queryParams = departure && destination ? `?departure=${encodeURIComponent(departure)}&destination=${encodeURIComponent(destination)}` : '';
      
      let data = await authFetch(`/rides/${id}/${queryParams}`);
      if (!data) {
        setLoading(false);
        return;
      }
      setRide(data);

      if (user) {
        let stateUrl = `/rides/${id}/booking-state/`;
        const paramsList = [];
        if (dep_waypoint_order !== undefined) {
          paramsList.push(`departure_order=${dep_waypoint_order}`);
        }
        if (arr_waypoint_order !== undefined) {
          paramsList.push(`arrival_order=${arr_waypoint_order}`);
        }
        if (paramsList.length > 0) {
          stateUrl += `?${paramsList.join('&')}`;
        }
        
        try {
          const stateData = await authFetch(stateUrl);
          setBookingState(stateData);

          if (stateData && stateData.booking_id) {
            setHasBooked(true);
            setBookingId(stateData.booking_id);
            setMyBooking({
              id: stateData.booking_id,
              status: stateData.status,
              payment_status: stateData.payment_status,
              amount_paid_online: stateData.price,
              departure_location: stateData.departure_location,
              arrival_location: stateData.arrival_location,
              seats_booked: stateData.seats_booked || 1,
              pricing_breakdown: stateData.pricing_breakdown,
              driver_counter_price: stateData.driver_counter_price,
              passenger_proposed_price: stateData.passenger_proposed_price,
              custom_price: stateData.custom_price,
            } as any);

            if (stateData.action === 'offer_received') {
              DeviceEventEmitter.emit('showDriverOffer', {
                bookingId: stateData.booking_id,
                driverPrice: stateData.pricing_breakdown?.driver_price ?? stateData.price,
                commission: stateData.pricing_breakdown?.commission ?? 0,
                totalToPay: stateData.price,
                departureLocation: stateData.departure_location,
                arrivalLocation: stateData.arrival_location,
              });
            }
          } else {
            setHasBooked(false);
            setBookingId(null);
            setMyBooking(null);
          }
        } catch (e) {
          console.warn("Could not fetch booking state:", e);
        }

        if (data.driver_details?.id === user.id) {
          try {
            const allBookings: Booking[] = await authFetch(`/bookings/?ride=${id}`);
            setBookings(Array.isArray(allBookings) ? allBookings : (allBookings as any)?.results || []);
          } catch (e) {
            console.warn("Could not fetch bookings list:", e);
          }
        }
      }
    } catch (error) {
      console.error("Error fetching ride:", error);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [id, departure, destination, dep_waypoint_order, arr_waypoint_order, authFetch, user]);

  useFocusEffect(
    useCallback(() => {
      setHasBooked(false);
      setBookingId(null);
      setMyBooking(null);
      setBookingState(null);
      fetchRide(true);
    }, [fetchRide])
  );

  useEffect(() => {
    const interval = setInterval(() => {
      fetchRide(false);
    }, 30000);

    const sub = DeviceEventEmitter.addListener('refreshRideDetails', () => {
      fetchRide(false);
    });

    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, [fetchRide]);

  // WebSocket
  useEffect(() => {
    if (!bookingId) {
      bookingWsRef.current?.disconnect();
      bookingWsRef.current = null;
      return;
    }

    const connectBookingWs = async () => {
      try {
        const { default: SecureStore } = await import('expo-secure-store');
        const storedToken = await SecureStore.getItemAsync('accessToken');
        if (!storedToken) return;

        bookingWsRef.current?.disconnect();

        const ws = new BookingWebSocketService(bookingId, storedToken, API_URL);
        ws.onUpdate = () => {
          fetchRide(false);
        };
        ws.connect();
        bookingWsRef.current = ws;
      } catch (e) {
        // ws fail fallback to polling
      }
    };

    connectBookingWs();

    return () => {
      bookingWsRef.current?.disconnect();
      bookingWsRef.current = null;
    };
  }, [bookingId, fetchRide]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchRide(false);
    setRefreshing(false);
  };

  const openChat = async () => {
    if (!authFetch) return;
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
    if (!authFetch || !user) return;
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
            participant_2: user.id
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

  const performBooking = async (seatsToBook: number, customPrice?: number, message?: string) => {
    if (bookingLoading || hasBooked || !createBooking) return;
    try {
      setBookingLoading(true);
      const depOrderNum = dep_waypoint_order !== undefined ? parseInt(dep_waypoint_order) : undefined;
      const arrOrderNum = arr_waypoint_order !== undefined ? parseInt(arr_waypoint_order) : undefined;

      const res = await createBooking(
        id,
        seatsToBook,
        departure,
        destination,
        customPrice,
        message,
        depOrderNum,
        arrOrderNum
      );
      if (res && res.id) {
        setBookingId(res.id);
        setHasBooked(true);
        await fetchRide(false);
        return true;
      }
    } catch (error: any) {
      CustomAlert.alert('Erreur', error.message || "Impossible de créer la réservation. Veuillez réessayer.");
    } finally {
      setBookingLoading(false);
    }
    return false;
  };

  const handlePassengerAccept = async (bId: string) => {
    if (!authFetch) return;
    setBookingLoading(true);
    try {
      const data = await authFetch(`/bookings/${bId}/passenger_accept/`, {
        method: 'POST'
      });
      if (data && !data.error) {
        CustomAlert.alert(
          "Succès",
          "Proposition acceptée ! Veuillez procéder au paiement pour confirmer votre réservation.",
          [
            {
              text: "Payer",
              onPress: () => {
                router.push({
                  pathname: '/payment',
                  params: {
                    booking_id: String(bId),
                    amount: String(data.amount_paid_online || (myBooking?.amount_paid_online || 0))
                  }
                });
              }
            }
          ]
        );
        await fetchRide(false);
        return true;
      }
    } catch (err: any) {
      CustomAlert.alert("Erreur", err.message || "Impossible d'accepter la proposition.");
    } finally {
      setBookingLoading(false);
    }
    return false;
  };

  const handlePassengerReject = async (bId: string) => {
    if (!authFetch) return;
    setBookingLoading(true);
    try {
      const data = await authFetch(`/bookings/${bId}/passenger_reject/`, {
        method: 'POST'
      });
      if (data && !data.error) {
        CustomAlert.alert("Annulée", "La demande de réservation est annulée.");
        await fetchRide(false);
        return true;
      }
    } catch (err: any) {
      CustomAlert.alert("Erreur", err.message || "Impossible de refuser la proposition.");
    } finally {
      setBookingLoading(false);
    }
    return false;
  };

  const handleCancelBooking = async () => {
    if (!bookingId || !authFetch) return;
    try {
      setBookingLoading(true);
      await authFetch(`/bookings/${bookingId}/cancel/`, { method: 'POST' });
      setHasBooked(false);
      setBookingId(null);
      await fetchRide(false);
      CustomAlert.alert('Succès', 'Votre réservation a été annulée. Si vous êtes éligible, votre demande de remboursement est en cours de traitement.');
      return true;
    } catch (error: any) {
      CustomAlert.alert('Erreur', error.message || 'Impossible d\'annuler la réservation.');
    } finally {
      setBookingLoading(false);
    }
    return false;
  };

  return {
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
  };
}
