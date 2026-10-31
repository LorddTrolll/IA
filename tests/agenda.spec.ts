import { test, expect } from '@playwright/test';
import { localDate } from '../src/lib/types';
import { loginDemoAdmin } from './demo-login';

test.beforeEach(async ({ request, context }) => {
  await loginDemoAdmin(request, context);
});

test('agenda cria e confirma um atendimento com persistência', async ({
  page,
  request,
}) => {
  const name = `Paciente Agenda E2E ${Date.now()}`;
  const current = await (await request.get('/api/clinic')).json();
  const dentistId = current.state.members.find(
    (m: { role: string; status: string }) =>
      m.role === 'admin' && m.status === 'active',
  ).id;
  const created = await request.post('/api/clinic', {
    data: { type: 'createPatient', payload: { name, dentistId } },
  });
  expect(created.ok()).toBeTruthy();
  const state = (await created.json()).state;
  const patientId = state.patients.find(
    (p: { name: string }) => p.name === name,
  ).id;
  const future = new Date(localDate() + 'T12:00:00Z');
  future.setUTCDate(future.getUTCDate() + 100);
  const date = future.toISOString().slice(0, 10);
  const taken = state.appointments
    .filter((a: { date: string }) => a.date === date)
    .map((a: { time: string }) => a.time);
  const time = Array.from(
    { length: 16 },
    (_, i) =>
      `${String(8 + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`,
  ).find((t) => !taken.includes(t))!;
  await page.goto('/');
  await page
    .getByRole('heading', { name: 'Dra. Helena Costa', exact: true })
    .waitFor();
  await page
    .getByRole('button', { name: 'Novo atendimento', exact: true })
    .click();
  const dialog = page.getByRole('dialog');
  await dialog
    .getByRole('combobox', { name: 'Paciente', exact: true })
    .selectOption(patientId);
  await dialog
    .getByRole('combobox', { name: 'Dentista', exact: true })
    .selectOption(dentistId);
  await dialog.getByLabel('Data', { exact: true }).fill(date);
  await dialog.getByLabel('Horário', { exact: true }).fill(time);
  await dialog
    .getByRole('combobox', { name: 'Duração', exact: true })
    .selectOption('30');
  await dialog
    .getByLabel('Procedimento', { exact: true })
    .fill('Avaliação de rotina E2E');
  await dialog
    .getByRole('button', { name: 'Agendar atendimento', exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await page
    .getByRole('navigation')
    .getByRole('button', { name: 'Agenda', exact: true })
    .click();
  await page.getByLabel('Data da agenda', { exact: true }).fill(date);
  const row = page.locator('.schedule-item').filter({ hasText: name });
  await expect(row).toBeVisible();
  await row.getByRole('combobox').selectOption('confirmed');
  await expect(row.getByRole('combobox')).toHaveValue('confirmed');
  const latest = (await (await request.get('/api/clinic')).json()).state;
  expect(
    latest.appointments.find(
      (a: { patientId: string }) => a.patientId === patientId,
    ),
  ).toMatchObject({ date, time, duration: 30, status: 'confirmed' });
});
