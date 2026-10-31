'use client';
import { useState, type FormEvent } from 'react';
import {
  ArrowLeft,
  ArrowUpRight,
  BrainCircuit,
  CalendarDays,
  Check,
  ChevronRight,
  ClipboardList,
  Download,
  FileText,
  HeartPulse,
  Mail,
  Phone,
  Plus,
  Receipt,
  ShieldAlert,
  Sparkles,
  Stethoscope,
  Wallet,
} from 'lucide-react';
import type {
  ClinicState,
  Patient,
  SessionInfo,
  Invoice,
  KnowledgeNote,
} from '@/lib/types';
import { brl, localDate, treatmentLabels } from '@/lib/types';
import {
  Avatar,
  Badge,
  Empty,
  Field,
  Modal,
  Submit,
  dateLabel,
  moneyInput,
} from './ui';
import './clinical.css';

type Props = {
  patient: Patient;
  state: ClinicState;
  session: SessionInfo;
  onAction: (type: string, payload: Record<string, unknown>) => Promise<void>;
  onBack: () => void;
  onAsk: (patientId: string, question?: string) => void;
};
type Dialog = {
  type: 'tooth' | 'treatment' | 'evolution' | 'invoice' | 'payment' | 'note';
  invoice?: Invoice;
  note?: KnowledgeNote;
  key: string;
} | null;
const permanent = [
  [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28],
  [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38],
];
const deciduous = [
  [55, 54, 53, 52, 51, 61, 62, 63, 64, 65],
  [85, 84, 83, 82, 81, 71, 72, 73, 74, 75],
];
const conditionNames: Record<string, string> = {
  healthy: 'Hígido',
  caries: 'Cárie',
  restoration: 'Restauração',
  missing: 'Ausente',
  implant: 'Implante',
  endodontic: 'Endodontia',
  fracture: 'Fratura',
  other: 'Outra condição',
};
const clinicalStatus: Record<string, string> = {
  existing: 'Condição existente',
  planned: 'Tratamento planejado',
  completed: 'Procedimento realizado',
};
const toothColor = (condition?: string, status?: string) =>
  !condition
    ? 'healthy'
    : status === 'planned'
      ? 'planned'
      : status === 'completed'
        ? 'completed'
        : ['Cárie', 'Fratura', 'caries', 'fracture'].includes(condition)
          ? 'attention'
          : ['Ausente', 'missing'].includes(condition)
            ? 'missing'
            : 'treated';
const displayCondition = (condition: string) =>
  conditionNames[condition] ?? condition;

function ToothIcon({
  number,
  color,
  lower,
}: {
  number: number;
  color: string;
  lower: boolean;
}) {
  return (
    <svg
      viewBox="0 0 42 60"
      aria-hidden="true"
      className={`clinical-tooth-svg clinical-tooth-${color} ${lower ? 'clinical-tooth-lower' : ''}`}
    >
      <path
        className="clinical-tooth-root"
        d="M10 24c-2 9 0 18 2 26 1 5 4 5 5 0l4-17 4 17c1 5 4 5 5 0 2-8 4-17 2-26"
      />
      <path
        className="clinical-tooth-crown"
        d="M8 25C4 17 5 7 11 5c5-2 7 2 10 2s5-4 10-2c6 2 7 12 3 20-2 4-5 5-8 3-3-2-7-2-10 0-3 2-6 1-8-3Z"
      />
      <path
        className="clinical-tooth-groove"
        d="m11 11 7 5-5 6m17-11-7 5 5 6m-10-6h5"
      />
      {color === 'missing' && (
        <path className="clinical-tooth-x" d="m7 5 28 45M35 5 7 50" />
      )}
      <title>Elemento {number}</title>
    </svg>
  );
}

export default function PatientDetail({
  patient,
  state,
  session,
  onAction,
  onBack,
  onAsk,
}: Props) {
  const clinical = session.user.role !== 'reception';
  const finance = session.user.role === 'admin' || session.user.finance;
  const [tab, setTab] = useState('Resumo');
  const [dialog, setDialog] = useState<Dialog>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selectedTooth, setSelectedTooth] = useState(46);
  const [dentition, setDentition] = useState<
    'permanent' | 'deciduous' | 'mixed'
  >('permanent');
  const [planFilter, setPlanFilter] = useState('all');
  const [appointmentFilter, setAppointmentFilter] = useState(false);
  const treatments = state.treatments.filter((t) => t.patientId === patient.id);
  const teeth = state.teeth.filter((t) => t.patientId === patient.id);
  const evolutions = state.evolutions
    .filter((t) => t.patientId === patient.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const invoices = state.invoices.filter((t) => t.patientId === patient.id);
  const invoiceIds = new Set(invoices.map((i) => i.id));
  const payments = state.payments.filter((t) => invoiceIds.has(t.invoiceId));
  const total = invoices.reduce((sum, i) => sum + i.amount, 0);
  const paid = payments.reduce((sum, p) => sum + p.amount, 0);
  const notes = state.notes
    .filter((n) => n.patientId === patient.id)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const appointments = state.appointments
    .filter((a) => a.patientId === patient.id && a.status !== 'cancelled')
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  const next = appointments.find(
    (a) => a.date >= localDate() && !['completed', 'missed'].includes(a.status),
  );
  const dentist = state.members.find((m) => m.id === patient.dentistId);
  const author = (id: string) =>
    state.members.find((m) => m.id === id)?.name ?? 'Profissional';
  const tabs = [
    'Resumo',
    ...(clinical
      ? ['Anamnese', 'Odontograma', 'Planejamento', 'Evoluções']
      : []),
    ...(finance ? ['Financeiro'] : []),
    ...(clinical ? ['Cérebro'] : []),
  ];
  const open = (
    type: NonNullable<Dialog>['type'],
    extra: Partial<NonNullable<Dialog>> = {},
  ) => {
    setError('');
    setDialog({ type, key: crypto.randomUUID(), ...extra });
  };
  const act = async (
    type: string,
    payload: Record<string, unknown>,
    close = true,
  ) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await onAction(type, payload);
      if (close) setDialog(null);
      setNotice('Registro salvo com sucesso.');
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Não foi possível salvar. Tente novamente.',
      );
    } finally {
      setBusy(false);
    }
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const d = new FormData(event.currentTarget);
    const fields = Object.fromEntries(d.entries());
    if (!dialog) return;
    try {
      if (dialog.type === 'tooth')
        await act('addTooth', {
          patientId: patient.id,
          tooth: selectedTooth,
          ...fields,
        });
      if (dialog.type === 'treatment')
        await act('addTreatment', {
          patientId: patient.id,
          ...fields,
          amount: moneyInput(d.get('amount')),
        });
      if (dialog.type === 'evolution')
        await act('addEvolution', { patientId: patient.id, ...fields });
      if (dialog.type === 'invoice')
        await act('createInvoice', {
          patientId: patient.id,
          ...fields,
          amount: moneyInput(d.get('amount')),
        });
      if (dialog.type === 'payment')
        await act('addPayment', {
          invoiceId: dialog.invoice!.id,
          ...fields,
          amount: moneyInput(d.get('amount')),
          idempotencyKey: dialog.key,
        });
      if (dialog.type === 'note')
        await act('saveNote', {
          patientId: patient.id,
          ...fields,
          ...(dialog.note ? { id: dialog.note.id } : {}),
        });
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Confira os valores informados.',
      );
    }
  };
  const allergy = Boolean(
    patient.allergies &&
    !/^(nenhuma|não|nao|nega|sem alergia)/i.test(patient.allergies),
  );
  const activeTreatments = treatments.filter(
    (t) => !['completed', 'cancelled'].includes(t.status),
  );
  return (
    <section className="clinical-page">
      <button className="clinical-back" onClick={onBack}>
        <ArrowLeft size={15} /> Todos os pacientes
      </button>
      <div className="clinical-heading">
        <div className="clinical-identity">
          <Avatar name={patient.name} color={patient.color} />
          <div>
            <span className="eyebrow">
              PRONTUÁRIO · {patient.id.slice(0, 8).toUpperCase()}
            </span>
            <h1>{patient.name}</h1>
            <div className="clinical-contact">
              {patient.phone && (
                <span>
                  <Phone size={12} />
                  {patient.phone}
                </span>
              )}
              {patient.birthDate && (
                <span>
                  <CalendarDays size={12} />
                  {dateLabel(patient.birthDate)}
                </span>
              )}
              <span>
                <i className="clinical-dot" />
                {dentist?.name ?? 'Sem dentista atribuído'}
              </span>
            </div>
          </div>
        </div>
        <div className="clinical-header-actions">
          {clinical && (
            <button
              className="button button-secondary"
              onClick={() =>
                onAsk(
                  patient.id,
                  'Resuma o planejamento e os alertas deste paciente.',
                )
              }
            >
              <Sparkles size={15} /> Consultar Cérebro
            </button>
          )}
          {clinical && (
            <button
              className="button button-primary"
              onClick={() => open('evolution')}
            >
              <Plus size={16} /> Nova evolução
            </button>
          )}
        </div>
      </div>
      <div
        className="clinical-tabs"
        role="tablist"
        aria-label="Seções do prontuário"
      >
        {tabs.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={t === tab}
            onClick={() => {
              setTab(t);
              setError('');
              setNotice('');
            }}
            className={t === tab ? 'active' : ''}
          >
            {t}
            {t === 'Cérebro' && <BrainCircuit size={13} />}
          </button>
        ))}
      </div>
      {notice && (
        <div className="clinical-notice" role="status">
          <Check size={16} />
          {notice}
          <button aria-label="Fechar mensagem" onClick={() => setNotice('')}>
            ×
          </button>
        </div>
      )}
      {error && !dialog && (
        <div className="clinical-error" role="alert">
          {error}
        </div>
      )}

      {tab === 'Resumo' && (
        <div className="clinical-summary-grid">
          <div className="clinical-main-column">
            {clinical && (
              <div
                className={`clinical-health-alert ${allergy ? 'clinical-health-warning' : ''}`}
              >
                <ShieldAlert size={21} />
                <div>
                  <span className="eyebrow">ATENÇÃO CLÍNICA</span>
                  <strong>
                    {allergy
                      ? `Alergia registrada: ${patient.allergies}`
                      : 'Nenhum alerta de alergia registrado'}
                  </strong>
                  <p>
                    {patient.medications
                      ? `Medicamentos: ${patient.medications}`
                      : 'Confira a anamnese com o paciente antes do atendimento.'}
                  </p>
                </div>
                <button
                  className="clinical-arrow"
                  onClick={() => setTab('Anamnese')}
                  aria-label="Abrir anamnese"
                >
                  <ArrowUpRight size={19} />
                </button>
              </div>
            )}
            <div className="clinical-metrics">
              <div>
                <span className="eyebrow">TRATAMENTOS ATIVOS</span>
                <strong>
                  {String(activeTreatments.length).padStart(2, '0')}
                </strong>
                <small>
                  {treatments.filter((t) => t.status === 'completed').length}{' '}
                  concluídos
                </small>
              </div>
              <div>
                <span className="eyebrow">ATENDIMENTOS</span>
                <strong>
                  {String(
                    appointments.filter((a) => a.status === 'completed').length,
                  ).padStart(2, '0')}
                </strong>
                <small>{appointments.length} registros na agenda</small>
              </div>
              {finance && (
                <div>
                  <span className="eyebrow">SALDO PENDENTE</span>
                  <strong className="clinical-money">
                    {brl(total - paid)}
                  </strong>
                  <small>{brl(paid)} recebidos</small>
                </div>
              )}
            </div>
            {clinical && (
              <section className="card clinical-section">
                <div className="clinical-section-heading">
                  <div>
                    <span className="eyebrow">CONTINUIDADE DO CUIDADO</span>
                    <h3>Planejamento em andamento</h3>
                  </div>
                  <button
                    className="clinical-link"
                    onClick={() => setTab('Planejamento')}
                  >
                    Ver plano <ArrowUpRight size={14} />
                  </button>
                </div>
                {activeTreatments.length ? (
                  activeTreatments.slice(0, 4).map((t) => (
                    <div className="clinical-treatment-row" key={t.id}>
                      <span className="clinical-tooth-number">
                        {t.tooth || '—'}
                      </span>
                      <div>
                        <strong>{t.procedure}</strong>
                        <small>{t.notes || 'Sem observações adicionais'}</small>
                      </div>
                      <Badge
                        tone={t.status === 'in_progress' ? 'lime' : 'neutral'}
                      >
                        {treatmentLabels[t.status]}
                      </Badge>
                    </div>
                  ))
                ) : (
                  <Empty
                    title="Um novo plano começa aqui"
                    description="Registre os procedimentos e acompanhe cada etapa do cuidado."
                    action={
                      <button
                        className="button button-secondary"
                        onClick={() => open('treatment')}
                      >
                        <Plus size={15} /> Planejar tratamento
                      </button>
                    }
                  />
                )}
              </section>
            )}
            {clinical && (
              <section className="card clinical-section">
                <div className="clinical-section-heading">
                  <div>
                    <span className="eyebrow">HISTÓRICO CLÍNICO</span>
                    <h3>Última evolução</h3>
                  </div>
                  <button
                    className="clinical-link"
                    onClick={() => setTab('Evoluções')}
                  >
                    Ver histórico <ArrowUpRight size={14} />
                  </button>
                </div>
                {evolutions[0] ? (
                  <div className="clinical-latest">
                    <div className="clinical-meta">
                      <Avatar name={author(evolutions[0].authorId)} small />
                      <span>
                        {author(evolutions[0].authorId)}
                        <small>{dateLabel(evolutions[0].createdAt)}</small>
                      </span>
                    </div>
                    <p>{evolutions[0].text}</p>
                    {evolutions[0].returnDate && (
                      <Badge
                        tone={
                          evolutions[0].returnDate < localDate()
                            ? 'coral'
                            : 'neutral'
                        }
                      >
                        <CalendarDays size={12} /> Retorno:{' '}
                        {dateLabel(evolutions[0].returnDate)}
                      </Badge>
                    )}
                  </div>
                ) : (
                  <p className="clinical-muted">
                    Nenhuma evolução registrada para este paciente.
                  </p>
                )}
              </section>
            )}
          </div>
          <aside className="clinical-side-column">
            <div className="clinical-next-visit">
              <span className="eyebrow">PRÓXIMO ENCONTRO</span>
              {next ? (
                <>
                  <div className="clinical-next-day">
                    {next.date.slice(8, 10)}
                    <span>
                      {new Date(`${next.date}T12:00:00`).toLocaleDateString(
                        'pt-BR',
                        { month: 'short' },
                      )}
                    </span>
                    <span className="clinical-next-time">{next.time}</span>
                  </div>
                  <h3>{next.procedure}</h3>
                  <p>
                    {next.room} · {next.duration} minutos
                  </p>
                  <Badge tone="lime">
                    {next.status === 'confirmed'
                      ? 'Confirmado'
                      : next.status === 'in_progress'
                        ? 'Em atendimento'
                        : 'Agendado'}
                  </Badge>
                </>
              ) : (
                <>
                  <CalendarDays size={32} />
                  <h3>Agenda em aberto</h3>
                  <p>Nenhum próximo atendimento agendado.</p>
                </>
              )}
              <button
                className="clinical-link"
                onClick={() => setAppointmentFilter(!appointmentFilter)}
              >
                {appointmentFilter
                  ? 'Ocultar agenda'
                  : 'Histórico de agendamentos'}{' '}
                <ChevronRight size={14} />
              </button>
              {appointmentFilter && (
                <div className="clinical-appointment-history">
                  {appointments.length ? (
                    appointments.map((a) => (
                      <div key={a.id}>
                        <strong>
                          {dateLabel(a.date)} · {a.time}
                        </strong>
                        <small>{a.procedure}</small>
                      </div>
                    ))
                  ) : (
                    <small>Sem agendamentos.</small>
                  )}
                </div>
              )}
            </div>
            <section className="card clinical-section clinical-facts">
              <span className="eyebrow">INFORMAÇÕES DO PACIENTE</span>
              <dl>
                <dt>Telefone</dt>
                <dd>{patient.phone || 'Não informado'}</dd>
                <dt>E-mail</dt>
                <dd>{patient.email || 'Não informado'}</dd>
                <dt>Responsável</dt>
                <dd>{patient.responsible || 'Não informado'}</dd>
                <dt>Paciente desde</dt>
                <dd>{dateLabel(patient.createdAt)}</dd>
              </dl>
            </section>
            {clinical && (
              <div className="clinical-brain-card">
                <BrainCircuit size={27} />
                <h3>Um cuidado que lembra.</h3>
                <p>
                  Planejamentos e evoluções conectados em uma memória clínica
                  consultável.
                </p>
                <button
                  className="clinical-link"
                  onClick={() => onAsk(patient.id)}
                >
                  Consultar este paciente <ArrowUpRight size={14} />
                </button>
              </div>
            )}
          </aside>
        </div>
      )}

      {tab === 'Anamnese' && clinical && (
        <section className="card clinical-section">
          <div className="clinical-section-heading">
            <div>
              <span className="eyebrow">FICHA DO PACIENTE</span>
              <h3>Dados e anamnese</h3>
              <p className="clinical-muted">
                Mantenha as informações atualizadas a cada atendimento.
              </p>
            </div>
            <HeartPulse size={23} />
          </div>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await act(
                'updatePatient',
                {
                  id: patient.id,
                  ...Object.fromEntries(
                    new FormData(e.currentTarget).entries(),
                  ),
                },
                false,
              );
            }}
          >
            <div className="clinical-form-grid">
              <Field label="Nome completo">
                <input
                  name="name"
                  defaultValue={patient.name}
                  required
                  maxLength={160}
                />
              </Field>
              <Field label="Data de nascimento">
                <input
                  name="birthDate"
                  type="date"
                  defaultValue={patient.birthDate}
                  max={localDate()}
                />
              </Field>
              <Field label="Telefone">
                <input
                  name="phone"
                  defaultValue={patient.phone}
                  maxLength={40}
                />
              </Field>
              <Field label="E-mail">
                <input name="email" type="email" defaultValue={patient.email} />
              </Field>
              <Field label="Responsável">
                <input name="responsible" defaultValue={patient.responsible} />
              </Field>
              <Field label="Dentista responsável">
                <select name="dentistId" defaultValue={patient.dentistId}>
                  {state.members
                    .filter(
                      (m) =>
                        m.status === 'active' &&
                        ['dentist', 'admin'].includes(m.role) &&
                        (session.user.role !== 'dentist' ||
                          m.id === session.user.id),
                    )
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                </select>
              </Field>
              <Field
                label="Alergias"
                hint="Inclua medicamentos, materiais e outras reações relevantes."
              >
                <textarea
                  name="allergies"
                  defaultValue={patient.allergies}
                  rows={3}
                />
              </Field>
              <Field label="Medicamentos em uso">
                <textarea
                  name="medications"
                  defaultValue={patient.medications}
                  rows={3}
                />
              </Field>
              <Field label="Condições de saúde">
                <textarea
                  name="conditions"
                  defaultValue={patient.conditions}
                  rows={3}
                />
              </Field>
              <Field label="Queixa principal">
                <textarea
                  name="complaint"
                  defaultValue={patient.complaint}
                  rows={3}
                />
              </Field>
              <Field label="Observações adicionais" full>
                <textarea name="notes" defaultValue={patient.notes} rows={4} />
              </Field>
            </div>
            <div className="clinical-form-footer">
              <span className="clinical-muted">
                As alterações ficam registradas no histórico de auditoria.
              </span>
              <Submit busy={busy}>Salvar ficha</Submit>
            </div>
          </form>
        </section>
      )}

      {tab === 'Odontograma' && clinical && (
        <div className="clinical-odontogram-layout">
          <section className="card clinical-section clinical-odontogram">
            <div className="clinical-section-heading">
              <div>
                <span className="eyebrow">MAPA DO SORRISO</span>
                <h3>Odontograma</h3>
              </div>
              <select
                aria-label="Tipo de dentição"
                value={dentition}
                onChange={(e) =>
                  setDentition(e.target.value as typeof dentition)
                }
              >
                <option value="permanent">Permanente</option>
                <option value="deciduous">Decídua</option>
                <option value="mixed">Mista</option>
              </select>
            </div>
            <p className="clinical-muted">
              Selecione um elemento para consultar o histórico ou registrar uma
              condição.
            </p>
            <div className="clinical-dental-scroll">
              {(dentition === 'mixed'
                ? [permanent, deciduous]
                : [dentition === 'permanent' ? permanent : deciduous]
              ).map((archset, group) => (
                <div className="clinical-arches" key={group}>
                  <div className="clinical-arch-guide">
                    <span>DIREITO</span>
                    <span>
                      {archset === permanent ? 'PERMANENTE' : 'DECÍDUA'}
                    </span>
                    <span>ESQUERDO</span>
                  </div>
                  {archset.map((row, ri) => (
                    <div
                      className={`clinical-arch-row ${ri === 1 ? 'clinical-bottom-arch' : ''}`}
                      key={ri}
                    >
                      {row.map((n) => {
                        const records = teeth
                          .filter((t) => t.tooth === n)
                          .sort((a, b) =>
                            b.createdAt.localeCompare(a.createdAt),
                          );
                        const latest = records[0];
                        const color = toothColor(
                          latest?.condition,
                          latest?.status,
                        );
                        return (
                          <button
                            key={n}
                            className={`clinical-tooth ${selectedTooth === n ? 'selected' : ''}`}
                            onClick={() => setSelectedTooth(n)}
                            aria-pressed={selectedTooth === n}
                            aria-label={`Dente ${n}${latest ? `, ${displayCondition(latest.condition)}` : ', sem registro'}`}
                          >
                            <span>{n}</span>
                            <ToothIcon
                              number={n}
                              color={color}
                              lower={ri === 1}
                            />
                            <i
                              className={`clinical-tooth-status clinical-status-${color}`}
                            />
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <div className="clinical-legend">
              {[
                ['healthy', 'Sem registro'],
                ['attention', 'Atenção'],
                ['treated', 'Condição registrada'],
                ['planned', 'Planejado'],
                ['completed', 'Realizado'],
                ['missing', 'Ausente'],
              ].map(([color, label]) => (
                <span key={color}>
                  <i className={`clinical-status-${color}`} />
                  {label}
                </span>
              ))}
            </div>
            <p className="clinical-footnote">
              O mapa representa o registro mais recente por elemento. Consulte
              abaixo as faces e todo o histórico; ausência de registro não
              confirma condição saudável.
            </p>
          </section>
          <aside className="card clinical-section clinical-selected-tooth">
            <span className="eyebrow">ELEMENTO SELECIONADO</span>
            <div className="clinical-selected-number">
              {selectedTooth}
              <Stethoscope size={26} />
            </div>
            <button
              className="button button-primary"
              onClick={() => open('tooth')}
            >
              <Plus size={15} /> Registrar condição
            </button>
            <h4>Histórico do elemento</h4>
            {teeth
              .filter((t) => t.tooth === selectedTooth)
              .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
              .map((t) => (
                <div className="clinical-tooth-history" key={t.id}>
                  <div>
                    <strong>{displayCondition(t.condition)}</strong>
                    <Badge tone={t.status === 'planned' ? 'lime' : 'neutral'}>
                      {t.surface}
                    </Badge>
                  </div>
                  <small>
                    {clinicalStatus[t.status]} · {dateLabel(t.createdAt)}
                  </small>
                  {t.notes && <p>{t.notes}</p>}
                  <small>{author(t.authorId)}</small>
                </div>
              ))}
            {!teeth.some((t) => t.tooth === selectedTooth) && (
              <p className="clinical-muted">
                Nenhuma condição registrada. A avaliação deve ser realizada pelo
                profissional.
              </p>
            )}
          </aside>
        </div>
      )}

      {tab === 'Planejamento' && clinical && (
        <section className="card clinical-section">
          <div className="clinical-section-heading">
            <div>
              <span className="eyebrow">CADA ETAPA DO CUIDADO</span>
              <h3>Plano de tratamento</h3>
            </div>
            <button
              className="button button-primary"
              onClick={() => open('treatment')}
            >
              <Plus size={15} /> Novo procedimento
            </button>
          </div>
          <div className="clinical-plan-toolbar">
            <div className="clinical-pill-switch">
              <button
                className={planFilter === 'all' ? 'active' : ''}
                onClick={() => setPlanFilter('all')}
              >
                Todos · {treatments.length}
              </button>
              <button
                className={planFilter === 'active' ? 'active' : ''}
                onClick={() => setPlanFilter('active')}
              >
                Em aberto · {activeTreatments.length}
              </button>
              <button
                className={planFilter === 'completed' ? 'active' : ''}
                onClick={() => setPlanFilter('completed')}
              >
                Concluídos
              </button>
            </div>
            {finance && (
              <span className="clinical-plan-value">
                Valor planejado{' '}
                <strong>
                  {brl(
                    treatments
                      .filter((t) => t.status !== 'cancelled')
                      .reduce((s, t) => s + t.amount, 0),
                  )}
                </strong>
              </span>
            )}
          </div>
          <div className="clinical-plan-list">
            {treatments
              .filter(
                (t) =>
                  planFilter === 'all' ||
                  (planFilter === 'active'
                    ? !['completed', 'cancelled'].includes(t.status)
                    : t.status === 'completed'),
              )
              .map((t) => (
                <article className="clinical-plan-item" key={t.id}>
                  <span className="clinical-tooth-number">
                    {t.tooth || '—'}
                  </span>
                  <div className="clinical-plan-info">
                    <div>
                      <h4>{t.procedure}</h4>
                      {t.priority === 'high' && (
                        <Badge tone="coral">Prioridade alta</Badge>
                      )}
                    </div>
                    <p>{t.notes || 'Sem observações adicionais.'}</p>
                    <small>
                      {author(t.dentistId)} · {dateLabel(t.createdAt)}
                    </small>
                  </div>
                  <div className="clinical-plan-end">
                    {finance && <strong>{brl(t.amount)}</strong>}
                    <select
                      value={t.status}
                      aria-label={`Status de ${t.procedure}`}
                      disabled={busy}
                      onChange={(e) =>
                        act(
                          'updateTreatment',
                          { id: t.id, status: e.target.value },
                          false,
                        )
                      }
                    >
                      {Object.entries(treatmentLabels).map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </div>
                </article>
              ))}
          </div>
          {!treatments.length && (
            <Empty
              title="Planeje o próximo sorriso"
              description="Adicione procedimentos, prioridades e valores. O plano é separado das cobranças financeiras."
              action={
                <button
                  className="button button-secondary"
                  onClick={() => open('treatment')}
                >
                  <Plus size={15} /> Adicionar procedimento
                </button>
              }
            />
          )}
          <p className="clinical-footnote">
            Aprovar um tratamento não gera cobrança automaticamente. Registre a
            conta na aba Financeiro.
          </p>
        </section>
      )}

      {tab === 'Evoluções' && clinical && (
        <section className="card clinical-section">
          <div className="clinical-section-heading">
            <div>
              <span className="eyebrow">MEMÓRIA DO ATENDIMENTO</span>
              <h3>Evoluções clínicas</h3>
            </div>
            <button
              className="button button-primary"
              onClick={() => open('evolution')}
            >
              <Plus size={15} /> Registrar evolução
            </button>
          </div>
          <div className="clinical-timeline">
            {evolutions.map((e) => (
              <article key={e.id} className="clinical-timeline-item">
                <i />
                <div className="clinical-timeline-date">
                  <span>{dateLabel(e.createdAt)}</span>
                  <small>
                    {new Date(e.createdAt).toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                      timeZone: 'America/Sao_Paulo',
                    })}
                  </small>
                </div>
                <div className="clinical-timeline-body">
                  <div className="clinical-meta">
                    <Avatar name={author(e.authorId)} small />
                    <strong>{author(e.authorId)}</strong>
                    <Badge>Registro clínico</Badge>
                  </div>
                  <p>{e.text}</p>
                  {e.returnDate && (
                    <Badge
                      tone={e.returnDate < localDate() ? 'coral' : 'neutral'}
                    >
                      <CalendarDays size={13} /> Retorno recomendado:{' '}
                      {dateLabel(e.returnDate)}
                    </Badge>
                  )}
                </div>
              </article>
            ))}
          </div>
          {!evolutions.length && (
            <Empty
              title="Histórico pronto para começar"
              description="Registre condutas, procedimentos, orientações e próximos passos de cada atendimento."
            />
          )}
          <p className="clinical-footnote">
            Evoluções são preservadas no histórico. Para corrigir uma
            informação, registre uma nova evolução explicando a retificação.
          </p>
        </section>
      )}

      {tab === 'Financeiro' && finance && (
        <div className="clinical-financial">
          <div className="clinical-metrics">
            <div>
              <span className="eyebrow">VALOR CONTRATADO</span>
              <strong className="clinical-money">{brl(total)}</strong>
              <small>{invoices.length} contas registradas</small>
            </div>
            <div>
              <span className="eyebrow">TOTAL RECEBIDO</span>
              <strong className="clinical-money">{brl(paid)}</strong>
              <small>{payments.length} pagamentos</small>
            </div>
            <div>
              <span className="eyebrow">A RECEBER</span>
              <strong className="clinical-money">{brl(total - paid)}</strong>
              <small>Saldo calculado pelos recebimentos</small>
            </div>
          </div>
          <section className="card clinical-section">
            <div className="clinical-section-heading">
              <div>
                <span className="eyebrow">CONTAS DO PACIENTE</span>
                <h3>Cobranças e recebimentos</h3>
              </div>
              <button
                className="button button-primary"
                onClick={() => open('invoice')}
              >
                <Plus size={15} /> Nova cobrança
              </button>
            </div>
            <div className="clinical-invoice-list">
              {invoices.map((i) => {
                const received = payments
                  .filter((p) => p.invoiceId === i.id)
                  .reduce((s, p) => s + p.amount, 0);
                const remaining = i.amount - received;
                return (
                  <article className="clinical-invoice" key={i.id}>
                    <span className="clinical-invoice-icon">
                      <Receipt size={21} />
                    </span>
                    <div className="clinical-invoice-info">
                      <strong>{i.description}</strong>
                      <small>Vencimento {dateLabel(i.dueDate)}</small>
                      <div className="clinical-payment-track">
                        <i
                          style={{
                            width: `${i.amount ? Math.min(100, (received / i.amount) * 100) : 0}%`,
                          }}
                        />
                      </div>
                      <small>
                        {brl(received)} recebido de {brl(i.amount)}
                      </small>
                    </div>
                    <div className="clinical-invoice-end">
                      <strong>{brl(remaining)}</strong>
                      <Badge
                        tone={
                          remaining === 0
                            ? 'lime'
                            : i.dueDate < localDate()
                              ? 'coral'
                              : 'neutral'
                        }
                      >
                        {remaining === 0
                          ? 'Quitado'
                          : i.dueDate < localDate()
                            ? 'Em atraso'
                            : 'Em aberto'}
                      </Badge>
                    </div>
                    {remaining > 0 && (
                      <button
                        className="button button-secondary"
                        onClick={() => open('payment', { invoice: i })}
                      >
                        Receber <ArrowUpRight size={14} />
                      </button>
                    )}
                  </article>
                );
              })}
            </div>
            {!invoices.length && (
              <Empty
                title="Nenhuma cobrança registrada"
                description="Crie cobranças e acompanhe pagamentos parciais, vencimentos e saldo pendente."
              />
            )}
          </section>
          <section className="card clinical-section">
            <div className="clinical-section-heading">
              <div>
                <span className="eyebrow">MOVIMENTAÇÕES</span>
                <h3>Histórico de pagamentos</h3>
              </div>
              <Wallet size={22} />
            </div>
            {payments.length ? (
              <div className="clinical-payments-table">
                {[...payments]
                  .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                  .map((p) => (
                    <div key={p.id}>
                      <div>
                        <strong>
                          {
                            invoices.find((i) => i.id === p.invoiceId)
                              ?.description
                          }
                        </strong>
                        <small>
                          {dateLabel(p.createdAt)} · {p.method}
                        </small>
                      </div>
                      <strong>{brl(p.amount)}</strong>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="clinical-muted">
                Os pagamentos aparecerão aqui após o primeiro recebimento.
              </p>
            )}
          </section>
        </div>
      )}

      {tab === 'Cérebro' && clinical && (
        <div className="clinical-knowledge">
          <div className="clinical-knowledge-banner">
            <div>
              <span className="eyebrow">CÉREBRO DO PACIENTE</span>
              <h2>O contexto acompanha o cuidado.</h2>
              <p>
                Notas e registros estruturados ficam disponíveis na consulta ao
                Cérebro. Exporte uma cópia Markdown para abrir no Obsidian.
              </p>
              <div>
                <button
                  className="button button-primary"
                  onClick={() => onAsk(patient.id)}
                >
                  <Sparkles size={15} /> Perguntar ao assistente
                </button>
                <a
                  className="button button-secondary"
                  href={`/api/vault?patientId=${encodeURIComponent(patient.id)}`}
                  download
                >
                  <Download size={15} /> Exportar vault
                </a>
              </div>
            </div>
            <BrainCircuit size={84} />
          </div>
          <section className="card clinical-section">
            <div className="clinical-section-heading">
              <div>
                <span className="eyebrow">NOTAS EM MARKDOWN</span>
                <h3>Memória clínica</h3>
              </div>
              <button
                className="button button-primary"
                onClick={() => open('note')}
              >
                <Plus size={15} /> Nova nota
              </button>
            </div>
            <div className="clinical-notes-grid">
              {notes.map((n) => (
                <button
                  key={n.id}
                  className="clinical-note-card"
                  onClick={() => open('note', { note: n })}
                >
                  <FileText size={22} />
                  <h4>{n.title}</h4>
                  <p>{n.content}</p>
                  <span>
                    {dateLabel(n.updatedAt)} <ArrowUpRight size={14} />
                  </span>
                </button>
              ))}
            </div>
            {!notes.length && (
              <Empty
                title="Conecte as informações importantes"
                description="Registre preferências, contexto do planejamento e observações em notas consultáveis."
              />
            )}
            <p className="clinical-footnote">
              A exportação gera uma cópia do vault no momento do download.
              Alterações feitas fora do sistema não são importadas
              automaticamente.
            </p>
          </section>
        </div>
      )}

      {dialog && (
        <Modal
          title={
            {
              tooth: `Registrar no elemento ${selectedTooth}`,
              treatment: 'Novo procedimento',
              evolution: 'Nova evolução clínica',
              invoice: 'Nova cobrança',
              payment: 'Registrar recebimento',
              note: dialog.note ? 'Editar nota clínica' : 'Nova nota clínica',
            }[dialog.type]
          }
          onClose={() => {
            if (!busy) setDialog(null);
          }}
          wide={dialog.type === 'note' || dialog.type === 'evolution'}
        >
          <form onSubmit={submit}>
            <div className="clinical-modal-body">
              {error && (
                <div className="clinical-error" role="alert">
                  {error}
                </div>
              )}
              {dialog.type === 'tooth' && (
                <div className="clinical-form-grid">
                  <Field label="Condição">
                    <select name="condition" required>
                      {Object.values(conditionNames).map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Face">
                    <select name="surface">
                      <option value="Geral">Dente completo</option>
                      <option value="V">Vestibular · V</option>
                      <option value="L">Lingual / palatina · L</option>
                      <option value="M">Mesial · M</option>
                      <option value="D">Distal · D</option>
                      <option value="O">Oclusal / incisal · O</option>
                    </select>
                  </Field>
                  <Field label="Tipo de registro" full>
                    <select name="status">
                      <option value="existing">Condição existente</option>
                      <option value="planned">Tratamento planejado</option>
                      <option value="completed">Procedimento realizado</option>
                    </select>
                  </Field>
                  <Field label="Observações" full>
                    <textarea
                      name="notes"
                      rows={4}
                      placeholder="Detalhes clínicos, materiais, extensão da condição…"
                      maxLength={5000}
                    />
                  </Field>
                </div>
              )}
              {dialog.type === 'treatment' && (
                <div className="clinical-form-grid">
                  <Field label="Procedimento" full>
                    <input
                      name="procedure"
                      placeholder="Ex.: Restauração em resina composta"
                      required
                      maxLength={200}
                    />
                  </Field>
                  <Field label="Elemento ou região">
                    <input
                      name="tooth"
                      placeholder="Ex.: 46 · Oclusal"
                      maxLength={80}
                    />
                  </Field>
                  {finance ? (
                    <Field label="Valor previsto (R$)">
                      <input
                        name="amount"
                        type="number"
                        step="0.01"
                        min="0"
                        defaultValue="0"
                        required
                      />
                    </Field>
                  ) : (
                    <input name="amount" type="hidden" value="0" />
                  )}
                  <Field label="Dentista">
                    <select name="dentistId" defaultValue={patient.dentistId}>
                      {state.members
                        .filter(
                          (m) =>
                            m.status === 'active' &&
                            ['admin', 'dentist'].includes(m.role) &&
                            (session.user.role !== 'dentist' ||
                              m.id === session.user.id),
                        )
                        .map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                    </select>
                  </Field>
                  <Field label="Prioridade">
                    <select name="priority">
                      <option value="normal">Normal</option>
                      <option value="high">Alta</option>
                    </select>
                  </Field>
                  <Field label="Status">
                    <select name="status">
                      {Object.entries(treatmentLabels).map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Observações" full>
                    <textarea
                      name="notes"
                      rows={3}
                      maxLength={5000}
                      placeholder="Etapas, dependências e orientações do procedimento."
                    />
                  </Field>
                </div>
              )}
              {dialog.type === 'evolution' && (
                <div className="clinical-form-grid">
                  <Field
                    label="Evolução do atendimento"
                    full
                    hint="Descreva o que foi realizado, observações e orientações ao paciente."
                  >
                    <textarea
                      name="text"
                      rows={8}
                      required
                      maxLength={20000}
                      placeholder="Procedimentos realizados, resposta do paciente e próximos passos…"
                    />
                  </Field>
                  <Field label="Retorno recomendado" full>
                    <input name="returnDate" type="date" />
                  </Field>
                  <div className="clinical-record-attribution">
                    <ClipboardList size={17} />
                    <span>
                      Registro assinado por <strong>{session.user.name}</strong>
                      . Data e hora são registradas automaticamente.
                    </span>
                  </div>
                </div>
              )}
              {dialog.type === 'invoice' && (
                <div className="clinical-form-grid">
                  <Field label="Descrição da cobrança" full>
                    <input
                      name="description"
                      required
                      placeholder="Ex.: Parcela 1/3 · Tratamento restaurador"
                      maxLength={200}
                    />
                  </Field>
                  <Field label="Valor (R$)">
                    <input
                      name="amount"
                      type="number"
                      min="0.01"
                      step="0.01"
                      required
                    />
                  </Field>
                  <Field label="Vencimento">
                    <input
                      name="dueDate"
                      type="date"
                      defaultValue={localDate()}
                      required
                    />
                  </Field>
                  <p className="clinical-footnote">
                    Para parcelar um orçamento, cadastre uma cobrança por
                    parcela, com seu valor e vencimento.
                  </p>
                </div>
              )}
              {dialog.type === 'payment' && dialog.invoice && (
                <>
                  <div className="clinical-payment-summary">
                    <span>{dialog.invoice.description}</span>
                    <strong>
                      Saldo:{' '}
                      {brl(
                        dialog.invoice.amount -
                          payments
                            .filter((p) => p.invoiceId === dialog.invoice!.id)
                            .reduce((s, p) => s + p.amount, 0),
                      )}
                    </strong>
                  </div>
                  <div className="clinical-form-grid">
                    <Field label="Valor recebido (R$)">
                      <input
                        name="amount"
                        type="number"
                        step="0.01"
                        min="0.01"
                        max={
                          (dialog.invoice.amount -
                            payments
                              .filter((p) => p.invoiceId === dialog.invoice!.id)
                              .reduce((s, p) => s + p.amount, 0)) /
                          100
                        }
                        defaultValue={(
                          (dialog.invoice.amount -
                            payments
                              .filter((p) => p.invoiceId === dialog.invoice!.id)
                              .reduce((s, p) => s + p.amount, 0)) /
                          100
                        ).toFixed(2)}
                        required
                      />
                    </Field>
                    <Field label="Forma de pagamento">
                      <select name="method">
                        <option>Pix</option>
                        <option>Dinheiro</option>
                        <option value="Cartão">Cartão</option>
                        <option>Transferência</option>
                        <option>Outro</option>
                      </select>
                    </Field>
                  </div>
                  <p className="clinical-footnote">
                    Confirme o recebimento antes de registrar. Pagamentos
                    parciais mantêm o restante em aberto.
                  </p>
                </>
              )}
              {dialog.type === 'note' && (
                <div className="clinical-form-grid">
                  <Field label="Título" full>
                    <input
                      name="title"
                      defaultValue={dialog.note?.title ?? ''}
                      required
                      maxLength={160}
                      placeholder="Ex.: Orientações e preferências do paciente"
                    />
                  </Field>
                  <Field
                    label="Conteúdo Markdown"
                    full
                    hint="Use títulos, listas e [[links internos]] compatíveis com o Obsidian."
                  >
                    <textarea
                      name="content"
                      defaultValue={dialog.note?.content ?? ''}
                      rows={12}
                      required
                      maxLength={30000}
                      className="clinical-markdown-editor"
                      placeholder="## Contexto do planejamento\n\n- Pontos importantes para o próximo atendimento…"
                    />
                  </Field>
                </div>
              )}
            </div>
            <footer className="clinical-modal-footer">
              <button
                className="button button-secondary"
                type="button"
                disabled={busy}
                onClick={() => setDialog(null)}
              >
                Cancelar
              </button>
              <Submit busy={busy}>
                {dialog.type === 'payment'
                  ? 'Confirmar recebimento'
                  : dialog.type === 'evolution'
                    ? 'Registrar evolução'
                    : 'Salvar registro'}
              </Submit>
            </footer>
          </form>
        </Modal>
      )}
    </section>
  );
}
