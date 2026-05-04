import type { StoredEvent } from '@/lib/types';

const MAX_EVENTS = 500;

// Module-level store — persists within a warm serverless instance.
// Data resets on cold starts, which is acceptable for a demo.
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
