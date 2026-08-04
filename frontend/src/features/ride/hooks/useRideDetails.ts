import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'expo-router';
import { CustomAlert } from '../../../../src/utils/CustomAlert';
import { useRideSession } from '../../../ride-session/hooks/useRideSession';
import { useRideSynchronization } from '../../../ride-session/hooks/useRideSynchronization';

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
  const [chatLoading, setChatLoading] = useState(false);
  const [portionMetrics, setPortionMetrics] = useState<{ distanceKm: number; durationMin: number } | null>(null);

  const segment = useMemo(() => {
    return {
      rideId: id,
      departureWaypointOrder: dep_waypoint_order !== undefined ? parseInt(dep_waypoint_order) : undefined,
      arrivalWaypointOrder: arr_waypoint_order !== undefined ? parseInt(arr_waypoint_order) : undefined
    };
  }, [id, dep_waypoint_order, arr_waypoint_order]);

  const {
    session,
    ride,
    booking,
    primaryState,
    secondaryState,
    actionState,
    seats,
    negotiation,
    payment,
    permissions,
    loading,
    synchronizing,
    error,
    refreshSession,
    performBooking: executeBooking,
    acceptOffer: executeAcceptOffer,
    rejectOffer: executeRejectOffer,
    cancelBooking: executeCancelBooking
  } = useRideSession(segment);

  useRideSynchronization(segment, booking?.id);

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

  const onRefresh = async () => {
    await refreshSession();
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
    const success = await executeBooking(seatsToBook, customPrice, message);
    if (!success && error) {
      CustomAlert.alert('Erreur', error || "Impossible de créer la réservation. Veuillez réessayer.");
    }
    return success;
  };

  const handlePassengerAccept = async (bId: string) => {
    const success = await executeAcceptOffer(bId);
    if (success) {
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
                  amount: String(payment?.amountPaidOnline || negotiation?.totalToPay || 0)
                }
              });
            }
          }
        ]
      );
    } else if (error) {
      CustomAlert.alert("Erreur", error || "Impossible d'accepter la proposition.");
    }
    return success;
  };

  const handlePassengerReject = async (bId: string) => {
    const success = await executeRejectOffer(bId);
    if (success) {
      CustomAlert.alert("Annulée", "La demande de réservation est annulée.");
    } else if (error) {
      CustomAlert.alert("Erreur", error || "Impossible de refuser la proposition.");
    }
    return success;
  };

  const handleCancelBooking = async () => {
    if (!booking?.id) return false;
    const success = await executeCancelBooking(booking.id);
    if (success) {
      CustomAlert.alert('Succès', 'Votre réservation a été annulée. Si vous êtes éligible, votre demande de remboursement est en cours de traitement.');
    } else if (error) {
      CustomAlert.alert('Erreur', error || 'Impossible d\'annuler la réservation.');
    }
    return success;
  };

  return {
    session,
    ride,
    loading,
    refreshing: synchronizing,
    hasBooked: Boolean(booking?.id),
    bookingId: booking?.id || null,
    myBooking: booking,
    bookings: ride?.bookings || [],
    bookingLoading: loading,
    chatLoading,
    bookingState: session?.bookingStateRaw || null,
    portionMetrics,
    seats,
    negotiation,
    payment,
    permissions,
    primaryState,
    secondaryState,
    actionState,
    onRefresh,
    openChat,
    handleChatWithPassenger,
    performBooking,
    handlePassengerAccept,
    handlePassengerReject,
    handleCancelBooking,
    fetchRide: refreshSession
  };
}
