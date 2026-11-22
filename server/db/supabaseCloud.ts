import { MemorySnapshot } from '../repositories/MemoryStorageRepository.js';

export interface RealtimeBroadcastEvent {
  event: string;
  payload: any;
  targetPlayerId?: string;
}

const BUCKET_NAME = 'enscribe-store';
const OBJECT_NAME = 'state.json';

export class SupabaseCloudSync {
  private url: string;
  private serviceKey: string;
  private bucketReady = false;

  constructor() {
    this.url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
    this.serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  }

  isConfigured(): boolean {
    return Boolean(this.url && this.serviceKey);
  }

  private headers(extra?: Record<string, string>): Record<string, string> {
    return {
      apikey: this.serviceKey,
      Authorization: `Bearer ${this.serviceKey}`,
      ...(extra || {}),
    };
  }

  async ensureBucket(): Promise<void> {
    if (!this.isConfigured() || this.bucketReady) return;
    const listRes = await fetch(`${this.url}/storage/v1/bucket`, {
      headers: this.headers(),
    });
    if (listRes.ok) {
      const buckets = (await listRes.json()) as Array<{ id: string; name: string }>;
      if (buckets.some((b) => b.id === BUCKET_NAME || b.name === BUCKET_NAME)) {
        this.bucketReady = true;
        return;
      }
    }

    const createRes = await fetch(`${this.url}/storage/v1/bucket`, {
      method: 'POST',
      headers: this.headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        id: BUCKET_NAME,
        name: BUCKET_NAME,
        public: false,
      }),
    });
    if (createRes.ok || createRes.status === 409) {
      this.bucketReady = true;
    } else {
      const text = await createRes.text().catch(() => '');
      throw new Error(`Failed ensuring Supabase bucket: ${createRes.status} ${text}`);
    }
  }

  async loadSnapshot(): Promise<MemorySnapshot | null> {
    if (!this.isConfigured()) return null;
    await this.ensureBucket();
    const res = await fetch(`${this.url}/storage/v1/object/${BUCKET_NAME}/${OBJECT_NAME}`, {
      headers: this.headers({ 'Cache-Control': 'no-cache' }),
    });
    if (res.status === 404 || res.status === 400) {
      return null;
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Failed loading Supabase snapshot: ${res.status} ${text}`);
    }
    return (await res.json()) as MemorySnapshot;
  }

  async saveSnapshot(snapshot: MemorySnapshot): Promise<void> {
    if (!this.isConfigured()) return;
    await this.ensureBucket();
    const payload = JSON.stringify(snapshot);
    let res = await fetch(`${this.url}/storage/v1/object/${BUCKET_NAME}/${OBJECT_NAME}`, {
      method: 'PUT',
      headers: this.headers({
        'Content-Type': 'application/json',
        'x-upsert': 'true',
      }),
      body: payload,
    });
    if (res.status === 404 || res.status === 400) {
      res = await fetch(`${this.url}/storage/v1/object/${BUCKET_NAME}/${OBJECT_NAME}`, {
        method: 'POST',
        headers: this.headers({
          'Content-Type': 'application/json',
          'x-upsert': 'true',
        }),
        body: payload,
      });
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Failed saving Supabase snapshot: ${res.status} ${text}`);
    }
  }

  async broadcastRealtime(events: RealtimeBroadcastEvent[]): Promise<void> {
    if (!this.isConfigured() || events.length === 0) return;
    const messages = events.map((e) => ({
      topic: 'enscribe-global',
      event: e.event,
      payload: {
        targetPlayerId: e.targetPlayerId ?? null,
        data: e.payload,
      },
    }));
    await fetch(`${this.url}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: this.headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ messages }),
    }).catch((err) => {
      console.error('[SupabaseRealtime] Broadcast warning:', err);
    });
  }
}
