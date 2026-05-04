import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const REALM = 'Senvo Prices Dashboard';

function unauthorized(): NextResponse {
  return new NextResponse(null, {
    status: 401,
    headers: { 'WWW-Authenticate': `Basic realm="${REALM}"` },
  });
}

async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const key = crypto.getRandomValues(new Uint8Array(32));
  const hmacKey = await crypto.subtle.importKey(
    'raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const [aSig, bSig] = await Promise.all([
    crypto.subtle.sign('HMAC', hmacKey, enc.encode(a)),
    crypto.subtle.sign('HMAC', hmacKey, enc.encode(b)),
  ]);
  const aArr = new Uint8Array(aSig);
  const bArr = new Uint8Array(bSig);
  let diff = 0;
  for (let i = 0; i < aArr.length; i++) diff |= aArr[i] ^ bArr[i];
  return diff === 0;
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  // Webhook endpoint is exempt — secured via signature instead
  if (request.nextUrl.pathname.startsWith('/api/webhook')) {
    return NextResponse.next();
  }

  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Basic ')) {
    return unauthorized();
  }

  const base64 = authHeader.slice(6);
  const decoded = atob(base64);
  const colonIndex = decoded.indexOf(':');
  const password = colonIndex >= 0 ? decoded.slice(colonIndex + 1) : '';

  const expected = process.env.DASHBOARD_PASSWORD ?? '';
  if (!expected || !(await timingSafeEqual(password, expected))) {
    return unauthorized();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
