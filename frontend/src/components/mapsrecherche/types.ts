export interface LocationData {
  latitude: number;
  longitude: number;
  name: string;
  address?: string;
  city?: string;
  country?: string;
  distanceText?: string;
  distKm?: number;
  note?: string;
}

export interface LocationPickerProps {
  onLocationSelected: (location: LocationData) => void;
  onCancel: () => void;
  initialLocation?: LocationData;
  title?: string;
}
