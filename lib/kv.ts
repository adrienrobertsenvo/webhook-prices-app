import type { StoredEvent, StoredSubscription } from '@/lib/types';
import { createClient } from '@vercel/edge-config';

const MAX_EVENTS = 50;
const MAX_SUBSCRIPTIONS = 100;

// ---------------------------------------------------------------------------
// Edge Config helpers
// ---------------------------------------------------------------------------

function isEdgeConfigAvailable(): boolean {
  return !!process.env.EDGE_CONFIG;
}

function edgeConfigClient() {
  return createClient(process.env.EDGE_CONFIG!);
}

async function ecRead<T>(key: string): Promise<T[]> {
  try {
    const val = await edgeConfigClient().get<T[]>(key);
    return Array.isArray(val) ? val : [];
  } catch (err) {
    console.error(`[kv] edge config read "${key}" failed:`, err);
    return [];
  }
}

async function ecWrite(key: string, value: unknown): Promise<void> {
  const token = process.env.VERCEL_API_TOKEN;
  const configId = process.env.EDGE_CONFIG_ID;
  if (!token || !configId) {
    console.warn('[kv] VERCEL_API_TOKEN or EDGE_CONFIG_ID not set — data not persisted');
    return;
  }
  const res = await fetch(`https://api.vercel.com/v1/edge-config/${configId}/items`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: [{ operation: 'upsert', key, value }] }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error(`[kv] edge config write "${key}" failed:`, res.status, body);
  }
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

const memEvents: StoredEvent[] = []; // fallback for local dev

export async function storeEvent(event: StoredEvent): Promise<void> {
  if (!isEdgeConfigAvailable()) {
    memEvents.unshift(event);
    if (memEvents.length > MAX_EVENTS) memEvents.splice(MAX_EVENTS);
    return;
  }
  const existing = await ecRead<StoredEvent>('events');
  const updated = [event, ...existing.filter((e) => e.webhook_event_id !== event.webhook_event_id)];
  if (updated.length > MAX_EVENTS) updated.splice(MAX_EVENTS);
  await ecWrite('events', updated);
}

export async function getEvents(): Promise<StoredEvent[]> {
  if (!isEdgeConfigAvailable()) return [...memEvents];
  return ecRead<StoredEvent>('events');
}

export async function clearEvents(): Promise<void> {
  if (!isEdgeConfigAvailable()) {
    memEvents.splice(0, memEvents.length);
    return;
  }
  await ecWrite('events', []);
}

// ---------------------------------------------------------------------------
// Subscriptions
// ---------------------------------------------------------------------------

const memSubs: StoredSubscription[] = []; // fallback for local dev

export async function storeSubscription(sub: StoredSubscription): Promise<void> {
  if (!isEdgeConfigAvailable()) {
    memSubs.unshift(sub);
    if (memSubs.length > MAX_SUBSCRIPTIONS) memSubs.splice(MAX_SUBSCRIPTIONS);
    return;
  }
  const existing = await ecRead<StoredSubscription>('subscriptions');
  const updated = [sub, ...existing.filter((s) => s.subscription_id !== sub.subscription_id)];
  if (updated.length > MAX_SUBSCRIPTIONS) updated.splice(MAX_SUBSCRIPTIONS);
  await ecWrite('subscriptions', updated);
}

export async function getSubscriptions(): Promise<StoredSubscription[]> {
  if (!isEdgeConfigAvailable()) return [...memSubs];
  return ecRead<StoredSubscription>('subscriptions');
}
