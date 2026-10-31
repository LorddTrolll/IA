import {
  brl,
  localDate,
  treatmentLabels,
  type AssistantReply,
  type AssistantSource,
  type ClinicState,
  type Patient,
} from './types';

/** Search deliberately uses only the state already filtered by the server's authorization. */
export const normalizeSearch = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const stopwords = new Set([
  'a',
  'o',
  'e',
  'de',
  'da',
  'do',
  'das',
  'dos',
  'um',
  'uma',
  'para',
  'por',
  'com',
  'em',
  'no',
  'na',
  'os',
  'as',
  'ao',
  'que',
  'qual',
  'quais',
  'como',
  'este',
  'esta',
  'esse',
  'essa',
  'paciente',
  'pacientes',
  'foi',
  'tem',
  'me',
  'sobre',
  'seu',
  'sua',
]);
const words = (value: string) =>
  normalizeSearch(value)
    .split(' ')
    .filter((w) => w.length > 1 && !stopwords.has(w));
const financialQuestion = (question: string) =>
  /\b(debito|debitos|divida|dividas|deve|devendo|saldo|financeiro|financeira|pagar|pagamento|pagamentos|receber|recebimento|cobranca|cobrancas|inadimplentes|inadimplencia)\b/.test(
    normalizeSearch(question),
  );
const dateLabel = (value: string) =>
  value ? value.slice(0, 10).split('-').reverse().join('/') : 'sem data';

export function selectPatients(
  state: ClinicState,
  question: string,
  patientId?: string,
): Patient[] {
  if (patientId) return state.patients.filter((p) => p.id === patientId);
  const normalized = normalizeSearch(question);
  const exact = state.patients.filter((p) =>
    ` ${normalized} `.includes(` ${normalizeSearch(p.name)} `),
  );
  if (exact.length) return exact;
  const query = new Set(words(question));
  const matched = state.patients
    .map((p) => ({
      p,
      score: words(p.name).filter((w) => query.has(w)).length,
    }))
    .filter((item) => item.score > 0);
  if (!matched.length) return [];
  const best = Math.max(...matched.map((item) => item.score));
  return matched.filter((item) => item.score === best).map((item) => item.p);
}

export const invoicePaid = (state: ClinicState, invoiceId: string) =>
  state.payments
    .filter((p) => p.invoiceId === invoiceId)
    .reduce((total, p) => total + p.amount, 0);

export function financialReply(
  state: ClinicState,
  question: string,
  patientId?: string,
  today = localDate(),
): AssistantReply | null {
  if (!financialQuestion(question)) return null;
  const selected = selectPatients(state, question, patientId);
  const includeAll = /\b(pacientes|todos|clinica|total|quem|quais)\b/.test(
    normalizeSearch(question),
  );
  if (!selected.length && !includeAll && !patientId)
    return {
      answer:
        'Selecione um paciente ou informe seu nome para consultar o saldo. Para uma visão geral, pergunte “Quais pacientes têm débitos?”.',
      sources: [],
      provider: 'local',
    };
  const scope = new Set(
    (selected.length ? selected : state.patients).map((p) => p.id),
  );
  const invoices = state.invoices.filter((i) => scope.has(i.patientId));
  const outstanding = invoices
    .map((invoice) => ({
      invoice,
      balance: Math.max(0, invoice.amount - invoicePaid(state, invoice.id)),
    }))
    .filter((i) => i.balance > 0);
  const total = outstanding.reduce((sum, i) => sum + i.balance, 0);
  const overdue = outstanding
    .filter((i) => i.invoice.dueDate < today)
    .reduce((sum, i) => sum + i.balance, 0);
  const sources: AssistantSource[] = outstanding.map(
    ({ invoice, balance }) => ({
      id: invoice.id,
      patientId: invoice.patientId,
      title: `Financeiro · ${state.patients.find((p) => p.id === invoice.patientId)?.name ?? 'Paciente'} · ${invoice.description}`,
      excerpt: `Valor: ${brl(invoice.amount)}. Recebido: ${brl(invoicePaid(state, invoice.id))}. Saldo: ${brl(balance)}. Vencimento: ${dateLabel(invoice.dueDate)}.`,
    }),
  );
  const names = selected.length
    ? selected.map((p) => p.name).join(', ')
    : 'os pacientes autorizados';
  if (!total)
    return {
      answer: `Não há saldo pendente registrado para ${names}. Consulta calculada diretamente nos lançamentos financeiros; não inclui valores ainda não lançados.`,
      sources: [],
      provider: 'local',
    };
  const grouped = new Map<string, number>();
  for (const { invoice, balance } of outstanding)
    grouped.set(
      invoice.patientId,
      (grouped.get(invoice.patientId) ?? 0) + balance,
    );
  const lines = [...grouped].map(
    ([id, balance]) =>
      `${state.patients.find((p) => p.id === id)?.name}: ${brl(balance)}`,
  );
  return {
    answer: `Saldo pendente registrado: ${brl(total)}. Desse total, ${brl(overdue)} está vencido em ${dateLabel(today)}.\n\n${lines.join('\n')}\n\nCalculado diretamente nas cobranças e pagamentos; parcelas futuras também compõem o saldo pendente. Consulte os lançamentos nas fontes.`,
    sources,
    provider: 'local',
  };
}

export function reminderReply(
  state: ClinicState,
  question: string,
  patientId?: string,
  today = localDate(),
): AssistantReply | null {
  const normalized = normalizeSearch(question);
  if (
    !/\b(retorno|retornos)\b/.test(normalized) ||
    !/\b(atrasado|atrasados|vencido|vencidos|pendente|pendentes)\b/.test(
      normalized,
    )
  )
    return null;
  const selected = selectPatients(state, question, patientId);
  const scope = selected.length ? selected : state.patients;
  const sources: AssistantSource[] = [];
  for (const patient of scope) {
    const latest = state.evolutions
      .filter((e) => e.patientId === patient.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    if (latest?.returnDate && latest.returnDate < today)
      sources.push({
        id: latest.id,
        patientId: patient.id,
        title: `Retorno · ${patient.name}`,
        excerpt: `Retorno recomendado em ${dateLabel(latest.returnDate)} na última evolução, de ${dateLabel(latest.createdAt)}. ${latest.text.slice(0, 500)}`,
      });
  }
  return {
    answer: sources.length
      ? `Encontrei ${sources.length} paciente(s) com retorno recomendado vencido em ${dateLabel(today)}.\n\n${sources.map((s, i) => `[${i + 1}] ${s.title}\n${s.excerpt}`).join('\n\n')}\n\nConfirme na agenda se o retorno já foi realizado ou reagendado.`
      : `Não há retorno vencido registrado na última evolução dos pacientes consultados, em ${dateLabel(today)}.`,
    sources,
    provider: 'local',
  };
}

export function retrieveSources(
  state: ClinicState,
  question: string,
  patientId?: string,
): AssistantSource[] {
  const selected = selectPatients(state, question, patientId);
  const scope = new Set(
    (selected.length ? selected : state.patients).map((p) => p.id),
  );
  const sources: AssistantSource[] = [];
  const name = (id: string) =>
    state.patients.find((p) => p.id === id)?.name ?? 'Clínica';
  for (const p of state.patients.filter((p) => scope.has(p.id)))
    sources.push({
      id: `patient:${p.id}`,
      patientId: p.id,
      title: `Ficha · ${p.name}`,
      excerpt: `Queixa: ${p.complaint || 'não registrada'}. Alergias: ${p.allergies || 'não informado; confirmar com o paciente'}. Medicamentos: ${p.medications || 'não informado'}. Condições: ${p.conditions || 'não informado'}. Observações: ${p.notes || 'sem observações'}.`,
    });
  for (const t of state.treatments.filter((t) => scope.has(t.patientId)))
    sources.push({
      id: t.id,
      patientId: t.patientId,
      title: `Planejamento · ${name(t.patientId)} · ${dateLabel(t.createdAt)}`,
      excerpt: `${t.procedure}. Elemento/região ${t.tooth || 'não especificado'}. Situação: ${treatmentLabels[t.status]}. Prioridade: ${t.priority === 'high' ? 'alta' : 'normal'}. ${t.notes}`,
    });
  for (const t of state.teeth.filter((t) => scope.has(t.patientId)))
    sources.push({
      id: t.id,
      patientId: t.patientId,
      title: `Odontograma · ${name(t.patientId)} · ${dateLabel(t.createdAt)}`,
      excerpt: `Dente ${t.tooth}, face ${t.surface}: ${t.condition}. Situação: ${t.status === 'existing' ? 'condição existente' : t.status === 'planned' ? 'planejado' : 'realizado'}. ${t.notes}`,
    });
  for (const e of state.evolutions.filter((e) => scope.has(e.patientId)))
    sources.push({
      id: e.id,
      patientId: e.patientId,
      title: `Evolução · ${name(e.patientId)} · ${dateLabel(e.createdAt)}`,
      excerpt: `${e.text}${e.returnDate ? ` Retorno recomendado: ${dateLabel(e.returnDate)}.` : ''}`,
    });
  for (const n of state.notes.filter(
    (n) => !n.patientId || scope.has(n.patientId),
  ))
    sources.push({
      id: n.id,
      patientId: n.patientId,
      title: `${n.title} · ${name(n.patientId)} · ${dateLabel(n.updatedAt)}`,
      excerpt: n.content,
    });
  const queryWords = words(question);
  return sources
    .map((source) => ({
      source,
      score: queryWords.reduce(
        (s, w) =>
          s +
          (normalizeSearch(`${source.title} ${source.excerpt}`).includes(w)
            ? 1
            : 0),
        0,
      ),
    }))
    .filter((item) => selected.length > 0 || item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map(({ source }) => ({
      ...source,
      excerpt: source.excerpt.slice(0, 1800),
    }));
}

export function localKnowledgeReply(
  sources: AssistantSource[],
  configured: boolean,
): AssistantReply {
  if (!sources.length)
    return {
      answer: `Não encontrei registros correspondentes na base autorizada. Tente selecionar um paciente ou informar o nome e o assunto.${configured ? '' : ' O Grok ainda não está configurado; consultas gerais de IA não estão disponíveis.'}`,
      sources: [],
      provider: 'local',
    };
  return {
    answer: `Busca nos registros da clínica${configured ? '' : ' · Grok não configurado'}\n\n${sources.map((s, i) => `[${i + 1}] ${s.title}\n${s.excerpt}`).join('\n\n')}\n\nResultados documentais, sem interpretação por IA. Confirme as informações no prontuário antes do atendimento.`,
    sources,
    provider: 'local',
  };
}

/** YAML strings use JSON's compatible quoted-scalar syntax; names never become filesystem paths. */
const yaml = (value: string) => JSON.stringify(value.replace(/\r/g, ''));
const md = (value: string) => value.replace(/</g, '&lt;').replace(/>/g, '&gt;');
const safeId = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, '_');
const fileHeading = (title: string, patient: Patient, updatedAt: string) =>
  `---\ntitle: ${yaml(title)}\npatient_id: ${yaml(patient.id)}\npatient_name: ${yaml(patient.name)}\nupdated_at: ${yaml(updatedAt)}\nsource: dentim\n---\n\n# ${md(title)}\n\n`;
export type VaultFile = { path: string; content: string };

export function buildVault(
  state: ClinicState,
  options: {
    patientId?: string;
    finance?: boolean;
    clinical?: boolean;
    now?: string;
  } = {},
): VaultFile[] {
  const now = options.now ?? new Date().toISOString();
  const files: VaultFile[] = [];
  const patients = state.patients.filter(
    (p) => !options.patientId || p.id === options.patientId,
  );
  const clinical = options.clinical !== false;
  const index = [
    '# Dentim · Cérebro da clínica',
    '',
    `Exportação: ${now}`,
    '',
    'Esta é uma cópia para consulta no Obsidian. O banco do sistema permanece a fonte oficial. Alterações neste vault não são importadas automaticamente.',
    '',
    '## Pacientes',
    '',
  ];
  for (const patient of patients) {
    const dir = `Pacientes/paciente-${safeId(patient.id)}`;
    index.push(
      `- [[${dir}/Resumo|${md(patient.name).replace(/[\[\]|\n\r]/g, ' ')}]]`,
    );
    const add = (name: string, title: string, body: string) =>
      files.push({
        path: `${dir}/${name}.md`,
        content: fileHeading(title, patient, now) + body + '\n',
      });
    add(
      'Resumo',
      patient.name,
      `- Identificador: ${md(patient.id)}\n- Nascimento: ${dateLabel(patient.birthDate)}\n- Telefone: ${md(patient.phone)}\n- E-mail: ${md(patient.email)}\n\n${clinical ? '[[Anamnese]] · [[Odontograma]] · [[Planejamento]] · [[Evolucoes]] · [[Retornos]]' : ''}${options.finance ? ' · [[Financeiro]]' : ''}`,
    );
    if (clinical) {
      add(
        'Anamnese',
        `Anamnese · ${patient.name}`,
        `## Queixa principal\n${md(patient.complaint || 'Não registrada.')}\n\n## Alergias\n${md(patient.allergies || 'Não informado. Confirmar com o paciente.')}\n\n## Medicamentos\n${md(patient.medications || 'Não informado.')}\n\n## Condições de saúde\n${md(patient.conditions || 'Não informado.')}\n\n## Observações\n${md(patient.notes || 'Sem observações.')}`,
      );
      add(
        'Odontograma',
        `Odontograma · ${patient.name}`,
        state.teeth
          .filter((t) => t.patientId === patient.id)
          .map(
            (t) =>
              `## Elemento ${t.tooth} · ${md(t.surface)}\n- Condição: ${md(t.condition)}\n- Situação: ${t.status}\n- Registrado em: ${t.createdAt}\n- Profissional: ${md(state.members.find((m) => m.id === t.authorId)?.name ?? t.authorId)}\n\n${md(t.notes)}`,
          )
          .join('\n\n') || 'Nenhum registro odontológico.',
      );
      add(
        'Planejamento',
        `Planejamento · ${patient.name}`,
        state.treatments
          .filter((t) => t.patientId === patient.id)
          .map(
            (t) =>
              `## ${md(t.procedure)}\n- Elemento/região: ${md(t.tooth)}\n- Situação: ${treatmentLabels[t.status]}\n- Prioridade: ${t.priority === 'high' ? 'Alta' : 'Normal'}\n${options.finance ? `- Valor proposto: ${brl(t.amount)}\n` : ''}\n${md(t.notes)}`,
          )
          .join('\n\n') || 'Nenhum planejamento registrado.',
      );
      add(
        'Evolucoes',
        `Evoluções · ${patient.name}`,
        state.evolutions
          .filter((e) => e.patientId === patient.id)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .map(
            (e) =>
              `## ${dateLabel(e.createdAt)}\nProfissional: ${md(state.members.find((m) => m.id === e.authorId)?.name ?? e.authorId)}\n\n${md(e.text)}\n\n${e.returnDate ? `Retorno recomendado: ${dateLabel(e.returnDate)}` : ''}`,
          )
          .join('\n\n') || 'Nenhuma evolução registrada.',
      );
      add(
        'Retornos',
        `Retornos · ${patient.name}`,
        state.evolutions
          .filter((e) => e.patientId === patient.id && e.returnDate)
          .map(
            (e) =>
              `- ${dateLabel(e.returnDate)} — [[Evolucoes]] — ${md(e.text).slice(0, 200)}`,
          )
          .join('\n') || 'Nenhum retorno recomendado registrado.',
      );
      for (const note of state.notes.filter((n) => n.patientId === patient.id))
        files.push({
          path: `${dir}/Notas/nota-${safeId(note.id)}.md`,
          content:
            fileHeading(note.title, patient, note.updatedAt) +
            md(note.content) +
            '\n',
        });
    }
    if (options.finance)
      add(
        'Financeiro',
        `Financeiro · ${patient.name}`,
        state.invoices
          .filter((i) => i.patientId === patient.id)
          .map(
            (i) =>
              `## ${md(i.description)}\n- Identificador: ${md(i.id)}\n- Valor: ${brl(i.amount)}\n- Recebido: ${brl(invoicePaid(state, i.id))}\n- Saldo: ${brl(Math.max(0, i.amount - invoicePaid(state, i.id)))}\n- Vencimento: ${dateLabel(i.dueDate)}`,
          )
          .join('\n\n') || 'Nenhuma cobrança registrada.',
      );
  }
  if (clinical && !options.patientId)
    for (const note of state.notes.filter((n) => !n.patientId))
      files.push({
        path: `Clinica/Protocolos/nota-${safeId(note.id)}.md`,
        content: `---\ntitle: ${yaml(note.title)}\nupdated_at: ${yaml(note.updatedAt)}\nsource: dentim\n---\n\n# ${md(note.title)}\n\n${md(note.content)}\n`,
      });
  files.unshift({ path: 'Indice.md', content: index.join('\n') + '\n' });
  files.push({
    path: 'LEIA-ME.md',
    content:
      '# Abrir no Obsidian\n\nExtraia o ZIP em uma pasta e escolha “Abrir pasta como vault” no Obsidian.\n\nOs dados foram exportados conforme as permissões do usuário. Esta é uma cópia pontual. Não publique dados de pacientes em repositório público.\n\nEdições externas não atualizam o sistema. Registre alterações clínicas no prontuário e exporte novamente. O importador com revisão de conflitos ainda não faz parte desta versão.\n',
  });
  return files;
}
