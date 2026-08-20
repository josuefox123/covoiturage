/**
 * ==============================================================
 * LocationPicker.tsx — Point d'entrée rétrocompatible
 * ==============================================================
 * 
 * Ce fichier sert de wrapper léger vers le composant modulaire
 * divisé dans le dossier 'mapsrecherche' pour garantir la
 * rétrocompatibilité complète des imports dans tout le projet.
 */

import LocationPicker from './mapsrecherche/LocationPicker';
export { LocationData, LocationPickerProps } from './mapsrecherche/types';
export default LocationPicker;
