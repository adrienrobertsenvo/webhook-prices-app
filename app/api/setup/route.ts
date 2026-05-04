import { NextRequest, NextResponse } from 'next/server';
import { storeSubscription } from '@/lib/kv';

function errorToString(val: unknown): string {
  if (typeof val === 'string') return val;
  if (Array.isArray(val)) {
    return val
      .map((v) => (typeof v === 'object' && v !== null ? (v as Record<string, unknown>).msg ?? JSON.stringify(v) : String(v)))
      .join('; ');
  }
  if (typeof val === 'object' && val !== null) {
    const o = val as Record<string, unknown>;
    return String(o.detail ?? o.message ?? o.msg ?? JSON.stringify(val));
  }
  return String(val);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const formData = await request.formData();
  const apiKeyId = (formData.get('apiKeyId') as string)?.trim();
  const apiKeySecret = (formData.get('apiKeySecret') as string)?.trim();
  const targetUrl = (formData.get('targetUrl') as string)?.trim();
  const eventType = (formData.get('eventType') as string)?.trim();

  if (!apiKeyId || !apiKeySecret || !targetUrl || !eventType) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const signingSecret = process.env.WEBHOOK_SIGNING_SECRET;
  if (!signingSecret) {
    return NextResponse.json({ error: 'WEBHOOK_SIGNING_SECRET env var is not set on this server' }, { status: 500 });
  }

  const reqBody = {
    target_url: targetUrl,
    object_types: ['selling_price'],
    event_types: [eventType],
    is_active: true,
    signing_secret: signingSecret,
  };

  console.log('[setup] sending to Senvo:', JSON.stringify(reqBody));

  let senvoRes: Response;
  try {
    senvoRes = await fetch('https://app.senvo.ai/api/webhooks/webhook_subscription/', {
      method: 'POST',
      headers: {
        'x-api-key-id': apiKeyId,
        'x-api-key': apiKeySecret,
        'content-type': 'application/json',
      },
      body: JSON.stringify(reqBody),
    });
  } catch (err) {
    console.error('[setup] fetch to Senvo failed:', err);
    return NextResponse.json({ error: 'Could not reach Senvo API' });
  }

  console.log('[setup] Senvo status:', senvoRes.status);

  if (!senvoRes.ok) {
    let rawBody: unknown;
    try { rawBody = await senvoRes.json(); } catch { rawBody = null; }
    console.log('[setup] Senvo error body:', JSON.stringify(rawBody));
    const errorMsg = rawBody
      ? errorToString((rawBody as Record<string, unknown>).detail ?? (rawBody as Record<string, unknown>).message ?? rawBody)
      : `Senvo API error (${senvoRes.status})`;
    return NextResponse.json({ error: errorMsg });
  }

  let data: Record<string, unknown>;
  try {
    data = await senvoRes.json();
    console.log('[setup] Senvo success body:', JSON.stringify(data));
  } catch (err) {
    console.error('[setup] failed to parse Senvo response:', err);
    return NextResponse.json({ error: 'Unexpected response from Senvo' });
  }

  const subscriptionId = String(data.id ?? '');

  try {
    await storeSubscription({
      subscription_id: subscriptionId,
      target_url: String(data.target_url ?? targetUrl),
      object_type: 'selling_price',
      event_type: eventType,
      is_active: Boolean(data.is_active ?? true),
      signing_secret: signingSecret,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[setup] storeSubscription failed:', err);
  }

  const payload = {
    signing_secret: signingSecret,
    subscription_id: subscriptionId,
    target_url: String(data.target_url ?? targetUrl),
    object_type: 'selling_price',
    event_type: eventType,
    is_active: Boolean(data.is_active ?? true),
  };

  console.log('[setup] returning:', JSON.stringify(payload));
  return NextResponse.json(payload);
}
