import { ClinicState, localDate } from '../types';
export const emptyState = (): ClinicState => ({
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
export function createDemoState(): ClinicState {
  const date = localDate();
  const at = `${date}T11:00:00.000Z`;
  const past = new Date(`${date}T12:00:00Z`);
  past.setUTCDate(past.getUTCDate() - 7);
  const due = past.toISOString().slice(0, 10);
  const future = new Date(`${date}T12:00:00Z`);
  future.setUTCDate(future.getUTCDate() + 14);
  const state = emptyState();
  state.members = [
    {
      id: 'admin-demo',
      name: 'Dra. Helena Costa',
      email: 'helena@lumina.exemplo',
      role: 'admin',
      status: 'active',
      finance: true,
      color: '#d5e7cf',
    },
    {
      id: 'dentist-1',
      name: 'Dr. Lucas Almeida',
      email: 'lucas@lumina.exemplo',
      role: 'dentist',
      status: 'active',
      finance: true,
      color: '#e9dfc9',
    },
    {
      id: 'dentist-2',
      name: 'Dra. Beatriz Lima',
      email: 'beatriz@lumina.exemplo',
      role: 'dentist',
      status: 'pending',
      finance: false,
      color: '#dddeed',
    },
    {
      id: 'reception-1',
      name: 'Marina Santos',
      email: 'marina@lumina.exemplo',
      role: 'reception',
      status: 'active',
      finance: true,
      color: '#d9e7e4',
    },
  ];
  const people = [
    ['Rafael Mota', '1988-05-12', 'Implante unitário · Elemento 46', '#dde8ca'],
    ['Mariana Oliveira', '1994-09-21', 'Revisão de alinhadores', '#e8dfd6'],
    ['João Pedro Silva', '1976-02-09', 'Restauração · Elemento 24', '#dae4e9'],
    ['Ana Clara Ribeiro', '2000-11-04', 'Avaliação e profilaxia', '#e4dbeb'],
    ['Carlos Eduardo Lima', '1982-06-15', 'Tratamento endodôntico', '#e7e2cc'],
    ['Sofia Mendes', '2014-03-08', 'Avaliação odontopediátrica', '#d9e7df'],
    ['Fernanda Rocha', '1991-07-19', 'Manutenção periodontal', '#e8dcd3'],
    ['Pedro Henrique Alves', '1986-12-02', 'Avaliação inicial', '#dbe3ea'],
  ];
  state.patients = people.map(([name, birthDate, complaint, color], i) => ({
    id: `patient-${i + 1}`,
    name,
    birthDate,
    phone: `(11) 99900-000${i + 1}`,
    email: '',
    responsible: i === 5 ? 'Carolina Mendes' : '',
    dentistId: i % 3 === 2 ? 'dentist-1' : 'admin-demo',
    allergies:
      i === 0 ? 'Alergia à penicilina' : i === 2 ? 'Látex' : 'Não relatadas',
    medications: i === 0 ? 'Losartana 50 mg, uso diário' : 'Não relatados',
    conditions: i === 0 ? 'Hipertensão controlada' : 'Não relatadas',
    complaint,
    notes: 'Cadastro fictício para demonstração.',
    createdAt: at,
    color,
  }));
  state.appointments = people.map((p, i) => ({
    id: `appointment-${i + 1}`,
    patientId: `patient-${i + 1}`,
    dentistId: state.patients[i].dentistId,
    date,
    time: [
      '08:00',
      '08:45',
      '09:30',
      '10:15',
      '11:00',
      '14:00',
      '14:45',
      '15:30',
    ][i],
    duration: 45,
    procedure: p[2],
    room: i % 3 === 2 ? 'Cadeira 01' : 'Cadeira 02',
    status:
      i === 0
        ? 'in_progress'
        : i === 1
          ? 'arrived'
          : i === 2
            ? 'confirmed'
            : i < 5
              ? 'scheduled'
              : 'confirmed',
  }));
  state.teeth = [
    {
      id: 'tooth-1',
      patientId: 'patient-1',
      tooth: 46,
      surface: 'O',
      condition: 'Implante',
      notes:
        'Planejamento de implante unitário. Conferir exame antes da próxima etapa.',
      status: 'planned',
      createdAt: at,
      authorId: 'admin-demo',
    },
    {
      id: 'tooth-2',
      patientId: 'patient-1',
      tooth: 16,
      surface: 'O',
      condition: 'Restauração',
      notes: 'Restauração existente em bom estado.',
      status: 'existing',
      createdAt: at,
      authorId: 'admin-demo',
    },
    {
      id: 'tooth-3',
      patientId: 'patient-3',
      tooth: 24,
      surface: 'M',
      condition: 'Cárie',
      notes: 'Avaliar extensão da lesão.',
      status: 'planned',
      createdAt: at,
      authorId: 'dentist-1',
    },
  ];
  state.treatments = [
    {
      id: 'treatment-1',
      patientId: 'patient-1',
      tooth: '46',
      procedure: 'Implante unitário',
      status: 'in_progress',
      priority: 'high',
      amount: 350000,
      dentistId: 'admin-demo',
      notes:
        'Revisar tomografia e disponibilidade óssea. Retorno após a etapa cirúrgica.',
      createdAt: at,
    },
    {
      id: 'treatment-2',
      patientId: 'patient-1',
      tooth: 'Geral',
      procedure: 'Profilaxia e orientação de higiene',
      status: 'completed',
      priority: 'normal',
      amount: 18000,
      dentistId: 'admin-demo',
      notes: 'Orientações de higiene registradas.',
      createdAt: at,
    },
    {
      id: 'treatment-3',
      patientId: 'patient-3',
      tooth: '24',
      procedure: 'Restauração em resina',
      status: 'approved',
      priority: 'normal',
      amount: 32000,
      dentistId: 'dentist-1',
      notes: 'Reavaliar oclusão após o procedimento.',
      createdAt: at,
    },
  ];
  state.evolutions = [
    {
      id: 'evolution-1',
      patientId: 'patient-1',
      text: 'Avaliação inicial e planejamento do implante no elemento 46. Paciente relata alergia à penicilina e hipertensão controlada. Solicitação de tomografia registrada; verificar exame antes da cirurgia.',
      authorId: 'admin-demo',
      createdAt: at,
      returnDate: future.toISOString().slice(0, 10),
    },
  ];
  state.invoices = [
    {
      id: 'invoice-1',
      patientId: 'patient-1',
      description: 'Implante unitário · Entrada',
      amount: 150000,
      dueDate: due,
      createdAt: at,
    },
    {
      id: 'invoice-2',
      patientId: 'patient-1',
      description: 'Implante unitário · Parcela 2',
      amount: 200000,
      dueDate: future.toISOString().slice(0, 10),
      createdAt: at,
    },
    {
      id: 'invoice-3',
      patientId: 'patient-2',
      description: 'Manutenção de alinhadores',
      amount: 35000,
      dueDate: date,
      createdAt: at,
    },
    {
      id: 'invoice-4',
      patientId: 'patient-3',
      description: 'Restauração em resina',
      amount: 32000,
      dueDate: due,
      createdAt: at,
    },
    {
      id: 'invoice-5',
      patientId: 'patient-4',
      description: 'Profilaxia',
      amount: 18000,
      dueDate: date,
      createdAt: at,
    },
  ];
  state.payments = [
    {
      id: 'payment-1',
      invoiceId: 'invoice-1',
      amount: 100000,
      method: 'Pix',
      createdAt: at,
      authorId: 'admin-demo',
      idempotencyKey: 'seed-payment-1',
    },
    {
      id: 'payment-2',
      invoiceId: 'invoice-3',
      amount: 35000,
      method: 'Cartão',
      createdAt: at,
      authorId: 'admin-demo',
      idempotencyKey: 'seed-payment-2',
    },
    {
      id: 'payment-3',
      invoiceId: 'invoice-5',
      amount: 18000,
      method: 'Pix',
      createdAt: at,
      authorId: 'admin-demo',
      idempotencyKey: 'seed-payment-3',
    },
  ];
  state.expenses = [
    {
      id: 'expense-1',
      description: 'Materiais odontológicos',
      category: 'Insumos',
      amount: 23500,
      date,
      paid: true,
    },
    {
      id: 'expense-2',
      description: 'Laboratório protético',
      category: 'Laboratório',
      amount: 45000,
      date,
      paid: false,
    },
  ];
  state.notes = [
    {
      id: 'note-1',
      patientId: 'patient-1',
      title: 'Planejamento integrado · Rafael Mota',
      content:
        '## Prioridades\n\nImplante unitário no elemento 46 em andamento. Conferir tomografia antes da etapa cirúrgica.\n\n## Atenção clínica\n\nAlergia à penicilina registrada na anamnese. Hipertensão controlada; confirmar medicamentos na consulta.\n\n## Próximo passo\n\nReavaliar exame e registrar a evolução no prontuário. [[Planejamento]] [[Anamnese]]',
      updatedAt: at,
      authorId: 'admin-demo',
    },
    {
      id: 'note-2',
      patientId: 'patient-2',
      title: 'Acompanhamento de alinhadores',
      content:
        'Revisar adaptação dos alinhadores e adesão ao tempo de uso. Fotografar evolução na próxima consulta.',
      updatedAt: at,
      authorId: 'admin-demo',
    },
    {
      id: 'note-3',
      patientId: '',
      title: 'Protocolo de acolhimento',
      content:
        'Confirmar identidade, atualizar anamnese e verificar alergias antes de cada atendimento. Registrar os procedimentos e a orientação de retorno.',
      updatedAt: at,
      authorId: 'admin-demo',
    },
  ];
  return state;
}
