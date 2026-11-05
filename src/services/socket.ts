import { WSEvent } from '../types';
import { getStoredToken, getStoredUser } from './api';

type EventCallback = (payload: any) => void;

class SocketClient {
  private ws: WebSocket | null = null;
  private listeners = new Map<string, Set<EventCallback>>();
  private reconnectTimeout: any = null;
  private heartbeatInterval: any = null;
  private isExplicitlyClosed = false;

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.isExplicitlyClosed = false;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.authenticate();
        this.startHeartbeat();
        this.emitLocal('connection:change', { connected: true });
      };

      this.ws.onmessage = (event) => {
        try {
          const wsEvent: WSEvent = JSON.parse(event.data);
          this.dispatch(wsEvent.type, (wsEvent as any).payload);
        } catch (err) {
          console.error('Failed to parse WS message:', err);
        }
      };

      this.ws.onclose = () => {
        this.stopHeartbeat();
        this.emitLocal('connection:change', { connected: false });
        if (!this.isExplicitlyClosed) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (err) => {
        console.warn('WebSocket connection error:', err);
      };
    } catch (e) {
      console.error('WebSocket initialization error:', e);
      this.scheduleReconnect();
    }
  }

  private authenticate() {
    this.authenticateUser();
  }

  public authenticateUser(token?: string, userId?: string) {
    const t = token || getStoredToken();
    const u = userId || getStoredUser()?.id;
    if (t && u && this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.send({
        type: 'auth',
        payload: { token: t, userId: u },
      });
    }
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        // Send a lightweight ping
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 25000);
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimeout) return;
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.connect();
    }, 3000);
  }

  disconnect() {
    this.isExplicitlyClosed = true;
    this.stopHeartbeat();
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  send(event: WSEvent) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(event));
    } else {
      console.warn('Socket not connected, could not send:', event.type);
    }
  }

  on(eventType: string, callback: EventCallback) {
    let set = this.listeners.get(eventType);
    if (!set) {
      set = new Set();
      this.listeners.set(eventType, set);
    }
    set.add(callback);
    return () => this.off(eventType, callback);
  }

  off(eventType: string, callback: EventCallback) {
    const set = this.listeners.get(eventType);
    if (set) {
      set.delete(callback);
    }
  }

  private dispatch(eventType: string, payload: any) {
    const set = this.listeners.get(eventType);
    if (set) {
      for (const cb of set) {
        try {
          cb(payload);
        } catch (e) {
          console.error(`Error in socket listener for ${eventType}:`, e);
        }
      }
    }
  }

  private emitLocal(eventType: string, payload: any) {
    this.dispatch(eventType, payload);
  }

  reAuth() {
    this.authenticate();
  }
}

export const socket = new SocketClient();
