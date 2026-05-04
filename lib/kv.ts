import type { StoredEvent, StoredSubscription } from '@/lib/types';

const MAX_EVENTS = 500;
const MAX_SUBSCRIPTIONS = 100;

// Module-level store — persists within a warm serverless instance.
// Data resets on cold starts, which is acceptable for a demo.
const store: StoredEvent[] = [];
const subscriptions: StoredSubscription[] = [];

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

export async function storeSubscription(sub: StoredSubscription): Promise<void> {
  subscriptions.unshift(sub);
  if (subscriptions.length > MAX_SUBSCRIPTIONS) subscriptions.splice(MAX_SUBSCRIPTIONS);
}

export async function getSubscriptions(): Promise<StoredSubscription[]> {
  return [...subscriptions];
}
