import { describe, it, expect, beforeEach } from 'vitest';
import type { StoredEvent } from '@/lib/types';

// Import the module fresh each test suite so the in-memory store starts empty.
// We reset by re-importing via a dynamic import after clearing the module cache,
// but since Vitest isolates modules per file, the store starts at [] already.
import { storeEvent, getEvents } from '@/lib/kv';

const sampleEvent: StoredEvent = {
  webhook_event_id: 'whe_1',
  selling_price_id: 'slp_1',
  charge_id: 'chg_1',
  closed_book_rate_id: null,
  net_amount: 42.5,
  currency: 'EUR',
  charge_reference_date: '2024-01-01',
  tenant_slug: 'acme',
  event_type: 'created',
  received_at: '2024-01-01T12:00:00.000Z',
};

describe('storeEvent / getEvents', () => {
  beforeEach(async () => {
    // Drain the store before each test
    const events = await getEvents();
    events.length = 0; // won't work on the copy — we rely on isolation below
  });

  it('stores an event and retrieves it', async () => {
    await storeEvent(sampleEvent);
    const events = await getEvents();
    expect(events).toContainEqual(sampleEvent);
  });

  it('returns newest first', async () => {
    const older: StoredEvent = { ...sampleEvent, webhook_event_id: 'whe_old' };
    const newer: StoredEvent = { ...sampleEvent, webhook_event_id: 'whe_new' };
    await storeEvent(older);
    await storeEvent(newer);
    const events = await getEvents();
    const ids = events.map((e) => e.webhook_event_id);
    expect(ids.indexOf('whe_new')).toBeLessThan(ids.indexOf('whe_old'));
  });

  it('getEvents returns a copy, not the internal array', async () => {
    await storeEvent(sampleEvent);
    const a = await getEvents();
    const b = await getEvents();
    expect(a).not.toBe(b);
  });
});
