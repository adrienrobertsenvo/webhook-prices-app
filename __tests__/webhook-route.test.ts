import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/signature', () => ({ verifySignature: vi.fn() }));
vi.mock('@/lib/kv', () => ({ storeEvent: vi.fn(), recordHit: vi.fn() }));

import { POST } from '@/app/api/webhook/route';
import { verifySignature } from '@/lib/signature';
import { storeEvent } from '@/lib/kv';

const sellingPricePayload = {
  id: 'slp_abc',
  charge_id: 'chg_abc',
  closed_book_rate_id: null,
  net_charge: { amount: 42.5, currency: 'EUR' },
  charge_reference_date: '2024-01-01',
  tenant_slug: 'acme',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

function makeRequest(body: object, signature = 'sig'): NextRequest {
  return new NextRequest('http://localhost/api/webhook', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'content-type': 'application/json',
      'x-webhook-signature': signature,
    },
  });
}

describe('POST /api/webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.WEBHOOK_SIGNING_SECRET = 'test-secret';
  });

  it('returns 401 when signature is invalid', async () => {
    vi.mocked(verifySignature).mockReturnValue(false);
    const res = await POST(makeRequest({ object_type: 'selling_price' }));
    expect(res.status).toBe(401);
    expect(storeEvent).not.toHaveBeenCalled();
  });

  it('returns 200 without storing for non-selling_price events', async () => {
    vi.mocked(verifySignature).mockReturnValue(true);
    const body = {
      id: 'whe_1', object_type: 'shipment', event_type: 'created',
      object_id: 'shp_1', tenant_slug: 'acme', created_at: '2024-01-01T00:00:00Z',
      payload: {},
    };
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(200);
    expect(storeEvent).not.toHaveBeenCalled();
  });

  it('stores event and returns 200 for selling_price events', async () => {
    vi.mocked(verifySignature).mockReturnValue(true);
    vi.mocked(storeEvent).mockResolvedValue(undefined);
    const body = {
      id: 'whe_1', object_type: 'selling_price', event_type: 'created',
      object_id: 'slp_abc', tenant_slug: 'acme', created_at: '2024-01-01T00:00:00Z',
      payload: sellingPricePayload,
    };
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(200);
    expect(storeEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        webhook_event_id: 'whe_1',
        selling_price_id: 'slp_abc',
        charge_id: 'chg_abc',
        closed_book_rate_id: null,
        net_amount: 42.5,
        currency: 'EUR',
        charge_reference_date: '2024-01-01',
        tenant_slug: 'acme',
        event_type: 'created',
      }),
    );
  });

  it('returns 400 for malformed JSON', async () => {
    vi.mocked(verifySignature).mockReturnValue(true);
    const req = new NextRequest('http://localhost/api/webhook', {
      method: 'POST',
      body: 'not json',
      headers: { 'x-webhook-signature': 'sig' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
