import { RideSessionData, SegmentIdentifier } from '../types/rideSession.types';

export class RideCache {
  private static instance: RideCache;
  private cache: Map<string, { data: RideSessionData; timestamp: number }> = new Map();
  private readonly TTL_MS = 60000; // 1 min TTL for performance only

  private constructor() {}

  public static getInstance(): RideCache {
    if (!RideCache.instance) {
      RideCache.instance = new RideCache();
    }
    return RideCache.instance;
  }

  public get(key: string): RideSessionData | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const age = Date.now() - entry.timestamp;
    if (age > this.TTL_MS) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  public set(key: string, data: RideSessionData): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  public invalidate(key: string): void {
    this.cache.delete(key);
  }

  public destroy(): void {
    this.cache.clear();
  }
}

export const rideCache = RideCache.getInstance();
