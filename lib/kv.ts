import type { StoredEvent } from '@/lib/types';

const KV_KEY = 'selling_price_events';
const MAX_EVENTS = 500;

function isConfigured(): boolean {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

async function getKv() {
  const { kv } = await import('@vercel/kv');
  return kv;
}

export async function storeEvent(event: StoredEvent): Promise<void> {
  if (!isConfigured()) return;
  const kv = await getKv();
  await kv.lpush(KV_KEY, JSON.stringify(event));
  await kv.ltrim(KV_KEY, 0, MAX_EVENTS - 1);
}

export async function getEvents(): Promise<StoredEvent[]> {
  if (!isConfigured()) return [];
  const kv = await getKv();
  const raw = await kv.lrange(KV_KEY, 0, -1);
  return raw.map((item) =>
    typeof item === 'string' ? (JSON.parse(item) as StoredEvent) : (item as StoredEvent),
  );
}
