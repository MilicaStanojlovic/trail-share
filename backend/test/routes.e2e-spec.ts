import request from 'supertest';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import {
  createE2eContext,
  destroyE2eContext,
  E2eContext,
} from './postgres-testcontainer';
import { seedDatabase } from '../src/seed/seed';
import type { RouteDto } from '../src/routes/dto/route-dto';

interface ErrorResponseBody {
  statusCode: number;
  message: string;
}

describe('RoutesController (e2e)', () => {
  let ctx: E2eContext;
  // Captured by the list case and reused by the shape and detail cases.
  let routes: RouteDto[];
  let firstRouteId: string;

  // Every route endpoint is deliberately public; no Authorization header is
  // sent in any request below.

  beforeAll(async () => {
    ctx = await createE2eContext();
    await seedDatabase(ctx.app.get(DataSource));
  });

  afterAll(async () => {
    await destroyE2eContext(ctx);
  });

  it('GET /api/routes returns 200 with an array of exactly 6 routes', async () => {
    const response = await request(ctx.app.getHttpServer() as App)
      .get('/api/routes')
      .expect(200);

    routes = response.body as RouteDto[];
    expect(routes).toHaveLength(6);
    expect(routes[0].name).toBe('Medvednica Ridge Loop');
  });

  it('the first route carries the decorated shape', () => {
    const route = routes[0];

    expect(route.id).toEqual(expect.any(String));
    expect(route.name).toBe('Medvednica Ridge Loop');
    expect(route.author).toEqual({
      id: expect.any(String) as string,
      displayName: 'Ivana Kovač',
    });
    expect(Object.keys(route.author).sort()).toEqual(['displayName', 'id']);

    expect(route.waypoints).toHaveLength(8);
    expect(route.waypoints[0]).toEqual([45.9002, 15.9432]);

    expect(route.waypointCount).toBe(8);
    expect(route.distanceKm).toBe(7.5);
    expect(route.distanceLabel).toBe('7.5 km');
    expect(route.elevationM).toBe(440);
    expect(route.elevationM % 10).toBe(0);
    expect(route.elevationLabel).toBe(`${route.elevationM} m`);
    expect(route.durationLabel).toBe('2 h 30 min');
    expect(new Date(route.createdAt).toISOString()).toBe(route.createdAt);

    firstRouteId = route.id;
  });

  // tourCount stopped being a hardcoded 0 once tours existed. Asserting the
  // seeded literal (2) would expire the day the seed dates fall behind
  // CURRENT_DATE, so the invariant is checked instead: a route card's count is
  // always the length of the list on its detail page.
  it('the first route tourCount equals the length of its upcoming tour list', async () => {
    const response = await request(ctx.app.getHttpServer() as App)
      .get(`/api/routes/${firstRouteId}/tours`)
      .expect(200);

    const tours = response.body as unknown[];
    expect(routes[0].tourCount).toBe(tours.length);
  });

  it('GET /api/routes?difficulty=Easy returns the easy routes in order', async () => {
    const response = await request(ctx.app.getHttpServer() as App)
      .get('/api/routes')
      .query({ difficulty: 'Easy' })
      .expect(200);

    const body = response.body as RouteDto[];
    expect(body.map((route) => route.name)).toEqual([
      'Sava Riverside Cruise',
      'Jarun Lake Circuit',
    ]);
  });

  it('GET /api/routes?search=LAKE returns one case-insensitive match', async () => {
    const response = await request(ctx.app.getHttpServer() as App)
      .get('/api/routes')
      .query({ search: 'LAKE' })
      .expect(200);

    const body = response.body as RouteDto[];
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe('Jarun Lake Circuit');
  });

  it('GET /api/routes?difficulty=Extreme returns 400', () => {
    return request(ctx.app.getHttpServer() as App)
      .get('/api/routes')
      .query({ difficulty: 'Extreme' })
      .expect(400);
  });

  it('GET /api/routes?bogus=1 returns 400 because the global validation pipe runs with forbidNonWhitelisted', async () => {
    const response = await request(ctx.app.getHttpServer() as App)
      .get('/api/routes')
      .query({ bogus: 1 })
      .expect(400);

    const body = response.body as ErrorResponseBody;
    expect(body.statusCode).toBe(400);
  });

  it('GET /api/routes/:id returns the same decorated shape', async () => {
    const response = await request(ctx.app.getHttpServer() as App)
      .get(`/api/routes/${firstRouteId}`)
      .expect(200);

    const route = response.body as RouteDto;
    expect(route.id).toBe(firstRouteId);
    expect(route.name).toBe('Medvednica Ridge Loop');
    expect(Object.keys(route.author).sort()).toEqual(['displayName', 'id']);
    expect(route.waypoints).toHaveLength(8);
  });

  it('GET /api/routes/not-a-uuid returns 400', async () => {
    const response = await request(ctx.app.getHttpServer() as App)
      .get('/api/routes/not-a-uuid')
      .expect(400);

    const body = response.body as ErrorResponseBody;
    expect(body.statusCode).toBe(400);
  });

  it('GET /api/routes/00000000-0000-4000-8000-000000000000 returns 404', async () => {
    const response = await request(ctx.app.getHttpServer() as App)
      .get('/api/routes/00000000-0000-4000-8000-000000000000')
      .expect(404);

    const body = response.body as ErrorResponseBody;
    expect(body.message).toBe('Route not found');
  });

  it('seedDatabase is idempotent', async () => {
    const result = await seedDatabase(ctx.app.get(DataSource));
    expect(result).toEqual({
      usersCreated: 0,
      routesCreated: 0,
      toursCreated: 0,
      bookingsCreated: 0,
    });

    const response = await request(ctx.app.getHttpServer() as App)
      .get('/api/routes')
      .expect(200);

    const body = response.body as RouteDto[];
    expect(body).toHaveLength(6);
  });
});
