export interface Ride {
  id: string;
  driver: string;
  driver_details: {
    id?: string;
    full_name: string;
    avatar: string | null;
    rating: number;
    phone?: string;
    vehicle?: {
      model?: string;
      color?: string;
      plate_number?: string;
    };
    preference?: {
      music?: boolean;
      smoking?: boolean;
      chatty?: boolean;
      air_conditioner?: boolean;
    };
  };
  departure_location: string;
  arrival_location: string;
  departure_time: string;
  departure_date: string;
  price_per_seat: number;
  seats_available: number;
  total_seats: number;
  status: string;
  distance_km?: number;
}

export interface Booking {
  id: string;
  ride: string | Ride;
  passenger: string;
  passenger_details: {
    id?: string;
    full_name: string;
    avatar: string | null;
    phone?: string;
  };
  seats_booked: number;
  status: string;
}
