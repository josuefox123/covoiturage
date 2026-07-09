export interface BookingResponse {
    id: string;
    ride: string;
    passenger: string;
    seats_booked: number;
    status: string;
    payment_status: string;
    created_at: string;
}

export const BookingService = {
    createBooking: async (authFetch: any, rideId: string, seatsBooked: number): Promise<BookingResponse> => {
        try {
            const response = await authFetch('/bookings/', {
                method: 'POST',
                body: JSON.stringify({
                    ride: rideId,
                    seats_booked: seatsBooked
                })
            });
            return response;
        } catch (error: any) {
            throw error;
        }
    },
    cancelBooking: async (authFetch: any, bookingId: string): Promise<any> => {
        try {
            const response = await authFetch(`/bookings/${bookingId}/cancel/`, {
                method: 'POST'
            });
            return response;
        } catch (error: any) {
            throw error;
        }
    }
};
