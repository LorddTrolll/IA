import { expect, test, type Response } from '@playwright/test';

async function successful(response: Response) {
  const body = await response.text();
  expect(response.ok(), `HTTP ${response.status()}: ${body}`).toBeTruthy();
}

// Exercises the real HTTP API and persisted demo SQLite store through the UI.
// Every run uses a distinct fictitious patient and cannot overwrite a real record.
test('clinical journey persists anamnese, FDI history, planning and evolutions', async ({
  page,
  request,
}) => {
  const name = `Paciente Clínico E2E ${Date.now()}`;
  await page.goto('/');
  await expect(
    page.getByText('AMBIENTE DE DEMONSTRAÇÃO', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Pessoas', exact: true }).click();
  await page
    .getByRole('button', { name: 'Novo paciente', exact: true })
    .click();
  const createDialog = page.getByRole('dialog');
  await createDialog.getByLabel('Nome completo').fill(name);
  await createDialog.getByLabel('Data de nascimento').fill('1992-04-17');
  await createDialog.getByLabel('Telefone').fill('(11) 99999-4411');
  await createDialog
    .getByLabel('E-mail', { exact: true })
    .fill('paciente.e2e@example.com');
  await createDialog
    .getByLabel('Queixa principal')
    .fill('Sensibilidade no elemento 46');
  const createResponse = page.waitForResponse(
    (r) => r.url().endsWith('/api/clinic') && r.request().method() === 'POST',
  );
  await createDialog
    .getByRole('button', { name: 'Cadastrar paciente', exact: true })
    .click();
  await successful(await createResponse);
  await expect(createDialog).not.toBeVisible();
  await page
    .getByRole('button', { name: `Abrir ficha de ${name}`, exact: true })
    .click();
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();

  await page.getByRole('tab', { name: 'Anamnese', exact: true }).click();
  await page.getByLabel('Alergias').fill('Látex — relato do paciente');
  await page.getByLabel('Medicamentos em uso').fill('Nenhum');
  await page.getByLabel('Condições de saúde').fill('Sem condições relatadas');
  const anamneseResponse = page.waitForResponse(
    (r) => r.url().endsWith('/api/clinic') && r.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Salvar ficha', exact: true }).click();
  await successful(await anamneseResponse);
  await expect(
    page.getByRole('status').filter({ hasText: 'Registro salvo com sucesso.' }),
  ).toBeVisible();

  await page.getByRole('tab', { name: 'Odontograma', exact: true }).click();
  await page
    .getByRole('button', { name: 'Dente 46, sem registro', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Registrar condição', exact: true })
    .click();
  let dialog = page.getByRole('dialog');
  await dialog
    .getByRole('combobox', { name: 'Condição', exact: true })
    .selectOption({ label: 'Cárie' });
  await dialog
    .getByRole('combobox', { name: 'Face', exact: true })
    .selectOption('O');
  await dialog
    .getByRole('combobox', { name: 'Tipo de registro', exact: true })
    .selectOption('planned');
  await dialog
    .getByLabel('Observações', { exact: true })
    .fill('Lesão oclusal observada na avaliação.');
  const toothResponse = page.waitForResponse(
    (r) => r.url().endsWith('/api/clinic') && r.request().method() === 'POST',
  );
  await dialog
    .getByRole('button', { name: 'Salvar registro', exact: true })
    .click();
  await successful(await toothResponse);
  await expect(
    page.getByText('Lesão oclusal observada na avaliação.', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Dente 46, Cárie', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page
    .getByRole('combobox', { name: 'Tipo de dentição', exact: true })
    .selectOption('mixed');
  await expect(
    page.getByRole('button', { name: 'Dente 55, sem registro', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('combobox', { name: 'Tipo de dentição', exact: true })
    .selectOption('permanent');
  await page.screenshot({ path: '/tmp/lumina-clinical.png', fullPage: true });

  await page.getByRole('tab', { name: 'Planejamento', exact: true }).click();
  await page
    .getByRole('button', { name: 'Novo procedimento', exact: true })
    .click();
  dialog = page.getByRole('dialog');
  await dialog
    .getByLabel('Procedimento', { exact: true })
    .fill('Restauração E2E do elemento 46');
  await dialog.getByLabel('Elemento ou região').fill('46');
  await dialog.getByLabel('Valor previsto (R$)').fill('450.50');
  await dialog
    .getByRole('combobox', { name: 'Prioridade', exact: true })
    .selectOption('high');
  await dialog
    .getByLabel('Observações', { exact: true })
    .fill('Reavaliar contato oclusal.');
  const planResponse = page.waitForResponse(
    (r) => r.url().endsWith('/api/clinic') && r.request().method() === 'POST',
  );
  await dialog
    .getByRole('button', { name: 'Salvar registro', exact: true })
    .click();
  await successful(await planResponse);
  await expect(
    page.getByRole('heading', {
      name: 'Restauração E2E do elemento 46',
      exact: true,
    }),
  ).toBeVisible();
  const statusResponse = page.waitForResponse(
    (r) => r.url().endsWith('/api/clinic') && r.request().method() === 'POST',
  );
  await page
    .getByRole('combobox', {
      name: 'Status de Restauração E2E do elemento 46',
      exact: true,
    })
    .selectOption('approved');
  await successful(await statusResponse);

  await page.getByRole('tab', { name: 'Evoluções', exact: true }).click();
  await page
    .getByRole('button', { name: 'Registrar evolução', exact: true })
    .click();
  dialog = page.getByRole('dialog');
  await dialog
    .getByLabel('Evolução do atendimento')
    .fill(
      'Avaliação realizada, odontograma atualizado e planejamento discutido com o paciente.',
    );
  await dialog.getByLabel('Retorno recomendado').fill('2027-02-12');
  const evolutionResponse = page.waitForResponse(
    (r) => r.url().endsWith('/api/clinic') && r.request().method() === 'POST',
  );
  await dialog
    .getByRole('button', { name: 'Registrar evolução', exact: true })
    .click();
  await successful(await evolutionResponse);
  await expect(
    page.getByText(
      'Avaliação realizada, odontograma atualizado e planejamento discutido com o paciente.',
      { exact: true },
    ),
  ).toBeVisible();

  await page.getByRole('tab', { name: 'Cérebro', exact: true }).click();
  await page.getByRole('button', { name: 'Nova nota', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog
    .getByLabel('Título', { exact: true })
    .fill('Orientações clínicas E2E');
  await dialog
    .getByLabel('Conteúdo Markdown')
    .fill(
      '## Plano\n\nReavaliar o [[Planejamento]] do elemento 46 no próximo retorno.',
    );
  const noteResponse = page.waitForResponse(
    (r) => r.url().endsWith('/api/clinic') && r.request().method() === 'POST',
  );
  await dialog
    .getByRole('button', { name: 'Salvar registro', exact: true })
    .click();
  await successful(await noteResponse);
  await expect(
    page.getByRole('heading', {
      name: 'Orientações clínicas E2E',
      exact: true,
    }),
  ).toBeVisible();

  // Validate underlying records and reload: the test must exercise persistence,
  // not only optimistic local component state.
  const response = await request.get('/api/clinic');
  expect(response.ok()).toBeTruthy();
  const { state } = await response.json();
  const patient = state.patients.find((p: { name: string }) => p.name === name);
  expect(patient.allergies).toBe('Látex — relato do paciente');
  expect(
    state.teeth.some(
      (t: {
        patientId: string;
        tooth: number;
        surface: string;
        status: string;
      }) =>
        t.patientId === patient.id &&
        t.tooth === 46 &&
        t.surface === 'O' &&
        t.status === 'planned',
    ),
  ).toBeTruthy();
  expect(
    state.treatments.find(
      (t: { patientId: string }) => t.patientId === patient.id,
    ),
  ).toMatchObject({ amount: 45050, status: 'approved' });
  expect(
    state.evolutions.some(
      (e: { patientId: string; returnDate: string }) =>
        e.patientId === patient.id && e.returnDate === '2027-02-12',
    ),
  ).toBeTruthy();
  const vault = await request.get(
    `/api/vault?patientId=${encodeURIComponent(patient.id)}`,
  );
  expect(vault.ok()).toBeTruthy();
  expect(vault.headers()['content-type']).toContain('application/zip');
  expect((await vault.body()).subarray(0, 2).toString()).toBe('PK');
  await page.reload();
  await page
    .getByRole('textbox', {
      name: 'Buscar paciente ou prontuário',
      exact: true,
    })
    .fill(name);
  await page
    .getByRole('textbox', {
      name: 'Buscar paciente ou prontuário',
      exact: true,
    })
    .press('Enter');
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  await expect(
    page.getByText('Alergia registrada: Látex — relato do paciente', {
      exact: true,
    }),
  ).toBeVisible();
});
