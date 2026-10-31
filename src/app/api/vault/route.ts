import { zipSync, strToU8 } from 'fflate';
import { buildVault } from '@/lib/knowledge';
import { getContext, responseError } from '@/lib/server/context';
import { AppError } from '@/lib/server/domain';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const context = await getContext(request);
    const patientId =
      new URL(request.url).searchParams.get('patientId') || undefined;
    if (patientId && !context.state.patients.some((p) => p.id === patientId))
      throw new AppError(404, 'Paciente não encontrado ou sem autorização.');
    const files = buildVault(context.state, {
      patientId,
      finance: context.user.role === 'admin' || context.user.finance,
      clinical: context.user.role !== 'reception',
    });
    const zip = zipSync(
      Object.fromEntries(
        files.map((file) => [file.path, strToU8(file.content)]),
      ),
      { level: 6 },
    );
    return new Response(new Uint8Array(zip), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="dentim-obsidian${patientId ? '-paciente' : ''}.zip"`,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    return responseError(error);
  }
}
