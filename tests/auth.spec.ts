import {
  expect,
  test,
  type Page,
  type APIRequestContext,
} from '@playwright/test';

const adminEmail = 'helena@dentim.exemplo';
const dentistEmail = 'lucas@dentim.exemplo';
const demoPassword = 'Dentim123!';

async function uiLogin(page: Page, email: string, password = demoPassword) {
  await page.getByLabel('Seu e-mail', { exact: true }).fill(email);
  await page.getByLabel('Senha', { exact: true }).fill(password);
  const response = page.waitForResponse(
    (r) => r.url().endsWith('/api/auth') && r.request().method() === 'POST',
  );
  await page
    .getByRole('button', { name: 'Entrar na clínica', exact: true })
    .click();
  return await response;
}

async function apiLogin(request: APIRequestContext, email: string) {
  const response = await request.post('/api/auth', {
    data: { action: 'login', email, password: demoPassword },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  return (await response.json()).user;
}

async function uiLogout(page: Page) {
  const response = page.waitForResponse(
    (r) => r.url().endsWith('/api/auth') && r.request().method() === 'POST',
  );
  await page
    .locator('.sidebar')
    .getByRole('button', { name: 'Sair da conta', exact: true })
    .click();
  expect((await response).ok()).toBeTruthy();
  await expect(
    page.getByRole('button', { name: 'Entrar na clínica', exact: true }),
  ).toBeVisible();
}

test('Dentim exige login, rejeita senha incorreta e encerra a sessão', async ({
  page,
}) => {
  // A brand-new context has no implicit demo administrator session.
  expect((await page.request.get('/api/clinic')).status()).toBe(401);
  expect((await page.request.get('/api/vault')).status()).toBe(401);
  await page.goto('/');
  await expect(page.locator('.auth-wordmark')).toContainText('Dentim');
  await page.screenshot({ path: '/tmp/dentim-login.png', fullPage: true });
  await expect(
    page.getByRole('button', { name: 'Entrar na clínica', exact: true }),
  ).toBeVisible();
  const wrong = await uiLogin(page, adminEmail, 'SenhaIncorreta123!');
  expect(wrong.status()).toBe(401);
  await expect(
    page.getByRole('alert').filter({ hasText: /senha inválidos/i }),
  ).toBeVisible();
  expect((await page.request.get('/api/clinic')).status()).toBe(401);
  const correct = await uiLogin(page, adminEmail);
  expect(correct.ok(), await correct.text()).toBeTruthy();
  await expect(
    page.getByRole('heading', { name: 'Dra. Helena Costa', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.topbar')).toContainText('Dra. Helena Costa');
  const current = await page.request.get('/api/clinic');
  expect(current.ok()).toBeTruthy();
  expect((await current.json()).session.user.email).toBe(adminEmail);
  await page.screenshot({
    path: '/tmp/dentim-authenticated.png',
    fullPage: true,
  });
  await uiLogout(page);
  expect((await page.request.get('/api/clinic')).status()).toBe(401);
  // Logout invalidates the browser's cookie, including after a full reload.
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Entrar na clínica', exact: true }),
  ).toBeVisible();
});

test('dentista vê o próprio nome e somente os seus pacientes', async ({
  page,
  request,
}) => {
  const admin = await apiLogin(request, adminEmail);
  const fullState = (await (await request.get('/api/clinic')).json()).state;
  const dentist = fullState.members.find(
    (m: { email: string }) => m.email === dentistEmail,
  );
  expect(dentist).toBeTruthy();
  const stamp = Date.now();
  const restrictedName = `Paciente Restrito E2E ${stamp}`;
  const allowedName = `Paciente Lucas E2E ${stamp}`;
  for (const [name, dentistId] of [
    [restrictedName, admin.id],
    [allowedName, dentist.id],
  ]) {
    const created = await request.post('/api/clinic', {
      data: { type: 'createPatient', payload: { name, dentistId } },
    });
    expect(created.ok(), await created.text()).toBeTruthy();
  }
  await page.goto('/');
  expect((await uiLogin(page, dentistEmail)).ok()).toBeTruthy();
  await expect(
    page.getByRole('heading', { name: 'Dr. Lucas Almeida', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.topbar')).toContainText('Dr. Lucas Almeida');
  await expect(page.locator('.topbar')).not.toContainText('Dra. Helena Costa');
  const filtered = (await (await page.request.get('/api/clinic')).json()).state;
  expect(filtered.patients.length).toBeGreaterThan(0);
  expect(
    filtered.patients.every(
      (p: { dentistId: string }) => p.dentistId === dentist.id,
    ),
  ).toBeTruthy();
  expect(
    filtered.patients.some((p: { name: string }) => p.name === restrictedName),
  ).toBeFalsy();
  await page.getByRole('button', { name: 'Pessoas', exact: true }).click();
  await expect(
    page.getByRole('button', {
      name: `Abrir ficha de ${allowedName}`,
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', {
      name: `Abrir ficha de ${restrictedName}`,
      exact: true,
    }),
  ).toHaveCount(0);
  const forbidden = await page.request.post('/api/clinic', {
    data: {
      type: 'createPatient',
      payload: { name: 'Atribuição proibida E2E', dentistId: admin.id },
    },
  });
  expect(forbidden.status()).toBe(403);
  await page.screenshot({ path: '/tmp/dentim-dentist.png', fullPage: true });
});

test('cadastro depende da aprovação do admin e suspensão bloqueia sessão existente', async ({
  page,
  request,
}) => {
  test.setTimeout(90000);
  const stamp = Date.now();
  const email = `cadastro-e2e-${stamp}@dentim.exemplo`;
  const name = `Dra. Cadastro E2E ${stamp}`;
  await page.goto('/');
  await page
    .getByRole('button', {
      name: 'Primeiro acesso? Solicitar cadastro',
      exact: true,
    })
    .click();
  await page.getByLabel('Nome completo', { exact: true }).fill(name);
  await page.getByLabel('Seu e-mail', { exact: true }).fill(email);
  await page.getByLabel('Senha', { exact: true }).fill(demoPassword);
  const signupResponse = page.waitForResponse(
    (r) => r.url().endsWith('/api/auth') && r.request().method() === 'POST',
  );
  await page
    .getByRole('button', { name: 'Solicitar cadastro', exact: true })
    .click();
  expect((await signupResponse).ok()).toBeTruthy();
  await expect(
    page.getByRole('status').filter({ hasText: /administrador/i }),
  ).toBeVisible();
  expect((await page.request.get('/api/clinic')).status()).toBe(401);
  await page
    .getByRole('button', { name: 'Já tem conta? Entrar', exact: true })
    .click();
  const pending = await uiLogin(page, email);
  expect(pending.status()).toBe(403);
  await expect(
    page
      .getByRole('alert')
      .filter({ hasText: /autorização do administrador/i }),
  ).toBeVisible();

  // Approval is exercised through the real administrator UI.
  expect((await uiLogin(page, adminEmail)).ok()).toBeTruthy();
  await page.getByRole('button', { name: 'Equipe', exact: true }).click();
  const row = page.getByRole('row').filter({ hasText: email });
  await expect(row).toContainText('Aguardando aprovação');
  await row.getByRole('button', { name: 'Revisar', exact: true }).click();
  const dialog = page.getByRole('dialog', {
    name: 'Gerenciar profissional',
    exact: true,
  });
  await dialog
    .getByRole('combobox', { name: 'Situação da conta', exact: true })
    .selectOption('active');
  await dialog
    .getByRole('button', { name: 'Salvar permissões', exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(row).toContainText('Ativo');
  const adminState = (await (await page.request.get('/api/clinic')).json())
    .state;
  const member = adminState.members.find(
    (m: { email: string }) => m.email === email,
  );
  expect(member).toMatchObject({
    role: 'dentist',
    status: 'active',
    finance: false,
  });
  await uiLogout(page);
  expect((await uiLogin(page, email)).ok()).toBeTruthy();
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  await expect(page.locator('.topbar')).toContainText(name);
  expect((await page.request.get('/api/clinic')).status()).toBe(200);

  // The server checks current authorization for every request, not just at login.
  await apiLogin(request, adminEmail);
  const suspended = await request.post('/api/clinic', {
    data: {
      type: 'updateMember',
      payload: { id: member.id, status: 'suspended' },
    },
  });
  expect(suspended.ok(), await suspended.text()).toBeTruthy();
  expect((await page.request.get('/api/clinic')).status()).toBe(403);
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Entrar na clínica', exact: true }),
  ).toBeVisible();
  const suspendedLogin = await uiLogin(page, email);
  expect(suspendedLogin.status()).toBe(403);
  await expect(
    page.getByRole('alert').filter({ hasText: /suspenso/i }),
  ).toBeVisible();
});
