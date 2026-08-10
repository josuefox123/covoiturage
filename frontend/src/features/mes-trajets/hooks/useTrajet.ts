import { useMemo } from 'react';
import { ResolveurMission } from '../resolution/resolveur-mission';
import { Mission } from '../types/types-mission';

/**
 * Hook utilitaire pour résoudre la mission d'un item (booking ou ride).
 * Mémoïse le résultat pour éviter les recalculs inutiles.
 */
export function useTrajet(item: any, role: 'passenger' | 'driver' = 'passenger'): Mission {
  return useMemo(() => {
    return ResolveurMission.resolveMission(item, role);
  }, [item, role]);
}
