import { NextResponse } from 'next/server';
import { getHits } from '@/lib/kv';

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(getHits());
}
