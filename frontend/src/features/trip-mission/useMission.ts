import { useMemo } from 'react';
import { MissionResolver } from './MissionResolver';
import { Mission } from './MissionTypes';

export function useMission(item: any, role: 'passenger' | 'driver' = 'passenger'): Mission {
  return useMemo(() => {
    return MissionResolver.resolveMission(item, role);
  }, [item, role]);
}
