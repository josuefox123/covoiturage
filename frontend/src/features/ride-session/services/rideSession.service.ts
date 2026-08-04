import { SegmentIdentifier } from '../types/rideSession.types';

export class RideSessionService {
  public static async fetchRideAndBookingState(
    authFetch: any,
    segment: SegmentIdentifier
  ): Promise<{ ride: any; bookingState: any }> {
    if (!authFetch || !segment.rideId) {
      throw new Error('authFetch et rideId requis');
    }

    const { rideId, departureWaypointOrder, arrivalWaypointOrder } = segment;

    let stateUrl = `/rides/${rideId}/booking-state/`;
    const queryParams: string[] = [];

    if (departureWaypointOrder !== undefined) {
      queryParams.push(`departure_order=${departureWaypointOrder}`);
    }
    if (arrivalWaypointOrder !== undefined) {
      queryParams.push(`arrival_order=${arrivalWaypointOrder}`);
    }

    if (queryParams.length > 0) {
      stateUrl += `?${queryParams.join('&')}`;
    }

    const [rideData, stateData] = await Promise.all([
      authFetch(`/rides/${rideId}/`),
      authFetch(stateUrl).catch(() => null)
    ]);

    return {
      ride: rideData,
      bookingState: stateData
    };
  }

  public static async createBooking(
    authFetch: any,
    params: {
      rideId: string;
      seatsBooked: number;
      departureLocation?: string;
      arrivalLocation?: string;
      customPrice?: number;
      message?: string;
      departureWaypointOrder?: number;
      arrivalWaypointOrder?: number;
    }
  ): Promise<any> {
    return authFetch('/bookings/', {
      method: 'POST',
      body: JSON.stringify({
        ride: params.rideId,
        seats_booked: params.seatsBooked,
        departure_location: params.departureLocation,
        arrival_location: params.arrivalLocation,
        passenger_proposed_price: params.customPrice,
        negotiation_message: params.message,
        departure_waypoint_order: params.departureWaypointOrder,
        arrival_waypoint_order: params.arrivalWaypointOrder
      })
    });
  }

  public static async acceptOffer(authFetch: any, bookingId: string): Promise<any> {
    return authFetch(`/bookings/${bookingId}/passenger_accept/`, {
      method: 'POST'
    });
  }

  public static async rejectOffer(authFetch: any, bookingId: string): Promise<any> {
    return authFetch(`/bookings/${bookingId}/passenger_reject/`, {
      method: 'POST'
    });
  }

  public static async cancelBooking(authFetch: any, bookingId: string): Promise<any> {
    return authFetch(`/bookings/${bookingId}/cancel/`, {
      method: 'POST'
    });
  }
}
