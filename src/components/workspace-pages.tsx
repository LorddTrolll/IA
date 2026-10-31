'use client';
import { Tooth } from './tooth-icon';
import { useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  FileText,
  Plus,
  Search,
  Sparkles,
  Stethoscope,
  Users,
} from 'lucide-react';
import {
  appointmentLabels,
  brl,
  localDate,
  pendingReturns,
  type ClinicState,
  type SessionInfo,
} from '@/lib/types';
import { Avatar, Badge, dateLabel, Empty } from './ui';
import type { ActionFn } from './forms';
type Props = {
  state: ClinicState;
  session: SessionInfo;
  onAction: ActionFn;
  onPatient: (id: string) => void;
};
export function PatientsPage({
  state,
  onPatient,
  onNew,
  search: globalSearch = '',
}: Props & { onNew: () => void; search?: string }) {
  const [search, setSearch] = useState(globalSearch),
    [filter, setFilter] = useState('all');
  const patients = state.patients.filter(
    (p) =>
      `${p.name} ${p.phone}`
        .toLocaleLowerCase()
        .includes(search.toLocaleLowerCase()) &&
      (filter !== 'pending' ||
        state.treatments.some(
          (t) =>
            t.patientId === p.id &&
            !['completed', 'cancelled'].includes(t.status),
        )),
  );
  return (
    <>
      <div className="page-title-row">
        <div>
          <span className="eyebrow">HISTÓRIAS QUE SE CONECTAM</span>
          <h1>
            Pessoas, primeiro<span>.</span>
          </h1>
          <p className="page-subtitle">
            Um lugar para conhecer, acompanhar e cuidar.
          </p>
        </div>
        <button className="button button-primary" onClick={onNew}>
          <Plus size={17} /> Novo paciente
        </button>
      </div>
      <div className="metric-strip">
        <div>
          <span className="eyebrow">PACIENTES</span>
          <strong>{String(state.patients.length).padStart(2, '0')}</strong>
        </div>
        <div>
          <span className="eyebrow">PLANOS EM ANDAMENTO</span>
          <strong>
            {String(
              state.treatments.filter((t) => t.status === 'in_progress').length,
            ).padStart(2, '0')}
          </strong>
        </div>
        <div>
          <span className="eyebrow">CUIDADO CONTÍNUO</span>
          <strong>
            {String(pendingReturns(state).length).padStart(2, '0')}
            <small>retornos para acompanhar</small>
          </strong>
        </div>
        <Users size={42} strokeWidth={1} />
      </div>
      <section className="card">
        <div className="list-toolbar">
          <div className="tabs">
            <button
              className={filter === 'all' ? 'active' : ''}
              onClick={() => setFilter('all')}
            >
              Todos os pacientes
            </button>
            <button
              className={filter === 'pending' ? 'active' : ''}
              onClick={() => setFilter('pending')}
            >
              Com tratamento pendente
            </button>
          </div>
          <label className="search-input">
            <Search size={16} />
            <input
              placeholder="Buscar nome ou telefone"
              aria-label="Buscar pacientes"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </div>
        {patients.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>PACIENTE</th>
                  <th>CONTATO</th>
                  <th>PROFISSIONAL</th>
                  <th>PRÓXIMO PASSO</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {patients.map((p) => {
                  const appt = state.appointments
                    .filter(
                      (a) =>
                        a.patientId === p.id &&
                        a.date >= localDate() &&
                        !['cancelled', 'completed', 'missed'].includes(
                          a.status,
                        ),
                    )
                    .sort((a, b) =>
                      `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`),
                    )[0];
                  return (
                    <tr key={p.id}>
                      <td>
                        <button
                          className="person-cell"
                          onClick={() => onPatient(p.id)}
                        >
                          <Avatar name={p.name} color={p.color} />
                          <div>
                            <strong>{p.name}</strong>
                            <span>
                              Paciente desde{' '}
                              {new Date(p.createdAt).getFullYear()}
                            </span>
                          </div>
                        </button>
                      </td>
                      <td>
                        <span>{p.phone || 'Não informado'}</span>
                        <small>{p.email}</small>
                      </td>
                      <td>
                        {state.members.find((m) => m.id === p.dentistId)
                          ?.name || 'Não atribuído'}
                      </td>
                      <td>
                        {appt ? (
                          <Badge tone="green">
                            {dateLabel(appt.date)} · {appt.time}
                          </Badge>
                        ) : (
                          <span className="muted-small">
                            Aguardando agendamento
                          </span>
                        )}
                      </td>
                      <td>
                        <button
                          className="icon-button"
                          aria-label={`Abrir ficha de ${p.name}`}
                          onClick={() => onPatient(p.id)}
                        >
                          <ArrowUpRight size={17} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="Nenhum paciente encontrado"
            description="Experimente outro termo ou cadastre uma nova história."
          />
        )}
        <div className="table-footer">
          {patients.length} paciente(s) encontrado(s)
          <span>Informações conectadas ao prontuário</span>
        </div>
      </section>
    </>
  );
}
export function AgendaPage({
  state,
  onAction,
  onPatient,
  onNew,
}: Props & { onNew: (date?: string) => void }) {
  const [date, setDate] = useState(localDate()),
    [dentist, setDentist] = useState('all'),
    [busy, setBusy] = useState(''),
    [error, setError] = useState('');
  const appointments = state.appointments
    .filter(
      (a) => a.date === date && (dentist === 'all' || a.dentistId === dentist),
    )
    .sort((a, b) => a.time.localeCompare(b.time));
  function move(n: number) {
    const d = new Date(date + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + n);
    setDate(d.toISOString().slice(0, 10));
  }
  async function change(id: string, status: string) {
    setBusy(id);
    setError('');
    try {
      await onAction('updateAppointment', { id, status });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
    }
  }
  return (
    <>
      <div className="page-title-row">
        <div>
          <span className="eyebrow">CADA HORÁRIO, UM CUIDADO</span>
          <h1>
            Agenda da clínica<span>.</span>
          </h1>
          <p className="page-subtitle">
            O ritmo do seu dia, com espaço para o que importa.
          </p>
        </div>
        <button className="button button-primary" onClick={() => onNew(date)}>
          <Plus size={17} /> Novo atendimento
        </button>
      </div>
      <div className="agenda-toolbar card">
        <div className="date-controls">
          <button
            className="icon-button"
            onClick={() => move(-1)}
            aria-label="Dia anterior"
          >
            <ChevronLeft size={18} />
          </button>
          <label className="date-picker">
            <CalendarDays size={17} />
            <input
              type="date"
              aria-label="Data da agenda"
              value={date}
              onChange={(e) => e.target.value && setDate(e.target.value)}
            />
          </label>
          <button
            className="icon-button"
            onClick={() => move(1)}
            aria-label="Próximo dia"
          >
            <ChevronRight size={18} />
          </button>
          <button
            className="button button-secondary small"
            onClick={() => setDate(localDate())}
          >
            Hoje
          </button>
        </div>
        <select
          aria-label="Filtrar por dentista"
          value={dentist}
          onChange={(e) => setDentist(e.target.value)}
        >
          <option value="all">Todos os profissionais</option>
          {state.members
            .filter((m) => m.role !== 'reception' && m.status === 'active')
            .map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
        </select>
        <Badge tone="green">{appointments.length} atendimento(s)</Badge>
      </div>
      {error && (
        <p className="error-banner" role="alert">
          {error}
        </p>
      )}
      <section className="schedule-list">
        {appointments.length ? (
          appointments.map((a) => {
            const p = state.patients.find((p) => p.id === a.patientId);
            return (
              <article
                key={a.id}
                className={`schedule-item card ${a.status === 'in_progress' ? 'schedule-active' : ''}`}
              >
                <div className="schedule-hour">
                  <strong>{a.time}</strong>
                  <span>
                    <Clock3 size={12} />
                    {a.duration} min
                  </span>
                </div>
                <div className="schedule-rule" />
                <Avatar name={p?.name || 'Paciente'} color={p?.color} />
                <div className="schedule-info">
                  <button
                    className="plain-link"
                    onClick={() => onPatient(a.patientId)}
                  >
                    {p?.name}
                  </button>
                  <span>{a.procedure}</span>
                  <small>
                    {state.members.find((m) => m.id === a.dentistId)?.name} ·{' '}
                    {a.room}
                  </small>
                </div>
                <div className="schedule-actions">
                  <select
                    aria-label={`Status do atendimento de ${p?.name}`}
                    disabled={busy === a.id}
                    value={a.status}
                    onChange={(e) => change(a.id, e.target.value)}
                  >
                    {Object.entries(appointmentLabels).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                  <button
                    className="icon-button"
                    aria-label={`Abrir prontuário de ${p?.name}`}
                    onClick={() => onPatient(a.patientId)}
                  >
                    <ArrowUpRight size={19} />
                  </button>
                </div>
              </article>
            );
          })
        ) : (
          <div className="card">
            <Empty
              title="Espaço para novos encontros"
              description="Não há atendimentos nesta data para o filtro selecionado."
              action={
                <button
                  className="button button-primary"
                  onClick={() => onNew(date)}
                >
                  <Plus size={15} />
                  Agendar atendimento
                </button>
              }
            />
          </div>
        )}
      </section>
    </>
  );
}
export function ClinicalPage({ state, onPatient, session }: Props) {
  const pending = state.treatments.filter(
    (t) => !['completed', 'cancelled'].includes(t.status),
  );
  const returns = pendingReturns(state);
  return (
    <>
      <div className="page-title-row">
        <div>
          <span className="eyebrow">CONTINUIDADE QUE TRANSFORMA</span>
          <h1>
            Cuidado em perspectiva<span>.</span>
          </h1>
          <p className="page-subtitle">
            Planejamentos, retornos e atenção a cada detalhe.
          </p>
        </div>
        <span className="large-line-icon">
          <Stethoscope size={36} strokeWidth={1} />
        </span>
      </div>
      <div className="two-columns">
        <section className="card padded">
          <div className="section-heading">
            <h2>Tratamentos pendentes</h2>
            <Badge>{pending.length}</Badge>
          </div>
          {pending.length ? (
            pending.map((t) => (
              <button
                key={t.id}
                className="clinical-list-row"
                onClick={() => onPatient(t.patientId)}
              >
                <span className="tooth-number">{t.tooth || '—'}</span>
                <div>
                  <strong>
                    {state.patients.find((p) => p.id === t.patientId)?.name}
                  </strong>
                  <span>{t.procedure}</span>
                </div>
                <Badge tone={t.priority === 'high' ? 'coral' : 'neutral'}>
                  {t.priority === 'high' ? 'Prioritário' : 'Planejado'}
                </Badge>
                <ArrowUpRight size={15} />
              </button>
            ))
          ) : (
            <Empty
              title="Tudo acompanhado"
              description="Os tratamentos pendentes aparecerão aqui."
            />
          )}
        </section>
        <section className="card padded">
          <div className="section-heading">
            <h2>Retornos para acompanhar</h2>
            <Badge tone="coral">{returns.length}</Badge>
          </div>
          {returns.length ? (
            returns.map((e) => (
              <button
                key={e.id}
                className="clinical-list-row"
                onClick={() => onPatient(e.patientId)}
              >
                <div className="mini-stat-icon coral-bg">
                  <Clock3 size={17} />
                </div>
                <div>
                  <strong>
                    {state.patients.find((p) => p.id === e.patientId)?.name}
                  </strong>
                  <span>Retorno previsto: {dateLabel(e.returnDate)}</span>
                </div>
                <ArrowUpRight size={16} />
              </button>
            ))
          ) : (
            <Empty
              title="Retornos em dia"
              description="Retornos registrados nas evoluções serão acompanhados aqui."
            />
          )}
          <div className="soft-note">
            Lembretes são baseados nos registros da equipe e continuam
            disponíveis sem IA.
          </div>
        </section>
      </div>
    </>
  );
}
export function KnowledgePage({
  state,
  onPatient,
  onAsk,
  session,
}: Props & { onAsk: (question?: string) => void }) {
  const [search, setSearch] = useState('');
  const notes = state.notes.filter((n) =>
    `${n.title} ${n.content} ${state.patients.find((p) => p.id === n.patientId)?.name || ''}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <>
      <div className="page-title-row">
        <div>
          <span className="eyebrow">MEMÓRIA QUE APOIA O CUIDADO</span>
          <h1>
            Cérebro da clínica<span>.</span>
          </h1>
          <p className="page-subtitle">
            Cada história conectada ao próximo passo.
          </p>
        </div>
        <a className="button button-secondary" href="/api/vault">
          <Download size={16} />
          Exportar para Obsidian
        </a>
      </div>
      <div className="knowledge-hero">
        <div>
          <div className="eyebrow lime">
            <Sparkles size={14} /> INTELIGÊNCIA CLÍNICA
          </div>
          <h2>
            O que você precisa
            <br />
            lembrar hoje?
          </h2>
          <p>
            Consulte planejamentos, encontre registros e prepare o próximo
            atendimento com mais contexto.
          </p>
          <button className="button button-lime" onClick={() => onAsk()}>
            Conversar com o assistente <ArrowUpRight size={16} />
          </button>
        </div>
        <div className="knowledge-orbit" aria-hidden="true">
          <span>✧</span>
          <i />
          <i />
          <b>
            MEMÓRIA
            <br />
            CONECTADA
          </b>
        </div>
      </div>
      <div className="knowledge-status">
        <span>
          <i className="status-dot" /> {state.notes.length} notas disponíveis
        </span>
        <span>Markdown compatível com Obsidian</span>
        <span>
          {session.grokConfigured
            ? 'API Grok configurada'
            : 'Busca documental local · Grok não configurado'}
        </span>
      </div>
      <section className="card padded">
        <div className="section-heading">
          <h2>Biblioteca de cuidados</h2>
          <label className="search-input">
            <Search size={16} />
            <input
              placeholder="Buscar nas notas"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Buscar nas notas"
            />
          </label>
        </div>
        <div className="notes-grid">
          {notes.map((n) => (
            <button
              className="note-card"
              key={n.id}
              onClick={() =>
                n.patientId ? onPatient(n.patientId) : onAsk(n.title)
              }
            >
              <div>
                <FileText size={19} />
                <ArrowUpRight size={15} />
              </div>
              <span className="eyebrow">
                {state.patients.find((p) => p.id === n.patientId)?.name ||
                  'CLÍNICA'}
              </span>
              <h3>{n.title}</h3>
              <p>{n.content.replace(/[#*\[\]]/g, '').slice(0, 150)}</p>
              <small>Atualizado em {dateLabel(n.updatedAt.slice(0, 10))}</small>
            </button>
          ))}
        </div>
        {!notes.length && (
          <Empty
            title="Nenhuma nota encontrada"
            description="Adicione notas pela aba Cérebro do prontuário do paciente."
          />
        )}
      </section>
      <p className="field-hint">
        A exportação gera uma cópia atual do vault. Edições feitas no Obsidian
        não são importadas automaticamente nesta versão.
      </p>
    </>
  );
}
