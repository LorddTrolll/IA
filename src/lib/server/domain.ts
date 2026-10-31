import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  localDate,
  type Action,
  type ClinicState,
  type Member,
} from '../types';

export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}
function fail(message: string, status = 400): never {
  throw new AppError(status, message);
}
const text = z.string().trim().max(12000);
const id = z.string().trim().min(1).max(120);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (s) =>
      s >= '1900-01-01' &&
      s <= '2200-12-31' &&
      !Number.isNaN(new Date(s + 'T12:00:00Z').valueOf()) &&
      new Date(s + 'T12:00:00Z').toISOString().slice(0, 10) === s,
    'Informe uma data válida entre 1900 e 2200',
  );
const optionalDate = z.union([date, z.literal('')]);
const money = z.number().int().positive().max(10000000000);
const colors = ['#dde8ca', '#e8dfd6', '#dae4e9', '#e4dbeb'];
const patientFields = {
  name: text.min(2).max(160),
  birthDate: optionalDate.default(''),
  phone: text.max(40).default(''),
  email: z.union([z.string().email().max(254), z.literal('')]).default(''),
  responsible: text.max(160).default(''),
  dentistId: id,
  allergies: text.default(''),
  medications: text.default(''),
  conditions: text.default(''),
  complaint: text.default(''),
  notes: text.default(''),
};
const appointmentFields = {
  patientId: id,
  dentistId: id,
  date,
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  duration: z.number().int().min(5).max(480),
  procedure: text.min(2).max(240),
  room: text.min(1).max(80),
};
const appointmentStatus = z.enum([
  'scheduled',
  'confirmed',
  'arrived',
  'in_progress',
  'completed',
  'cancelled',
  'missed',
]);
const treatmentStatus = z.enum([
  'proposed',
  'approved',
  'in_progress',
  'completed',
  'cancelled',
]);
const schemas: Record<string, z.ZodTypeAny> = {
  createPatient: z.object(patientFields),
  updatePatient: z.object({
    id,
    ...Object.fromEntries(
      Object.entries(patientFields).map(([k, v]) => [k, v.optional()]),
    ),
  }),
  createAppointment: z.object({
    ...appointmentFields,
    status: appointmentStatus.default('scheduled'),
  }),
  updateAppointment: z.object({
    id,
    ...Object.fromEntries(
      Object.entries(appointmentFields).map(([k, v]) => [k, v.optional()]),
    ),
    status: appointmentStatus.optional(),
  }),
  addTooth: z.object({
    patientId: id,
    tooth: z
      .number()
      .int()
      .refine((n) => {
        const q = Math.floor(n / 10),
          t = n % 10;
        return q >= 1 && q <= 8 && t >= 1 && t <= (q <= 4 ? 8 : 5);
      }, 'Elemento FDI inválido'),
    surface: text.max(20),
    condition: text.min(2).max(80),
    notes: text.default(''),
    status: z.enum(['existing', 'planned', 'completed']),
  }),
  addTreatment: z.object({
    patientId: id,
    tooth: text.max(80).default('Geral'),
    procedure: text.min(2).max(240),
    status: treatmentStatus.default('proposed'),
    priority: z.enum(['normal', 'high']).default('normal'),
    amount: z.number().int().min(0).max(10000000000).default(0),
    dentistId: id,
    notes: text.default(''),
  }),
  updateTreatment: z.object({ id, status: treatmentStatus }),
  addEvolution: z.object({
    patientId: id,
    text: text.min(3),
    returnDate: optionalDate.default(''),
  }),
  createInvoice: z.object({
    patientId: id,
    description: text.min(2).max(240),
    amount: money,
    dueDate: date,
  }),
  addPayment: z.object({
    invoiceId: id,
    amount: money,
    method: z.enum(['Pix', 'Dinheiro', 'Cartão', 'Transferência', 'Outro']),
    idempotencyKey: z.string().min(8).max(120),
  }),
  addExpense: z.object({
    description: text.min(2).max(240),
    category: text.min(1).max(80),
    amount: money,
    date,
    paid: z.boolean().default(false),
  }),
  saveNote: z.object({
    id: id.optional(),
    patientId: z.string().max(120).default(''),
    title: text.min(2).max(240),
    content: text.min(1).max(50000),
  }),
  updateMember: z.object({
    id,
    name: text.min(2).max(160).optional(),
    role: z.enum(['admin', 'dentist', 'reception']).optional(),
    status: z.enum(['active', 'pending', 'suspended']).optional(),
    finance: z.boolean().optional(),
  }),
};
const clinicalActions = new Set([
  'addTooth',
  'addTreatment',
  'updateTreatment',
  'addEvolution',
  'saveNote',
]);
const financeActions = new Set(['createInvoice', 'addPayment', 'addExpense']);
export const hasFinance = (user: Member) =>
  user.role === 'admin' || user.finance;
export const hasClinical = (user: Member) =>
  user.role === 'admin' || user.role === 'dentist';
export function ensureActive(user: Member) {
  if (user.status !== 'active')
    fail(
      user.status === 'pending'
        ? 'Seu acesso aguarda autorização do administrador.'
        : 'Seu acesso está suspenso.',
      403,
    );
}
export function visibleState(state: ClinicState, user: Member): ClinicState {
  ensureActive(user);
  const out = structuredClone(state);
  const ids = new Set(
    out.patients
      .filter((p) => user.role !== 'dentist' || p.dentistId === user.id)
      .map((p) => p.id),
  );
  out.patients = out.patients.filter((p) => ids.has(p.id));
  out.appointments = out.appointments.filter(
    (a) =>
      ids.has(a.patientId) &&
      (user.role !== 'dentist' || a.dentistId === user.id),
  );
  out.teeth = out.teeth.filter((t) => ids.has(t.patientId));
  out.treatments = out.treatments.filter((t) => ids.has(t.patientId));
  out.evolutions = out.evolutions.filter((t) => ids.has(t.patientId));
  out.notes = out.notes.filter((t) => !t.patientId || ids.has(t.patientId));
  out.invoices = out.invoices.filter((t) => ids.has(t.patientId));
  const invoices = new Set(out.invoices.map((t) => t.id));
  out.payments = out.payments.filter((t) => invoices.has(t.invoiceId));
  if (user.role !== 'admin') {
    out.audit = [];
    out.members = out.members
      .filter((m) => m.status === 'active' || m.id === user.id)
      .map((m) => ({
        ...m,
        email: m.id === user.id ? m.email : '',
        finance: m.id === user.id ? m.finance : false,
      }));
  }
  if (!hasFinance(user)) {
    out.invoices = [];
    out.payments = [];
    out.expenses = [];
    out.treatments = out.treatments.map((t) => ({ ...t, amount: 0 }));
  }
  if (user.role !== 'admin') out.expenses = [];
  if (!hasClinical(user)) {
    out.patients = out.patients.map((p) => ({
      ...p,
      allergies: '',
      medications: '',
      conditions: '',
      complaint: '',
      notes: '',
    }));
    out.teeth = [];
    out.treatments = [];
    out.evolutions = [];
    out.notes = [];
  }
  return out;
}
export function outstanding(state: ClinicState, invoiceId: string): number {
  const invoice = state.invoices.find((i) => i.id === invoiceId);
  if (!invoice) return 0;
  return (
    invoice.amount -
    state.payments
      .filter((p) => p.invoiceId === invoiceId)
      .reduce((s, p) => s + p.amount, 0)
  );
}
function patientAccess(s: ClinicState, u: Member, patientId: string) {
  const p = s.patients.find((p) => p.id === patientId);
  if (!p) fail('Paciente não encontrado.', 404);
  if (u.role === 'dentist' && p.dentistId !== u.id)
    fail('Você não tem acesso a este paciente.', 403);
  return p;
}
function dentistActive(s: ClinicState, u: Member, dentistId: string) {
  const d = s.members.find(
    (m) =>
      m.id === dentistId &&
      m.status === 'active' &&
      (m.role === 'dentist' || m.role === 'admin'),
  );
  if (!d) fail('Selecione um dentista autorizado.', 400);
  if (u.role === 'dentist' && dentistId !== u.id)
    fail('Você só pode atribuir atendimentos a si mesmo.', 403);
}
export function applyAction(
  original: ClinicState,
  user: Member,
  action: Action,
): ClinicState {
  ensureActive(user);
  if (!Object.hasOwn(schemas, action.type)) fail('Ação desconhecida.');
  const schema = schemas[action.type];
  if (clinicalActions.has(action.type) && !hasClinical(user))
    fail('Seu perfil não permite editar informações clínicas.', 403);
  if (financeActions.has(action.type) && !hasFinance(user))
    fail('Seu perfil não tem acesso financeiro.', 403);
  if (action.type === 'addExpense' && user.role !== 'admin')
    fail('Apenas administradores podem registrar despesas.', 403);
  if (action.type === 'updateMember' && user.role !== 'admin')
    fail('Apenas administradores podem autorizar usuários.', 403);
  const parsed = schema.safeParse(action.payload);
  if (!parsed.success)
    fail(
      parsed.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; '),
    );
  // Validation strips all fields that can only be generated by the server.
  const p = parsed.data as Record<string, any>;
  const s = structuredClone(original);
  const now = new Date().toISOString();
  const newId = randomUUID();
  let entityId: string = newId;
  const clinicalPatientFields = [
    'allergies',
    'medications',
    'conditions',
    'complaint',
    'notes',
  ];
  switch (action.type) {
    case 'createPatient':
    case 'updatePatient': {
      if (
        !hasClinical(user) &&
        clinicalPatientFields.some((k) =>
          action.type === 'updatePatient'
            ? Object.hasOwn(action.payload, k)
            : !!p[k],
        )
      )
        fail('Seu perfil não permite alterar a anamnese.', 403);
      if (p.birthDate && p.birthDate > localDate())
        fail('A data de nascimento não pode estar no futuro.');
      if (p.dentistId) dentistActive(s, user, p.dentistId);
      if (action.type === 'createPatient')
        s.patients.push({
          ...p,
          id: newId,
          color: colors[s.patients.length % colors.length],
          createdAt: now,
        } as any);
      else {
        const pat = patientAccess(s, user, p.id);
        entityId = p.id;
        Object.assign(pat, p);
      }
      break;
    }
    case 'createAppointment':
    case 'updateAppointment': {
      let previous: (typeof s.appointments)[number] | undefined;
      if (action.type === 'updateAppointment') {
        previous = s.appointments.find((a) => a.id === p.id);
        if (!previous) fail('Agendamento não encontrado.', 404);
        patientAccess(s, user, previous!.patientId);
        if (user.role === 'dentist' && previous!.dentistId !== user.id)
          fail('Agendamento de outro profissional.', 403);
      }
      const item = {
        ...(previous ?? {}),
        ...p,
        id: previous?.id ?? newId,
      } as (typeof s.appointments)[number];
      patientAccess(s, user, item.patientId);
      const assignmentChanged =
        !previous || item.dentistId !== previous.dentistId;
      const terminal = ['cancelled', 'missed', 'completed'].includes(
        item.status,
      );
      // Admin/reception must still be able to close an appointment after a
      // professional is suspended, without assigning new work to that account.
      if (assignmentChanged || !terminal)
        dentistActive(s, user, item.dentistId);
      if (!['cancelled', 'missed'].includes(item.status)) {
        const start =
          Number(item.time.slice(0, 2)) * 60 + Number(item.time.slice(3));
        const end = start + item.duration;
        if (end > 1440) fail('O atendimento deve terminar no mesmo dia.');
        const conflict = s.appointments.some(
          (a) =>
            a.id !== item.id &&
            a.date === item.date &&
            !['cancelled', 'missed'].includes(a.status) &&
            (a.dentistId === item.dentistId ||
              a.room.toLowerCase() === item.room.toLowerCase() ||
              a.patientId === item.patientId) &&
            (() => {
              const t =
                Number(a.time.slice(0, 2)) * 60 + Number(a.time.slice(3));
              return start < t + a.duration && end > t;
            })(),
        );
        if (conflict)
          fail(
            'Conflito de horário: paciente, dentista ou cadeira já possui um atendimento.',
            409,
          );
      }
      if (previous) Object.assign(previous, item);
      else s.appointments.push(item);
      entityId = item.id;
      break;
    }
    case 'addTooth':
      patientAccess(s, user, p.patientId);
      s.teeth.push({
        ...p,
        id: newId,
        authorId: user.id,
        createdAt: now,
      } as any);
      break;
    case 'addTreatment':
      patientAccess(s, user, p.patientId);
      dentistActive(s, user, p.dentistId);
      if (p.amount > 0 && !hasFinance(user))
        fail('Você não tem permissão para definir valores.', 403);
      s.treatments.push({ ...p, id: newId, createdAt: now } as any);
      break;
    case 'updateTreatment': {
      const t = s.treatments.find((t) => t.id === p.id);
      if (!t) fail('Tratamento não encontrado.', 404);
      patientAccess(s, user, t!.patientId);
      t!.status = p.status;
      entityId = p.id;
      break;
    }
    case 'addEvolution':
      patientAccess(s, user, p.patientId);
      s.evolutions.push({
        ...p,
        id: newId,
        authorId: user.id,
        createdAt: now,
      } as any);
      break;
    case 'createInvoice':
      patientAccess(s, user, p.patientId);
      s.invoices.push({ ...p, id: newId, createdAt: now } as any);
      break;
    case 'addPayment': {
      const invoice = s.invoices.find((i) => i.id === p.invoiceId);
      if (!invoice) fail('Cobrança não encontrada.', 404);
      patientAccess(s, user, invoice!.patientId);
      const existing = s.payments.find(
        (x) => x.idempotencyKey === p.idempotencyKey,
      );
      if (existing) {
        if (
          existing.invoiceId !== p.invoiceId ||
          existing.amount !== p.amount ||
          existing.method !== p.method
        )
          fail(
            'Identificador de pagamento já utilizado com outros dados.',
            409,
          );
        return s;
      }
      if (p.amount > outstanding(s, p.invoiceId))
        fail('O pagamento excede o saldo da cobrança.', 409);
      s.payments.push({
        ...p,
        id: newId,
        createdAt: now,
        authorId: user.id,
      } as any);
      break;
    }
    case 'addExpense':
      s.expenses.push({ ...p, id: newId } as any);
      break;
    case 'saveNote': {
      if (p.patientId) patientAccess(s, user, p.patientId);
      else if (user.role !== 'admin')
        fail('Apenas administradores podem editar protocolos gerais.', 403);
      const existing = p.id ? s.notes.find((n) => n.id === p.id) : undefined;
      if (p.id && !existing) fail('Nota não encontrada.', 404);
      if (existing) {
        if (existing.patientId) patientAccess(s, user, existing.patientId);
        else if (user.role !== 'admin')
          fail('Apenas administradores podem editar protocolos gerais.', 403);
        if (existing.patientId !== p.patientId)
          fail('Uma nota não pode ser movida para outro paciente.');
        Object.assign(existing, p, { updatedAt: now, authorId: user.id });
        entityId = existing.id;
      } else
        s.notes.push({
          ...p,
          id: newId,
          updatedAt: now,
          authorId: user.id,
        } as any);
      break;
    }
    case 'updateMember': {
      const member = s.members.find((m) => m.id === p.id);
      if (!member) fail('Usuário não encontrado.', 404);
      if (
        member!.id === user.id &&
        ((p.status && p.status !== 'active') || (p.role && p.role !== 'admin'))
      )
        fail('O administrador não pode remover o próprio acesso.');
      const next = { ...member!, ...p };
      if (
        member!.role === 'admin' &&
        member!.status === 'active' &&
        (next.role !== 'admin' || next.status !== 'active') &&
        s.members.filter((m) => m.role === 'admin' && m.status === 'active')
          .length <= 1
      )
        fail('A clínica deve manter ao menos um administrador ativo.');
      Object.assign(member!, p);
      entityId = p.id;
      break;
    }
  }
  s.audit.unshift({
    id: randomUUID(),
    action: action.type,
    authorId: user.id,
    createdAt: now,
    entityId,
  });
  return s;
}
