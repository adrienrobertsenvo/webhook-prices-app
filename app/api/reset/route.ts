import { NextResponse } from 'next/server';
import { clearEvents } from '@/lib/kv';

export async function POST(): Promise<NextResponse> {
  await clearEvents();
  return NextResponse.json({ ok: true });
}
