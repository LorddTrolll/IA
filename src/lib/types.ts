export type Role = 'admin' | 'dentist' | 'reception';
export type Member = {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: 'active' | 'pending' | 'suspended';
  finance: boolean;
  color: string;
};
export type Patient = {
  id: string;
  name: string;
  birthDate: string;
  phone: string;
  email: string;
  responsible: string;
  dentistId: string;
  allergies: string;
  medications: string;
  conditions: string;
  complaint: string;
  notes: string;
  createdAt: string;
  color: string;
};
export type Appointment = {
  id: string;
  patientId: string;
  dentistId: string;
  date: string;
  time: string;
  duration: number;
  procedure: string;
  room: string;
  status:
    | 'scheduled'
    | 'confirmed'
    | 'arrived'
    | 'in_progress'
    | 'completed'
    | 'cancelled'
    | 'missed';
};
export type ToothRecord = {
  id: string;
  patientId: string;
  tooth: number;
  surface: string;
  condition: string;
  notes: string;
  status: 'existing' | 'planned' | 'completed';
  createdAt: string;
  authorId: string;
};
export type Treatment = {
  id: string;
  patientId: string;
  tooth: string;
  procedure: string;
  status: 'proposed' | 'approved' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'normal' | 'high';
  amount: number;
  dentistId: string;
  notes: string;
  createdAt: string;
};
export type Evolution = {
  id: string;
  patientId: string;
  text: string;
  authorId: string;
  createdAt: string;
  returnDate: string;
};
export type Invoice = {
  id: string;
  patientId: string;
  description: string;
  amount: number;
  dueDate: string;
  createdAt: string;
};
export type Payment = {
  id: string;
  invoiceId: string;
  amount: number;
  method: string;
  createdAt: string;
  authorId: string;
  idempotencyKey: string;
};
export type Expense = {
  id: string;
  description: string;
  category: string;
  amount: number;
  date: string;
  paid: boolean;
};
export type KnowledgeNote = {
  id: string;
  patientId: string;
  title: string;
  content: string;
  updatedAt: string;
  authorId: string;
};
export type Audit = {
  id: string;
  action: string;
  authorId: string;
  createdAt: string;
  entityId: string;
};
export type ClinicState = {
  patients: Patient[];
  appointments: Appointment[];
  teeth: ToothRecord[];
  treatments: Treatment[];
  evolutions: Evolution[];
  invoices: Invoice[];
  payments: Payment[];
  expenses: Expense[];
  notes: KnowledgeNote[];
  members: Member[];
  audit: Audit[];
};
export type SessionInfo = {
  mode: 'demo' | 'production';
  user: Member;
  grokConfigured: boolean;
  storage: string;
};
export type ClinicResponse = { state: ClinicState; session: SessionInfo };
export type Action = { type: string; payload: Record<string, unknown> };
export type AssistantSource = {
  id: string;
  title: string;
  excerpt: string;
  patientId: string;
};
export type AssistantReply = {
  answer: string;
  sources: AssistantSource[];
  provider: 'local' | 'grok';
};
export const brl = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    value / 100,
  );
export const localDate = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
export const patientInitials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
export const appointmentLabels: Record<Appointment['status'], string> = {
  scheduled: 'Agendado',
  confirmed: 'Confirmado',
  arrived: 'Na recepção',
  in_progress: 'Em atendimento',
  completed: 'Concluído',
  cancelled: 'Cancelado',
  missed: 'Faltou',
};
export const treatmentLabels: Record<Treatment['status'], string> = {
  proposed: 'Proposto',
  approved: 'Aprovado',
  in_progress: 'Em andamento',
  completed: 'Concluído',
  cancelled: 'Cancelado',
};
/** The latest evolution replaces the previous return recommendation. */
export function pendingReturns(
  state: Pick<ClinicState, 'evolutions'>,
  today = localDate(),
): Evolution[] {
  const latest = new Map<string, Evolution>();
  for (const evolution of state.evolutions) {
    const previous = latest.get(evolution.patientId);
    if (!previous || evolution.createdAt > previous.createdAt)
      latest.set(evolution.patientId, evolution);
  }
  return [...latest.values()]
    .filter((e) => e.returnDate && e.returnDate <= today)
    .sort((a, b) => a.returnDate.localeCompare(b.returnDate));
}
export function clinicDateOf(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}
