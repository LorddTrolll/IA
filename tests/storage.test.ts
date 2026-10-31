import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  demoMode,
  loadFullState,
  saveFullState,
} from '../src/lib/server/storage';
import { applyAction } from '../src/lib/server/domain';
test('SQLite persists records and rejects stale revisions without losing committed data', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'lumina-storage-test-'));
  const previous = {
    mode: process.env.DEMO_MODE,
    dir: process.env.DEMO_DATA_DIR,
  };
  process.env.DEMO_MODE = 'true';
  process.env.DEMO_DATA_DIR = directory;
  try {
    const original = await loadFullState();
    const next = applyAction(original.state, original.state.members[0], {
      type: 'createPatient',
      payload: {
        name: 'Paciente Persistido',
        dentistId: original.state.members[0].id,
      },
    });
    assert.equal(await saveFullState(next, original.revision), true);
    assert.equal(await saveFullState(original.state, original.revision), false);
    const read = await loadFullState();
    assert.equal(read.revision, original.revision + 1);
    assert.equal(read.state.patients.at(-1)!.name, 'Paciente Persistido');
  } finally {
    if (previous.mode === undefined) delete process.env.DEMO_MODE;
    else process.env.DEMO_MODE = previous.mode;
    if (previous.dir === undefined) delete process.env.DEMO_DATA_DIR;
    else process.env.DEMO_DATA_DIR = previous.dir;
    rmSync(directory, { recursive: true, force: true });
  }
});
test('explicit production does not fall back to demonstration data', () => {
  const before = process.env.DEMO_MODE;
  try {
    process.env.DEMO_MODE = 'false';
    assert.equal(demoMode(), false);
  } finally {
    if (before === undefined) delete process.env.DEMO_MODE;
    else process.env.DEMO_MODE = before;
  }
});
