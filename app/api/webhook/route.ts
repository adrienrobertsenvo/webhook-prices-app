import { NextRequest, NextResponse } from 'next/server';
import { verifySignature } from '@/lib/signature';
import { storeEvent, recordHit } from '@/lib/kv';
import type { StoredEvent } from '@/lib/types';

export async function GET(): Promise<NextResponse> {
  recordHit({ received_at: new Date().toISOString(), method: 'GET', signature: '(none)', body: '', result: 'ignored', status: 200 });
  return NextResponse.json({ ok: true });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const rawBody = Buffer.from(await request.arrayBuffer());
  const bodyText = rawBody.toString();
  const signature = request.headers.get('x-webhook-signature') ?? '';

  function hit(result: Parameters<typeof recordHit>[0]['result'], status: number) {
    recordHit({
      received_at: new Date().toISOString(),
      method: 'POST',
      signature: signature ? `${signature.slice(0, 16)}…` : '(none)',
      body: bodyText.slice(0, 2000),
      result,
      status,
    });
  }

  const secret = process.env.WEBHOOK_SIGNING_SECRET;
  if (!secret) {
    hit('no_secret', 500);
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
  }

  if (!verifySignature(secret, rawBody, signature)) {
    hit('invalid_signature', 401);
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
    event = JSON.parse(bodyText);
  } catch {
    hit('invalid_json', 400);
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (event.object_type !== 'selling_price') {
    hit('ignored', 200);
    return NextResponse.json({ ok: true });
  }

  try {
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
    hit('stored', 200);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[webhook] store failed:', err);
    hit('error', 500);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
