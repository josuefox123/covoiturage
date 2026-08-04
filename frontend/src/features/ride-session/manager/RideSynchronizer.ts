import { rideSessionManager } from './RideSessionManager';
import { rideEventBus } from './EventBus';
import { BookingWebSocketService } from '../../../services/websocketService';
import { API_URL } from '../../../services/api';
import { SegmentIdentifier } from '../types/rideSession.types';

export class RideSynchronizer {
  private static instance: RideSynchronizer;
  private socketService: BookingWebSocketService | null = null;
  private pollingInterval: NodeJS.Timeout | null = null;
  private currentSegment: SegmentIdentifier | null = null;
  private currentAuthFetch: any = null;
  private currentUser: any = null;
  private unsubscribeBus: (() => void) | null = null;

  private constructor() {}

  public static getInstance(): RideSynchronizer {
    if (!RideSynchronizer.instance) {
      RideSynchronizer.instance = new RideSynchronizer();
    }
    return RideSynchronizer.instance;
  }

  public start(authFetch: any, user: any, segment: SegmentIdentifier): void {
    this.currentAuthFetch = authFetch;
    this.currentUser = user;
    this.currentSegment = segment;

    // Subscribe to EventBus
    if (!this.unsubscribeBus) {
      this.unsubscribeBus = rideEventBus.subscribe('ALL', (event) => {
        if (this.currentSegment && String(event.rideId) === String(this.currentSegment.rideId)) {
          this.triggerAtomicSync('EventBus:' + event.type);
        }
      });
    }

    // Initial session load
    rideSessionManager.loadSession(authFetch, segment, user);

    // Setup 30s polling
    this.stopPolling();
    this.pollingInterval = setInterval(() => {
      this.triggerAtomicSync('Polling:30s');
    }, 30000);
  }

  public stop(): void {
    this.stopPolling();
    this.disconnectWebSocket();
    if (this.unsubscribeBus) {
      this.unsubscribeBus();
      this.unsubscribeBus = null;
    }
    this.currentSegment = null;
    this.currentAuthFetch = null;
    this.currentUser = null;
  }

  public async setupWebSocket(bookingId: string | null): Promise<void> {
    if (!bookingId) {
      this.disconnectWebSocket();
      return;
    }

    try {
      const { default: SecureStore } = await import('expo-secure-store');
      const token = await SecureStore.getItemAsync('zemy_access_token');
      if (!token) return;

      this.disconnectWebSocket();

      const ws = new BookingWebSocketService(bookingId, token, API_URL);
      ws.onUpdate = () => {
        this.triggerAtomicSync('WebSocketUpdate');
      };
      ws.connect();
      this.socketService = ws;
    } catch (e) {
      // WS fallback to polling
    }
  }

  public triggerAtomicSync(source: string): void {
    if (!this.currentAuthFetch || !this.currentSegment || !this.currentUser) return;
    rideSessionManager.loadSession(this.currentAuthFetch, this.currentSegment, this.currentUser, {
      forceRefresh: true,
      silent: true
    });
  }

  private stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  private disconnectWebSocket(): void {
    if (this.socketService) {
      this.socketService.disconnect();
      this.socketService = null;
    }
  }
}

export const rideSynchronizer = RideSynchronizer.getInstance();
