import {
  createHash,
  randomBytes,
  randomUUID,
  scrypt,
  timingSafeEqual,
} from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import type { ClinicState, Member } from '../types';
import { AppError, ensureActive } from './domain';
import { DEMO_SEED_EMAILS } from './seed';
import { demoMode, getDemoDatabase } from './storage';

const SCRYPT_N = 16384;
function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(
      password,
      salt,
      64,
      { N: SCRYPT_N, r: 8, p: 1, maxmem: 64 * 1024 * 1024 },
      (error, key) => (error ? reject(error) : resolve(key)),
    ),
  );
}
const SESSION_TTL_SECONDS = 8 * 60 * 60;
const DEMO_PASSWORD = 'Dentim123!';
const seedStores = new WeakMap<DatabaseSync, DemoAuthStore>();
let dummyHash: Promise<string> | undefined;
const emailKey = (email: string) => email.trim().toLowerCase();
const digest = (value: string) =>
  createHash('sha256').update(value).digest('hex');
const tokenValid = (token: string | undefined): token is string =>
  !!token && /^[A-Za-z0-9_-]{43}$/.test(token);
const demoOnly = () => {
  if (!demoMode())
    throw new AppError(403, 'A autenticação de demonstração está desativada.');
};

/** Salted memory-hard hashes; passwords and raw session tokens never enter clinic state. */
export async function hashPassword(password: string): Promise<string> {
  if (password.length < 8 || password.length > 128)
    throw new AppError(400, 'A senha deve ter entre 8 e 128 caracteres.');
  const salt = randomBytes(16);
  const key = await derive(password, salt);
  return `scrypt$${SCRYPT_N}$8$1$${salt.toString('base64url')}$${key.toString('base64url')}`;
}
export async function verifyPassword(
  password: string,
  encoded: string,
): Promise<boolean> {
  const match =
    /^scrypt\$16384\$8\$1\$([A-Za-z0-9_-]{22})\$([A-Za-z0-9_-]{86})$/.exec(
      encoded,
    );
  if (!match || password.length > 128) return false;
  const expected = Buffer.from(match[2], 'base64url');
  const actual = await derive(password, Buffer.from(match[1], 'base64url'));
  return expected.length === actual.length && timingSafeEqual(actual, expected);
}

type Credential = {
  member_id: string;
  email: string;
  password_hash: string;
  seeded: number;
};
type Session = { member_id: string; expires_at: number };
export type DemoLogin = { user: Member; token: string; maxAge: number };

/** A real SQLite-backed authenticator for fictitious demonstration accounts only. */
export class DemoAuthStore {
  private initialized?: Promise<void>;
  constructor(
    private db: DatabaseSync,
    private clock: () => number = Date.now,
  ) {
    demoOnly();
    db.exec(`
      CREATE TABLE IF NOT EXISTS demo_credentials (
        member_id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE COLLATE NOCASE,
        password_hash TEXT NOT NULL,
        seeded INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS demo_sessions (
        token_hash TEXT PRIMARY KEY,
        member_id TEXT NOT NULL,
        expires_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS demo_sessions_member ON demo_sessions(member_id);
      CREATE TABLE IF NOT EXISTS demo_auth_attempts (
        bucket TEXT PRIMARY KEY,
        window_start INTEGER NOT NULL,
        attempts INTEGER NOT NULL
      );
    `);
  }
  private state(): ClinicState {
    const row = this.db
      .prepare('SELECT data FROM clinic_state WHERE id=?')
      .get('main') as { data: string } | undefined;
    if (!row)
      throw new AppError(503, 'Não foi possível ler os dados de demonstração.');
    return JSON.parse(row.data) as ClinicState;
  }
  private initialize(): Promise<void> {
    demoOnly();
    if (!this.initialized) this.initialized = this.seedCredentials();
    return this.initialized;
  }
  private async seedCredentials(): Promise<void> {
    const state = this.state();
    for (const member of state.members) {
      const seededEmail = DEMO_SEED_EMAILS[member.id];
      if (!seededEmail || emailKey(member.email) !== seededEmail) continue;
      const existing = this.db
        .prepare(
          'SELECT member_id,email,password_hash,seeded FROM demo_credentials WHERE member_id=?',
        )
        .get(member.id) as Credential | undefined;
      if (existing) {
        if (
          existing.seeded &&
          emailKey(existing.email) ===
            seededEmail.replace('@dentim.exemplo', '@lumina.exemplo')
        ) {
          this.db
            .prepare('UPDATE demo_credentials SET email=? WHERE member_id=?')
            .run(seededEmail, member.id);
        }
        continue;
      }
      const encoded = await hashPassword(DEMO_PASSWORD);
      this.db
        .prepare(
          'INSERT OR IGNORE INTO demo_credentials(member_id,email,password_hash,seeded) VALUES (?,?,?,1)',
        )
        .run(member.id, seededEmail, encoded);
    }
  }
  private consume(bucket: string, limit: number, windowMs: number) {
    const now = this.clock();
    const key = digest(bucket);
    const row = this.db
      .prepare(
        `INSERT INTO demo_auth_attempts(bucket,window_start,attempts) VALUES (?,?,1)
      ON CONFLICT(bucket) DO UPDATE SET
      attempts=CASE WHEN demo_auth_attempts.window_start<=? THEN 1 ELSE demo_auth_attempts.attempts+1 END,
      window_start=CASE WHEN demo_auth_attempts.window_start<=? THEN excluded.window_start ELSE demo_auth_attempts.window_start END
      RETURNING attempts`,
      )
      .get(key, now, now - windowMs, now - windowMs) as { attempts: number };
    if (row.attempts > limit)
      throw new AppError(
        429,
        'Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.',
      );
  }
  async login(
    email: string,
    password: string,
    clientId = 'local',
  ): Promise<DemoLogin> {
    await this.initialize();
    const normalized = emailKey(email);
    this.consume(`login-client:${clientId}`, 60, 15 * 60 * 1000);
    this.consume(`login-account:${normalized}`, 30, 15 * 60 * 1000);
    this.consume(`login:${clientId}:${normalized}`, 8, 15 * 60 * 1000);
    const credential = this.db
      .prepare(
        'SELECT member_id,email,password_hash,seeded FROM demo_credentials WHERE email=?',
      )
      .get(normalized) as Credential | undefined;
    if (!dummyHash)
      dummyHash = hashPassword(randomBytes(24).toString('base64url'));
    const correct = await verifyPassword(
      password,
      credential?.password_hash ?? (await dummyHash),
    );
    if (!credential || !correct)
      throw new AppError(401, 'E-mail ou senha inválidos.');
    const user = this.state().members.find(
      (member) => member.id === credential.member_id,
    );
    if (!user) throw new AppError(401, 'E-mail ou senha inválidos.');
    ensureActive(user);
    this.db
      .prepare('DELETE FROM demo_auth_attempts WHERE bucket IN (?,?)')
      .run(
        digest(`login:${clientId}:${normalized}`),
        digest(`login-account:${normalized}`),
      );
    const token = randomBytes(32).toString('base64url');
    const now = this.clock();
    this.db.prepare('DELETE FROM demo_sessions WHERE expires_at<=?').run(now);
    this.db
      .prepare(
        'INSERT INTO demo_sessions(token_hash,member_id,expires_at) VALUES (?,?,?)',
      )
      .run(digest(token), user.id, now + SESSION_TTL_SECONDS * 1000);
    return { user, token, maxAge: SESSION_TTL_SECONDS };
  }
  async currentUser(token?: string): Promise<Member> {
    demoOnly();
    if (!tokenValid(token))
      throw new AppError(401, 'Entre na sua conta para continuar.');
    const session = this.db
      .prepare(
        'SELECT member_id,expires_at FROM demo_sessions WHERE token_hash=?',
      )
      .get(digest(token)) as Session | undefined;
    if (!session || session.expires_at <= this.clock()) {
      if (session)
        this.db
          .prepare('DELETE FROM demo_sessions WHERE token_hash=?')
          .run(digest(token));
      throw new AppError(401, 'Sua sessão expirou. Entre novamente.');
    }
    const user = this.state().members.find(
      (member) => member.id === session.member_id,
    );
    if (!user) {
      this.db
        .prepare('DELETE FROM demo_sessions WHERE token_hash=?')
        .run(digest(token));
      throw new AppError(401, 'Sua sessão expirou. Entre novamente.');
    }
    if (user.status !== 'active') {
      this.db
        .prepare('DELETE FROM demo_sessions WHERE member_id=?')
        .run(user.id);
      ensureActive(user);
    }
    return user;
  }
  async logout(token?: string): Promise<void> {
    demoOnly();
    if (tokenValid(token))
      this.db
        .prepare('DELETE FROM demo_sessions WHERE token_hash=?')
        .run(digest(token));
  }
  async signup(
    input: { name: string; email: string; password: string },
    clientId = 'local',
  ): Promise<void> {
    await this.initialize();
    this.consume(`signup:${clientId}`, 10, 60 * 60 * 1000);
    const email = emailKey(input.email);
    // The route returns the same result for an existing address, without replacing its password.
    if (this.state().members.some((member) => emailKey(member.email) === email))
      return;
    const passwordHash = await hashPassword(input.password);
    const user: Member = {
      id: randomUUID(),
      name: input.name,
      email,
      role: 'dentist',
      status: 'pending',
      finance: false,
      color: '#d5e7cf',
    };
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const state = this.state();
      if (!state.members.some((member) => emailKey(member.email) === email)) {
        state.members.push(user);
        state.audit.unshift({
          id: randomUUID(),
          action: 'signup',
          authorId: user.id,
          createdAt: new Date(this.clock()).toISOString(),
          entityId: user.id,
        });
        this.db
          .prepare(
            'INSERT INTO demo_credentials(member_id,email,password_hash,seeded) VALUES (?,?,?,0)',
          )
          .run(user.id, email, passwordHash);
        this.db
          .prepare(
            'UPDATE clinic_state SET data=?,revision=revision+1 WHERE id=?',
          )
          .run(JSON.stringify(state), 'main');
      }
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
}

export async function getDemoAuth(): Promise<DemoAuthStore> {
  demoOnly();
  const db = await getDemoDatabase();
  let store = seedStores.get(db);
  if (!store) {
    store = new DemoAuthStore(db);
    seedStores.set(db, store);
  }
  return store;
}
/** Client IP is only a rate-limit hint; account-wide limits also prevent header-spoof bypass. */
export function authClientId(request: Request): string {
  return (
    request.headers.get('x-real-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'local'
  ).slice(0, 128);
}
