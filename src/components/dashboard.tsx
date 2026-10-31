'use client';
import {
  ArrowRight,
  ArrowUpRight,
  Clock3,
  Plus,
  Sparkles,
  Check,
  Circle,
  CalendarDays,
  ChevronRight,
  Ellipsis,
  Wallet,
  Stethoscope,
} from 'lucide-react';
import {
  brl,
  localDate,
  pendingReturns,
  clinicDateOf,
  type ClinicState,
  type SessionInfo,
} from '@/lib/types';
import { Avatar, Badge, Empty } from './ui';
export default function Dashboard({
  state,
  session,
  onPatient,
  onNavigate,
  onSchedule,
  onAsk,
}: {
  state: ClinicState;
  session: SessionInfo;
  onPatient: (id: string) => void;
  onNavigate: (page: string) => void;
  onSchedule: () => void;
  onAsk: (question: string) => void;
}) {
  const today = localDate();
  const appointments = state.appointments
    .filter((a) => a.date === today && a.status !== 'cancelled')
    .sort((a, b) => a.time.localeCompare(b.time));
  const active = appointments.find((a) => a.status === 'in_progress');
  const next =
    active ||
    appointments.find((a) => !['completed', 'missed'].includes(a.status));
  const patient = state.patients.find((p) => p.id === next?.patientId);
  const completed = appointments.filter((a) => a.status === 'completed').length;
  const upcoming = appointments.filter((a) =>
    ['scheduled', 'confirmed', 'arrived'].includes(a.status),
  );
  const overdue = state.invoices.filter(
    (i) =>
      i.dueDate < today &&
      i.amount >
        state.payments
          .filter((p) => p.invoiceId === i.id)
          .reduce((s, p) => s + p.amount, 0),
  );
  const returns = pendingReturns(state, today);
  const finance = session.user.finance || session.user.role === 'admin';
  const paidToday = state.payments
    .filter((p) => clinicDateOf(p.createdAt) === today)
    .reduce((s, p) => s + p.amount, 0);
  const rows = appointments.filter((a) => a.id !== active?.id).slice(0, 4);
  return (
    <>
      <div className="page-title-row">
        <div>
          <div className="live-label">
            <i /> OPERAÇÃO EM TEMPO REAL
          </div>
          <h1>
            Pulso da clínica<span>.</span>
          </h1>
          <p className="page-subtitle">
            Seu dia em equilíbrio. Cada cuidado, conectado.
          </p>
        </div>
        <div className="today-date">
          <CalendarDays size={17} />
          <div>
            <span>HOJE NA LÚMINA</span>
            <strong>
              {new Intl.DateTimeFormat('pt-BR', {
                weekday: 'long',
                day: '2-digit',
                month: 'long',
                timeZone: 'America/Sao_Paulo',
              }).format(new Date())}
            </strong>
          </div>
        </div>
      </div>
      <div className="hero-grid">
        <section className="care-card">
          <div className="care-card-top">
            <span className="eyebrow">
              <i className="glow-dot" />
              {active
                ? 'EM ATENDIMENTO'
                : next
                  ? 'PRÓXIMO CUIDADO'
                  : 'UM RESPIRO NA AGENDA'}
            </span>
            <Stethoscope size={19} />
          </div>
          <div className="chair-number">
            {next?.room.replace(/\D/g, '') || '01'}
          </div>
          <div className="care-card-body">
            <span className="eyebrow lime">
              {next?.room.toUpperCase() || 'TUDO EM DIA'}
            </span>
            <h2>{patient?.name || 'Prontos para cuidar.'}</h2>
            <p>
              {next?.procedure ||
                'Organize o próximo atendimento da sua clínica.'}
            </p>
          </div>
          <div className="care-card-footer">
            <div>
              <span className="care-time">
                <Clock3 size={12} />
                {next
                  ? `${next.time} · ${next.duration} min reservados`
                  : 'Uma nova história começa aqui'}
              </span>
              <div className="care-progress">
                <span style={{ width: active ? '62%' : '10%' }} />
              </div>
              <span className="care-footnote">
                {active
                  ? 'Cuidado em andamento'
                  : next
                    ? 'Tudo pronto para receber'
                    : 'Sua agenda, em um só lugar'}
              </span>
            </div>
            <button
              className="button button-lime"
              onClick={() => (patient ? onPatient(patient.id) : onSchedule())}
            >
              {patient ? 'Abrir prontuário' : 'Novo atendimento'}
              <ArrowRight size={16} />
            </button>
          </div>
          <div className="care-watermark" aria-hidden="true" />
        </section>
        <section className="flow-card card">
          <div className="section-heading">
            <span className="eyebrow">FLUXO DE HOJE</span>
            <button className="text-link" onClick={() => onNavigate('agenda')}>
              Ver agenda <ArrowUpRight size={13} />
            </button>
          </div>
          <div className="flow-number">
            {String(appointments.length).padStart(2, '0')}
            <span>
              atendimentos
              <br />
              programados
            </span>
          </div>
          <div
            className="flow-bars"
            aria-label={`${completed} concluídos, ${active ? 1 : 0} em andamento, ${upcoming.length} próximos`}
          >
            {Array.from(
              { length: Math.max(appointments.length, 8) },
              (_, i) => (
                <span
                  key={i}
                  className={
                    i < completed
                      ? 'done'
                      : i === completed && active
                        ? 'now'
                        : ''
                  }
                />
              ),
            )}
          </div>
          <div className="flow-legend">
            <span>
              <i />
              {completed} concluídos
            </span>
            <span>
              <i className="coral" />
              {active ? 1 : 0} agora
            </span>
            <span>
              <i className="pale" />
              {upcoming.length} próximos
            </span>
          </div>
          <div className="flow-bottom">
            <span className="check-circle">
              <Check size={14} />
            </span>
            <p>
              {appointments.length
                ? 'Cada horário é uma oportunidade de cuidar.'
                : 'Um dia cheio de possibilidades.'}
            </p>
          </div>
        </section>
      </div>
      <div className="dashboard-middle">
        <section className="agenda-card card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">A SEGUIR</span>
              <h2>
                Próximos encontros{' '}
                <span className="count-chip">{upcoming.length}</span>
              </h2>
            </div>
            <button
              className="icon-button"
              title="Agendar atendimento"
              onClick={onSchedule}
            >
              <Plus size={19} />
            </button>
          </div>
          {rows.length ? (
            <div className="appointment-rows">
              {rows.map((a) => {
                const p = state.patients.find((p) => p.id === a.patientId),
                  dentist = state.members.find((m) => m.id === a.dentistId);
                return (
                  <button
                    key={a.id}
                    className="appointment-row"
                    onClick={() => onPatient(a.patientId)}
                  >
                    <div className="appointment-time">
                      {a.time}
                      <span>{a.duration} MIN</span>
                    </div>
                    <Avatar name={p?.name || 'Paciente'} color={p?.color} />
                    <div className="appointment-person">
                      <strong>{p?.name}</strong>
                      <span>{a.procedure}</span>
                    </div>
                    <div className="appointment-dentist">
                      {dentist?.name}
                      <span>{a.room}</span>
                    </div>
                    <Badge
                      tone={
                        a.status === 'completed'
                          ? 'green'
                          : a.status === 'confirmed'
                            ? 'lime'
                            : 'neutral'
                      }
                      dot
                    >
                      {a.status === 'completed'
                        ? 'Concluído'
                        : a.status === 'confirmed'
                          ? 'Confirmado'
                          : a.status === 'arrived'
                            ? 'Na recepção'
                            : a.status === 'missed'
                              ? 'Faltou'
                              : 'Agendado'}
                    </Badge>
                    <ChevronRight size={15} />
                  </button>
                );
              })}
            </div>
          ) : (
            <Empty
              title="Agenda tranquila"
              description="Os próximos atendimentos aparecerão aqui."
            />
          )}
          <button
            className="card-footer-link"
            onClick={() => onNavigate('agenda')}
          >
            Explorar agenda do dia <ArrowRight size={15} />
          </button>
        </section>
        <section className="brain-card">
          <div className="brain-symbol">
            <Sparkles size={23} />
          </div>
          <span className="eyebrow">SEU SEGUNDO OLHAR</span>
          <h2>
            O cuidado também
            <br />
            está nos detalhes.
          </h2>
          <p>
            {returns.length
              ? `${returns.length} registro(s) de retorno merecem sua atenção.`
              : 'Planejamentos, histórias e próximos passos. Tudo conectado no Cérebro da clínica.'}
          </p>
          <button
            className="brain-prompt"
            onClick={() => onAsk('Quais pacientes precisam de retorno?')}
          >
            <span>O que preciso lembrar hoje?</span>
            <ArrowUpRight size={17} />
          </button>
          <div className="brain-footer">
            <i />{' '}
            {session.grokConfigured
              ? 'Grok conectado'
              : 'Busca local · Grok configurável'}
            <span>✧</span>
          </div>
        </section>
      </div>
      <div className="dashboard-bottom">
        <section className="mini-stat card">
          <div className="mini-stat-icon">
            <Wallet size={19} />
          </div>
          <div>
            <span className="eyebrow">
              {finance ? 'RECEBIDO HOJE' : 'PACIENTES EM CUIDADO'}
            </span>
            <strong>
              {finance
                ? brl(paidToday)
                : String(state.patients.length).padStart(2, '0')}
            </strong>
            <span className="muted-small">
              {finance
                ? 'Pagamentos registrados no dia'
                : 'Histórias conectadas à clínica'}
            </span>
          </div>
          <button
            className="icon-button"
            aria-label={finance ? 'Abrir caixa' : 'Abrir pacientes'}
            onClick={() => onNavigate(finance ? 'caixa' : 'pacientes')}
          >
            <ArrowUpRight size={18} />
          </button>
        </section>
        <section className="mini-stat card">
          <div className="mini-stat-icon coral-bg">
            <Clock3 size={19} />
          </div>
          <div>
            <span className="eyebrow">
              {finance ? 'CONTAS PARA ACOMPANHAR' : 'RETORNOS PARA ACOMPANHAR'}
            </span>
            <strong>
              {String(finance ? overdue.length : returns.length).padStart(
                2,
                '0',
              )}
              <small>{finance ? 'em atraso' : 'pendentes'}</small>
            </strong>
            <span className="muted-small">
              {finance
                ? 'Um olhar atento para a saúde do caixa'
                : 'Continuidade para cada cuidado'}
            </span>
          </div>
          <button
            className="icon-button"
            aria-label="Ver pendências"
            onClick={() => onNavigate(finance ? 'caixa' : 'clinica')}
          >
            <ArrowUpRight size={18} />
          </button>
        </section>
        <section className="daily-note">
          <span className="eyebrow">FEITO PARA CUIDAR</span>
          <p>
            Uma clínica organizada.
            <br />
            <strong>Mais espaço para pessoas.</strong>
          </p>
          <span className="note-flower" aria-hidden="true">
            ✳
          </span>
        </section>
      </div>
    </>
  );
}
