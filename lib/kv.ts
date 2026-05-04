import { kv } from '@vercel/kv';
import type { StoredEvent } from '@/lib/types';

const KV_KEY = 'selling_price_events';
const MAX_EVENTS = 500;

export async function storeEvent(event: StoredEvent): Promise<void> {
  await kv.lpush(KV_KEY, JSON.stringify(event));
  await kv.ltrim(KV_KEY, 0, MAX_EVENTS - 1);
}

export async function getEvents(): Promise<StoredEvent[]> {
  const raw = await kv.lrange(KV_KEY, 0, -1);
  return raw.map((item) =>
    typeof item === 'string' ? (JSON.parse(item) as StoredEvent) : (item as StoredEvent),
  );
}
