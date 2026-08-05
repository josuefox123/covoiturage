/**
 * ==============================================================
 * Fichier :
 * websocketService.ts
 *
 * Description :
 * Composant ou logique de l'application Zemy.
 *
 * Projet :
 * Zemy
 * ==============================================================
 */
/**
 * Service WebSocket pour le chat en temps réel.
 *
 * Connexion : ws://<host>/ws/chat/<conversationId>/?token=<JWT>
 *
 * Usage :
 *   const ws = new WebSocketService(url, token);
 *   ws.onMessage = (msg) => ...;
 *   ws.connect();
 *   ws.sendMessage("Bonjour !");
 *   ws.disconnect();
 */

export type WSMessage = {
  type: 'message' | 'typing' | 'read' | 'error';
  message?: {
    id: string;
    content: string;
    sender: string;
    sender_details: { id: string; full_name: string; avatar: string | null };
    created_at: string;
    message_type: string;
    is_read: boolean;
  };
  user_id?: string;
  is_typing?: boolean;
  error?: string;
};

export class WebSocketService {
  private ws: WebSocket | null = null;
  private url: string;
  private token: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // ms, doublé à chaque tentative
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private shouldReconnect = true;

  // Callbacks publics
  onMessage: ((msg: WSMessage) => void) | null = null;
  onOpen: (() => void) | null = null;
  onClose: (() => void) | null = null;
  onError: ((error: Event) => void) | null = null;
  onReconnecting: ((attempt: number) => void) | null = null;

  constructor(url: string, token: string) {
    this.url = url;
    this.token = token;
  }

  connect() {
    // Désactivé temporairement en raison des limitations de handshake Upgrade sur LiteSpeed (PlanetHoster N0C)
    // Utilisation du fallback HTTP REST pour le chat.
    console.log('[WS] WebSocket Chat désactivé temporairement. Utilisation du fallback HTTP REST.');
    return;
  }

  disconnect() {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close(1000, 'Fermeture volontaire');
      this.ws = null;
    }
  }

  sendMessage(content: string) {
    this._send({ type: 'message', content });
  }

  sendTyping(isTyping: boolean) {
    this._send({ type: 'typing', is_typing: isTyping });
  }

  sendReadReceipt() {
    this._send({ type: 'read' });
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private _send(data: object) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.warn('[WS] Tentative d\'envoi hors connexion, message ignoré');
    }
  }

  private _scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn('[WS] Nombre maximum de reconnexions atteint');
      return;
    }

    this.reconnectAttempts++;
    this.onReconnecting?.(this.reconnectAttempts);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, this.reconnectDelay);

    // Backoff exponentiel : 1s, 2s, 4s, 8s, 16s
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, 16000);
  }
}

export function buildWsUrl(apiBaseUrl: string, conversationId: string): string {
  let wsBase = apiBaseUrl
    .replace(/^https:\/\//, 'wss://')
    .replace(/^http:\/\//, 'ws://')
    .replace(/\/+$/, ''); // supprimer le slash final

  if (wsBase.endsWith('/api')) {
    wsBase = wsBase.substring(0, wsBase.length - 4);
  }

  return `${wsBase}/ws/chat/${conversationId}/`;
}

/**
 * Construit l'URL WebSocket pour les notifications de statut de réservation.
 */
export function buildBookingWsUrl(apiBaseUrl: string, bookingId: string): string {
  let wsBase = apiBaseUrl
    .replace(/^https:\/\//, 'wss://')
    .replace(/^http:\/\//, 'ws://')
    .replace(/\/+$/, '');

  if (wsBase.endsWith('/api')) {
    wsBase = wsBase.substring(0, wsBase.length - 4);
  }

  return `${wsBase}/ws/booking/${bookingId}/`;
}

export type BookingWSMessage = {
  type: 'booking_status_update';
  booking_id: string;
  status: string;
  amount?: number;
  payment_status?: string;
};

/**
 * Service WebSocket léger pour les mises à jour de statut de réservation.
 *
 * Usage :
 *   const ws = new BookingWebSocketService(bookingId, token, apiBaseUrl);
 *   ws.onUpdate = (msg) => { /* mettre à jour le state * / };
 *   ws.connect();
 *   // Nettoyage :
 *   ws.disconnect();
 */
export class BookingWebSocketService {
  private ws: WebSocket | null = null;
  private url: string;
  private token: string;
  private shouldReconnect = true;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = 2000;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  onUpdate: ((msg: BookingWSMessage) => void) | null = null;
  onOpen: (() => void) | null = null;
  onClose: (() => void) | null = null;

  constructor(bookingId: string, token: string, apiBaseUrl: string) {
    this.url = buildBookingWsUrl(apiBaseUrl, bookingId);
    this.token = token;
  }

  connect() {
    // Désactivé temporairement en raison des limitations de handshake Upgrade sur LiteSpeed (PlanetHoster N0C)
    // Le synchronisateur utilisera automatiquement le fallback HTTP polling de 30 secondes.
    console.log('[BookingWS] WebSocket Réservation désactivé temporairement. Utilisation du fallback HTTP polling.');
    return;
  }

  disconnect() {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close(1000, 'Fermeture volontaire');
      this.ws = null;
    }
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private _scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return;
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, this.reconnectDelay);
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, 16000);
  }
}
