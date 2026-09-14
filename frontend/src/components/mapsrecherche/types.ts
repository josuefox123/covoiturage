export interface SearchLocationResult {
  id: string;
  name: string;
  display_name: string;
  latitude: number;
  longitude: number;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    suburb?: string;
    neighbourhood?: string;
    road?: string;
    country?: string;
  };
  source: 'nominatim' | 'local';
}

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

