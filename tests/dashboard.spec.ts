import { test, expect } from '@playwright/test';
test('painel, busca, assistente e exportação funcionam', async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Pulso da clínica.' }),
  ).toBeVisible();
  await expect(
    page.getByText('AMBIENTE DE DEMONSTRAÇÃO', { exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: '/tmp/lumina-desktop.png', fullPage: true });
  const clinic = await (await request.get('/api/clinic')).json();
  const patient = clinic.state.patients[0];
  await page.getByLabel('Buscar paciente ou prontuário').fill(patient.name);
  await page.locator('.search-results').getByRole('button').first().click();
  await expect(
    page.getByRole('heading', { name: patient.name, exact: true }),
  ).toBeVisible();
  await page.getByLabel('Abrir assistente Lúmina').click();
  await page
    .getByLabel('Pergunta ao assistente')
    .fill('Quanto este paciente ainda deve?');
  await page.getByLabel('Enviar pergunta').click();
  await expect(page.locator('.chat-assistant')).toContainText(
    /Saldo pendente|Não há saldo/,
  );
  await expect(page.locator('.chat-assistant')).toContainText(
    'BUSCA DOCUMENTAL LOCAL',
  );
  await page.getByLabel('Fechar assistente').click();
  const vault = await request.get('/api/vault');
  expect(vault.ok()).toBeTruthy();
  expect(vault.headers()['content-type']).toContain('zip');
  expect((await vault.body()).length).toBeGreaterThan(500);
  expect(errors).toEqual([]);
});
test('painel adapta-se ao celular sem rolagem horizontal', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Pulso da clínica.' }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({ path: '/tmp/lumina-mobile.png', fullPage: true });
  await page.getByLabel('Abrir menu').click();
  await page
    .getByRole('navigation')
    .getByRole('button', { name: 'Pessoas', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Pessoas, primeiro.' }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
});
