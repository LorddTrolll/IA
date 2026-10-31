import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AppError } from '@/lib/server/domain';
import {
  authToken,
  checkOrigin,
  readJson,
  responseError,
} from '@/lib/server/context';
import { adminClient, demoMode, publicClient } from '@/lib/server/storage';
import { authClientId, getDemoAuth } from '@/lib/server/demo-auth';
import type { Member } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const schema = z.object({
  action: z.enum(['login', 'signup', 'logout']),
  email: z
    .string()
    .trim()
    .email()
    .max(254)
    .transform((value) => value.toLowerCase())
    .optional(),
  password: z.string().max(128).optional(),
  name: z.string().trim().min(2).max(160).optional(),
});
const cacheHeaders = { 'Cache-Control': 'no-store' };
function secureCookie(request: Request): boolean {
  // Real accounts always use secure cookies in production. Explicit fake demo
  // mode also supports a local production build served over HTTP for testing.
  return (
    (!demoMode() && process.env.NODE_ENV === 'production') ||
    new URL(request.url).protocol === 'https:' ||
    !!(
      process.env.APP_URL && new URL(process.env.APP_URL).protocol === 'https:'
    )
  );
}
function sessionResponse(
  request: Request,
  user: Member,
  token: string,
  maxAge: number,
) {
  const response = NextResponse.json({ user }, { headers: cacheHeaders });
  response.cookies.set('dentim-access', token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: secureCookie(request),
    path: '/',
    maxAge,
  });
  return response;
}
export async function GET() {
  return NextResponse.json(
    { mode: demoMode() ? 'demo' : 'production' },
    { headers: cacheHeaders },
  );
}
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const parsed = schema.safeParse(await readJson(request));
    if (!parsed.success)
      throw new AppError(400, 'Confira os dados de acesso informados.');
    const { action, email, password, name } = parsed.data;
    if (action === 'logout') {
      const token = authToken(request);
      if (demoMode()) await (await getDemoAuth()).logout(token);
      else if (token) await adminClient().auth.admin.signOut(token, 'local');
      const response = NextResponse.json(
        { ok: true },
        { headers: cacheHeaders },
      );
      const attributes = {
        httpOnly: true,
        sameSite: 'strict' as const,
        secure: secureCookie(request),
        path: '/',
        maxAge: 0,
      };
      response.cookies.set('dentim-access', '', attributes);
      response.cookies.set('lumina-access', '', attributes); // Remove the retired cookie; it is never accepted.
      return response;
    }
    if (!email || !password) throw new AppError(400, 'Informe e-mail e senha.');
    if (action === 'signup') {
      if (!name) throw new AppError(400, 'Informe seu nome.');
      if (password.length < 8)
        throw new AppError(400, 'A senha deve ter entre 8 e 128 caracteres.');
      if (demoMode()) {
        await (
          await getDemoAuth()
        ).signup({ name, email, password }, authClientId(request));
        return NextResponse.json(
          {
            ok: true,
            message:
              'Se o e-mail estiver disponível, sua conta de demonstração foi criada. Aguarde a autorização do administrador para entrar.',
          },
          { headers: cacheHeaders },
        );
      }
      const { error } = await publicClient().auth.signUp({
        email,
        password,
        options: { data: { name } },
      });
      if (error)
        throw new AppError(
          400,
          'Não foi possível solicitar o cadastro. Confira os dados e tente novamente.',
        );
      return NextResponse.json(
        {
          ok: true,
          message:
            'Se o cadastro for elegível, você receberá as instruções por e-mail. O acesso depende da autorização do administrador.',
        },
        { headers: cacheHeaders },
      );
    }
    if (demoMode()) {
      const result = await (
        await getDemoAuth()
      ).login(email, password, authClientId(request));
      return sessionResponse(request, result.user, result.token, result.maxAge);
    }
    const { data, error } = await publicClient().auth.signInWithPassword({
      email,
      password,
    });
    if (error || !data.session)
      throw new AppError(401, 'E-mail ou senha inválidos.');
    const { data: profile } = await adminClient()
      .from('profiles')
      .select('id,name,email,role,status,finance,color')
      .eq('id', data.user.id)
      .single();
    if (!profile || profile.status !== 'active') {
      await adminClient().auth.admin.signOut(
        data.session.access_token,
        'local',
      );
      throw new AppError(
        403,
        profile?.status === 'suspended'
          ? 'Seu acesso está suspenso.'
          : 'Seu acesso aguarda autorização do administrador.',
      );
    }
    return sessionResponse(
      request,
      profile as Member,
      data.session.access_token,
      data.session.expires_in,
    );
  } catch (error) {
    return responseError(error);
  }
}
