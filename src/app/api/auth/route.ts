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
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const schema = z.object({
  action: z.enum(['login', 'signup', 'logout']),
  email: z.string().email().max(254).optional(),
  password: z.string().min(8).max(128).optional(),
  name: z.string().trim().min(2).max(160).optional(),
});
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const parsed = schema.safeParse(await readJson(request));
    if (!parsed.success)
      throw new AppError(
        400,
        'Confira os dados. A senha deve ter pelo menos 8 caracteres.',
      );
    const { action, email, password, name } = parsed.data;
    if (action === 'logout') {
      if (!demoMode()) {
        const token = authToken(request);
        if (token) await adminClient().auth.admin.signOut(token, 'local');
      }
      const response = NextResponse.json({ ok: true });
      response.cookies.set('lumina-access', '', {
        httpOnly: true,
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 0,
      });
      return response;
    }
    if (demoMode())
      throw new AppError(
        400,
        'A demonstração utiliza somente contas fictícias. Configure o Supabase para criar contas reais.',
      );
    if (!email || !password) throw new AppError(400, 'Informe e-mail e senha.');
    const client = publicClient();
    if (action === 'signup') {
      if (!name) throw new AppError(400, 'Informe seu nome.');
      const { error } = await client.auth.signUp({
        email,
        password,
        options: { data: { name } },
      });
      if (error)
        throw new AppError(
          400,
          'Não foi possível solicitar o cadastro. Confira os dados e tente novamente.',
        );
      return NextResponse.json({
        ok: true,
        message:
          'Se o cadastro for elegível, você receberá as instruções por e-mail. O acesso depende da autorização do administrador.',
      });
    }
    const { data, error } = await client.auth.signInWithPassword({
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
    const response = NextResponse.json({ user: profile });
    response.cookies.set('lumina-access', data.session.access_token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: data.session.expires_in,
    });
    return response;
  } catch (error) {
    return responseError(error);
  }
}
