// ─── Barrel file — Exports publics de la feature mes-trajets ─────────────────
//
// Importez depuis ce fichier pour accéder à tous les éléments de la feature.
// Exemple : import { CarteTrajet, ResolveurMission } from '@/src/features/mes-trajets';

// Types
export type {
  Mission,
  DonneesMission,
  ActionMission,
  EtatMission,
  TypeActionMission,
  // Alias de compatibilité
  MissionState,
  MissionData,
  MissionAction,
  MissionActionType
} from './types/types-mission';

// Résolution
export { ResolveurMission } from './resolution/resolveur-mission';
export { ResolveurPassager } from './resolution/resolveur-passager';
export { ResolveurConducteur } from './resolution/resolveur-conducteur';

// Composants
export { CarteTrajet } from './composants/CarteTrajet';
export { BadgeStatut } from './composants/BadgeStatut';
export { BoutonsAction } from './composants/BoutonsAction';
export { BarreProgression } from './composants/BarreProgression';
export { EnteteTrajet } from './composants/EnteteTrajet';
export { SwitcherRole } from './composants/SwitcherRole';
export { FiltresStatut } from './composants/FiltresStatut';
export { EtatVide } from './composants/EtatVide';

// Actions
export { GestionnaireActions } from './actions/gestionnaire-actions';

// Hooks
export { useTrajet } from './hooks/useTrajet';
