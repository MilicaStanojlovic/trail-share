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
  process.env.DB_HOST = container.getHost();
  process.env.DB_PORT = String(container.getPort());
  process.env.DB_USER = container.getUsername();
  process.env.DB_PASSWORD = container.getPassword();
  process.env.DB_NAME = container.getDatabase();
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
