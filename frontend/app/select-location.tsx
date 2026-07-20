import React from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import LocationPicker, { LocationData } from '../src/components/LocationPicker';

export default function SelectLocationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ type?: string; title?: string }>();

  const title =
    params.title ||
    (params.type === 'arrival' || params.type === 'destination'
      ? "Lieu d'arrivée"
      : 'Lieu de départ');

  const handleLocationSelected = (location: LocationData) => {
    router.back();
  };

  return (
    <LocationPicker
      title={title}
      onLocationSelected={handleLocationSelected}
      onCancel={() => router.back()}
    />
  );
}
