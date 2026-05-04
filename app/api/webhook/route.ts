import { NextRequest, NextResponse } from 'next/server';
import { verifySignature } from '@/lib/signature';
import { storeEvent } from '@/lib/kv';
import type { StoredEvent } from '@/lib/types';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const secret = process.env.WEBHOOK_SIGNING_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
  }

  const rawBody = Buffer.from(await request.arrayBuffer());
  const signature = request.headers.get('x-webhook-signature') ?? '';

  if (!verifySignature(secret, rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let event: {
    id: string;
    object_type: string;
    event_type: 'created' | 'updated' | 'deleted';
    object_id: string;
    tenant_slug: string;
    created_at: string;
    payload: {
      id: string;
      charge_id: string;
      closed_book_rate_id: string | null;
      net_charge: { amount: number; currency: string };
      charge_reference_date: string;
      tenant_slug: string;
    };
  };

  try {
    event = JSON.parse(rawBody.toString());
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (event.object_type !== 'selling_price') {
    return NextResponse.json({ ok: true });
  }

  const { payload } = event;
  const stored: StoredEvent = {
    webhook_event_id: event.id,
    selling_price_id: payload.id,
    charge_id: payload.charge_id,
    closed_book_rate_id: payload.closed_book_rate_id ?? null,
    net_amount: payload.net_charge.amount,
    currency: payload.net_charge.currency,
    charge_reference_date: payload.charge_reference_date,
    tenant_slug: payload.tenant_slug,
    event_type: event.event_type,
    received_at: new Date().toISOString(),
  };

  await storeEvent(stored);
  return NextResponse.json({ ok: true });
}
