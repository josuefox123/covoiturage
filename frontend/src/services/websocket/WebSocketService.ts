/**
 * ==============================================================
 * Fichier : WebSocketService.ts
 *
 * Description :
 * Service client WebSocket autonome et haute résilience pour React Native / Expo.
 * Connecte l'application au backend Django Channels en temps réel.
 *
 * Fonctionnalités :
 * - Détection automatique SSL (wss:// vs ws://)
 * - Reconnexion automatique avec Exponential Backoff
 * - Keep-alive Heartbeat (ping/pong)
 * - Traitement instantané des notifications et événements UI
 * ==============================================================
 */

import { DeviceEventEmitter, Platform } from 'react-native';
import * as Speech from 'expo-speech';
import { rideEventBus } from '../../features/ride-session/manager/EventBus';

export class WebSocketService {
  private static instance: WebSocketService | null = null;
  private socket: WebSocket | null = null;
  private token: string | null = null;
  private baseUrl: string = '';
  private reconnectAttempts = 0;
  private maxReconnectDelay = 30000;
  private heartbeatInterval: any = null;
  private isExplicitlyClosed = false;

  private constructor() {}

  public static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  /**
   * Initialise et ouvre la connexion WebSocket avec le serveur Django Channels.
   */
  public connect(token: string, apiBaseUrl: string) {
    if (Platform.OS === 'web') return; // Optionnel sur web

    this.token = token;
    this.baseUrl = apiBaseUrl;
    this.isExplicitlyClosed = false;

    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.initSocket();
  }

  private initSocket() {
    if (!this.token || !this.baseUrl) return;

    try {
      // Construire l'URL WebSocket sécurisée (wss:// pour https://, ws:// pour http://)
      let wsUrl = this.baseUrl.replace(/^http/, 'ws').replace(/\/+$/, '').replace(/\/api$/, '');
      const fullWsUrl = `${wsUrl}/ws/notifications/?token=${encodeURIComponent(this.token)}`;

      console.log('[WebSocket] Connexion en cours vers :', fullWsUrl);
      this.socket = new WebSocket(fullWsUrl);

      this.socket.onopen = this.handleOpen.bind(this);
      this.socket.onmessage = this.handleMessage.bind(this);
      this.socket.onerror = this.handleError.bind(this);
      this.socket.onclose = this.handleClose.bind(this);
    } catch (error) {
      console.warn('[WebSocket] Échec initialisation socket :', error);
      this.scheduleReconnect();
    }
  }

  private handleOpen() {
    console.log('[WebSocket] Connecté avec succès au serveur en direct !');
    this.reconnectAttempts = 0;
    this.startHeartbeat();

    DeviceEventEmitter.emit('wsStatusChange', { connected: true });
  }

  private handleMessage(event: WebSocketMessageEvent) {
    try {
      const payload = JSON.parse(event.data);

      if (payload.type === 'pong') return; // Accusé de réception heartbeat

      if (payload.type === 'notification') {
        const { title, message, data } = payload;

        // 1. Annonce vocale TTS si disponible
        const speakTypes = [
          'new_booking_request',
          'booking_accepted_passenger',
          'passenger_paid_driver',
          'passenger_refused_offer',
          'leg_seats_freed_driver',
          'booking_cancelled',
          'booking_expired'
        ];
        
        if (data?.type && speakTypes.includes(data.type)) {
          try {
            Speech.speak(message || title, { language: 'fr' });
          } catch (e) {
            console.warn('[WebSocket] TTS Error :', e);
          }
        }

        // 2. Émettre un événement global pour afficher la bannière / pop-up
        DeviceEventEmitter.emit('realtimeNotification', { title, message, data });

        // 3. Déclencher les modales d'action spécifiques
        if (data?.type === 'new_booking_request') {
          DeviceEventEmitter.emit('showBookingRequest', {
            id: data.booking_id,
            departure_location: data.departure_location || '',
            arrival_location: data.arrival_location || '',
            seats_booked: parseInt(data.seats_booked || '1'),
            total_amount: parseInt(data.total_amount || '0'),
            created_at: data.created_at || new Date().toISOString(),
            negotiation_message: data.negotiation_message || '',
            passenger_details: {
              full_name: data.passenger_name || 'Passager',
              phone: data.passenger_phone || ''
            }
          });
        } else if (data?.type === 'booking_accepted_passenger') {
          DeviceEventEmitter.emit('refreshRideDetails');
          if (data?.ride_id) {
            rideEventBus.emit({
              type: 'SessionReloadRequested',
              rideId: String(data.ride_id),
              bookingId: data.booking_id ? String(data.booking_id) : undefined,
              timestamp: Date.now()
            });
          }
        }
      }
    } catch (e) {
      console.warn('[WebSocket] Erreur parsing message :', e);
    }
  }

  private handleError(event: Event) {
    console.warn('[WebSocket] Erreur survenue :', event);
  }

  private handleClose(event: WebSocketCloseEvent) {
    console.log(`[WebSocket] Déconnecté (code: ${event.code})`);
    this.stopHeartbeat();
    DeviceEventEmitter.emit('wsStatusChange', { connected: false });

    if (!this.isExplicitlyClosed) {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), this.maxReconnectDelay);
    console.log(`[WebSocket] Tentative de reconnexion dans ${delay / 1000}s (Essai n°${this.reconnectAttempts})...`);
    setTimeout(() => {
      if (!this.isExplicitlyClosed) {
        this.initSocket();
      }
    }, delay);
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({ type: 'ping' }));
      }
    }, 25000);
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Ferme proprement la connexion (ex: lors de la déconnexion utilisateur).
   */
  public disconnect() {
    this.isExplicitlyClosed = true;
    this.stopHeartbeat();
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.token = null;
  }
}

export const wsService = WebSocketService.getInstance();
