import { Capacitor } from '@capacitor/core';
import { createClient, RealtimeChannel } from '@supabase/supabase-js';
import { io, Socket } from 'socket.io-client';

const DEFAULT_SUPABASE_URL = 'https://llqiguxvkgkfdbsbzsbo.supabase.co';
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_8S0QfpHMM4dhZyOjtPRHdw_mdZIhoZE';

type Listener = (payload: any) => void;

class UnifiedRealtimeClient {
  private listeners = new Map<string, Set<Listener>>();
  private activePlayerId: string = 'player_alex';
  private localSocket: Socket | null = null;
  private supabaseChannel: RealtimeChannel | null = null;
  private supabaseConnected = false;
  private localSocketConnected = false;
  public connected = false;

  constructor() {
    this.initSupabase();
    this.initGameSocket();
  }

  private syncConnectedState(): void {
    this.connected = this.supabaseConnected || this.localSocketConnected;
  }

  private initSupabase(): void {
    const url = (import.meta as any).env?.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
    const key = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) return;

    const client = createClient(url, key, {
      realtime: {
        params: {
          eventsPerSecond: 20,
        },
      },
    });

    const channel = client.channel('enscribe-global', {
      config: {
        broadcast: { self: false },
      },
    });

    const dispatchBroadcast = (event: string, rawPayload: any) => {
      const targetPlayerId = rawPayload?.targetPlayerId ?? null;
      if (targetPlayerId && targetPlayerId !== this.activePlayerId) {
        return;
      }
      const data = rawPayload && 'data' in rawPayload ? rawPayload.data : rawPayload;
      this.dispatchLocal(event, data);
    };

    const events = [
      'room:updated',
      'room:match_started',
      'match:state',
      'rooms:public_updated',
      'matchmaking:ranked_matched',
      'match:rematch_created',
      'match:typing_live',
      'gridit:room_updated',
      'gridit:rooms_updated',
      'gridit:match_started',
      'gridit:match_state',
      'gridit:match_delta',
      'gridit:matched',
      'gridit:rematch',
      'gridit:host_shake',
    ];

    for (const ev of events) {
      channel.on('broadcast', { event: ev }, (msg) => {
        dispatchBroadcast(ev, msg.payload);
      });
    }

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        this.supabaseConnected = true;
        this.syncConnectedState();
        this.dispatchLocal('connect', undefined);
      } else if (
        status === 'CLOSED' ||
        status === 'TIMED_OUT' ||
        status === 'CHANNEL_ERROR'
      ) {
        this.supabaseConnected = false;
        this.syncConnectedState();
      }
    });

    this.supabaseChannel = channel;
  }

  private initGameSocket(): void {
    if (Capacitor.isNativePlatform()) {
      // On Android/iOS always use Fly.io server
      const flyUrl = (import.meta as any).env?.VITE_GAME_SERVER_URL || 'https://enscribe-game.fly.dev';
      this.connectSocket(flyUrl);
      return;
    }
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      // Local dev — connect to local server
      this.connectSocket(undefined);
    } else {
      // Production web — connect to Fly.io
      const flyUrl = (import.meta as any).env?.VITE_GAME_SERVER_URL || 'https://enscribe-game.fly.dev';
      this.connectSocket(flyUrl);
    }
  }

  private connectSocket(url: string | undefined): void {
    const sock = io(url as any, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 600,
      transports: ['websocket'],
    });
    sock.on('connect', () => {
      this.localSocketConnected = true;
      this.syncConnectedState();
      this.dispatchLocal('connect', undefined);
    });
    sock.on('disconnect', () => {
      this.localSocketConnected = false;
      this.syncConnectedState();
    });
    const events = [
      'room:updated',
      'room:match_started',
      'match:state',
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
    ];
    for (const ev of events) {
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
    this.localSocket?.emit('auth:identify', playerId);
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
    if (event === 'match:typing' && this.supabaseChannel) {
      this.supabaseChannel
        .send({
          type: 'broadcast',
          event: 'match:typing_live',
          payload: {
            data: payload,
          },
        })
        .catch(() => undefined);
    }
    if (event === 'gridit:host_shake' && this.supabaseChannel) {
      this.supabaseChannel
        .send({
          type: 'broadcast',
          event: 'gridit:host_shake',
          payload: {
            data: payload,
          },
        })
        .catch(() => undefined);
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
