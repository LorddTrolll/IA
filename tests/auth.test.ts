import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import {
  DemoAuthStore,
  hashPassword,
  verifyPassword,
} from '../src/lib/server/demo-auth';
import { createDemoState, migrateDemoSeedEmails } from '../src/lib/server/seed';
import { applyAction, AppError, visibleState } from '../src/lib/server/domain';
import type { ClinicState } from '../src/lib/types';

const rejectsStatus = (status: number) => (error: unknown) =>
  error instanceof AppError && error.status === status;
async function withDemo(
  run: (
    db: DatabaseSync,
    store: DemoAuthStore,
    setTime: (time: number) => void,
  ) => Promise<void>,
) {
  const previous = process.env.DEMO_MODE;
  process.env.DEMO_MODE = 'true';
  const db = new DatabaseSync(':memory:');
  db.exec(
    'CREATE TABLE clinic_state(id TEXT PRIMARY KEY,revision INTEGER NOT NULL,data TEXT NOT NULL)',
  );
  db.prepare('INSERT INTO clinic_state(id,revision,data) VALUES(?,0,?)').run(
    'main',
    JSON.stringify(createDemoState()),
  );
  let now = Date.now();
  const store = new DemoAuthStore(db, () => now);
  try {
    await run(db, store, (time) => {
      now = time;
    });
  } finally {
    db.close();
    if (previous === undefined) delete process.env.DEMO_MODE;
    else process.env.DEMO_MODE = previous;
  }
}
const readState = (db: DatabaseSync) =>
  JSON.parse(
    (
      db.prepare('SELECT data FROM clinic_state WHERE id=?').get('main') as {
        data: string;
      }
    ).data,
  ) as ClinicState;
const update = (db: DatabaseSync, state: ClinicState) =>
  db
    .prepare('UPDATE clinic_state SET data=?,revision=revision+1 WHERE id=?')
    .run(JSON.stringify(state), 'main');

test('password hashes are salted and verify only the matching password', async () => {
  const a = await hashPassword('Teste-Senha-123!'),
    b = await hashPassword('Teste-Senha-123!');
  assert.notEqual(a, b);
  assert(!a.includes('Teste-Senha-123!'));
  assert.equal(await verifyPassword('Teste-Senha-123!', a), true);
  assert.equal(await verifyPassword('Outra-Senha-123!', a), false);
  assert.equal(await verifyPassword('Teste-Senha-123!', 'invalid'), false);
  await assert.rejects(hashPassword('curta'), rejectsStatus(400));
});
test('demo users log in separately with opaque hashed sessions and authorized patient scopes', async () =>
  withDemo(async (db, store) => {
    await assert.rejects(store.currentUser(), rejectsStatus(401));
    await assert.rejects(store.currentUser('admin-demo'), rejectsStatus(401));
    const admin = await store.login(
      'helena@dentim.exemplo',
      'Dentim123!',
      'test-admin',
    );
    const dentist = await store.login(
      'lucas@dentim.exemplo',
      'Dentim123!',
      'test-dentist',
    );
    assert.notEqual(admin.token, dentist.token);
    assert.match(admin.token, /^[A-Za-z0-9_-]{43}$/);
    assert.equal((await store.currentUser(admin.token)).id, 'admin-demo');
    assert.equal((await store.currentUser(dentist.token)).id, 'dentist-1');
    const scoped = visibleState(
      readState(db),
      await store.currentUser(dentist.token),
    );
    assert(scoped.patients.length > 0);
    assert(
      scoped.patients.every((patient) => patient.dentistId === 'dentist-1'),
    );
    const stored = db.prepare('SELECT token_hash FROM demo_sessions').all() as {
      token_hash: string;
    }[];
    assert(
      stored.every(
        (row) =>
          row.token_hash !== admin.token && row.token_hash !== dentist.token,
      ),
    );
    assert(stored.every((row) => /^[a-f0-9]{64}$/.test(row.token_hash)));
    const credential = db
      .prepare('SELECT password_hash FROM demo_credentials WHERE member_id=?')
      .get('admin-demo') as { password_hash: string };
    assert(credential.password_hash.startsWith('scrypt$'));
    assert(!credential.password_hash.includes('Dentim123!'));
    assert(!JSON.stringify(readState(db)).includes(admin.token));
  }));
test('logout revokes exactly its own session and credentials persist across authenticator instances', async () =>
  withDemo(async (db, store) => {
    const admin = await store.login(
      'helena@dentim.exemplo',
      'Dentim123!',
      'test-admin',
    );
    const dentist = await store.login(
      'lucas@dentim.exemplo',
      'Dentim123!',
      'test-dentist',
    );
    await store.logout(admin.token);
    await assert.rejects(store.currentUser(admin.token), rejectsStatus(401));
    assert.equal((await store.currentUser(dentist.token)).id, 'dentist-1');
    const restored = new DemoAuthStore(db);
    assert.equal((await restored.currentUser(dentist.token)).id, 'dentist-1');
    assert.equal(
      (
        await restored.login(
          'helena@dentim.exemplo',
          'Dentim123!',
          'test-restored',
        )
      ).user.id,
      'admin-demo',
    );
  }));
test('expired sessions are rejected and removed without waiting in real time', async () =>
  withDemo(async (db, store, setTime) => {
    const login = await store.login(
      'helena@dentim.exemplo',
      'Dentim123!',
      'test-expiry',
    );
    assert.equal(login.maxAge, 8 * 60 * 60);
    setTime(Date.now() + login.maxAge * 1000 + 1000);
    await assert.rejects(store.currentUser(login.token), rejectsStatus(401));
    assert.equal(
      (
        db.prepare('SELECT COUNT(*) AS count FROM demo_sessions').get() as {
          count: number;
        }
      ).count,
      0,
    );
  }));
test('signup creates a pending dentist and approval, suspension and duplicate registration respect authorization', async () =>
  withDemo(async (db, store) => {
    const input = {
      name: 'Dra. Nova Conta',
      email: 'nova@dentim.exemplo',
      password: 'Senha-Nova-123!',
    };
    await store.signup(input, 'test-signup');
    let state = readState(db);
    const member = state.members.find((m) => m.email === input.email)!;
    assert.equal(member.role, 'dentist');
    assert.equal(member.status, 'pending');
    assert.equal(member.finance, false);
    await assert.rejects(
      store.login(input.email, 'Senha-Incorreta-123!', 'test-new'),
      rejectsStatus(401),
    );
    await assert.rejects(
      store.login(input.email, input.password, 'test-new'),
      rejectsStatus(403),
    );
    state = applyAction(state, state.members[0], {
      type: 'updateMember',
      payload: { id: member.id, status: 'active' },
    });
    update(db, state);
    const login = await store.login(input.email, input.password, 'test-new');
    assert.equal((await store.currentUser(login.token)).id, member.id);
    await store.signup(
      { ...input, password: 'Nao-Altere-123!' },
      'test-signup',
    );
    await assert.rejects(
      store.login(input.email, 'Nao-Altere-123!', 'test-duplicate'),
      rejectsStatus(401),
    );
    state = readState(db);
    state = applyAction(state, state.members[0], {
      type: 'updateMember',
      payload: { id: member.id, status: 'suspended' },
    });
    update(db, state);
    await assert.rejects(store.currentUser(login.token), rejectsStatus(403));
    await assert.rejects(
      store.login(input.email, input.password, 'test-suspended'),
      rejectsStatus(403),
    );
    state = applyAction(state, state.members[0], {
      type: 'updateMember',
      payload: { id: member.id, status: 'active' },
    });
    update(db, state);
    await assert.rejects(
      store.currentUser(login.token),
      rejectsStatus(401),
      'blocked session stays revoked after reactivation',
    );
  }));
test('bad credentials use generic errors and repeated failures are rate limited with window expiry', async () =>
  withDemo(async (_db, store, setTime) => {
    for (let attempt = 0; attempt < 8; attempt++)
      await assert.rejects(
        store.login('helena@dentim.exemplo', 'incorreta', 'test-throttle'),
        (error) =>
          error instanceof AppError &&
          error.status === 401 &&
          error.message === 'E-mail ou senha inválidos.',
      );
    await assert.rejects(
      store.login('helena@dentim.exemplo', 'incorreta', 'test-throttle'),
      rejectsStatus(429),
    );
    await assert.rejects(
      store.login('desconhecida@dentim.exemplo', 'incorreta', 'test-unknown'),
      (error) =>
        error instanceof AppError &&
        error.status === 401 &&
        error.message === 'E-mail ou senha inválidos.',
    );
    setTime(Date.now() + 15 * 60 * 1000 + 1000);
    assert.equal(
      (
        await store.login(
          'helena@dentim.exemplo',
          'Dentim123!',
          'test-throttle',
        )
      ).user.id,
      'admin-demo',
    );
  }));
test('demo authentication helpers cannot create sessions or accounts in production mode', async () =>
  withDemo(async (_db, store) => {
    process.env.DEMO_MODE = 'false';
    await assert.rejects(
      store.login('helena@dentim.exemplo', 'Dentim123!'),
      rejectsStatus(403),
    );
    await assert.rejects(store.currentUser('x'.repeat(43)), rejectsStatus(403));
    await assert.rejects(
      store.signup({
        name: 'Não criar',
        email: 'nunca@dentim.exemplo',
        password: 'Nao-Criar-123!',
      }),
      rejectsStatus(403),
    );
  }));
test('legacy demo email migration preserves custom addresses and unrelated identities', () => {
  const state = createDemoState();
  state.members[0].email = 'helena@lumina.exemplo';
  state.members[1].email = 'meu-endereco@exemplo.com';
  assert.equal(migrateDemoSeedEmails(state), true);
  assert.equal(state.members[0].email, 'helena@dentim.exemplo');
  assert.equal(state.members[1].email, 'meu-endereco@exemplo.com');
  assert.equal(migrateDemoSeedEmails(state), false);
});
