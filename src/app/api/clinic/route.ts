import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AppError } from '@/lib/server/domain';
import {
  getClinicResponse,
  mutateClinic,
  readJson,
  responseError,
} from '@/lib/server/context';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try {
    return NextResponse.json(await getClinicResponse(request), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return responseError(error);
  }
}
export async function POST(request: Request) {
  try {
    const parsed = z
      .object({ type: z.string().max(80), payload: z.record(z.unknown()) })
      .safeParse(await readJson(request));
    if (!parsed.success) throw new AppError(400, 'Ação inválida.');
    return NextResponse.json(await mutateClinic(request, parsed.data), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return responseError(error);
  }
}
