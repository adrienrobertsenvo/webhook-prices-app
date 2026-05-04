import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const REALM = 'Senvo Prices Dashboard';

function unauthorized(): NextResponse {
  return new NextResponse(null, {
    status: 401,
    headers: { 'WWW-Authenticate': `Basic realm="${REALM}"` },
  });
}

export function middleware(request: NextRequest): NextResponse {
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

  if (!process.env.DASHBOARD_PASSWORD || password !== process.env.DASHBOARD_PASSWORD) {
    return unauthorized();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
