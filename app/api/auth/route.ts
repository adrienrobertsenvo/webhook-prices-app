import { NextRequest, NextResponse } from 'next/server';

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

async function deriveSessionToken(password: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(password), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode('dash'));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const expected = process.env.DASHBOARD_PASSWORD ?? '';
  if (!expected) return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });

  let password: string;
  try {
    const body = await request.json();
    password = (body.password as string) ?? '';
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  if (!(await timingSafeEqual(password, expected))) {
    return NextResponse.json({ error: 'Wrong password' }, { status: 401 });
  }

  const token = await deriveSessionToken(expected);
  const response = NextResponse.json({ ok: true });
  response.cookies.set('dash_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24,
  });
  return response;
}
