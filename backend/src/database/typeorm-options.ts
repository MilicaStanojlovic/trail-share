import { readFileSync } from 'node:fs';
import { join } from 'node:path';
// The postgres-specific options type, not the DataSourceOptions union: `ssl`
// and `uuidExtension` exist only on this member of it.
import type { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';

/**
 * How to negotiate TLS, named after libpq's `sslmode` so the values mean what a
 * Postgres user expects.
 *
 * - `disable`   plaintext. Local containers only — the e2e Testcontainers DB.
 * - `require`   TLS with the server certificate verified. The right setting for
 *               Supabase, and the one to try first.
 * - `no-verify` TLS with verification switched off. Only if `require` fails
 *               because the server presents a certificate Node cannot chain to
 *               a public CA. It still encrypts, but it cannot detect a man in
 *               the middle, so it is a fallback and never a default.
 */
export type SslMode = 'disable' | 'require' | 'no-verify';

export const SSL_MODES: readonly SslMode[] = [
  'disable',
  'require',
  'no-verify',
];

export function parseSslMode(value: string | undefined): SslMode {
  if (value === undefined || value === '') {
    return 'disable';
  }
  if (!SSL_MODES.includes(value as SslMode)) {
    throw new Error(
      `DB_SSL must be one of ${SSL_MODES.join(', ')} — got "${value}".`,
    );
  }
  return value as SslMode;
}

export interface DbEnv {
  /** Full Postgres connection URL — for Supabase, the session pooler string. */
  url: string | undefined;
  ssl: SslMode;
  /**
   * Path to a CA certificate in PEM form. Supabase's poolers present a chain
   * rooted in Supabase's own CA, which is not in Node's bundled trust store, so
   * plain `require` fails with SELF_SIGNED_CERT_IN_CHAIN. Point this at the
   * certificate from Settings -> Database -> SSL Configuration and `require`
   * verifies properly against it.
   */
  sslCaPath?: string;
}

function toSslOption(
  mode: SslMode,
  caPath: string | undefined,
): PostgresConnectionOptions['ssl'] {
  switch (mode) {
    case 'disable':
      return false;
    case 'require':
      // Reading at startup rather than lazily: a missing or unreadable CA file
      // should stop the app with an obvious error, not silently fall back to an
      // unverified connection.
      return {
        rejectUnauthorized: true,
        ...(caPath ? { ca: readFileSync(caPath, 'utf8') } : {}),
      };
    case 'no-verify':
      return { rejectUnauthorized: false };
  }
}

/**
 * The single description of how this project talks to Postgres.
 *
 * Both the running app and the TypeORM CLI build their options from here, so
 * the schema the CLI generates migrations against is always the schema the app
 * connects to. Two hand-maintained copies of this config is how they drift.
 */
export function buildTypeOrmOptions(env: DbEnv): PostgresConnectionOptions {
  if (!env.url) {
    throw new Error(
      'DATABASE_URL is not set. Copy backend/.env.example to backend/.env and ' +
        'put your Supabase connection string in it.',
    );
  }

  return {
    type: 'postgres',
    url: env.url,
    ssl: toSslOption(env.ssl, env.sslCaPath),

    // The migration chain owns the schema in every environment. `synchronize`
    // is deliberately absent rather than set to false for some environments:
    // the moment it runs anywhere, that environment's schema stops being the
    // one the migrations produce, and the drift is invisible until a query
    // fails somewhere else.
    synchronize: false,

    // Write uuid defaults as `gen_random_uuid()` rather than
    // `uuid_generate_v4()`. gen_random_uuid() has been core Postgres since 13,
    // so it needs no extension and no search_path entry. uuid-ossp needs both:
    // on Supabase it is installed into the `extensions` schema, and
    // "function uuid_generate_v4() does not exist" is a well-known failure
    // there. Nothing here installs pgcrypto — this option only selects which
    // expression TypeORM writes into generated migrations.
    uuidExtension: 'pgcrypto',

    migrations: [join(__dirname, '..', 'migrations', '*{.ts,.js}')],
    migrationsTableName: 'migrations',
  };
}
