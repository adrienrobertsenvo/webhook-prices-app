# Webhook Prices App — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Next.js app on Vercel that receives Senvo `selling_price` webhooks, verifies their HMAC-SHA256 signature, stores them in Vercel KV, and displays them in a Basic-Auth-protected dashboard.

**Architecture:** A single Next.js 15 App Router project — one POST route for receiving webhooks (signature-gated, no user auth), one server-rendered dashboard page (Basic Auth via middleware), and Vercel KV as the store. No client-side JS needed.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS, Vercel KV (`@vercel/kv`), Vitest

---

## File Map

| File | Responsibility |
|---|---|
| `lib/types.ts` | `StoredEvent` type shared across lib and app |
| `lib/signature.ts` | Pure HMAC-SHA256 verification function |
| `lib/kv.ts` | `storeEvent` / `getEvents` wrappers around Vercel KV |
| `app/api/webhook/route.ts` | POST handler: verify sig → filter → store |
| `middleware.ts` | HTTP Basic Auth for all routes except `/api/webhook` |
| `app/page.tsx` | Server-rendered dashboard table |
| `app/layout.tsx` | Root layout (title, viewport) |
| `__tests__/signature.test.ts` | Unit tests for `verifySignature` |
| `__tests__/kv.test.ts` | Unit tests for `storeEvent` / `getEvents` with mocked KV |
| `__tests__/webhook-route.test.ts` | Integration tests for the POST route handler |
| `vitest.config.ts` | Vitest config with `@` path alias |
| `.env.local.example` | Template for required env vars |

---

## Task 1: Scaffold the project

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `vitest.config.ts`

- [ ] **Step 1: Run create-next-app**

```bash
cd /Users/adrienrobert/gitrepo/webhook-prices-app
npx create-next-app@latest . --typescript --tailwind --eslint --app --no-src-dir --import-alias "@/*" --no-git
```

When prompted: accept all defaults. This creates Next.js 15 with App Router, TypeScript, Tailwind, and ESLint.

- [ ] **Step 2: Install additional dependencies**

```bash
npm install @vercel/kv
npm install -D vitest @vitejs/plugin-react
```

- [ ] **Step 3: Create vitest config**

Create `vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
```

- [ ] **Step 4: Add test script to package.json**

In `package.json`, add to `"scripts"`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 5: Delete scaffold boilerplate**

```bash
rm -rf app/fonts
```

Replace `app/globals.css` content with just:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 6: Verify Next.js starts**

```bash
npm run build
```
Expected: build succeeds (ignore the default page for now).

- [ ] **Step 7: Commit**

```bash
git init
git add .
git commit -m "chore: scaffold Next.js 15 + Vercel KV + Vitest"
```

---

## Task 2: Type definitions

**Files:**
- Create: `lib/types.ts`

- [ ] **Step 1: Create `lib/types.ts`**

```bash
mkdir -p lib
```

```ts
// lib/types.ts
export interface StoredEvent {
  webhook_event_id: string;       // whe_*
  selling_price_id: string;       // slp_*
  charge_id: string;              // chg_*
  closed_book_rate_id: string | null;
  net_amount: number;
  currency: string;
  charge_reference_date: string;  // YYYY-MM-DD
  tenant_slug: string;
  event_type: 'created' | 'updated' | 'deleted';
  received_at: string;            // ISO timestamp
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/types.ts
git commit -m "feat: add StoredEvent type"
```

---

## Task 3: Signature verification (TDD)

**Files:**
- Create: `lib/signature.ts`, `__tests__/signature.test.ts`

- [ ] **Step 1: Create test directory and write failing tests**

```bash
mkdir -p __tests__
```

Create `__tests__/signature.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { createHmac } from 'crypto';
import { verifySignature } from '@/lib/signature';

const SECRET = 'test-signing-secret';

function makeSignature(secret: string, body: string): string {
  return createHmac('sha256', secret).update(Buffer.from(body)).digest('hex');
}

describe('verifySignature', () => {
  it('returns true for a valid signature', () => {
    const body = '{"id":"whe_1","object_type":"selling_price"}';
    const sig = makeSignature(SECRET, body);
    expect(verifySignature(SECRET, Buffer.from(body), sig)).toBe(true);
  });

  it('returns false for a wrong signature', () => {
    const body = '{"id":"whe_1"}';
    expect(verifySignature(SECRET, Buffer.from(body), 'deadbeef')).toBe(false);
  });

  it('returns false when signature length differs (prevents timing oracle)', () => {
    const body = '{"id":"whe_1"}';
    expect(verifySignature(SECRET, Buffer.from(body), 'short')).toBe(false);
  });

  it('returns false for empty signature', () => {
    const body = '{"id":"whe_1"}';
    expect(verifySignature(SECRET, Buffer.from(body), '')).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- __tests__/signature.test.ts
```
Expected: FAIL — `Cannot find module '@/lib/signature'`

- [ ] **Step 3: Implement `lib/signature.ts`**

```ts
// lib/signature.ts
import { createHmac, timingSafeEqual } from 'crypto';

export function verifySignature(secret: string, body: Buffer, signature: string): boolean {
  if (!signature) return false;
  const digest = createHmac('sha256', secret).update(body).digest('hex');
  try {
    return timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
  } catch {
    // timingSafeEqual throws if lengths differ
    return false;
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- __tests__/signature.test.ts
```
Expected: 4 tests pass

- [ ] **Step 5: Commit**

```bash
git add lib/signature.ts __tests__/signature.test.ts
git commit -m "feat: add HMAC-SHA256 signature verification"
```

---

## Task 4: Vercel KV helpers (TDD)

**Files:**
- Create: `lib/kv.ts`, `__tests__/kv.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/kv.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { StoredEvent } from '@/lib/types';

const mockLpush = vi.fn();
const mockLtrim = vi.fn();
const mockLrange = vi.fn();

vi.mock('@vercel/kv', () => ({
  kv: {
    lpush: mockLpush,
    ltrim: mockLtrim,
    lrange: mockLrange,
  },
}));

import { storeEvent, getEvents } from '@/lib/kv';

const sampleEvent: StoredEvent = {
  webhook_event_id: 'whe_1',
  selling_price_id: 'slp_1',
  charge_id: 'chg_1',
  closed_book_rate_id: null,
  net_amount: 42.5,
  currency: 'EUR',
  charge_reference_date: '2024-01-01',
  tenant_slug: 'acme',
  event_type: 'created',
  received_at: '2024-01-01T12:00:00.000Z',
};

describe('storeEvent', () => {
  beforeEach(() => vi.clearAllMocks());

  it('pushes serialised event to the list', async () => {
    mockLpush.mockResolvedValue(1);
    mockLtrim.mockResolvedValue('OK');
    await storeEvent(sampleEvent);
    expect(mockLpush).toHaveBeenCalledWith(
      'selling_price_events',
      JSON.stringify(sampleEvent),
    );
  });

  it('trims the list to 500 entries after push', async () => {
    mockLpush.mockResolvedValue(501);
    mockLtrim.mockResolvedValue('OK');
    await storeEvent(sampleEvent);
    expect(mockLtrim).toHaveBeenCalledWith('selling_price_events', 0, 499);
  });
});

describe('getEvents', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns deserialised events', async () => {
    mockLrange.mockResolvedValue([JSON.stringify(sampleEvent)]);
    const events = await getEvents();
    expect(events).toEqual([sampleEvent]);
  });

  it('returns empty array when KV is empty', async () => {
    mockLrange.mockResolvedValue([]);
    const events = await getEvents();
    expect(events).toEqual([]);
  });

  it('handles pre-deserialised objects from KV (Vercel KV auto-parses JSON)', async () => {
    mockLrange.mockResolvedValue([sampleEvent]);
    const events = await getEvents();
    expect(events[0].webhook_event_id).toBe('whe_1');
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- __tests__/kv.test.ts
```
Expected: FAIL — `Cannot find module '@/lib/kv'`

- [ ] **Step 3: Implement `lib/kv.ts`**

```ts
// lib/kv.ts
import { kv } from '@vercel/kv';
import type { StoredEvent } from '@/lib/types';

const KV_KEY = 'selling_price_events';
const MAX_EVENTS = 500;

export async function storeEvent(event: StoredEvent): Promise<void> {
  await kv.lpush(KV_KEY, JSON.stringify(event));
  await kv.ltrim(KV_KEY, 0, MAX_EVENTS - 1);
}

export async function getEvents(): Promise<StoredEvent[]> {
  const raw = await kv.lrange(KV_KEY, 0, -1);
  return raw.map((item) =>
    typeof item === 'string' ? (JSON.parse(item) as StoredEvent) : (item as StoredEvent),
  );
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- __tests__/kv.test.ts
```
Expected: 5 tests pass

- [ ] **Step 5: Commit**

```bash
git add lib/kv.ts __tests__/kv.test.ts
git commit -m "feat: add Vercel KV store/read helpers"
```

---

## Task 5: Webhook route handler (TDD)

**Files:**
- Create: `app/api/webhook/route.ts`, `__tests__/webhook-route.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/webhook-route.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/signature', () => ({ verifySignature: vi.fn() }));
vi.mock('@/lib/kv', () => ({ storeEvent: vi.fn() }));

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
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- __tests__/webhook-route.test.ts
```
Expected: FAIL — `Cannot find module '@/app/api/webhook/route'`

- [ ] **Step 3: Create the route**

```bash
mkdir -p app/api/webhook
```

Create `app/api/webhook/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server';
import { verifySignature } from '@/lib/signature';
import { storeEvent } from '@/lib/kv';
import type { StoredEvent } from '@/lib/types';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const rawBody = Buffer.from(await request.arrayBuffer());
  const signature = request.headers.get('x-webhook-signature') ?? '';
  const secret = process.env.WEBHOOK_SIGNING_SECRET ?? '';

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
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- __tests__/webhook-route.test.ts
```
Expected: 4 tests pass

- [ ] **Step 5: Commit**

```bash
git add app/api/webhook/route.ts __tests__/webhook-route.test.ts
git commit -m "feat: add webhook POST route with signature verification"
```

---

## Task 6: Basic Auth middleware

**Files:**
- Create: `middleware.ts`

- [ ] **Step 1: Create `middleware.ts`**

```ts
// middleware.ts
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
```

> **Note:** Middleware runs on the Edge runtime where `Buffer` is unavailable — `atob()` is used instead for base64 decoding. The username is not checked; any username with the correct password is accepted.

- [ ] **Step 2: Run the full test suite to confirm no regressions**

```bash
npm test
```
Expected: all 13 tests pass

- [ ] **Step 3: Commit**

```bash
git add middleware.ts
git commit -m "feat: add Basic Auth middleware for dashboard"
```

---

## Task 7: Dashboard page

**Files:**
- Modify: `app/page.tsx`, `app/layout.tsx`

- [ ] **Step 1: Replace `app/layout.tsx`**

```tsx
// app/layout.tsx
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Senvo Prices Dashboard',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900">{children}</body>
    </html>
  );
}
```

- [ ] **Step 2: Replace `app/page.tsx`**

```tsx
// app/page.tsx
import { getEvents } from '@/lib/kv';
import type { StoredEvent } from '@/lib/types';

export const dynamic = 'force-dynamic';

const EVENT_TYPE_COLORS: Record<StoredEvent['event_type'], string> = {
  created: 'bg-green-100 text-green-800',
  updated: 'bg-blue-100 text-blue-800',
  deleted: 'bg-red-100 text-red-800',
};

export default async function DashboardPage() {
  const events = await getEvents();

  return (
    <main className="max-w-screen-xl mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Selling Prices</h1>
        <p className="text-sm text-gray-500 mt-1">
          {events.length} event{events.length !== 1 ? 's' : ''} received · newest first
        </p>
      </div>

      {events.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-12 text-center text-gray-400">
          No selling price events yet. Push one from Senvo to see it here.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-900 text-gray-100">
              <tr>
                {[
                  'Event ID', 'Type', 'SP ID', 'Charge ID',
                  'Amount', 'Ref Date', 'Tenant', 'Received',
                ].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {events.map((e, i) => (
                <tr key={e.webhook_event_id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{e.webhook_event_id}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${EVENT_TYPE_COLORS[e.event_type]}`}>
                      {e.event_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{e.selling_price_id}</td>
                  <td className="px-4 py-3 font-mono text-xs">{e.charge_id}</td>
                  <td className="px-4 py-3 font-semibold tabular-nums">
                    {e.net_amount.toLocaleString('en-US', {
                      style: 'currency',
                      currency: e.currency,
                      minimumFractionDigits: 2,
                    })}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{e.charge_reference_date}</td>
                  <td className="px-4 py-3 text-gray-600">{e.tenant_slug}</td>
                  <td className="px-4 py-3 tabular-nums text-gray-500 whitespace-nowrap">
                    {new Date(e.received_at).toLocaleString('en-GB', {
                      dateStyle: 'short',
                      timeStyle: 'medium',
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx app/layout.tsx
git commit -m "feat: add selling prices dashboard"
```

---

## Task 8: Environment config and GitHub push

**Files:**
- Create: `.env.local.example`, update `.gitignore`

- [ ] **Step 1: Create `.env.local.example`**

```bash
# .env.local.example
# Copy to .env.local and fill in values for local development.

# From Senvo subscription creation (shown only once).
WEBHOOK_SIGNING_SECRET=

# Password for the dashboard (any string — used with HTTP Basic Auth).
DASHBOARD_PASSWORD=

# Injected automatically by Vercel KV. Only needed for local dev.
# Get values from: Vercel Dashboard → Storage → your KV → .env.local
KV_REST_API_URL=
KV_REST_API_TOKEN=
```

- [ ] **Step 2: Verify `.gitignore` contains `.env.local`**

Check that `.gitignore` (created by create-next-app) contains `.env.local`. It should by default. If not, add it.

```bash
grep -n ".env.local" .gitignore
```
Expected: at least one matching line.

- [ ] **Step 3: Create GitHub repo and push**

```bash
gh repo create webhook-prices-app --public --source=. --remote=origin --push
```

If `gh` is not available, create the repo manually on GitHub, then:
```bash
git remote add origin https://github.com/<your-org>/webhook-prices-app.git
git push -u origin main
```

- [ ] **Step 4: Commit env example**

```bash
git add .env.local.example
git commit -m "chore: add env var template"
git push
```

---

## Task 9: Deploy to Vercel

- [ ] **Step 1: Create Vercel project from GitHub repo**

Go to https://vercel.com/new → Import the `webhook-prices-app` GitHub repo → click **Deploy** (accept all defaults for Next.js auto-detection).

- [ ] **Step 2: Add Vercel KV storage**

In the Vercel project: **Storage** tab → **Create Database** → **KV** → name it `webhook-prices-kv` → **Create & Connect**.

This auto-injects `KV_REST_API_URL` and `KV_REST_API_TOKEN` into the project's env vars.

- [ ] **Step 3: Add remaining env vars**

In Vercel project **Settings → Environment Variables**, add:

| Name | Value |
|---|---|
| `WEBHOOK_SIGNING_SECRET` | *(from Senvo subscription — see below)* |
| `DASHBOARD_PASSWORD` | *(choose a strong password)* |

- [ ] **Step 4: Create a Senvo webhook subscription for `selling_price` events**

```bash
curl -X POST https://app.senvo.ai/api/webhooks/webhook_subscription/ \
  -H "x-api-key-id: <your-api-key-id>" \
  -H "x-api-key: <your-api-key-secret>" \
  -H "content-type: application/json" \
  -d '{
    "target_url": "https://<your-vercel-app>.vercel.app/api/webhook",
    "object_type": "selling_price",
    "event_type": "created"
  }'
```

Copy the `signing_secret` from the response — it is shown **only once**. Set it as `WEBHOOK_SIGNING_SECRET` in Vercel.

Repeat for `event_type: "updated"` if desired.

- [ ] **Step 5: Trigger a redeploy to pick up the new env vars**

In Vercel: **Deployments** → latest deployment → **Redeploy**.

- [ ] **Step 6: Smoke-test the webhook endpoint**

Send a signed test payload to confirm the endpoint accepts it:

```bash
# Compute signature
BODY='{"id":"whe_test","object_type":"selling_price","event_type":"created","object_id":"slp_test","tenant_slug":"test","created_at":"2024-01-01T00:00:00Z","payload":{"id":"slp_test","charge_id":"chg_test","closed_book_rate_id":null,"net_charge":{"amount":9.99,"currency":"EUR"},"charge_reference_date":"2024-01-01","tenant_slug":"test","created_at":"2024-01-01T00:00:00Z","updated_at":"2024-01-01T00:00:00Z"}}'
SIG=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "$WEBHOOK_SIGNING_SECRET" | awk '{print $2}')

curl -s -o /dev/null -w "%{http_code}" \
  -X POST https://<your-vercel-app>.vercel.app/api/webhook \
  -H "content-type: application/json" \
  -H "x-webhook-signature: $SIG" \
  -d "$BODY"
```
Expected: `200`

- [ ] **Step 7: Open the dashboard**

Navigate to `https://<your-vercel-app>.vercel.app` in a browser. Enter any username and the `DASHBOARD_PASSWORD` when prompted. The test event should appear in the table.

---

## Self-Review Notes

- All 4 Spec requirements covered: webhook receiver ✓, selling prices displayed ✓, signature verification ✓, dashboard Basic Auth ✓
- No TBDs or TODO placeholders
- `StoredEvent` type defined in Task 2 and used consistently in Tasks 4, 5, and 7
- `storeEvent` / `getEvents` / `verifySignature` signatures consistent across tests and implementation
- Edge runtime constraint (no `Buffer` in middleware) is handled with `atob()`
- `export const dynamic = 'force-dynamic'` on the dashboard page ensures fresh KV reads on each request
