import { NextResponse } from 'next/server';
import { getSubscriptions } from '@/lib/kv';

export async function GET(): Promise<NextResponse> {
  const subs = await getSubscriptions();
  return NextResponse.json(subs);
}
