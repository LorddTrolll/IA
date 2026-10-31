import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildVault,
  financialReply,
  normalizeSearch,
  retrieveSources,
  selectPatients,
  reminderReply,
} from '../src/lib/knowledge';
import type { ClinicState, Patient } from '../src/lib/types';

const p = (id: string, name: string): Patient => ({
  id,
  name,
  birthDate: '1990-02-01',
  phone: '11999990000',
  email: '',
  responsible: '',
  dentistId: 'd1',
  allergies: 'Penicilina',
  medications: '',
  conditions: '',
  complaint: 'Dor no dente 46',
  notes: '',
  createdAt: '2026-10-30T12:00:00.000Z',
  color: 'green',
});
const empty = (): ClinicState => ({
  patients: [],
  appointments: [],
  teeth: [],
  treatments: [],
  evolutions: [],
  invoices: [],
  payments: [],
  expenses: [],
  notes: [],
  members: [],
  audit: [],
});
function example() {
  const s = empty();
  s.patients = [p('p1', 'Rafaél Móta'), p('p2', 'Ana Santos')];
  s.treatments = [
    {
      id: 't1',
      patientId: 'p1',
      tooth: '46',
      procedure: 'Implante unitário',
      status: 'approved',
      priority: 'high',
      amount: 150050,
      dentistId: 'd1',
      notes: 'Aguardar cicatrização',
      createdAt: '2026-10-30T12:00:00.000Z',
    },
  ];
  s.invoices = [
    {
      id: 'i1',
      patientId: 'p1',
      description: 'Implante',
      amount: 150050,
      dueDate: '2026-10-01',
      createdAt: '2026-10-01T12:00:00Z',
    },
    {
      id: 'i2',
      patientId: 'p1',
      description: 'Retorno',
      amount: 10000,
      dueDate: '2026-12-01',
      createdAt: '2026-10-01T12:00:00Z',
    },
    {
      id: 'i3',
      patientId: 'p2',
      description: 'Limpeza',
      amount: 15000,
      dueDate: '2026-10-01',
      createdAt: '2026-10-01T12:00:00Z',
    },
  ];
  s.payments = [
    {
      id: 'pay1',
      invoiceId: 'i1',
      amount: 100000,
      method: 'Pix',
      createdAt: '2026-10-01T12:00:00Z',
      authorId: 'd1',
      idempotencyKey: 'k1',
    },
  ];
  return s;
}

test('busca normaliza acentos e seleciona paciente pelo nome', () => {
  const s = example();
  assert.equal(normalizeSearch('DÉBITOS de Rafaél'), 'debitos de rafael');
  assert.deepEqual(
    selectPatients(s, 'O que ficou planejado para Rafael Mota?').map(
      (p) => p.id,
    ),
    ['p1'],
  );
  const found = retrieveSources(s, 'planejamento Rafael Mota dente 46');
  assert.ok(found.some((x) => x.id === 't1'));
  assert.ok(found.every((x) => x.patientId === 'p1'));
});

test('nomes curtos não correspondem a fragmentos de palavras', () => {
  const s = empty();
  s.patients = [p('p1', 'Ana')];
  assert.deepEqual(selectPatients(s, 'consulte a anamnese'), []);
});

test('financeiro calcula centavos, pagamentos parciais e parcelas futuras sem LLM', () => {
  const r = financialReply(
    example(),
    'Quanto Rafael Mota deve?',
    undefined,
    '2026-10-31',
  );
  assert.equal(r?.provider, 'local');
  assert.match(r!.answer, /600,50/);
  assert.match(r!.answer, /500,50/);
  assert.equal(r?.sources.length, 2);
  assert.ok(r?.sources.every((x) => x.patientId === 'p1'));
});

test('consulta financeira geral inclui apenas pacientes recebidos no contexto autorizado', () => {
  const s = example();
  s.patients = s.patients.filter((p) => p.id === 'p1');
  const r = financialReply(
    s,
    'Quais pacientes estão com débitos?',
    undefined,
    '2026-10-31',
  );
  assert.doesNotMatch(r!.answer, /Ana/);
  assert.equal(r!.sources.length, 2);
});

test('pergunta financeira sem paciente pede seleção em vez de presumir escopo', () => {
  const r = financialReply(
    example(),
    'Qual é o saldo?',
    undefined,
    '2026-10-31',
  );
  assert.match(r!.answer, /Selecione um paciente/);
  assert.equal(r!.sources.length, 0);
});

test('vault exporta notas vinculadas e preserva YAML sem aceitar nomes como caminhos', () => {
  const s = example();
  s.patients[0].id = '../p1';
  s.patients[0].name = 'Paciente "X"\nadmin: true';
  const files = buildVault(s, {
    patientId: '../p1',
    clinical: true,
    finance: false,
    now: '2026-10-31T12:00:00Z',
  });
  assert.ok(files.every((f) => !f.path.includes('..')));
  assert.ok(files.some((f) => f.path.endsWith('/Anamnese.md')));
  assert.ok(files.every((f) => !f.path.endsWith('/Financeiro.md')));
  const summary = files.find((f) => f.path.endsWith('/Resumo.md'))!;
  assert.ok(
    summary.content.includes('patient_name: "Paciente \\"X\\"\\nadmin: true"'),
  );
});

test('recepção exporta somente cadastro e financeiro autorizado, sem dados clínicos', () => {
  const files = buildVault(example(), { clinical: false, finance: true });
  assert.ok(files.some((f) => f.path.endsWith('/Financeiro.md')));
  assert.ok(
    files.every(
      (f) => !f.path.endsWith('/Anamnese.md') && !f.path.includes('Evolucoes'),
    ),
  );
  assert.ok(files.every((f) => !f.content.includes('Penicilina')));
});

test('busca retorna fontes limitadas e não fabrica resposta quando não há registro', () => {
  const s = example();
  assert.deepEqual(retrieveSources(s, 'ortodontia lingual criança'), []);
  for (let i = 0; i < 30; i++)
    s.notes.push({
      id: `n${i}`,
      patientId: 'p1',
      title: 'Planejamento',
      content: 'Acompanhar implante 46',
      updatedAt: '2026-10-31',
      authorId: 'd1',
    });
  assert.equal(retrieveSources(s, 'implante', 'p1').length, 8);
});

test('retornos atrasados usam a última evolução e a data de referência', () => {
  const s = example();
  s.evolutions = [
    {
      id: 'e1',
      patientId: 'p1',
      text: 'Reavaliar implante',
      authorId: 'd1',
      createdAt: '2026-10-01',
      returnDate: '2026-10-20',
    },
    {
      id: 'e2',
      patientId: 'p2',
      text: 'Profilaxia',
      authorId: 'd1',
      createdAt: '2026-10-01',
      returnDate: '2026-10-10',
    },
    {
      id: 'e3',
      patientId: 'p2',
      text: 'Retorno realizado',
      authorId: 'd1',
      createdAt: '2026-10-15',
      returnDate: '2026-12-15',
    },
  ];
  const reply = reminderReply(
    s,
    'Quais pacientes têm retornos atrasados?',
    undefined,
    '2026-10-31',
  );
  assert.equal(reply?.sources.length, 1);
  assert.equal(reply?.sources[0].patientId, 'p1');
  assert.match(reply!.answer, /20\/10\/2026/);
});
