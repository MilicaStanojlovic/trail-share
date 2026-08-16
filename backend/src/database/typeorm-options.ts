import { join } from 'node:path';
import type { DataSourceOptions } from 'typeorm';

/**
 * The connection settings both consumers need. `app.module.ts` fills this from
 * `ConfigService`; `data-source.ts` fills it from `process.env` for the CLI,
 * which runs outside the Nest container and has no ConfigService.
 */
export interface DbEnv {
  host: string;
  port: number;
  user: string;
  password: string;
  name: string;
}

/**
 * The single description of how this project talks to Postgres.
 *
 * Both the running app and the TypeORM CLI build their options from here, so
 * the schema the CLI generates migrations against is always the schema the app
 * connects to. Two hand-maintained copies of this config is how they drift.
 */
export function buildTypeOrmOptions(env: DbEnv): DataSourceOptions {
  return {
    type: 'postgres',
    host: env.host,
    port: env.port,
    username: env.user,
    password: env.password,
    database: env.name,

    // The migration chain owns the schema in every environment, development
    // included. `synchronize` is deliberately absent rather than set to false
    // for some environments: the moment it runs anywhere, that environment's
    // schema stops being the one the migrations produce, and the drift is
    // invisible until a query fails somewhere else.
    synchronize: false,

    migrations: [join(__dirname, '..', 'migrations', '*{.ts,.js}')],
    migrationsTableName: 'migrations',
  };
}
