import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkOrigin, readJson } from '../src/lib/server/context';
import { AppError } from '../src/lib/server/domain';
const reject = (fn: () => unknown, status: number) =>
  assert.throws(fn, (e) => e instanceof AppError && e.status === status);
test('origin uses the real Host when Next binds 0.0.0.0 and refuses unrelated origins', () => {
  const before = process.env.APP_URL;
  delete process.env.APP_URL;
  try {
    assert.doesNotThrow(() =>
      checkOrigin(
        new Request('http://0.0.0.0:3000/api/clinic', {
          headers: { host: '127.0.0.1:3000', origin: 'http://127.0.0.1:3000' },
        }),
      ),
    );
    assert.doesNotThrow(() =>
      checkOrigin(
        new Request('http://0.0.0.0:3000/api/clinic', {
          headers: { host: 'clinic.example', origin: 'https://clinic.example' },
        }),
      ),
    );
    reject(
      () =>
        checkOrigin(
          new Request('http://0.0.0.0:3000/api/clinic', {
            headers: {
              host: 'clinic.example',
              origin: 'https://attacker.example',
              'x-forwarded-host': 'attacker.example',
            },
          }),
        ),
      403,
    );
    reject(
      () =>
        checkOrigin(
          new Request('http://0.0.0.0:3000/api/clinic', {
            headers: { host: 'clinic.example', origin: 'null' },
          }),
        ),
      403,
    );
    reject(
      () =>
        checkOrigin(
          new Request('https://clinic.example/api/clinic', {
            headers: {
              host: 'clinic.example',
              origin: 'http://clinic.example',
            },
          }),
        ),
      403,
    );
    reject(
      () =>
        checkOrigin(
          new Request('http://0.0.0.0:3000/api/clinic', {
            headers: { host: 'clinic.example', 'sec-fetch-site': 'cross-site' },
          }),
        ),
      403,
    );
  } finally {
    if (before === undefined) delete process.env.APP_URL;
    else process.env.APP_URL = before;
  }
});
test('configured APP_URL pins the origin even when a Host header claims another site', () => {
  const before = process.env.APP_URL;
  process.env.APP_URL = 'https://clinic.example';
  try {
    assert.doesNotThrow(() =>
      checkOrigin(
        new Request('http://0.0.0.0:3000/api/clinic', {
          headers: { host: '0.0.0.0:3000', origin: 'https://clinic.example' },
        }),
      ),
    );
    reject(
      () =>
        checkOrigin(
          new Request('http://0.0.0.0:3000/api/clinic', {
            headers: {
              host: 'attacker.example',
              origin: 'https://attacker.example',
            },
          }),
        ),
      403,
    );
    assert.doesNotThrow(() =>
      checkOrigin(new Request('http://0.0.0.0:3000/api/clinic')),
    );
  } finally {
    if (before === undefined) delete process.env.APP_URL;
    else process.env.APP_URL = before;
  }
});
test('JSON reader rejects invalid bodies and bounds actual streamed bytes without Content-Length', async () => {
  assert.deepEqual(
    await readJson(
      new Request('http://localhost', { method: 'POST', body: '{"ok":true}' }),
    ),
    { ok: true },
  );
  await assert.rejects(
    readJson(
      new Request('http://localhost', { method: 'POST', body: 'invalid' }),
    ),
    (e) => e instanceof AppError && e.status === 400,
  );
  await assert.rejects(
    readJson(
      new Request('http://localhost', {
        method: 'POST',
        body: 'x'.repeat(100001),
      }),
    ),
    (e) => e instanceof AppError && e.status === 413,
  );
});
