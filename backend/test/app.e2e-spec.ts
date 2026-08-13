import request from 'supertest';
import type { App } from 'supertest/types';
import {
  createE2eContext,
  destroyE2eContext,
  E2eContext,
} from './postgres-testcontainer';

describe('AppController (e2e)', () => {
  let ctx: E2eContext;

  beforeAll(async () => {
    ctx = await createE2eContext();
  });

  afterAll(async () => {
    await destroyE2eContext(ctx);
  });

  it('GET /api/health reports ok', () => {
    return request(ctx.app.getHttpServer() as App)
      .get('/api/health')
      .expect(200)
      .expect({ status: 'ok' });
  });
});
