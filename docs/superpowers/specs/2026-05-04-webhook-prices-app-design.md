# Webhook Prices App — Design Spec

**Date:** 2026-05-04  
**Status:** Approved

## Overview

A Next.js app deployed on Vercel that receives selling price webhook events from the Senvo Webhooks API and displays them in a password-protected dashboard.

## Architecture

### 1. Webhook Receiver — `POST /api/webhook`

- Public URL (Senvo must be able to reach it without credentials)
- Secured via HMAC-SHA256 signature verification:
  - Read raw request body before any parsing
  - Compute `HMAC-SHA256(raw_body, WEBHOOK_SIGNING_SECRET)`, lowercase hex
  - Compare with `X-Webhook-Signature` header using `timingSafeEqual`
  - Reject with 401 if signature does not match
- Filter: only process events where `object_type === 'selling_price'`
- Store event to Vercel KV as a list (key: `selling_price_events`, capped at 500 entries)
- Return `200` immediately; process nothing async

### 2. Dashboard — `GET /`

- Server-rendered Next.js page (App Router, no client-side JS required)
- Reads the `selling_price_events` list from Vercel KV
- Displays a table: event id (`whe_*`), selling price id (`slp_*`), charge id (`chg_*`), net amount, tax, event type, received timestamp
- Protected by HTTP Basic Auth middleware

### 3. Auth Middleware — `middleware.ts`

- Applies HTTP Basic Auth to all routes **except** `/api/webhook`
- Username: `senvo` (hardcoded)
- Password: `DASHBOARD_PASSWORD` env var
- Returns `401 WWW-Authenticate` challenge if credentials are missing or wrong

## Environment Variables

| Variable | Source | Purpose |
|---|---|---|
| `WEBHOOK_SIGNING_SECRET` | Senvo subscription creation | Verifies incoming webhook payloads |
| `DASHBOARD_PASSWORD` | Set manually in Vercel | Protects the dashboard |
| `KV_REST_API_URL` | Auto-injected by Vercel KV | Vercel KV connection |
| `KV_REST_API_TOKEN` | Auto-injected by Vercel KV | Vercel KV auth |

## Security Model

- Webhook endpoint: no user auth, but only Senvo with the correct `signing_secret` can deliver valid payloads — anything else is rejected
- Dashboard: HTTP Basic Auth, password in env var, never exposed in code
- No API keys or secrets in source code

## Tech Stack

- Next.js 14+ (App Router)
- TypeScript
- Vercel KV (`@vercel/kv`)
- Deployed on Vercel

## Data Shape (stored per event)

```ts
{
  webhook_event_id: string;   // whe_*
  selling_price_id: string;   // slp_*
  charge_id: string;          // chg_*
  closed_book_rate_id: string | null;
  net_amount: number | null;
  tax: number | null;
  currency: string | null;
  event_type: "created" | "updated" | "deleted";
  received_at: string;        // ISO timestamp
}
```
