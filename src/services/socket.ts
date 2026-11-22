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
  public connected = false;

  constructor() {
    this.initSupabase();
    this.initLocalSocketIfLocalhost();
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
    ];

    for (const ev of events) {
      channel.on('broadcast', { event: ev }, (msg) => {
        dispatchBroadcast(ev, msg.payload);
      });
    }

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        this.connected = true;
        this.dispatchLocal('connect', undefined);
      }
    });

    this.supabaseChannel = channel;
  }

  private initLocalSocketIfLocalhost(): void {
    const host = window.location.hostname;
    if (host !== 'localhost' && host !== '127.0.0.1') {
      return;
    }
    const sock = io({
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 600,
    });
    sock.on('connect', () => {
      this.connected = true;
      this.dispatchLocal('connect', undefined);
    });
    const events = [
      'room:updated',
      'room:match_started',
      'match:state',
      'rooms:public_updated',
      'matchmaking:ranked_matched',
      'match:rematch_created',
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
