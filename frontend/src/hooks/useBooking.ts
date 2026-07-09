import { useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { BookingService, BookingResponse } from '../services/booking.service';

export const useBooking = () => {
    const { authFetch } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const createBooking = useCallback(async (rideId: string, seatsBooked: number): Promise<BookingResponse | null> => {
        setLoading(true);
        setError(null);
        try {
            const booking = await BookingService.createBooking(authFetch, rideId, seatsBooked);
            return booking;
        } catch (err: any) {
            const errMsg = err.error || err.message || "Erreur lors de la création de la réservation.";
            setError(errMsg);
            return null;
        } finally {
            setLoading(false);
        }
    }, [authFetch]);

    const cancelBooking = useCallback(async (bookingId: string): Promise<boolean> => {
        setLoading(true);
        setError(null);
        try {
            await BookingService.cancelBooking(authFetch, bookingId);
            return true;
        } catch (err: any) {
            const errMsg = err.error || err.message || "Erreur lors de l'annulation de la réservation.";
            setError(errMsg);
            return false;
        } finally {
            setLoading(false);
        }
    }, [authFetch]);

    return {
        createBooking,
        cancelBooking,
        loading,
        error
    };
};
