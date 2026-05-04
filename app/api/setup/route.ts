import { NextRequest, NextResponse } from 'next/server';
import { storeSubscription } from '@/lib/kv';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const formData = await request.formData();
  const apiKeyId = (formData.get('apiKeyId') as string)?.trim();
  const apiKeySecret = (formData.get('apiKeySecret') as string)?.trim();
  const targetUrl = (formData.get('targetUrl') as string)?.trim();
  const eventType = (formData.get('eventType') as string)?.trim();

  if (!apiKeyId || !apiKeySecret || !targetUrl || !eventType) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  let senvoRes: Response;
  try {
    senvoRes = await fetch('https://app.senvo.ai/api/webhooks/webhook_subscription/', {
      method: 'POST',
      headers: {
        'x-api-key-id': apiKeyId,
        'x-api-key': apiKeySecret,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        target_url: targetUrl,
        object_type: 'selling_price',
        event_type: eventType,
      }),
    });
  } catch (err) {
    console.error('[setup] fetch to Senvo failed:', err);
    return NextResponse.json({ error: 'Could not reach Senvo API' });
  }

  console.log('[setup] Senvo status:', senvoRes.status);

  if (!senvoRes.ok) {
    let errorMsg = `Senvo API error (${senvoRes.status})`;
    try {
      const body = await senvoRes.json();
      console.log('[setup] Senvo error body:', JSON.stringify(body));
      errorMsg = body.detail ?? body.message ?? errorMsg;
    } catch { /* ignore parse errors */ }
    return NextResponse.json({ error: errorMsg });
  }

  let data: Record<string, unknown>;
  try {
    data = await senvoRes.json();
    console.log('[setup] Senvo success body:', JSON.stringify(data));
  } catch (err) {
    console.error('[setup] failed to parse Senvo success response:', err);
    return NextResponse.json({ error: 'Unexpected response from Senvo' });
  }

  try {
    await storeSubscription({
      subscription_id: String(data.id ?? ''),
      target_url: String(data.target_url ?? targetUrl),
      object_type: String(data.object_type ?? 'selling_price'),
      event_type: String(data.event_type ?? eventType),
      is_active: Boolean(data.is_active),
      signing_secret: data.signing_secret ? String(data.signing_secret) : undefined,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[setup] storeSubscription failed:', err);
    // non-fatal — subscription was created in Senvo, just not cached locally
  }

  const responsePayload = {
    signing_secret: data.signing_secret ? String(data.signing_secret) : undefined,
    subscription_id: String(data.id ?? ''),
    target_url: String(data.target_url ?? targetUrl),
    object_type: String(data.object_type ?? 'selling_price'),
    event_type: String(data.event_type ?? eventType),
    is_active: Boolean(data.is_active),
  };

  console.log('[setup] returning payload:', JSON.stringify(responsePayload));
  return NextResponse.json(responsePayload);
}
