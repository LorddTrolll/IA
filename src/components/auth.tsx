'use client';
import { Tooth } from './tooth-icon';
import { useState, type FormEvent } from 'react';
import { ArrowRight, ArrowUpRight, LockKeyhole, Sparkles } from 'lucide-react';
import { Field, Submit } from './ui';
export default function AuthScreen({
  setup = false,
  errorMessage = '',
  onSuccess,
}: {
  setup?: boolean;
  errorMessage?: string;
  onSuccess: () => void;
}) {
  const [signup, setSignup] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [success, setSuccess] = useState('');
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setSuccess('');
    const f = new FormData(e.currentTarget);
    try {
      const r = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: signup ? 'signup' : 'login',
          ...Object.fromEntries(f),
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      if (signup)
        setSuccess(
          data.message ||
            'Cadastro recebido. Aguarde a confirmação do e-mail e a autorização do administrador.',
        );
      else onSuccess();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-page">
      <section className="auth-brand">
        <div className="auth-wordmark">
          <Tooth size={34} />
          Lúmina<span>CLÍNICA CONECTADA</span>
        </div>
        <div>
          <span className="eyebrow lime">MAIS ESPAÇO PARA O QUE IMPORTA</span>
          <h1>
            Organize a clínica.
            <br />
            Conecte histórias.
            <br />
            <em>Cuide de pessoas.</em>
          </h1>
          <p>
            Prontuários, planejamentos e inteligência clínica.
            <br />
            Um novo olhar para a sua rotina.
          </p>
        </div>
        <span className="auth-brand-footer">
          FEITO PARA CUIDAR <span>✳</span>
        </span>
      </section>
      <section className="auth-form">
        <div>
          <span className="eyebrow">BEM-VINDO À LÚMINA</span>
          <h2>
            {setup
              ? 'Vamos conectar sua clínica.'
              : signup
                ? 'Comece uma nova história.'
                : 'Bom ter você por aqui.'}
          </h2>
          <p>
            {setup
              ? 'O código está pronto para receber a configuração dos serviços.'
              : signup
                ? 'Crie sua conta. O acesso será liberado pelo administrador.'
                : 'Entre para acompanhar os cuidados de hoje.'}
          </p>
          {setup ? (
            <div className="setup-instructions">
              <LockKeyhole size={27} />
              <h3>Configuração de produção pendente</h3>
              <p>
                {errorMessage ||
                  'Configure o Supabase e execute a migração do banco antes de publicar.'}
              </p>
              <ol>
                <li>
                  Crie um projeto no Supabase e execute{' '}
                  <code>supabase/migrations/001_clinic.sql</code>.
                </li>
                <li>
                  Configure as variáveis do servidor conforme{' '}
                  <code>.env.example</code>.
                </li>
                <li>
                  Cadastre a primeira conta e autorize o administrador conforme
                  o README.
                </li>
              </ol>
              <button className="button button-primary" onClick={onSuccess}>
                Verificar conexão <ArrowRight size={16} />
              </button>
            </div>
          ) : (
            <form onSubmit={submit}>
              {signup && (
                <Field label="Nome completo">
                  <input
                    name="name"
                    required
                    autoComplete="name"
                    maxLength={150}
                  />
                </Field>
              )}
              <Field label="Seu e-mail">
                <input
                  type="email"
                  name="email"
                  placeholder="voce@clinica.com.br"
                  required
                  autoComplete="email"
                />
              </Field>
              <Field label="Senha">
                <input
                  type="password"
                  name="password"
                  minLength={8}
                  maxLength={128}
                  placeholder="Mínimo de 8 caracteres"
                  required
                  autoComplete={signup ? 'new-password' : 'current-password'}
                />
              </Field>
              {error && (
                <p className="error-text" role="alert">
                  {error}
                </p>
              )}
              {success && (
                <p className="success-banner" role="status">
                  {success}
                </p>
              )}
              <Submit busy={busy}>
                {signup ? 'Solicitar cadastro' : 'Entrar na clínica'}
                <ArrowRight size={16} />
              </Submit>
              <button
                type="button"
                className="auth-switch"
                onClick={() => {
                  setSignup(!signup);
                  setError('');
                  setSuccess('');
                }}
              >
                {signup
                  ? 'Já tem conta? Entrar'
                  : 'Primeiro acesso? Solicitar cadastro'}
                <ArrowUpRight size={14} />
              </button>
            </form>
          )}
          <p className="auth-footnote">
            <LockKeyhole size={12} /> Acesso individual · autorizado pela sua
            clínica
          </p>
        </div>
      </section>
    </main>
  );
}
