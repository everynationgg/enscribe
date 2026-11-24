import { Capacitor } from '@capacitor/core';
import { io, Socket } from 'socket.io-client';

type Listener = (payload: any) => void;

const REALTIME_EVENTS = [
  'room:updated',
  'room:match_started',
  'match:state',
  'match:typing_live',
  'rooms:public_updated',
  'matchmaking:ranked_matched',
  'match:rematch_created',
  'gridit:room_updated',
  'gridit:rooms_updated',
  'gridit:match_started',
  'gridit:match_state',
  'gridit:match_delta',
  'gridit:matched',
  'gridit:rematch',
  'gridit:host_shake',
  'guessit:room_updated',
  'guessit:rooms_updated',
  'guessit:match_started',
  'guessit:match_state',
  'guessit:matched',
  'guessit:rematch',
  'twistit:room_updated',
  'twistit:rooms_updated',
  'twistit:match_started',
  'twistit:match_state',
  'twistit:quick_matched',
];

class UnifiedRealtimeClient {
  private listeners = new Map<string, Set<Listener>>();
  private activePlayerId: string | null = null;
  private localSocket: Socket | null = null;
  private localSocketConnected = false;
  public connected = false;

  constructor() {
    this.initGameSocket();
  }

  private syncConnectedState(): void {
    this.connected = this.localSocketConnected;
  }

  private initGameSocket(): void {
    if (Capacitor.isNativePlatform()) {
      const flyUrl =
        (import.meta as any).env?.VITE_GAME_SERVER_URL ||
        (import.meta as any).env?.VITE_API_BASE_URL ||
        'https://enscribe-game.fly.dev';
      this.connectSocket(flyUrl);
      return;
    }
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      // Local dev — connect through Vite WS proxy to local server
      this.connectSocket(undefined);
    } else {
      // Production web — connect directly to Fly.io
      const flyUrl =
        (import.meta as any).env?.VITE_GAME_SERVER_URL ||
        (import.meta as any).env?.VITE_API_BASE_URL ||
        'https://enscribe-game.fly.dev';
      this.connectSocket(flyUrl);
    }
  }

  private connectSocket(url: string | undefined): void {
    const sock = io(url as any, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 3000,
      transports: ['websocket'],
    });
    sock.on('connect', () => {
      this.localSocketConnected = true;
      this.syncConnectedState();
      if (this.activePlayerId) {
        sock.emit('auth:identify', this.activePlayerId);
      }
      this.dispatchLocal('connect', undefined);
    });
    sock.on('disconnect', () => {
      this.localSocketConnected = false;
      this.syncConnectedState();
    });
    for (const ev of REALTIME_EVENTS) {
      sock.on(ev, (payload) => this.dispatchLocal(ev, payload));
    }
    this.localSocket = sock;
  }

  private dispatchLocal(event: string, payload: any): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const fn of set) {
      try {
        fn(payload);
      } catch (err) {
        console.error(`[Realtime] listener error for ${event}:`, err);
      }
    }
  }

  setActivePlayerId(playerId: string): void {
    this.activePlayerId = playerId;
    if (this.localSocket?.connected) {
      this.localSocket.emit('auth:identify', playerId);
    }
  }

  on(event: string, fn: Listener): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(fn);
  }

  off(event: string, fn: Listener): void {
    this.listeners.get(event)?.delete(fn);
  }

  emit(event: string, payload?: any): void {
    if (event === 'auth:identify' && typeof payload === 'string') {
      this.activePlayerId = payload;
    }
    this.localSocket?.emit(event, payload);
  }
}

let hubInstance: UnifiedRealtimeClient | null = null;

export function getSocket(): UnifiedRealtimeClient {
  if (!hubInstance) {
    hubInstance = new UnifiedRealtimeClient();
  }
  return hubInstance;
}
