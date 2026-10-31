import { NextResponse } from 'next/server';
import { demoMode, loadFullState } from '@/lib/server/storage';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    await loadFullState();
    return NextResponse.json(
      { status: 'ok', mode: demoMode() ? 'demo' : 'production' },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return NextResponse.json(
      { status: 'unavailable' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
