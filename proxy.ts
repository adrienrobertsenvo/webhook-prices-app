import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const REALM = 'Senvo Prices Dashboard';
const SESSION_COOKIE = 'dash_session';

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

// Derive a fixed token from the password so the cookie value is unguessable
// without knowing the password, and rotating the password invalidates sessions.
async function deriveSessionToken(password: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(password), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode('dash'));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  // Webhook endpoint is exempt — secured via HMAC signature instead
  if (request.nextUrl.pathname.startsWith('/api/webhook')) {
    return NextResponse.next();
  }

  const expected = process.env.DASHBOARD_PASSWORD ?? '';
  if (!expected) return unauthorized();

  const expectedToken = await deriveSessionToken(expected);

  // Session cookie path — used by fetch() calls from JS (Basic Auth headers
  // are not reliably forwarded by browsers for programmatic fetch requests)
  const sessionCookie = request.cookies.get(SESSION_COOKIE);
  if (sessionCookie?.value && (await timingSafeEqual(sessionCookie.value, expectedToken))) {
    return NextResponse.next();
  }

  // Basic Auth path — used by the browser for page navigation
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Basic ')) {
    return unauthorized();
  }

  const base64 = authHeader.slice(6);
  const decoded = atob(base64);
  const colonIndex = decoded.indexOf(':');
  const password = colonIndex >= 0 ? decoded.slice(colonIndex + 1) : '';

  if (!(await timingSafeEqual(password, expected))) {
    return unauthorized();
  }

  // Valid Basic Auth — set session cookie so fetch() calls in the same
  // browser session are authenticated without re-sending the header
  const response = NextResponse.next();
  response.cookies.set(SESSION_COOKIE, expectedToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24, // 1 day
  });
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
