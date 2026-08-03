export interface BookingResponse {
    id: string;
    ride: string;
    passenger: string;
    seats_booked: number;
    status: string;
    payment_status: string;
    created_at: string;
    amount_paid_online?: number;
}

export const BookingService = {
    createBooking: async (
        authFetch: any,
        rideId: string,
        seatsBooked: number,
        departureLocation?: string,
        arrivalLocation?: string,
        passengerProposedPrice?: number,
        negotiationMessage?: string,
        departureWaypointOrder?: number,
        arrivalWaypointOrder?: number
    ): Promise<BookingResponse> => {
        try {
            const response = await authFetch('/bookings/', {
                method: 'POST',
                body: JSON.stringify({
                    ride: rideId,
                    seats_booked: seatsBooked,
                    departure_location: departureLocation,
                    arrival_location: arrivalLocation,
                    passenger_proposed_price: passengerProposedPrice,
                    negotiation_message: negotiationMessage,
                    departure_waypoint_order: departureWaypointOrder,
                    arrival_waypoint_order: arrivalWaypointOrder
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
