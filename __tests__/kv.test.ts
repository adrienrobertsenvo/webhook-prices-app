import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { StoredEvent } from '@/lib/types';

const { mockLpush, mockLtrim, mockLrange } = vi.hoisted(() => ({
  mockLpush: vi.fn(),
  mockLtrim: vi.fn(),
  mockLrange: vi.fn(),
}));

vi.mock('@vercel/kv', () => ({
  kv: {
    lpush: mockLpush,
    ltrim: mockLtrim,
    lrange: mockLrange,
  },
}));

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

describe('storeEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.KV_REST_API_URL = 'http://localhost';
    process.env.KV_REST_API_TOKEN = 'test-token';
  });

  it('pushes serialised event to the list', async () => {
    mockLpush.mockResolvedValue(1);
    mockLtrim.mockResolvedValue('OK');
    await storeEvent(sampleEvent);
    expect(mockLpush).toHaveBeenCalledWith(
      'selling_price_events',
      JSON.stringify(sampleEvent),
    );
  });

  it('trims the list to 500 entries after push', async () => {
    mockLpush.mockResolvedValue(501);
    mockLtrim.mockResolvedValue('OK');
    await storeEvent(sampleEvent);
    expect(mockLtrim).toHaveBeenCalledWith('selling_price_events', 0, 499);
  });
});

describe('getEvents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.KV_REST_API_URL = 'http://localhost';
    process.env.KV_REST_API_TOKEN = 'test-token';
  });

  it('returns deserialised events', async () => {
    mockLrange.mockResolvedValue([JSON.stringify(sampleEvent)]);
    const events = await getEvents();
    expect(events).toEqual([sampleEvent]);
  });

  it('returns empty array when KV is empty', async () => {
    mockLrange.mockResolvedValue([]);
    const events = await getEvents();
    expect(events).toEqual([]);
  });

  it('handles pre-deserialised objects from KV (Vercel KV auto-parses JSON)', async () => {
    mockLrange.mockResolvedValue([sampleEvent]);
    const events = await getEvents();
    expect(events[0].webhook_event_id).toBe('whe_1');
  });
});
