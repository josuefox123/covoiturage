export interface Ride {
  id: string;
  driver: string;
  driver_details: {
    full_name: string;
    avatar: string | null;
    rating: number;
  };
  departure_location: string;
  arrival_location: string;
  departure_time: string;
  departure_date: string;
  price_per_seat: number;
  seats_available: number;
  total_seats: number;
  status: string;
}

export interface Booking {
  id: string;
  ride: string;
  passenger: string;
  passenger_details: {
    full_name: string;
    avatar: string | null;
  };
  seats_booked: number;
  status: string;
}
