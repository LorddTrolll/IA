import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  AppError,
  outstanding,
  visibleState,
} from '../src/lib/server/domain';
import { createDemoState } from '../src/lib/server/seed';
const action = (type: string, payload: Record<string, unknown>) => ({
  type,
  payload,
});
function rejects(fn: () => unknown, status: number) {
  assert.throws(fn, (e) => e instanceof AppError && e.status === status);
}
test('partial payment uses integer cents, is idempotent and prevents overpayment', () => {
  const s = createDemoState(),
    admin = s.members[0];
  assert.equal(outstanding(s, 'invoice-1'), 50000);
  const a = action('addPayment', {
    invoiceId: 'invoice-1',
    amount: 12345,
    method: 'Pix',
    idempotencyKey: 'journey-payment-1',
  });
  const paid = applyAction(s, admin, a);
  assert.equal(outstanding(paid, 'invoice-1'), 37655);
  assert.equal(paid.payments.length, s.payments.length + 1);
  assert.equal(
    applyAction(paid, admin, a).payments.length,
    paid.payments.length,
  );
  rejects(
    () =>
      applyAction(
        paid,
        admin,
        action('addPayment', { ...a.payload, amount: 12346 }),
      ),
    409,
  );
  rejects(
    () =>
      applyAction(
        paid,
        admin,
        action('addPayment', {
          ...a.payload,
          amount: 40000,
          idempotencyKey: 'overpayment',
        }),
      ),
    409,
  );
  rejects(
    () =>
      applyAction(
        s,
        admin,
        action('addPayment', { ...a.payload, amount: 1.23 }),
      ),
    400,
  );
  assert.equal(s.payments.length, 3, 'original state is immutable');
});
test('dentist state isolates patients and hides finance without permission', () => {
  const s = createDemoState(),
    dentist = { ...s.members[1], finance: false };
  const visible = visibleState(s, dentist);
  assert(visible.patients.length > 0);
  assert(visible.patients.every((p) => p.dentistId === dentist.id));
  assert(
    visible.notes.every(
      (n) => !n.patientId || visible.patients.some((p) => p.id === n.patientId),
    ),
  );
  assert.deepEqual(visible.invoices, []);
  assert.deepEqual(visible.payments, []);
  assert.deepEqual(visible.expenses, []);
  assert(visible.treatments.every((t) => t.amount === 0));
  rejects(
    () =>
      applyAction(
        s,
        dentist,
        action('addEvolution', {
          patientId: 'patient-1',
          text: 'Forbidden evolution',
        }),
      ),
    403,
  );
  rejects(
    () =>
      applyAction(
        s,
        dentist,
        action('createInvoice', {
          patientId: 'patient-3',
          description: 'Exam',
          amount: 1000,
          dueDate: '2027-01-01',
        }),
      ),
    403,
  );
});
test('reception cannot read or mutate clinical records', () => {
  const s = createDemoState(),
    reception = s.members[3];
  const visible = visibleState(s, reception);
  assert.equal(visible.patients[0].allergies, '');
  assert.equal(visible.patients[0].complaint, '');
  assert.deepEqual(visible.notes, []);
  assert.deepEqual(visible.teeth, []);
  assert.deepEqual(visible.evolutions, []);
  rejects(
    () =>
      applyAction(
        s,
        reception,
        action('addEvolution', { patientId: 'patient-1', text: 'Forbidden' }),
      ),
    403,
  );
  rejects(
    () =>
      applyAction(
        s,
        reception,
        action('updatePatient', { id: 'patient-1', allergies: 'changed' }),
      ),
    403,
  );
  rejects(
    () =>
      applyAction(
        s,
        reception,
        action('updatePatient', { id: 'patient-1', allergies: '' }),
      ),
    403,
  );
});
test('pending and suspended accounts never read data; only admin approves access', () => {
  const s = createDemoState();
  rejects(() => visibleState(s, s.members[2]), 403);
  rejects(
    () =>
      applyAction(
        s,
        s.members[1],
        action('updateMember', {
          id: s.members[2].id,
          status: 'active',
          role: 'admin',
        }),
      ),
    403,
  );
  const approved = applyAction(
    s,
    s.members[0],
    action('updateMember', { id: s.members[2].id, status: 'active' }),
  );
  assert.equal(approved.members[2].status, 'active');
  rejects(
    () =>
      applyAction(
        s,
        s.members[0],
        action('updateMember', { id: s.members[0].id, status: 'suspended' }),
      ),
    400,
  );
});
test('scheduling detects dentist, chair and patient overlap, and permits adjacent appointments', () => {
  const s = createDemoState(),
    a = s.appointments[0];
  const payload = {
    patientId: 'patient-1',
    dentistId: 'admin-demo',
    date: a.date,
    time: '08:30',
    duration: 30,
    procedure: 'Avaliação',
    room: 'Cadeira 04',
  };
  rejects(
    () => applyAction(s, s.members[0], action('createAppointment', payload)),
    409,
  );
  const saved = applyAction(
    s,
    s.members[0],
    action('createAppointment', { ...payload, time: '17:00' }),
  );
  assert.equal(saved.appointments.length, s.appointments.length + 1);
  rejects(
    () =>
      applyAction(
        s,
        s.members[0],
        action('createAppointment', { ...payload, time: '25:00' }),
      ),
    400,
  );
  rejects(
    () =>
      applyAction(
        s,
        s.members[0],
        action('createAppointment', { ...payload, date: '2026-02-30' }),
      ),
    400,
  );
});
test('clinical journey preserves odontogram history, authorship, treatment and evolution', () => {
  let s = createDemoState();
  const admin = s.members[0];
  s = applyAction(
    s,
    admin,
    action('createPatient', {
      name: 'Paciente de Teste',
      dentistId: admin.id,
      allergies: 'Látex',
    }),
  );
  const p = s.patients.at(-1)!;
  s = applyAction(
    s,
    admin,
    action('addTooth', {
      patientId: p.id,
      tooth: 46,
      surface: 'O',
      condition: 'Cárie',
      status: 'planned',
      notes: 'Primeiro registro',
    }),
  );
  s = applyAction(
    s,
    admin,
    action('addTooth', {
      patientId: p.id,
      tooth: 46,
      surface: 'O',
      condition: 'Restauração',
      status: 'completed',
      notes: 'Segundo registro',
    }),
  );
  assert.equal(s.teeth.filter((t) => t.patientId === p.id).length, 2);
  assert.equal(s.teeth.at(-1)!.authorId, admin.id);
  rejects(
    () =>
      applyAction(
        s,
        admin,
        action('addTooth', {
          patientId: p.id,
          tooth: 89,
          surface: 'O',
          condition: 'Cárie',
          status: 'planned',
        }),
      ),
    400,
  );
  s = applyAction(
    s,
    admin,
    action('addTreatment', {
      patientId: p.id,
      tooth: '46',
      procedure: 'Restauração',
      dentistId: admin.id,
      amount: 30000,
    }),
  );
  s = applyAction(
    s,
    admin,
    action('updateTreatment', {
      id: s.treatments.at(-1)!.id,
      status: 'completed',
    }),
  );
  s = applyAction(
    s,
    admin,
    action('addEvolution', {
      patientId: p.id,
      text: 'Procedimento concluído. Retorno programado.',
      returnDate: '2027-01-01',
    }),
  );
  assert.equal(s.treatments.at(-1)!.status, 'completed');
  assert.equal(s.evolutions.at(-1)!.authorId, admin.id);
  assert(s.audit.length >= 6);
});

test('new patients accept omitted optional fields, but dates and inherited action names are rejected', () => {
  const s = createDemoState(),
    admin = s.members[0],
    reception = s.members[3];
  const created = applyAction(
    s,
    reception,
    action('createPatient', { name: 'Cadastro simples', dentistId: admin.id }),
  );
  const patient = created.patients.at(-1)!;
  assert.equal(patient.phone, '');
  assert.equal(patient.birthDate, '');
  assert.equal(patient.complaint, '');
  rejects(
    () =>
      applyAction(
        s,
        admin,
        action('createPatient', {
          name: 'Data futura',
          dentistId: admin.id,
          birthDate: '2200-01-01',
        }),
      ),
    400,
  );
  rejects(
    () =>
      applyAction(
        s,
        admin,
        action('createPatient', {
          name: 'Data inválida',
          dentistId: admin.id,
          birthDate: '1899-12-31',
        }),
      ),
    400,
  );
  for (const type of ['constructor', 'toString', '__proto__', 'unknown'])
    rejects(() => applyAction(s, admin, action(type, {})), 400);
  rejects(
    () =>
      applyAction(
        s,
        admin,
        action('updateAppointment', {
          id: s.appointments[0].id,
          status: 'unknown',
        }),
      ),
    400,
  );
});
test('suspended dentists receive no new appointments but existing appointments can be cancelled', () => {
  const s = createDemoState(),
    admin = s.members[0],
    appointment = s.appointments.find((a) => a.dentistId === 'dentist-1')!;
  const suspended = applyAction(
    s,
    admin,
    action('updateMember', { id: 'dentist-1', status: 'suspended' }),
  );
  const cancelled = applyAction(
    suspended,
    admin,
    action('updateAppointment', { id: appointment.id, status: 'cancelled' }),
  );
  assert.equal(
    cancelled.appointments.find((a) => a.id === appointment.id)!.status,
    'cancelled',
  );
  rejects(
    () =>
      applyAction(
        suspended,
        admin,
        action('createAppointment', {
          patientId: appointment.patientId,
          dentistId: 'dentist-1',
          date: appointment.date,
          time: '18:00',
          duration: 30,
          procedure: 'Retorno',
          room: 'Cadeira 03',
        }),
      ),
    400,
  );
  rejects(
    () =>
      applyAction(
        cancelled,
        admin,
        action('updateAppointment', {
          id: appointment.id,
          status: 'scheduled',
        }),
      ),
    400,
  );
});
test('a pending admin can be demoted while the sole active admin keeps access', () => {
  const s = createDemoState(),
    admin = s.members[0];
  s.members[2].role = 'admin';
  s.members[2].status = 'pending';
  const updated = applyAction(
    s,
    admin,
    action('updateMember', { id: s.members[2].id, role: 'dentist' }),
  );
  assert.equal(updated.members[2].role, 'dentist');
  rejects(
    () =>
      applyAction(
        s,
        admin,
        action('updateMember', { id: admin.id, role: 'reception' }),
      ),
    400,
  );
});
