import { RideEventPayload, RideEventType } from '../types/rideSession.types';

type Listener = (event: RideEventPayload) => void;

export class EventBus {
  private static instance: EventBus;
  private listeners: Map<string, Set<Listener>> = new Map();

  private constructor() {}

  public static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  public subscribe(eventType: RideEventType | 'ALL', listener: Listener): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(listener);

    return () => {
      this.listeners.get(eventType)?.delete(listener);
    };
  }

  public emit(event: RideEventPayload): void {
    const typeListeners = this.listeners.get(event.type);
    if (typeListeners) {
      typeListeners.forEach((fn) => fn(event));
    }

    const allListeners = this.listeners.get('ALL');
    if (allListeners) {
      allListeners.forEach((fn) => fn(event));
    }
  }
}

export const rideEventBus = EventBus.getInstance();
