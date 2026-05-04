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

let res: Response;
  try {
    res = await fetch('https://app.senvo.ai/api/webhooks/webhook_subscription/', {
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
  } catch {
    return NextResponse.json({ error: 'Could not reach Senvo API' });
  }

  if (!res.ok) {
    let errorMsg = `Senvo API error (${res.status})`;
    try {
      const body = await res.json();
      errorMsg = body.detail ?? body.message ?? errorMsg;
    } catch { /* ignore parse errors */ }
    return NextResponse.json({ error: errorMsg });
  }

  const data = await res.json();

  await storeSubscription({
    subscription_id: data.id,
    target_url: data.target_url,
    object_type: data.object_type,
    event_type: data.event_type,
    is_active: data.is_active ?? false,
    signing_secret: data.signing_secret,
    created_at: new Date().toISOString(),
  });

  return NextResponse.json({
    signing_secret: data.signing_secret,
    subscription_id: data.id,
    target_url: data.target_url,
    object_type: data.object_type,
    event_type: data.event_type,
    is_active: data.is_active,
  });
}
