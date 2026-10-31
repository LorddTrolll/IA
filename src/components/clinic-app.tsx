'use client';
import { Tooth } from './tooth-icon';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  Bell,
  BrainCircuit,
  CalendarDays,
  Check,
  ChevronDown,
  CircleHelp,
  Download,
  Grid2X2,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { localDate, pendingReturns, type ClinicResponse } from '@/lib/types';
import { Avatar, Badge, Modal } from './ui';
import Dashboard from './dashboard';
import {
  AgendaPage,
  ClinicalPage,
  KnowledgePage,
  PatientsPage,
} from './workspace-pages';
import { AppointmentForm, PatientForm } from './forms';
import PatientDetail from './patient-detail';
import { AnalyticsPage, FinancePage, TeamPage } from './business';
import Assistant from './assistant';
import AuthScreen from './auth';
const nav = [
  { id: 'pulso', name: 'Pulso', icon: Grid2X2 },
  { id: 'agenda', name: 'Agenda', icon: CalendarDays },
  { id: 'pacientes', name: 'Pessoas', icon: Users },
  { id: 'clinica', name: 'Clínica', icon: Tooth },
  { id: 'cerebro', name: 'Cérebro', icon: BrainCircuit },
  { id: 'caixa', name: 'Caixa', icon: Wallet },
  { id: 'analises', name: 'Análises', icon: TrendingUp },
];
export default function ClinicApp() {
  const [data, setData] = useState<ClinicResponse | null>(null),
    [status, setStatus] = useState('loading'),
    [loadError, setLoadError] = useState(''),
    [page, setPage] = useState('pulso'),
    [patientId, setPatientId] = useState<string | null>(null),
    [modal, setModal] = useState<null | 'patient' | 'appointment' | 'help'>(
      null,
    ),
    [scheduleDate, setScheduleDate] = useState(''),
    [assistant, setAssistant] = useState<{
      patientId?: string;
      question?: string;
    } | null>(null),
    [search, setSearch] = useState(''),
    [searchOpen, setSearchOpen] = useState(false),
    [notifications, setNotifications] = useState(false),
    [toast, setToast] = useState(''),
    [mobile, setMobile] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const refresh = useCallback(async () => {
    setStatus('loading');
    try {
      const r = await fetch('/api/clinic', { cache: 'no-store' });
      const json = await r.json();
      if (!r.ok) {
        setLoadError(json.error || 'Não foi possível conectar.');
        setStatus(
          json.code === 'SETUP_REQUIRED'
            ? 'setup'
            : r.status === 401 || r.status === 403
              ? 'auth'
              : 'error',
        );
        return;
      }
      setData(json);
      setStatus('ready');
    } catch {
      setStatus('error');
      setLoadError(
        'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.',
      );
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === 'Escape') {
        setNotifications(false);
        setSearchOpen(false);
        setMobile(false);
        setAssistant(null);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 4200);
    return () => clearTimeout(t);
  }, [toast]);
  async function action(type: string, payload: Record<string, unknown>) {
    const r = await fetch('/api/clinic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, payload }),
    });
    const json = await r.json();
    if (!r.ok) {
      if (r.status === 401) setStatus('auth');
      throw new Error(json.error || 'Não foi possível salvar.');
    }
    setData(json);
    setToast(
      type === 'addPayment'
        ? 'Pagamento registrado. O saldo já está atualizado.'
        : 'Tudo certo. Informações salvas.',
    );
  }
  function navigate(next: string) {
    setPage(next);
    setPatientId(null);
    setMobile(false);
    setNotifications(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function openPatient(id: string) {
    setPatientId(id);
    setPage('pacientes');
    setSearchOpen(false);
    setSearch('');
    setAssistant(null);
    setNotifications(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function schedule(date?: string) {
    setScheduleDate(date || localDate());
    setModal('appointment');
  }
  if (status === 'loading' && !data)
    return (
      <div className="app-loading">
        <Tooth size={43} strokeWidth={1.4} />
        <strong>Lúmina</strong>
        <span>
          Conectando cuidado e informação<span className="loading-dots">…</span>
        </span>
      </div>
    );
  if (status === 'setup' || status === 'auth')
    return (
      <AuthScreen
        setup={status === 'setup'}
        errorMessage={loadError}
        onSuccess={() => void refresh()}
      />
    );
  if (!data)
    return (
      <div className="app-loading">
        <Tooth size={40} />
        <h2>Vamos tentar de novo?</h2>
        <p>{loadError}</p>
        <button
          className="button button-primary"
          onClick={() => void refresh()}
        >
          Reconectar <ArrowRight size={16} />
        </button>
      </div>
    );
  const { state, session } = data;
  const canFinance = session.user.role === 'admin' || session.user.finance;
  const clinical = session.user.role !== 'reception';
  const filteredNav = nav.filter(
    (n) =>
      (clinical || !['clinica', 'cerebro'].includes(n.id)) &&
      (canFinance || !['caixa', 'analises'].includes(n.id)),
  );
  const selectedPatient = state.patients.find((p) => p.id === patientId);
  const searched = search.trim()
    ? state.patients
        .filter((p) =>
          `${p.name} ${p.phone}`.toLowerCase().includes(search.toLowerCase()),
        )
        .slice(0, 5)
    : [];
  const today = localDate();
  const alerts = [
    ...pendingReturns(state, today).map((e) => ({
      id: e.id,
      patientId: e.patientId,
      title: `Retorno · ${state.patients.find((p) => p.id === e.patientId)?.name || 'Paciente'}`,
      description: `Previsto para ${e.returnDate.split('-').reverse().join('/')}`,
    })),
    ...(canFinance
      ? state.invoices
          .filter(
            (i) =>
              i.dueDate < today &&
              i.amount >
                state.payments
                  .filter((p) => p.invoiceId === i.id)
                  .reduce((s, p) => s + p.amount, 0),
          )
          .map((i) => ({
            id: i.id,
            patientId: i.patientId,
            title: `Pagamento pendente · ${state.patients.find((p) => p.id === i.patientId)?.name || 'Paciente'}`,
            description: i.description,
          }))
      : []),
  ];
  const props = { state, session, onAction: action, onPatient: openPatient };
  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobile ? 'sidebar-open' : ''}`}>
        <button
          className="brand"
          onClick={() => navigate('pulso')}
          aria-label="Lúmina início"
        >
          <Tooth size={30} strokeWidth={1.45} />
          <strong>
            Lúmina<span>CLÍNICA CONECTADA</span>
          </strong>
        </button>
        <nav aria-label="Navegação principal">
          {filteredNav.map((n) => (
            <button
              key={n.id}
              className={`nav-item ${page === n.id ? 'nav-active' : ''}`}
              onClick={() => navigate(n.id)}
              title={n.name}
            >
              <span>
                <n.icon size={21} strokeWidth={1.5} />
                {n.id === 'agenda' && <i className="nav-notice" />}
              </span>
              <span>{n.name}</span>
              {page === n.id && <span className="nav-active-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          {session.user.role === 'admin' && (
            <button
              className={`nav-item ${page === 'equipe' ? 'nav-active' : ''}`}
              onClick={() => navigate('equipe')}
              title="Equipe"
            >
              <ShieldCheck size={20} strokeWidth={1.5} />
              <span>Equipe</span>
            </button>
          )}
          <button
            className="nav-icon"
            onClick={() => setModal('help')}
            aria-label="Ajuda"
          >
            <CircleHelp size={20} strokeWidth={1.5} />
          </button>
          <button
            className={`nav-icon ${page === 'configuracoes' ? 'selected' : ''}`}
            onClick={() => navigate('configuracoes')}
            aria-label="Configurações"
          >
            <Settings2 size={20} strokeWidth={1.5} />
          </button>
          <button
            className="profile-button"
            onClick={() => navigate('configuracoes')}
            aria-label="Meu perfil"
          >
            <Avatar name={session.user.name} color="sage" small />
          </button>
        </div>
      </aside>
      {mobile && (
        <div className="mobile-overlay" onClick={() => setMobile(false)} />
      )}
      <div className="main-shell">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            onClick={() => setMobile(!mobile)}
            aria-label="Abrir menu"
          >
            <Menu size={22} />
          </button>
          <div className="clinic-location">
            <span className="eyebrow">CENTRO CLÍNICO</span>
            <strong>
              Lúmina Odontologia <ChevronDown size={12} />
            </strong>
          </div>
          <div className="global-search">
            <Search size={17} />
            <input
              ref={searchRef}
              placeholder="Buscar paciente ou prontuário"
              aria-label="Buscar paciente ou prontuário"
              value={search}
              onFocus={() => setSearchOpen(true)}
              onChange={(e) => {
                setSearch(e.target.value);
                setSearchOpen(true);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && searched[0])
                  openPatient(searched[0].id);
              }}
            />
            <kbd>⌘ K</kbd>
            {searchOpen && search && (
              <div className="search-results">
                <span className="eyebrow">PACIENTES ENCONTRADOS</span>
                {searched.length ? (
                  searched.map((p) => (
                    <button key={p.id} onClick={() => openPatient(p.id)}>
                      <Avatar name={p.name} color={p.color} small />
                      <div>
                        <strong>{p.name}</strong>
                        <small>{p.phone || 'Abrir prontuário'}</small>
                      </div>
                      <ArrowUpRight size={15} />
                    </button>
                  ))
                ) : (
                  <p>Nenhum paciente encontrado.</p>
                )}
              </div>
            )}
          </div>
          <div className="topbar-actions">
            <div className="notification-wrap">
              <button
                className={`notification-button ${alerts.length ? 'has-notifications' : ''}`}
                aria-label={`Notificações: ${alerts.length} pendências`}
                onClick={() => {
                  setNotifications(!notifications);
                  setSearchOpen(false);
                }}
              >
                <Bell size={19} strokeWidth={1.4} />
              </button>
              {notifications && (
                <div className="notifications-popover">
                  <div className="section-heading">
                    <h3>Um olhar atento</h3>
                    <Badge>{alerts.length}</Badge>
                  </div>
                  <p>Registros que merecem acompanhamento.</p>
                  {alerts.length ? (
                    alerts.slice(0, 6).map((a) => (
                      <button
                        key={a.id}
                        onClick={() => openPatient(a.patientId)}
                      >
                        <i />
                        <span>
                          <strong>{a.title}</strong>
                          <small>{a.description}</small>
                        </span>
                        <ArrowUpRight size={14} />
                      </button>
                    ))
                  ) : (
                    <div className="soft-note">
                      Tudo em dia. Sem pendências registradas.
                    </div>
                  )}
                </div>
              )}
            </div>
            <button
              className="button button-primary new-appointment"
              onClick={() => schedule()}
            >
              <Plus size={17} />
              <span>Novo atendimento</span>
            </button>
          </div>
        </header>
        <main className="main-content">
          {session.mode === 'demo' && (
            <div className="demo-banner">
              <span>
                <i /> AMBIENTE DE DEMONSTRAÇÃO
              </span>
              <span>
                Dados fictícios · alterações salvas nesta instância{' '}
                <button onClick={() => navigate('configuracoes')}>
                  Sobre o ambiente <ArrowUpRight size={12} />
                </button>
              </span>
            </div>
          )}
          {selectedPatient ? (
            <PatientDetail
              patient={selectedPatient}
              state={state}
              session={session}
              onAction={action}
              onBack={() => setPatientId(null)}
              onAsk={(id, q) => setAssistant({ patientId: id, question: q })}
            />
          ) : page === 'pulso' ? (
            <Dashboard
              {...props}
              onNavigate={navigate}
              onSchedule={() => schedule()}
              onAsk={(q) => setAssistant({ question: q })}
            />
          ) : page === 'agenda' ? (
            <AgendaPage {...props} onNew={schedule} />
          ) : page === 'pacientes' ? (
            <PatientsPage {...props} onNew={() => setModal('patient')} />
          ) : page === 'clinica' && clinical ? (
            <ClinicalPage {...props} />
          ) : page === 'cerebro' && clinical ? (
            <KnowledgePage
              {...props}
              onAsk={(q) => setAssistant({ question: q })}
            />
          ) : page === 'caixa' && canFinance ? (
            <FinancePage {...props} />
          ) : page === 'analises' && canFinance ? (
            <AnalyticsPage {...props} />
          ) : page === 'equipe' && session.user.role === 'admin' ? (
            <TeamPage {...props} />
          ) : (
            <>
              <div className="page-title-row">
                <div>
                  <span className="eyebrow">CADA DETALHE NO SEU LUGAR</span>
                  <h1>
                    Sua clínica conectada<span>.</span>
                  </h1>
                  <p className="page-subtitle">
                    Perfil, integrações e informações do ambiente.
                  </p>
                </div>
              </div>
              <div className="settings-grid">
                <section className="card padded">
                  <div className="section-heading">
                    <h2>Seu espaço de cuidado</h2>
                    <ShieldCheck size={20} />
                  </div>
                  <div className="settings-profile">
                    <Avatar name={session.user.name} />
                    <div>
                      <h3>{session.user.name}</h3>
                      <p>{session.user.email}</p>
                    </div>
                  </div>
                  <div className="settings-row">
                    <span>Perfil de acesso</span>
                    <Badge tone="green">
                      {session.user.role === 'admin'
                        ? 'Administrador'
                        : session.user.role === 'dentist'
                          ? 'Dentista'
                          : 'Recepção'}
                    </Badge>
                  </div>
                  <div className="settings-row">
                    <span>Gerenciamento financeiro</span>
                    <strong>{canFinance ? 'Autorizado' : 'Restrito'}</strong>
                  </div>
                  <div className="settings-row">
                    <span>Armazenamento</span>
                    <strong>{session.storage}</strong>
                  </div>
                  {session.mode === 'production' && (
                    <button
                      className="button button-secondary"
                      onClick={async () => {
                        await fetch('/api/auth', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ action: 'logout' }),
                        });
                        setData(null);
                        setStatus('auth');
                      }}
                    >
                      <LogOut size={15} />
                      Sair da conta
                    </button>
                  )}
                </section>
                <section className="card padded">
                  <div className="section-heading">
                    <h2>Integrações</h2>
                    <Sparkles size={20} />
                  </div>
                  <div className="integration-item">
                    <div className="integration-icon">
                      <BrainCircuit size={21} />
                    </div>
                    <div>
                      <strong>Grok · xAI</strong>
                      <p>
                        {session.grokConfigured
                          ? 'API e modelo configurados.'
                          : 'Busca local ativa. Configure a chave e o modelo no servidor.'}
                      </p>
                    </div>
                    <Badge tone={session.grokConfigured ? 'green' : 'neutral'}>
                      {session.grokConfigured
                        ? 'Configurado'
                        : 'Não configurado'}
                    </Badge>
                  </div>
                  <div className="integration-item">
                    <div className="integration-icon violet">
                      <FileIcon />
                    </div>
                    <div>
                      <strong>Obsidian</strong>
                      <p>
                        Vault Markdown exportável. Sem sincronização automática.
                      </p>
                    </div>
                    <Badge tone="green">Disponível</Badge>
                  </div>
                  <a className="button button-secondary" href="/api/vault">
                    <Download size={15} />
                    Exportar vault atual
                  </a>
                </section>
                <section className="card padded settings-info">
                  <span className="eyebrow">PUBLICAÇÃO ONLINE</span>
                  <h2>Uma base para crescer com você.</h2>
                  <p>
                    O modo de produção utiliza Supabase para dados persistentes
                    e autenticação. As chaves são configuradas exclusivamente no
                    servidor. O passo a passo de publicação no Render está no
                    README do projeto.
                  </p>
                  {session.mode === 'demo' && (
                    <div className="soft-note">
                      Esta demonstração usa SQLite local com pacientes
                      fictícios. No Render gratuito, use Supabase para preservar
                      os dados entre reinicializações.
                    </div>
                  )}
                </section>
              </div>
            </>
          )}
          <footer className="app-footer">
            <span>
              LÚMINA <i /> CUIDADO CONECTADO
            </span>
            <span>Mais presença. Mais cuidado.</span>
            <button onClick={() => setModal('help')}>
              Precisa de uma mão? <CircleHelp size={13} />
            </button>
          </footer>
        </main>
      </div>
      {clinical && (
        <button
          className="floating-assistant"
          onClick={() => setAssistant({ patientId: patientId || undefined })}
          aria-label="Abrir assistente Lúmina"
        >
          <Sparkles size={21} />
          <span>Um segundo olhar</span>
        </button>
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          {toast}
        </div>
      )}
      {modal === 'patient' && (
        <PatientForm
          state={state}
          session={session}
          onAction={action}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'appointment' && (
        <AppointmentForm
          state={state}
          session={session}
          onAction={action}
          onClose={() => setModal(null)}
          defaultDate={scheduleDate}
          defaultPatientId={patientId || ''}
        />
      )}
      {modal === 'help' && (
        <Modal
          title="Um novo olhar para sua rotina"
          onClose={() => setModal(null)}
        >
          <div className="modal-body help-body">
            <p>
              Comece cadastrando um paciente em <strong>Pessoas</strong>. No
              prontuário, registre a anamnese, o odontograma, os tratamentos e
              as evoluções.
            </p>
            <p>
              Organize horários em <strong>Agenda</strong> e acompanhe
              recebimentos e despesas em <strong>Caixa</strong>. O administrador
              autoriza novos profissionais em <strong>Equipe</strong>.
            </p>
            <p>
              O <strong>Cérebro</strong> reúne as notas e gera um vault para
              abrir no Obsidian. O assistente encontra registros locais;
              respostas do Grok precisam da API xAI configurada.
            </p>
            <div className="soft-note">
              Versão inicial: agenda diária, gestão clínica e financeira básica
              e exportação do vault. Anexos, sincronização bidirecional,
              estornos e comissões ficam para as próximas etapas.
            </div>
            <button
              className="button button-primary"
              onClick={() => setModal(null)}
            >
              Vamos começar <ArrowRight size={15} />
            </button>
          </div>
        </Modal>
      )}
      {assistant && (
        <Assistant
          key={`${assistant.patientId || 'all'}:${assistant.question || ''}`}
          state={state}
          session={session}
          patientId={assistant.patientId}
          initialQuestion={assistant.question}
          onClose={() => setAssistant(null)}
          onPatient={openPatient}
        />
      )}
    </div>
  );
}
function FileIcon() {
  return <span style={{ fontSize: 23, lineHeight: 1 }}>◇</span>;
}
