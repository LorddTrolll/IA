import { expect, test } from '@playwright/test';
import type { ClinicResponse } from '../src/lib/types';
import { loginDemoAdmin } from './demo-login';

test.beforeEach(async ({ request, context }) => {
  await loginDemoAdmin(request, context);
});

const unique = `Financeiro E2E ${Date.now()}`;

test('financeiro: cria cobrança, recebe parcela e registra despesa', async ({
  page,
  request,
}) => {
  const initialResponse = await request.get('/api/clinic');
  expect(initialResponse.ok()).toBeTruthy();
  const initial = (await initialResponse.json()) as ClinicResponse;
  const dentist =
    initial.state.members.find(
      (m) => m.status === 'active' && m.role === 'dentist',
    ) ?? initial.session.user;
  const patientResponse = await request.post('/api/clinic', {
    data: {
      type: 'createPatient',
      payload: { name: unique, dentistId: dentist.id, phone: '11999990000' },
    },
  });
  expect(patientResponse.ok()).toBeTruthy();
  const created = (await patientResponse.json()) as ClinicResponse;
  const patient = created.state.patients.find((p) => p.name === unique)!;
  expect(patient).toBeTruthy();

  await page.goto('/');
  await page.getByRole('button', { name: 'Caixa', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Clareza em cada número.' }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Nova cobrança', exact: true })
    .click();
  const chargeDialog = page.getByRole('dialog', { name: 'Nova cobrança' });
  await chargeDialog
    .getByRole('combobox', { name: 'Paciente', exact: true })
    .selectOption(patient.id);
  await chargeDialog
    .getByLabel('Descrição', { exact: true })
    .fill(`Restauração teste ${unique}`);
  await chargeDialog.getByLabel('Valor (R$)', { exact: true }).fill('375.50');
  await chargeDialog
    .getByLabel('Vencimento', { exact: true })
    .fill('2030-12-20');
  await chargeDialog
    .getByRole('button', { name: 'Criar cobrança', exact: true })
    .click();
  await expect(chargeDialog).not.toBeVisible();

  const search = page.getByRole('textbox', {
    name: 'Buscar paciente ou cobrança',
    exact: true,
  });
  await search.fill(unique);
  const row = page.getByRole('row').filter({ hasText: unique });
  await expect(row).toHaveCount(1);
  await expect(row).toContainText(/375,50/);
  await expect(row).toContainText('Em aberto');
  await row.getByRole('button', { name: 'Receber', exact: true }).click();
  const paymentDialog = page.getByRole('dialog', {
    name: 'Registrar recebimento',
  });
  await paymentDialog
    .getByRole('spinbutton', { name: /^Valor recebido/ })
    .fill('150.00');
  await paymentDialog
    .getByRole('combobox', { name: 'Forma de pagamento', exact: true })
    .selectOption('Pix');
  await paymentDialog
    .getByRole('button', { name: 'Confirmar recebimento', exact: true })
    .click();
  await expect(paymentDialog).not.toBeVisible();
  await expect(row).toContainText('Parcial');
  await expect(row).toContainText(/150,00/);
  await expect(row).toContainText(/Restam\s+R\$\s*225,50/);

  const after = (await (
    await request.get('/api/clinic')
  ).json()) as ClinicResponse;
  const invoice = after.state.invoices.find((i) => i.patientId === patient.id)!;
  expect(invoice.amount).toBe(37550);
  expect(
    after.state.payments
      .filter((p) => p.invoiceId === invoice.id)
      .reduce((sum, p) => sum + p.amount, 0),
  ).toBe(15000);

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar CSV', exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^dentim-recebimentos-.*\.csv$/);
  const stream = await download.createReadStream();
  let csv = '';
  for await (const chunk of stream!) csv += chunk.toString('utf8');
  expect(csv).toContain(unique);
  expect(csv).toContain('375,50');
  expect(csv).toContain('225,50');
  await page.screenshot({ path: '/tmp/dentim-finance.png', fullPage: true });

  await page.getByRole('button', { name: /^Despesas/ }).click();
  await page.getByRole('button', { name: 'Nova despesa', exact: true }).click();
  const expenseDialog = page.getByRole('dialog', { name: 'Registrar despesa' });
  await expenseDialog
    .getByLabel('Descrição', { exact: true })
    .fill(`Laboratório ${unique}`);
  await expenseDialog
    .getByRole('combobox', { name: 'Categoria', exact: true })
    .selectOption('Laboratório');
  await expenseDialog.getByLabel('Valor (R$)', { exact: true }).fill('75.50');
  await expenseDialog
    .getByRole('button', { name: 'Salvar despesa', exact: true })
    .click();
  await expect(expenseDialog).not.toBeVisible();
  await page
    .getByRole('textbox', { name: 'Buscar despesa', exact: true })
    .fill(unique);
  await expect(page.getByRole('row').filter({ hasText: unique })).toContainText(
    /75,50/,
  );
  await expect(page.getByRole('row').filter({ hasText: unique })).toContainText(
    'Pago',
  );
});

test('equipe: administrador aprova um cadastro pendente', async ({
  page,
  request,
}) => {
  const initial = (await (
    await request.get('/api/clinic')
  ).json()) as ClinicResponse;
  const pending = initial.state.members.find((m) => m.status === 'pending');
  test.skip(
    !pending,
    'A demonstração não tem um cadastro pendente disponível.',
  );
  try {
    await page.goto('/');
    await page.getByRole('button', { name: 'Equipe', exact: true }).click();
    const row = page.getByRole('row').filter({ hasText: pending!.email });
    await expect(row).toContainText('Aguardando aprovação');
    await row.getByRole('button', { name: 'Revisar', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Gerenciar profissional' });
    await dialog
      .getByRole('combobox', { name: 'Perfil de acesso', exact: true })
      .selectOption('dentist');
    await dialog
      .getByRole('combobox', { name: 'Situação da conta', exact: true })
      .selectOption('active');
    await dialog.getByLabel('Autorizar acesso financeiro').check();
    await dialog
      .getByRole('button', { name: 'Salvar permissões', exact: true })
      .click();
    await expect(dialog).not.toBeVisible();
    await expect(row).toContainText('Ativo');
    await expect(row).toContainText('Autorizado');
    const after = (await (
      await request.get('/api/clinic')
    ).json()) as ClinicResponse;
    expect(after.state.members.find((m) => m.id === pending!.id)).toMatchObject(
      { role: 'dentist', status: 'active', finance: true },
    );
  } finally {
    if (pending)
      await request.post('/api/clinic', {
        data: {
          type: 'updateMember',
          payload: {
            id: pending.id,
            role: pending.role,
            status: pending.status,
            finance: pending.finance,
          },
        },
      });
  }
});
