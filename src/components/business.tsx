'use client';

import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import {
  ArrowDownLeft,
  ArrowDownToLine,
  ArrowUpRight,
  Check,
  ChevronDown,
  CreditCard,
  FileText,
  Landmark,
  Plus,
  Search,
  ShieldCheck,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import {
  brl,
  localDate,
  type ClinicState,
  type Invoice,
  type Member,
  type SessionInfo,
} from '@/lib/types';
import {
  Avatar,
  Badge,
  dateLabel,
  Empty,
  Field,
  Modal,
  moneyInput,
  Submit,
} from './ui';
import './business.css';

export type BusinessProps = {
  state: ClinicState;
  session: SessionInfo;
  onAction: (type: string, payload: Record<string, unknown>) => Promise<void>;
  onPatient: (id: string) => void;
};
const roleNames = {
  admin: 'Administrador',
  dentist: 'Dentista',
  reception: 'Recepção',
};
const memberStatuses = {
  active: 'Ativo',
  pending: 'Aguardando aprovação',
  suspended: 'Suspenso',
};
const errorMessage = (e: unknown) =>
  e instanceof Error ? e.message : 'Não foi possível salvar. Tente novamente.';
const paymentsFor = (state: ClinicState, id: string) =>
  state.payments
    .filter((p) => p.invoiceId === id)
    .reduce((n, p) => n + p.amount, 0);
const timestampDate = (value: string) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value));
const hasFinance = (session: SessionInfo) =>
  session.user.role === 'admin' || session.user.finance;
function saveCSV(filename: string, rows: (string | number)[][]) {
  const escape = (v: string | number) => {
    let text = String(v);
    if (/^[\s]*[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  const data =
    '\ufeff' + rows.map((row) => row.map(escape).join(';')).join('\r\n');
  const url = URL.createObjectURL(
    new Blob([data], { type: 'text/csv;charset=utf-8;' }),
  );
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
function Stat({
  label,
  value,
  sub,
  icon,
  accent = false,
}: {
  label: string;
  value: string;
  sub: string;
  icon: ReactNode;
  accent?: boolean;
}) {
  return (
    <article className={`card biz-stat ${accent ? 'biz-stat-accent' : ''}`}>
      <div className="biz-stat-top">
        <span className="eyebrow">{label}</span>
        {icon}
      </div>
      <strong>{value}</strong>
      <span className="biz-stat-sub">{sub}</span>
    </article>
  );
}
function ErrorText({ error }: { error: string }) {
  return error ? (
    <p role="alert" className="biz-form-error">
      {error}
    </p>
  ) : null;
}

export function FinancePage({
  state,
  session,
  onAction,
  onPatient,
}: BusinessProps) {
  const [tab, setTab] = useState<'invoices' | 'expenses'>('invoices');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [modal, setModal] = useState<'invoice' | 'expense' | Invoice | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [paymentKey, setPaymentKey] = useState('');
  const today = localDate();
  const admin = session.user.role === 'admin';
  const received = state.payments.reduce((sum, p) => sum + p.amount, 0);
  const expenses = state.expenses
    .filter((e) => e.paid)
    .reduce((sum, e) => sum + e.amount, 0);
  const outstanding = state.invoices.reduce(
    (sum, i) => sum + Math.max(0, i.amount - paymentsFor(state, i.id)),
    0,
  );
  const overdue = state.invoices
    .filter((i) => i.dueDate < today)
    .reduce(
      (sum, i) => sum + Math.max(0, i.amount - paymentsFor(state, i.id)),
      0,
    );
  const invoices = state.invoices
    .filter((i) => {
      const patient = state.patients.find((p) => p.id === i.patientId);
      const paid = paymentsFor(state, i.id);
      const matches = `${patient?.name ?? ''} ${i.description}`
        .toLocaleLowerCase('pt-BR')
        .includes(search.toLocaleLowerCase('pt-BR'));
      return (
        matches &&
        (filter === 'all' ||
          (filter === 'open' && paid < i.amount) ||
          (filter === 'paid' && paid >= i.amount) ||
          (filter === 'overdue' && paid < i.amount && i.dueDate < today))
      );
    })
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const filteredExpenses = state.expenses
    .filter((e) =>
      `${e.description} ${e.category}`
        .toLocaleLowerCase('pt-BR')
        .includes(search.toLocaleLowerCase('pt-BR')),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  const openModal = (value: typeof modal) => {
    setError('');
    setPaymentKey(crypto.randomUUID());
    setModal(value);
  };
  const closeModal = () => {
    if (!busy) setModal(null);
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || !modal) return;
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    try {
      if (modal === 'invoice')
        await onAction('createInvoice', {
          patientId: String(data.get('patientId')),
          description: String(data.get('description')).trim(),
          amount: moneyInput(data.get('amount')),
          dueDate: String(data.get('dueDate')),
        });
      else if (modal === 'expense')
        await onAction('addExpense', {
          description: String(data.get('description')).trim(),
          category: String(data.get('category')),
          amount: moneyInput(data.get('amount')),
          date: String(data.get('date')),
          paid: data.get('paid') === 'on',
        });
      else
        await onAction('addPayment', {
          invoiceId: modal.id,
          amount: moneyInput(data.get('amount')),
          method: String(data.get('method')),
          idempotencyKey: String(data.get('idempotencyKey')),
        });
      setModal(null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const download = () => {
    if (tab === 'invoices')
      saveCSV(`dentim-recebimentos-${today}.csv`, [
        [
          'Paciente',
          'Descrição',
          'Vencimento',
          'Valor (BRL)',
          'Recebido (BRL)',
          'Saldo (BRL)',
        ],
        ...invoices.map((i) => [
          state.patients.find((p) => p.id === i.patientId)?.name ?? 'Paciente',
          i.description,
          i.dueDate,
          (i.amount / 100).toFixed(2).replace('.', ','),
          (paymentsFor(state, i.id) / 100).toFixed(2).replace('.', ','),
          (Math.max(0, i.amount - paymentsFor(state, i.id)) / 100)
            .toFixed(2)
            .replace('.', ','),
        ]),
      ]);
    else
      saveCSV(`dentim-despesas-${today}.csv`, [
        ['Descrição', 'Categoria', 'Data', 'Valor (BRL)', 'Status'],
        ...filteredExpenses.map((e) => [
          e.description,
          e.category,
          e.date,
          (e.amount / 100).toFixed(2).replace('.', ','),
          e.paid ? 'Pago' : 'Pendente',
        ]),
      ]);
  };
  if (!hasFinance(session))
    return (
      <Empty
        title="Acesso financeiro restrito"
        description="O administrador pode autorizar o acesso ao caixa nas permissões da sua conta."
      />
    );
  return (
    <div className="biz-page">
      <div className="biz-page-heading">
        <div>
          <span className="eyebrow">GESTÃO FINANCEIRA</span>
          <h1 className="page-title">
            Clareza em cada número<span>.</span>
          </h1>
          <p className="biz-muted">
            Seu caixa, seus recebimentos e os próximos passos.
          </p>
        </div>
        <button
          className="button button-primary"
          onClick={() => openModal(tab === 'invoices' ? 'invoice' : 'expense')}
        >
          <Plus size={17} />
          {tab === 'invoices' ? 'Nova cobrança' : 'Nova despesa'}
        </button>
      </div>
      <div className="biz-stats-grid">
        <Stat
          label="RECEBIDO"
          value={brl(received)}
          sub="Total de pagamentos registrados"
          icon={<ArrowDownLeft size={18} />}
          accent
        />
        <Stat
          label="A RECEBER"
          value={brl(outstanding)}
          sub="Saldo das cobranças em aberto"
          icon={<Wallet size={18} />}
        />
        <Stat
          label="EM ATRASO"
          value={brl(overdue)}
          sub="Valores com vencimento anterior a hoje"
          icon={<CreditCard size={18} />}
        />
        <Stat
          label={admin ? 'SALDO REGISTRADO' : 'PAGAMENTOS'}
          value={
            admin ? brl(received - expenses) : String(state.payments.length)
          }
          sub={
            admin
              ? 'Recebimentos menos despesas pagas'
              : 'Recebimentos disponíveis para seu perfil'
          }
          icon={<TrendingUp size={18} />}
        />
      </div>
      <section className="card biz-ledger">
        <div className="biz-ledger-header">
          <div className="tabs" aria-label="Tipo de movimentação">
            <button
              onClick={() => {
                setTab('invoices');
                setSearch('');
              }}
              className={tab === 'invoices' ? 'active' : ''}
            >
              Recebimentos <span>{state.invoices.length}</span>
            </button>
            {admin && (
              <button
                onClick={() => {
                  setTab('expenses');
                  setSearch('');
                }}
                className={tab === 'expenses' ? 'active' : ''}
              >
                Despesas <span>{state.expenses.length}</span>
              </button>
            )}
          </div>
          <button
            className="button button-secondary biz-export"
            onClick={download}
          >
            <ArrowDownToLine size={15} /> Exportar CSV
          </button>
        </div>
        <div className="biz-filters">
          <div className="biz-search">
            <Search size={17} />
            <input
              aria-label={
                tab === 'invoices'
                  ? 'Buscar paciente ou cobrança'
                  : 'Buscar despesa'
              }
              placeholder={
                tab === 'invoices'
                  ? 'Buscar paciente ou cobrança...'
                  : 'Buscar descrição ou categoria...'
              }
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {tab === 'invoices' && (
            <label className="biz-select">
              <span className="biz-sr-only">Filtrar cobranças</span>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="all">Todas as cobranças</option>
                <option value="open">Em aberto</option>
                <option value="overdue">Em atraso</option>
                <option value="paid">Quitadas</option>
              </select>
              <ChevronDown size={15} />
            </label>
          )}
        </div>
        {tab === 'invoices' ? (
          invoices.length ? (
            <div className="table-wrap">
              <table className="data-table biz-table">
                <thead>
                  <tr>
                    <th>Paciente / procedimento</th>
                    <th>Vencimento</th>
                    <th>Valor</th>
                    <th>Recebido</th>
                    <th>Situação</th>
                    <th>
                      <span className="biz-sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((i) => {
                    const p = state.patients.find((p) => p.id === i.patientId);
                    const paid = paymentsFor(state, i.id);
                    const remaining = Math.max(0, i.amount - paid);
                    const late = i.dueDate < today && remaining > 0;
                    return (
                      <tr key={i.id}>
                        <td>
                          <div className="biz-person">
                            <Avatar
                              name={p?.name ?? 'Paciente'}
                              color={p?.color}
                              small
                            />
                            <div>
                              <button
                                className="biz-link"
                                onClick={() => onPatient(i.patientId)}
                              >
                                {p?.name ?? 'Paciente'}
                              </button>
                              <small>{i.description}</small>
                            </div>
                          </div>
                        </td>
                        <td className={late ? 'biz-overdue' : ''}>
                          {dateLabel(i.dueDate)}
                        </td>
                        <td className="biz-money">{brl(i.amount)}</td>
                        <td className="biz-money">
                          {brl(paid)}
                          {remaining > 0 && paid > 0 && (
                            <small className="biz-balance">
                              Restam {brl(remaining)}
                            </small>
                          )}
                        </td>
                        <td>
                          <Badge
                            tone={
                              remaining === 0
                                ? 'green'
                                : late
                                  ? 'coral'
                                  : 'neutral'
                            }
                            dot
                          >
                            {remaining === 0
                              ? 'Quitado'
                              : late
                                ? 'Em atraso'
                                : paid > 0
                                  ? 'Parcial'
                                  : 'Em aberto'}
                          </Badge>
                        </td>
                        <td>
                          {remaining > 0 ? (
                            <button
                              className="biz-row-action"
                              onClick={() => openModal(i)}
                            >
                              Receber <ArrowUpRight size={15} />
                            </button>
                          ) : (
                            <span className="biz-check">
                              <Check size={17} aria-label="Cobrança quitada" />
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty
              title="Nenhuma cobrança encontrada"
              description={
                search || filter !== 'all'
                  ? 'Ajuste os filtros para encontrar outros registros.'
                  : 'Crie uma cobrança para acompanhar os recebimentos da clínica.'
              }
              action={
                !search && filter === 'all' ? (
                  <button
                    className="button button-primary"
                    onClick={() => openModal('invoice')}
                  >
                    Criar cobrança
                  </button>
                ) : undefined
              }
            />
          )
        ) : filteredExpenses.length ? (
          <div className="table-wrap">
            <table className="data-table biz-table">
              <thead>
                <tr>
                  <th>Descrição</th>
                  <th>Categoria</th>
                  <th>Data</th>
                  <th>Valor</th>
                  <th>Situação</th>
                </tr>
              </thead>
              <tbody>
                {filteredExpenses.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <div className="biz-person">
                        <span className="biz-expense-icon">
                          <Landmark size={18} />
                        </span>
                        <strong>{e.description}</strong>
                      </div>
                    </td>
                    <td>{e.category}</td>
                    <td>{dateLabel(e.date)}</td>
                    <td className="biz-money">{brl(e.amount)}</td>
                    <td>
                      <Badge tone={e.paid ? 'green' : 'neutral'} dot>
                        {e.paid ? 'Pago' : 'Pendente'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="Nenhuma despesa encontrada"
            description="Registre despesas para acompanhar o saldo da clínica."
            action={
              <button
                className="button button-primary"
                onClick={() => openModal('expense')}
              >
                Registrar despesa
              </button>
            }
          />
        )}
        <footer className="biz-ledger-footer">
          <span>
            {tab === 'invoices' ? invoices.length : filteredExpenses.length}{' '}
            registros exibidos
          </span>
          <span>Valores em reais · BRL</span>
        </footer>
      </section>
      {modal && (
        <Modal
          title={
            modal === 'invoice'
              ? 'Nova cobrança'
              : modal === 'expense'
                ? 'Registrar despesa'
                : 'Registrar recebimento'
          }
          onClose={closeModal}
        >
          <form onSubmit={submit}>
            <div className="modal-body">
              <div className="form-grid">
                {modal === 'invoice' ? (
                  <>
                    <Field label="Paciente" full>
                      <select name="patientId" required defaultValue="">
                        <option value="" disabled>
                          Selecione um paciente
                        </option>
                        {state.patients.map((p) => (
                          <option value={p.id} key={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Descrição" full>
                      <input
                        name="description"
                        required
                        maxLength={240}
                        placeholder="Ex.: Restauração · elemento 36"
                      />
                    </Field>
                    <Field label="Valor (R$)">
                      <input
                        name="amount"
                        type="number"
                        step="0.01"
                        min="0.01"
                        max="1000000"
                        required
                        placeholder="0,00"
                      />
                    </Field>
                    <Field label="Vencimento">
                      <input
                        name="dueDate"
                        type="date"
                        defaultValue={today}
                        required
                      />
                    </Field>
                  </>
                ) : modal === 'expense' ? (
                  <>
                    <Field label="Descrição" full>
                      <input
                        name="description"
                        required
                        maxLength={240}
                        placeholder="Ex.: Materiais odontológicos"
                      />
                    </Field>
                    <Field label="Categoria">
                      <select name="category">
                        <option>Materiais</option>
                        <option>Estrutura</option>
                        <option>Equipe</option>
                        <option>Laboratório</option>
                        <option>Serviços</option>
                        <option>Outros</option>
                      </select>
                    </Field>
                    <Field label="Data">
                      <input
                        name="date"
                        type="date"
                        defaultValue={today}
                        required
                      />
                    </Field>
                    <Field label="Valor (R$)">
                      <input
                        name="amount"
                        type="number"
                        min="0.01"
                        max="1000000"
                        step="0.01"
                        placeholder="0,00"
                        required
                      />
                    </Field>
                    <label className="biz-checkbox">
                      <input name="paid" type="checkbox" defaultChecked />
                      <span>Despesa já paga</span>
                    </label>
                  </>
                ) : (
                  <>
                    <div className="biz-payment-summary">
                      <span className="eyebrow">
                        {
                          state.patients.find((p) => p.id === modal.patientId)
                            ?.name
                        }
                      </span>
                      <h3>{modal.description}</h3>
                      <div>
                        <span>Saldo pendente</span>
                        <strong>
                          {brl(
                            Math.max(
                              0,
                              modal.amount - paymentsFor(state, modal.id),
                            ),
                          )}
                        </strong>
                      </div>
                    </div>
                    <Field
                      label="Valor recebido (R$)"
                      hint="É possível registrar pagamentos parciais."
                    >
                      <input
                        name="amount"
                        type="number"
                        min="0.01"
                        step="0.01"
                        max={(
                          (modal.amount - paymentsFor(state, modal.id)) /
                          100
                        ).toFixed(2)}
                        defaultValue={(
                          (modal.amount - paymentsFor(state, modal.id)) /
                          100
                        ).toFixed(2)}
                        required
                      />
                    </Field>
                    <Field label="Forma de pagamento">
                      <select name="method">
                        <option>Pix</option>
                        <option>Dinheiro</option>
                        <option>Cartão</option>
                        <option>Transferência</option>
                        <option>Outro</option>
                      </select>
                    </Field>
                    <input
                      type="hidden"
                      name="idempotencyKey"
                      value={paymentKey}
                    />
                  </>
                )}
              </div>
              <ErrorText error={error} />
            </div>
            <div className="form-actions">
              <button
                type="button"
                className="button button-secondary"
                onClick={closeModal}
                disabled={busy}
              >
                Cancelar
              </button>
              <Submit busy={busy}>
                {modal === 'invoice'
                  ? 'Criar cobrança'
                  : modal === 'expense'
                    ? 'Salvar despesa'
                    : 'Confirmar recebimento'}
              </Submit>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

export function TeamPage({ state, session, onAction }: BusinessProps) {
  const [member, setMember] = useState<Member | null>(null);
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (session.user.role !== 'admin')
    return (
      <Empty
        title="Administração da equipe"
        description="Apenas administradores podem aprovar contas e alterar as permissões da equipe."
      />
    );
  const pending = state.members.filter((m) => m.status === 'pending').length;
  const members = state.members.filter(
    (m) => filter === 'all' || m.status === filter,
  );
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || !member) return;
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    try {
      await onAction('updateMember', {
        id: member.id,
        role: String(data.get('role')),
        status: String(data.get('status')),
        finance: data.get('finance') === 'on',
      });
      setMember(null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="biz-page">
      <div className="biz-page-heading">
        <div>
          <span className="eyebrow">PESSOAS QUE CUIDAM</span>
          <h1 className="page-title">
            Uma equipe conectada<span>.</span>
          </h1>
          <p className="biz-muted">
            Aprove acessos e defina a autonomia de cada profissional.
          </p>
        </div>
        <Badge tone="green">
          <ShieldCheck size={14} /> Administração
        </Badge>
      </div>
      {pending > 0 && (
        <div className="biz-pending-banner">
          <div>
            <span className="biz-pending-dot" />
            <strong>
              {pending} {pending === 1 ? 'conta aguarda' : 'contas aguardam'}{' '}
              sua aprovação
            </strong>
            <p>Revise o perfil e as permissões antes de liberar o acesso.</p>
          </div>
          <button
            className="button button-secondary"
            onClick={() => setFilter('pending')}
          >
            Revisar contas <ArrowUpRight size={16} />
          </button>
        </div>
      )}
      <section className="card biz-ledger">
        <div className="biz-ledger-header">
          <div className="tabs" aria-label="Filtrar equipe">
            {[
              ['all', 'Todos'],
              ['active', 'Ativos'],
              ['pending', 'Pendentes'],
              ['suspended', 'Suspensos'],
            ].map(([value, label]) => (
              <button
                key={value}
                className={filter === value ? 'active' : ''}
                onClick={() => setFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <span className="biz-muted biz-count">
            {state.members.length} profissionais
          </span>
        </div>
        {members.length ? (
          <div className="table-wrap">
            <table className="data-table biz-table">
              <thead>
                <tr>
                  <th>Profissional</th>
                  <th>Perfil</th>
                  <th>Financeiro</th>
                  <th>Status</th>
                  <th>
                    <span className="biz-sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <div className="biz-person">
                        <Avatar name={m.name} color={m.color} />
                        <div>
                          <strong>
                            {m.name}
                            {m.id === session.user.id ? (
                              <span className="biz-you">Você</span>
                            ) : null}
                          </strong>
                          <small>{m.email}</small>
                        </div>
                      </div>
                    </td>
                    <td>{roleNames[m.role]}</td>
                    <td>
                      <span
                        className={
                          m.finance || m.role === 'admin'
                            ? 'biz-permission-yes'
                            : 'biz-muted'
                        }
                      >
                        {m.role === 'admin'
                          ? 'Acesso completo'
                          : m.finance
                            ? 'Autorizado'
                            : 'Sem acesso'}
                      </span>
                    </td>
                    <td>
                      <Badge
                        tone={
                          m.status === 'active'
                            ? 'green'
                            : m.status === 'pending'
                              ? 'coral'
                              : 'neutral'
                        }
                        dot
                      >
                        {memberStatuses[m.status]}
                      </Badge>
                    </td>
                    <td>
                      <button
                        className="biz-row-action"
                        onClick={() => {
                          setError('');
                          setMember(m);
                        }}
                      >
                        {m.status === 'pending' ? 'Revisar' : 'Gerenciar'}{' '}
                        <ArrowUpRight size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="Nenhuma conta nesta situação"
            description="Contas criadas pela tela de cadastro aparecerão aqui para aprovação."
          />
        )}
        <footer className="biz-ledger-footer">
          <ShieldCheck size={14} />
          <span>
            Novos cadastros precisam de aprovação para acessar a clínica.
          </span>
        </footer>
      </section>
      <div className="biz-team-note">
        <Users size={22} />
        <div>
          <h3>Autonomia com responsabilidade</h3>
          <p>
            Dentistas acessam os pacientes vinculados a eles. Permissões
            financeiras são concedidas separadamente. A recepção organiza a
            agenda sem acesso ao conteúdo clínico.
          </p>
        </div>
      </div>
      {member && (
        <Modal
          title="Gerenciar profissional"
          onClose={() => {
            if (!busy) setMember(null);
          }}
        >
          <form onSubmit={submit}>
            <div className="modal-body">
              <div className="biz-member-summary">
                <Avatar name={member.name} color={member.color} />
                <div>
                  <strong>{member.name}</strong>
                  <small>{member.email}</small>
                </div>
              </div>
              <div className="form-grid">
                <Field label="Perfil de acesso">
                  <select name="role" defaultValue={member.role}>
                    <option value="dentist">Dentista</option>
                    <option value="reception">Recepção</option>
                    <option value="admin">Administrador</option>
                  </select>
                </Field>
                <Field label="Situação da conta">
                  <select name="status" defaultValue={member.status}>
                    <option value="pending">Aguardando aprovação</option>
                    <option value="active">Ativo — acesso autorizado</option>
                    <option value="suspended">
                      Suspenso — acesso bloqueado
                    </option>
                  </select>
                </Field>
                <label className="biz-checkbox biz-permission-check">
                  <input
                    type="checkbox"
                    name="finance"
                    defaultChecked={member.finance}
                  />
                  <span>
                    <strong>Autorizar acesso financeiro</strong>
                    <small>
                      Permite consultar cobranças e registrar movimentações.
                    </small>
                  </span>
                </label>
              </div>
              {member.id === session.user.id && (
                <p className="biz-form-hint">
                  A aplicação protege o último administrador ativo para manter o
                  acesso à gestão.
                </p>
              )}
              <ErrorText error={error} />
            </div>
            <div className="form-actions">
              <button
                type="button"
                className="button button-secondary"
                disabled={busy}
                onClick={() => setMember(null)}
              >
                Cancelar
              </button>
              <Submit busy={busy}>Salvar permissões</Submit>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

export function AnalyticsPage({ state, session, onPatient }: BusinessProps) {
  const [period, setPeriod] = useState<'month' | 'all'>('month');
  const today = localDate();
  const month = today.slice(0, 7);
  const appointments = state.appointments.filter(
    (a) => period === 'all' || a.date.startsWith(month),
  );
  const completed = appointments.filter((a) => a.status === 'completed');
  const missed = appointments.filter((a) => a.status === 'missed');
  const scheduled = appointments.filter(
    (a) => !['completed', 'missed', 'cancelled'].includes(a.status),
  );
  const completion = appointments.length
    ? Math.round((completed.length / appointments.length) * 100)
    : 0;
  const paid = state.payments.filter(
    (p) => period === 'all' || timestampDate(p.createdAt).startsWith(month),
  );
  const paidTotal = paid.reduce((n, p) => n + p.amount, 0);
  const expenseTotal = state.expenses
    .filter((e) => e.paid && (period === 'all' || e.date.startsWith(month)))
    .reduce((n, e) => n + e.amount, 0);
  const finance = hasFinance(session);
  const admin = session.user.role === 'admin';
  const monthly = useMemo(() => {
    const [year, m] = today.split('-').map(Number);
    return Array.from({ length: 6 }, (_, index) => {
      const date = new Date(Date.UTC(year, m - 6 + index, 1));
      const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
      return {
        label: new Intl.DateTimeFormat('pt-BR', {
          month: 'short',
          timeZone: 'UTC',
        })
          .format(date)
          .replace('.', ''),
        received: state.payments
          .filter((p) => timestampDate(p.createdAt).startsWith(key))
          .reduce((n, p) => n + p.amount, 0),
        spent: state.expenses
          .filter((e) => e.paid && e.date.startsWith(key))
          .reduce((n, e) => n + e.amount, 0),
      };
    });
  }, [state.payments, state.expenses, today]);
  const chartMax = Math.max(
    ...monthly.map((m) => Math.max(m.received, admin ? m.spent : 0)),
    100,
  );
  const statusItems = [
    { label: 'Concluídos', value: completed.length, color: 'lime' },
    {
      label: 'Programados / em atendimento',
      value: scheduled.length,
      color: 'sage',
    },
    { label: 'Faltas', value: missed.length, color: 'coral' },
    {
      label: 'Cancelados',
      value: appointments.filter((a) => a.status === 'cancelled').length,
      color: 'gray',
    },
  ];
  const activeDentists = state.members.filter(
    (m) => m.role === 'dentist' && m.status === 'active',
  );
  const pendingPatients = state.patients
    .map((p) => ({
      ...p,
      count: state.treatments.filter(
        (t) =>
          t.patientId === p.id &&
          !['completed', 'cancelled'].includes(t.status),
      ).length,
    }))
    .filter((p) => p.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  return (
    <div className="biz-page">
      <div className="biz-page-heading">
        <div>
          <span className="eyebrow">DADOS QUE ORIENTAM</span>
          <h1 className="page-title">
            Um olhar mais amplo<span>.</span>
          </h1>
          <p className="biz-muted">
            Indicadores calculados a partir dos registros da sua clínica.
          </p>
        </div>
        <label className="biz-select">
          <span className="biz-sr-only">Período dos indicadores</span>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as typeof period)}
          >
            <option value="month">Este mês</option>
            <option value="all">Todo o período</option>
          </select>
          <ChevronDown size={15} />
        </label>
      </div>
      <div className="biz-stats-grid">
        <Stat
          label="ATENDIMENTOS"
          value={String(appointments.length).padStart(2, '0')}
          sub={
            period === 'month'
              ? 'Agendamentos deste mês'
              : 'Todos os agendamentos'
          }
          icon={<Users size={18} />}
          accent
        />
        <Stat
          label="CONCLUSÃO"
          value={`${completion}%`}
          sub={`${completed.length} atendimentos concluídos`}
          icon={<Check size={18} />}
        />
        <Stat
          label="TEMPO CLÍNICO"
          value={`${(completed.reduce((n, a) => n + a.duration, 0) / 60).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h`}
          sub="Duração prevista dos atendimentos concluídos"
          icon={<FileText size={18} />}
        />
        <Stat
          label={
            finance
              ? admin
                ? 'RESULTADO DE CAIXA'
                : 'RECEBIDO NO PERÍODO'
              : 'PACIENTES'
          }
          value={
            finance
              ? brl(paidTotal - (admin ? expenseTotal : 0))
              : String(state.patients.length)
          }
          sub={
            finance
              ? admin
                ? 'Recebido menos despesas pagas no período'
                : 'Recebimentos disponíveis para seu perfil'
              : 'Pacientes disponíveis para seu perfil'
          }
          icon={<TrendingUp size={18} />}
        />
      </div>
      <div className="biz-analysis-grid">
        {finance && (
          <section className="card biz-chart-card">
            <div className="biz-chart-heading">
              <div>
                <span className="eyebrow">ÚLTIMOS 6 MESES</span>
                <h2>Movimento do caixa</h2>
              </div>
              <span className="biz-chart-unit">BRL</span>
            </div>
            <div className="biz-chart-legend">
              <span>
                <i className="biz-dot-lime" />
                Recebido
              </span>
              {admin && (
                <span>
                  <i className="biz-dot-forest" />
                  Despesas pagas
                </span>
              )}
            </div>
            <div
              className="biz-chart"
              role="img"
              aria-label={`Movimento dos últimos seis meses. ${monthly.map((m) => `${m.label}: ${brl(m.received)} recebidos${admin ? ` e ${brl(m.spent)} em despesas pagas` : ''}`).join('. ')}`}
            >
              <div className="biz-chart-grid">
                <span>{brl(chartMax)}</span>
                <span>{brl(Math.round(chartMax / 2))}</span>
                <span>R$ 0</span>
              </div>
              <div className="biz-chart-columns">
                {monthly.map((m) => (
                  <div className="biz-chart-month" key={m.label}>
                    <div className="biz-chart-pair">
                      <div
                        className="biz-bar biz-bar-received"
                        style={{ height: `${(m.received / chartMax) * 100}%` }}
                        title={`${m.label}: ${brl(m.received)} recebidos`}
                      />
                      {admin && (
                        <div
                          className="biz-bar biz-bar-spent"
                          style={{ height: `${(m.spent / chartMax) * 100}%` }}
                          title={`${m.label}: ${brl(m.spent)} em despesas`}
                        />
                      )}
                    </div>
                    <span>{m.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
        <section className="card biz-chart-card">
          <div className="biz-chart-heading">
            <div>
              <span className="eyebrow">FLUXO DE ATENDIMENTOS</span>
              <h2>Cada etapa, em perspectiva</h2>
            </div>
          </div>
          <div className="biz-status-summary">
            <strong>{String(appointments.length).padStart(2, '0')}</strong>
            <span>
              agendamentos
              <br />
              no período selecionado
            </span>
          </div>
          <div className="biz-status-track">
            {statusItems
              .filter((i) => i.value > 0)
              .map((i) => (
                <span
                  className={`biz-status-${i.color}`}
                  key={i.label}
                  style={{
                    width: `${(i.value / Math.max(appointments.length, 1)) * 100}%`,
                  }}
                  title={`${i.label}: ${i.value}`}
                />
              ))}
          </div>
          <div className="biz-status-list">
            {statusItems.map((i) => (
              <div key={i.label}>
                <span>
                  <i className={`biz-status-${i.color}`} />
                  {i.label}
                </span>
                <strong>{i.value}</strong>
              </div>
            ))}
          </div>
        </section>
        <section className="card biz-chart-card">
          <div className="biz-chart-heading">
            <div>
              <span className="eyebrow">EQUIPE CLÍNICA</span>
              <h2>Atendimentos por dentista</h2>
            </div>
          </div>
          {activeDentists.length ? (
            <div className="biz-dentists">
              {activeDentists.map((m) => {
                const count = completed.filter(
                  (a) => a.dentistId === m.id,
                ).length;
                return (
                  <div className="biz-dentist" key={m.id}>
                    <div className="biz-person">
                      <Avatar name={m.name} color={m.color} small />
                      <span>{m.name}</span>
                      <strong>{count}</strong>
                    </div>
                    <div className="biz-dentist-track">
                      <span
                        style={{
                          width: `${(count / Math.max(completed.length, 1)) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
              <p className="biz-form-hint">
                Somente atendimentos concluídos no período selecionado.
              </p>
            </div>
          ) : (
            <Empty
              title="Sem profissionais ativos"
              description="Aprove os dentistas para acompanhar os indicadores da equipe."
            />
          )}
        </section>
        <section className="card biz-chart-card">
          <div className="biz-chart-heading">
            <div>
              <span className="eyebrow">CONTINUIDADE DO CUIDADO</span>
              <h2>Planos em acompanhamento</h2>
            </div>
          </div>
          {pendingPatients.length ? (
            <div className="biz-followups">
              {pendingPatients.map((p) => (
                <button key={p.id} onClick={() => onPatient(p.id)}>
                  <Avatar name={p.name} color={p.color} small />
                  <div>
                    <strong>{p.name}</strong>
                    <small>
                      {p.count}{' '}
                      {p.count === 1
                        ? 'procedimento pendente'
                        : 'procedimentos pendentes'}
                    </small>
                  </div>
                  <ArrowUpRight size={17} />
                </button>
              ))}
            </div>
          ) : (
            <Empty
              title="Nenhum planejamento pendente"
              description="Os próximos tratamentos em acompanhamento aparecerão aqui."
            />
          )}
        </section>
      </div>
    </div>
  );
}
