'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  ArrowUp,
  ArrowUpRight,
  Bot,
  Check,
  FileText,
  Loader2,
  Sparkles,
  X,
} from 'lucide-react';
import {
  type AssistantReply,
  type ClinicState,
  type SessionInfo,
} from '@/lib/types';
type Message = {
  role: 'user' | 'assistant';
  text: string;
  sources?: AssistantReply['sources'];
  provider?: string;
};
export default function Assistant({
  state,
  session,
  patientId,
  initialQuestion,
  onClose,
  onPatient,
}: {
  state: ClinicState;
  session: SessionInfo;
  patientId?: string;
  initialQuestion?: string;
  onClose: () => void;
  onPatient: (id: string) => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]),
    [question, setQuestion] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const started = useRef(false),
    bottom = useRef<HTMLDivElement>(null),
    abort = useRef<AbortController | null>(null);
  const patient = state.patients.find((p) => p.id === patientId);
  async function ask(q: string) {
    if (!q.trim() || busy) return;
    setMessages((m) => [...m, { role: 'user', text: q }]);
    setQuestion('');
    setBusy(true);
    setError('');
    const controller = new AbortController();
    abort.current = controller;
    try {
      const r = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, patientId }),
        signal: controller.signal,
      });
      const data = await r.json();
      if (!r.ok)
        throw new Error(
          data.error || 'Não foi possível consultar o assistente.',
        );
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          text: data.answer,
          sources: data.sources,
          provider: data.provider,
        },
      ]);
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (initialQuestion && !started.current) {
      started.current = true;
      void ask(initialQuestion);
    }
    return () => abort.current?.abort();
  }, []); // Each panel is a separate conversation.
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, busy, error]);
  return (
    <div
      className="assistant-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <aside
        className="assistant-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Assistente da clínica"
      >
        <header>
          <div className="assistant-logo">
            <Sparkles size={22} />
          </div>
          <div>
            <span className="eyebrow">UM SEGUNDO OLHAR</span>
            <h2>Assistente Lúmina</h2>
          </div>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Fechar assistente"
          >
            <X size={20} />
          </button>
        </header>
        <div className="assistant-context">
          <i />
          {patient
            ? `Contexto: ${patient.name}`
            : 'Contexto: registros autorizados da clínica'}
        </div>
        <div className="assistant-messages">
          {!messages.length && (
            <div className="assistant-welcome">
              <div className="sparkle-large">✧</div>
              <h3>
                Mais contexto.
                <br />
                Mais cuidado.
              </h3>
              <p>Encontre informações registradas e prepare o próximo passo.</p>
              {(patient
                ? [
                    'Resuma o planejamento deste paciente.',
                    'Existe alguma alergia registrada?',
                    'Quanto este paciente ainda deve?',
                  ]
                : [
                    'Quais pacientes precisam de retorno?',
                    'Quais pacientes têm débitos pendentes?',
                    'Quais tratamentos estão planejados?',
                  ]
              ).map((q) => (
                <button key={q} onClick={() => ask(q)}>
                  {q}
                  <ArrowUpRight size={15} />
                </button>
              ))}
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`chat-message chat-${m.role}`}>
              {m.role === 'assistant' && (
                <span className="chat-provider">
                  <Sparkles size={13} />
                  {m.provider === 'grok'
                    ? 'GROK · XAI'
                    : 'BUSCA DOCUMENTAL LOCAL'}
                </span>
              )}
              <div className="chat-text">{m.text}</div>
              {!!m.sources?.length && (
                <div className="chat-sources">
                  <span>REGISTROS CONSULTADOS</span>
                  {m.sources.map((s) => (
                    <button
                      key={s.id}
                      onClick={() =>
                        s.patientId ? onPatient(s.patientId) : undefined
                      }
                      disabled={!s.patientId}
                    >
                      <FileText size={13} />
                      <span>
                        {s.title}
                        <small>{s.excerpt}</small>
                      </span>
                      {s.patientId && <ArrowUpRight size={13} />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
          {busy && (
            <div className="assistant-thinking">
              <Loader2 size={15} className="spin" />
              Consultando registros e conectando o contexto…
            </div>
          )}
          {error && (
            <div className="error-banner" role="alert">
              {error}
            </div>
          )}
          <div ref={bottom} />
        </div>
        <div className="assistant-input-wrap">
          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              void ask(question);
            }}
          >
            <textarea
              autoFocus
              aria-label="Pergunta ao assistente"
              placeholder="O que você precisa lembrar?"
              rows={2}
              maxLength={1500}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void ask(question);
                }
              }}
            />
            <button
              type="submit"
              disabled={busy || !question.trim()}
              aria-label="Enviar pergunta"
            >
              <ArrowUp size={20} />
            </button>
          </form>
          <p>
            {session.grokConfigured
              ? 'IA de apoio · confira as fontes antes de decidir.'
              : 'Modo local · configure a API xAI para respostas com Grok.'}
          </p>
        </div>
      </aside>
    </div>
  );
}
