import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { ClinicState, Member } from '../types';
import { AppError } from './domain';
import { createDemoState, emptyState, migrateDemoSeedEmails } from './seed';

export function demoMode(): boolean {
  if (process.env.DEMO_MODE === 'true') return true;
  if (process.env.DEMO_MODE === 'false') return false;
  if (
    process.env.SUPABASE_URL ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
    return false;
  return process.env.NODE_ENV !== 'production';
}
export function requireProductionConfig() {
  if (
    !process.env.SUPABASE_URL ||
    !process.env.SUPABASE_ANON_KEY ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  )
    throw new AppError(
      503,
      'Configure SUPABASE_URL, SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY para usar dados reais. Para demonstração, defina DEMO_MODE=true.',
    );
}
const fetchWithTimeout: typeof fetch = (input, init) =>
  fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(12000) });
export function publicClient(): SupabaseClient {
  requireProductionConfig();
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: fetchWithTimeout },
    },
  );
}
export function adminClient(): SupabaseClient {
  requireProductionConfig();
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: fetchWithTimeout },
    },
  );
}
const demoDatabases = new Map<string, Promise<DatabaseSync>>();
async function openDemoDatabase(folder: string): Promise<DatabaseSync> {
  const { DatabaseSync } = await import('node:sqlite');
  mkdirSync(folder, { recursive: true });
  const db = new DatabaseSync(join(folder, 'clinic.sqlite'));
  db.exec(
    'PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS clinic_state (id TEXT PRIMARY KEY, revision INTEGER NOT NULL DEFAULT 0, data TEXT NOT NULL)',
  );
  db.exec('BEGIN IMMEDIATE');
  try {
    const row = db
      .prepare('SELECT data, revision FROM clinic_state WHERE id=?')
      .get('main') as { data: string; revision: number } | undefined;
    if (!row) {
      db.prepare(
        'INSERT INTO clinic_state (id,revision,data) VALUES (?,0,?)',
      ).run('main', JSON.stringify(createDemoState()));
    } else {
      const state = JSON.parse(row.data) as ClinicState;
      if (migrateDemoSeedEmails(state)) {
        db.prepare(
          'UPDATE clinic_state SET data=?, revision=revision+1 WHERE id=?',
        ).run(JSON.stringify(state), 'main');
      }
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    db.close();
    throw error;
  }
  return db;
}
/** Demo-only database; never initializes sample credentials or files in production. */
export async function getDemoDatabase(): Promise<DatabaseSync> {
  if (!demoMode())
    throw new AppError(403, 'O armazenamento de demonstração está desativado.');
  const folder = resolve(
    process.env.DEMO_DATA_DIR || join(process.cwd(), '.data'),
  );
  let opening = demoDatabases.get(folder);
  if (!opening) {
    opening = openDemoDatabase(folder);
    demoDatabases.set(folder, opening);
    opening.catch(() => demoDatabases.delete(folder));
  }
  return opening;
}
export type Stored = { state: ClinicState; revision: number };
export async function loadFullState(): Promise<Stored> {
  if (demoMode()) {
    const db = await getDemoDatabase();
    const row = db
      .prepare('SELECT data,revision FROM clinic_state WHERE id=?')
      .get('main') as { data: string; revision: number };
    return { state: JSON.parse(row.data), revision: row.revision };
  }
  const client = adminClient();
  // One SQL snapshot pairs permissions with the exact data revision. A role change
  // also increments that revision, so a concurrent mutation must reauthorize.
  const { data: row, error } = await client.rpc('load_clinic_state');
  if (error || !row)
    throw new AppError(
      503,
      'Não foi possível acessar o banco. Verifique a conexão e aplique a migração SQL.',
    );
  const state = {
    ...emptyState(),
    ...(row.data as ClinicState),
    members: row.profiles as Member[],
  };
  return { state, revision: row.revision };
}
export async function saveFullState(
  state: ClinicState,
  revision: number,
): Promise<boolean> {
  if (demoMode()) {
    const db = await getDemoDatabase();
    const result = db
      .prepare(
        'UPDATE clinic_state SET data=?,revision=revision+1 WHERE id=? AND revision=?',
      )
      .run(JSON.stringify(state), 'main', revision);
    return Number(result.changes) === 1;
  }
  const client = adminClient();
  const data = { ...state, members: [] };
  const { data: rows, error } = await client
    .from('clinic_state')
    .update({ data, revision: revision + 1 })
    .eq('id', 'main')
    .eq('revision', revision)
    .select('revision');
  if (error)
    throw new AppError(
      503,
      'Não foi possível salvar os dados. Tente novamente.',
    );
  return !!rows?.length;
}
