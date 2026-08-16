import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';

/**
 * Boots a throwaway Postgres container and a Nest app wired to it, so e2e specs
 * never touch the local dev database. Requires a running Docker daemon.
 *
 * Container start is slow (image pull on first run) — jest-e2e.json raises the
 * timeout and pins maxWorkers to 1 so suites reuse the machine serially.
 */
export interface E2eContext {
  app: INestApplication;
  container: StartedPostgreSqlContainer;
}

export async function createE2eContext(): Promise<E2eContext> {
  const container = await new PostgreSqlContainer('postgres:16-alpine').start();

  // AppModule reads connection settings from env via ConfigService, so pointing
  // the env at the container is enough to redirect the whole app.
  //
  // This assignment is a safety barrier, not just configuration. AppModule
  // calls ConfigModule.forRoot(), which loads backend/.env — and that file
  // points at the live Supabase database. Left to itself, this suite would run
  // 77 destructive specs against production data.
  //
  // Setting the variable here is what prevents it: dotenv never overwrites a
  // variable that is already present in process.env, so the container URL wins
  // over the one in .env. Deleting process.env.DATABASE_URL instead would not
  // work — dotenv runs later, inside the AppModule import below, and would
  // simply put the Supabase value back.
  process.env.DATABASE_URL = container.getConnectionUri();
  process.env.DB_SSL = 'disable';
  process.env.NODE_ENV = 'test';

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  await app.init();

  return { app, container };
}

export async function destroyE2eContext(ctx: E2eContext): Promise<void> {
  await ctx.app.close();
  await ctx.container.stop();
}
