import { NextResponse } from 'next/server';
import type { Action, ClinicResponse, ClinicState, Member } from '../types';
import { AppError, applyAction, ensureActive, visibleState } from './domain';
import {
  adminClient,
  demoMode,
  loadFullState,
  requireProductionConfig,
  saveFullState,
} from './storage';

export type Context = {
  state: ClinicState;
  user: Member;
  mode: 'demo' | 'production';
  storage: string;
};
function cookie(request: Request, name: string): string | undefined {
  const entry = request.headers
    .get('cookie')
    ?.split(';')
    .map((x) => x.trim())
    .find((x) => x.startsWith(name + '='));
  if (!entry) return undefined;
  try {
    return decodeURIComponent(entry.slice(name.length + 1));
  } catch {
    return undefined;
  }
}
export function authToken(request: Request): string | undefined {
  const bearer = request.headers.get('authorization');
  return bearer?.startsWith('Bearer ')
    ? bearer.slice(7)
    : cookie(request, 'lumina-access');
}
export async function authenticatedUser(request: Request): Promise<Member> {
  if (demoMode()) {
    const { state } = await loadFullState();
    return state.members.find((m) => m.id === 'admin-demo')!;
  }
  requireProductionConfig();
  const token = authToken(request);
  if (!token) throw new AppError(401, 'Entre na sua conta para continuar.');
  const client = adminClient();
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user)
    throw new AppError(401, 'Sua sessão expirou. Entre novamente.');
  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('id,name,email,role,status,finance,color')
    .eq('id', data.user.id)
    .single();
  if (profileError || !profile)
    throw new AppError(403, 'Seu cadastro ainda não foi autorizado.');
  const member = profile as Member;
  ensureActive(member);
  return member;
}
export async function getContext(request: Request): Promise<Context> {
  const user = await authenticatedUser(request);
  const { state } = await loadFullState();
  const current = state.members.find((m) => m.id === user.id);
  if (!current) throw new AppError(403, 'Usuário não encontrado.');
  ensureActive(current);
  return {
    state: visibleState(state, current),
    user: current,
    mode: demoMode() ? 'demo' : 'production',
    storage: demoMode()
      ? 'SQLite local · dados fictícios'
      : 'Supabase PostgreSQL',
  };
}
export function asClinicResponse(context: Context): ClinicResponse {
  return {
    state: context.state,
    session: {
      mode: context.mode,
      user: context.user,
      grokConfigured: !!(process.env.XAI_API_KEY && process.env.XAI_MODEL),
      storage: context.storage,
    },
  };
}
export async function getClinicResponse(
  request: Request,
): Promise<ClinicResponse> {
  return asClinicResponse(await getContext(request));
}
export function checkOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin) {
    if (request.headers.get('sec-fetch-site') === 'cross-site')
      throw new AppError(403, 'Origem da solicitação não autorizada.');
    return;
  }
  let source: URL;
  try {
    source = new URL(origin);
  } catch {
    throw new AppError(403, 'Origem da solicitação não autorizada.');
  }
  if (
    !['http:', 'https:'].includes(source.protocol) ||
    source.origin !== origin
  )
    throw new AppError(403, 'Origem da solicitação não autorizada.');
  if (process.env.APP_URL) {
    if (source.origin !== new URL(process.env.APP_URL).origin)
      throw new AppError(403, 'Origem da solicitação não autorizada.');
    return;
  }
  // Next may reconstruct request.url with its bind address (0.0.0.0). The
  // actual Host is the browser's destination. Never trust X-Forwarded-Host.
  const host = request.headers.get('host') ?? new URL(request.url).host;
  if (source.host !== host)
    throw new AppError(403, 'Origem da solicitação não autorizada.');
  if (
    source.protocol !== new URL(request.url).protocol &&
    source.protocol !== 'https:'
  )
    throw new AppError(403, 'Origem da solicitação não autorizada.');
}
export async function readJson(request: Request): Promise<any> {
  if (Number(request.headers.get('content-length') || 0) > 100000)
    throw new AppError(413, 'Solicitação muito grande.');
  const reader = request.body?.getReader();
  if (!reader) throw new AppError(400, 'JSON inválido.');
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > 100000) {
      await reader.cancel();
      throw new AppError(413, 'Solicitação muito grande.');
    }
    chunks.push(value);
  }
  const joined = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(joined));
  } catch {
    throw new AppError(400, 'JSON inválido.');
  }
}
export async function mutateClinic(
  request: Request,
  action: Action,
): Promise<ClinicResponse> {
  checkOrigin(request);
  const authenticated = await authenticatedUser(request);
  for (let attempt = 0; attempt < 4; attempt++) {
    const { state, revision } = await loadFullState();
    const user = state.members.find((m) => m.id === authenticated.id);
    if (!user) throw new AppError(403, 'Usuário não encontrado.');
    ensureActive(user);
    const updated = applyAction(state, user, action);
    if (action.type === 'updateMember' && !demoMode()) {
      const member = updated.members.find((m) => m.id === action.payload.id)!;
      const { error } = await adminClient().rpc('admin_update_member', {
        actor_id: user.id,
        target_id: member.id,
        patch: {
          name: member.name,
          role: member.role,
          status: member.status,
          finance: member.finance,
        },
      });
      if (error)
        throw new AppError(
          409,
          'Não foi possível atualizar o usuário. Confira suas permissões e tente novamente.',
        );
      return getClinicResponse(request);
    }
    if (await saveFullState(updated, revision))
      return asClinicResponse({
        state: visibleState(updated, user),
        user,
        mode: demoMode() ? 'demo' : 'production',
        storage: demoMode()
          ? 'SQLite local · dados fictícios'
          : 'Supabase PostgreSQL',
      });
  }
  throw new AppError(
    409,
    'Os dados foram alterados por outro usuário. Atualize e tente novamente.',
  );
}
export function responseError(error: unknown): Response {
  if (error instanceof AppError) {
    const code =
      error.status === 503 &&
      !demoMode() &&
      (!process.env.SUPABASE_URL ||
        !process.env.SUPABASE_ANON_KEY ||
        !process.env.SUPABASE_SERVICE_ROLE_KEY)
        ? 'SETUP_REQUIRED'
        : undefined;
    return NextResponse.json(
      { error: error.message, ...(code ? { code } : {}) },
      { status: error.status, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  console.error(
    'Lúmina request failed:',
    error instanceof Error ? error.name : 'UnknownError',
  );
  return NextResponse.json(
    { error: 'Não foi possível concluir a operação. Tente novamente.' },
    { status: 500, headers: { 'Cache-Control': 'no-store' } },
  );
}
