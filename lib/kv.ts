import type { StoredEvent, StoredSubscription } from '@/lib/types';
import { createClient } from '@vercel/edge-config';

const MAX_EVENTS = 500;
const MAX_SUBSCRIPTIONS = 100;
const EC_KEY = 'subscriptions';

// ---------------------------------------------------------------------------
// Events — in-memory only (ephemeral demo data, high volume, not worth storing)
// ---------------------------------------------------------------------------

const store: StoredEvent[] = [];

export async function storeEvent(event: StoredEvent): Promise<void> {
  store.unshift(event);
  if (store.length > MAX_EVENTS) store.splice(MAX_EVENTS);
}

export async function getEvents(): Promise<StoredEvent[]> {
  return [...store];
}

export async function clearEvents(): Promise<void> {
  store.splice(0, store.length);
}

// ---------------------------------------------------------------------------
// Subscriptions — persisted in Vercel Edge Config
// Falls back to in-memory when Edge Config is not configured (local dev).
// ---------------------------------------------------------------------------

const memSubs: StoredSubscription[] = []; // fallback for local dev

function isEdgeConfigAvailable(): boolean {
  return !!process.env.EDGE_CONFIG;
}

async function readFromEdgeConfig(): Promise<StoredSubscription[]> {
  try {
    const client = createClient(process.env.EDGE_CONFIG!);
    const val = await client.get<StoredSubscription[]>(EC_KEY);
    return Array.isArray(val) ? val : [];
  } catch (err) {
    console.error('[kv] edge config read failed:', err);
    return [];
  }
}

async function writeToEdgeConfig(subs: StoredSubscription[]): Promise<void> {
  const token = process.env.VERCEL_API_TOKEN;
  const configId = process.env.EDGE_CONFIG_ID;
  if (!token || !configId) {
    console.warn('[kv] VERCEL_API_TOKEN or EDGE_CONFIG_ID not set — subscription not persisted');
    return;
  }
  const res = await fetch(`https://api.vercel.com/v1/edge-config/${configId}/items`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: [{ operation: 'upsert', key: EC_KEY, value: subs }] }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error('[kv] edge config write failed:', res.status, body);
  }
}

export async function storeSubscription(sub: StoredSubscription): Promise<void> {
  if (!isEdgeConfigAvailable()) {
    memSubs.unshift(sub);
    if (memSubs.length > MAX_SUBSCRIPTIONS) memSubs.splice(MAX_SUBSCRIPTIONS);
    return;
  }
  const existing = await readFromEdgeConfig();
  const updated = [sub, ...existing.filter((s) => s.subscription_id !== sub.subscription_id)];
  if (updated.length > MAX_SUBSCRIPTIONS) updated.splice(MAX_SUBSCRIPTIONS);
  await writeToEdgeConfig(updated);
}

export async function getSubscriptions(): Promise<StoredSubscription[]> {
  if (!isEdgeConfigAvailable()) return [...memSubs];
  return readFromEdgeConfig();
}
