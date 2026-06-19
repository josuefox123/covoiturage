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
    if (this.ws?.readyState === WebSocket.OPEN) return;

    const fullUrl = `${this.url}?token=${this.token}`;
    this.ws = new WebSocket(fullUrl);

    this.ws.onopen = () => {
      console.log('[WS] Connecté au chat');
      this.reconnectAttempts = 0;
      this.reconnectDelay = 1000;
      this.onOpen?.();
    };

    this.ws.onmessage = (event) => {
      try {
        const data: WSMessage = JSON.parse(event.data);
        this.onMessage?.(data);
      } catch (e) {
        console.error('[WS] Erreur parsing message:', e);
      }
    };

    this.ws.onclose = (event) => {
      console.log(`[WS] Déconnecté (code=${event.code})`);
      this.onClose?.();

      // Ne pas se reconnecter si fermeture volontaire (4001=auth, 4003=forbidden)
      if (!this.shouldReconnect || event.code === 4001 || event.code === 4003) {
        return;
      }

      this._scheduleReconnect();
    };

    this.ws.onerror = (error) => {
      console.error('[WS] Erreur:', error);
      this.onError?.(error);
    };
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

    console.log(`[WS] Reconnexion dans ${this.reconnectDelay}ms (tentative ${this.reconnectAttempts})`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, this.reconnectDelay);

    // Backoff exponentiel : 1s, 2s, 4s, 8s, 16s
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, 16000);
  }
}

/**
 * Crée l'URL WebSocket en fonction de l'URL API de base.
 * ex: http://192.168.1.10:8000 → ws://192.168.1.10:8000/ws/chat/<id>/
 */
export function buildWsUrl(apiBaseUrl: string, conversationId: string): string {
  const wsBase = apiBaseUrl
    .replace(/^https:\/\//, 'wss://')
    .replace(/^http:\/\//, 'ws://')
    .replace(/\/+$/, ''); // supprimer le slash final

  return `${wsBase}/ws/chat/${conversationId}/`;
}
