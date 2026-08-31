import request from 'supertest';
import type { App } from 'supertest/types';
import {
  createE2eContext,
  destroyE2eContext,
  E2eContext,
  TEST_PASSWORD,
} from './postgres-testcontainer';
import { UserRole } from '../src/users/user.entity';
import type { RouteDto } from '../src/routes/dto/route-dto';
import type { CreateRouteDto } from '../src/routes/dto/create-route.dto';
import { RouteDifficulty, RouteActivity } from '../src/routes/route.entity';

interface AuthResponseBody {
  token: string;
  user: {
    id: string;
    displayName: string;
    email: string;
    role: UserRole;
  };
}

interface ErrorResponseBody {
  statusCode: number;
  message: string;
}

const waypoints: [number, number][] = [
  [45.9002, 15.9432],
  [45.9068, 15.9508],
  [45.9121, 15.9601],
];

const validBody: CreateRouteDto = {
  name: 'Sljeme Summit Climb',
  description: 'Steep but shaded.',
  difficulty: RouteDifficulty.MODERATE,
  activity: RouteActivity.HIKING,
  waypoints,
};

const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const distanceLabelRegex = /^\d+\.\d km$/;
const durationLabelRegex = /^(\d+ h( \d+ min)?|\d+ min)$/;

describe('RoutesController create (e2e)', () => {
  let ctx: E2eContext;
  let guideId: string;
  let guideToken: string;
  let hikerId: string;
  let hikerToken: string;
  let guideRoute: RouteDto;
  let hikerRoute: RouteDto;
  const createdRouteIds: string[] = [];

  beforeAll(async () => {
    ctx = await createE2eContext();

    const guideResponse = await request(ctx.app.getHttpServer() as App)
      .post('/api/auth/register')
      .send({
        displayName: 'Ivana Kovac',
        email: 'guide-create@trailshare.hr',
        password: TEST_PASSWORD,
        role: UserRole.GUIDE,
      })
      .expect(201);

    const guideBody = guideResponse.body as AuthResponseBody;
    guideToken = guideBody.token;
    guideId = guideBody.user.id;

    const hikerResponse = await request(ctx.app.getHttpServer() as App)
      .post('/api/auth/register')
      .send({
        displayName: 'Luka Horvat',
        email: 'hiker-create@trailshare.hr',
        password: TEST_PASSWORD,
        role: UserRole.HIKER,
      })
      .expect(201);

    const hikerBody = hikerResponse.body as AuthResponseBody;
    hikerToken = hikerBody.token;
    hikerId = hikerBody.user.id;
  });

  afterAll(async () => {
    await destroyE2eContext(ctx);
  });

  it('POST /api/routes with no Authorization header returns 401 and body.message is Unauthorized', async () => {
    const response = await request(ctx.app.getHttpServer() as App)
      .post('/api/routes')
      .send(validBody)
      .expect(401);

    const body = response.body as ErrorResponseBody;
    expect(body.message).toBe('Unauthorized');
  });

  it('POST /api/routes with a garbage bearer token returns 401', () => {
    return request(ctx.app.getHttpServer() as App)
      .post('/api/routes')
      .set('Authorization', 'Bearer garbage')
      .send(validBody)
      .expect(401);
  });

  it('POST /api/routes with the guide token and validBody returns 201', async () => {
    const response = await request(ctx.app.getHttpServer() as App)
      .post('/api/routes')
      .set('Authorization', `Bearer ${guideToken}`)
      .send(validBody)
      .expect(201);

    const route = response.body as RouteDto;
    guideRoute = route;
    createdRouteIds.push(route.id);

    expect(route.id).toMatch(uuidRegex);
    expect(route.name).toBe(validBody.name);
    expect(route.difficulty).toBe(validBody.difficulty);
    expect(route.activity).toBe(validBody.activity);
    expect(route.description).toBe(validBody.description);
    expect(route.waypoints).toEqual(validBody.waypoints);
    expect(route.waypointCount).toBe(3);
    expect(route.tourCount).toBe(0);
    expect(route.author).toEqual({
      id: guideId,
      displayName: 'Ivana Kovac',
    });
    expect(Object.keys(route.author).sort()).toEqual(['displayName', 'id']);
    expect(route.distanceLabel).toMatch(distanceLabelRegex);
    expect(typeof route.distanceKm).toBe('number');
    expect(route.elevationM % 10).toBe(0);
    expect(route.elevationLabel).toBe(`${route.elevationM} m`);
    expect(route.durationLabel).toMatch(durationLabelRegex);
    expect(new Date(route.createdAt).toISOString()).toBe(route.createdAt);
  });

  it('POST /api/routes with the HIKER token and validBody returns 201', async () => {
    const response = await request(ctx.app.getHttpServer() as App)
      .post('/api/routes')
      .set('Authorization', `Bearer ${hikerToken}`)
      .send({ ...validBody, name: 'Jarun Lake Circuit' })
      .expect(201);

    const route = response.body as RouteDto;
    hikerRoute = route;
    createdRouteIds.push(route.id);

    expect(route.author.id).toBe(hikerId);
  });

  it('POST with the guide token and a body that omits description entirely returns 201 with the default description', async () => {
    const response = await request(ctx.app.getHttpServer() as App)
      .post('/api/routes')
      .set('Authorization', `Bearer ${guideToken}`)
      .send({
        name: validBody.name,
        difficulty: validBody.difficulty,
        activity: validBody.activity,
        waypoints: validBody.waypoints,
      })
      .expect(201);

    const route = response.body as RouteDto;
    createdRouteIds.push(route.id);

    expect(route.description).toBe('No description yet.');
  });

  it('POST with the guide token and description of three spaces returns 201 with the default description', async () => {
    const response = await request(ctx.app.getHttpServer() as App)
      .post('/api/routes')
      .set('Authorization', `Bearer ${guideToken}`)
      .send({ ...validBody, description: '   ' })
      .expect(201);

    const route = response.body as RouteDto;
    createdRouteIds.push(route.id);

    expect(route.description).toBe('No description yet.');
  });

  it('name of ab returns 400', () => {
    return request(ctx.app.getHttpServer() as App)
      .post('/api/routes')
      .set('Authorization', `Bearer ${guideToken}`)
      .send({ ...validBody, name: 'ab' })
      .expect(400);
  });

  it('name of two leading and two trailing spaces around ab returns 400', () => {
    return request(ctx.app.getHttpServer() as App)
      .post('/api/routes')
      .set('Authorization', `Bearer ${guideToken}`)
      .send({ ...validBody, name: '  ab  ' })
      .expect(400);
  });

  it('name of 121 characters returns 400', () => {
    const longName = 'a'.repeat(121);
    return request(ctx.app.getHttpServer() as App)
      .post('/api/routes')
      .set('Authorization', `Bearer ${guideToken}`)
      .send({ ...validBody, name: longName })
      .expect(400);
  });

  it('a single waypoint returns 400', () => {
    return request(ctx.app.getHttpServer() as App)
      .post('/api/routes')
      .set('Authorization', `Bearer ${guideToken}`)
      .send({ ...validBody, waypoints: [[45.9002, 15.9432]] })
      .expect(400);
  });

  it('a waypoint of [95, 15.96] alongside a valid one returns 400', () => {
    return request(ctx.app.getHttpServer() as App)
      .post('/api/routes')
      .set('Authorization', `Bearer ${guideToken}`)
      .send({
        ...validBody,
        waypoints: [
          [95, 15.96],
          [45.9002, 15.9432],
        ],
      })
      .expect(400);
  });

  it('a waypoint of [45.9, 15.96, 1] alongside a valid one returns 400', () => {
    return request(ctx.app.getHttpServer() as App)
      .post('/api/routes')
      .set('Authorization', `Bearer ${guideToken}`)
      .send({
        ...validBody,
        waypoints: [
          [45.9, 15.96, 1],
          [45.9002, 15.9432],
        ],
      })
      .expect(400);
  });

  it("a waypoint of ['a','b'] alongside a valid one returns 400", () => {
    return request(ctx.app.getHttpServer() as App)
      .post('/api/routes')
      .set('Authorization', `Bearer ${guideToken}`)
      .send({
        ...validBody,
        waypoints: [
          ['a', 'b'],
          [45.9002, 15.9432],
        ],
      })
      .expect(400);
  });

  it('difficulty Extreme returns 400', () => {
    return request(ctx.app.getHttpServer() as App)
      .post('/api/routes')
      .set('Authorization', `Bearer ${guideToken}`)
      .send({ ...validBody, difficulty: 'Extreme' })
      .expect(400);
  });

  it('activity Running returns 400', () => {
    return request(ctx.app.getHttpServer() as App)
      .post('/api/routes')
      .set('Authorization', `Bearer ${guideToken}`)
      .send({ ...validBody, activity: 'Running' })
      .expect(400);
  });

  it('an extra body property authorId returns 400', async () => {
    const response = await request(ctx.app.getHttpServer() as App)
      .post('/api/routes')
      .set('Authorization', `Bearer ${guideToken}`)
      .send({
        ...validBody,
        authorId: 'a29c3acc-9f02-4e7e-8e1b-6f6e6f6e6f6e',
      })
      .expect(400);

    const body = response.body as ErrorResponseBody;
    expect(body.statusCode).toBe(400);
  });

  it('GET /api/routes with no auth returns 200 and contains both created routes', async () => {
    const response = await request(ctx.app.getHttpServer() as App)
      .get('/api/routes')
      .expect(200);

    const routes = response.body as RouteDto[];
    const ids = routes.map((route) => route.id);

    expect(ids).toContain(guideRoute.id);
    expect(ids).toContain(hikerRoute.id);
    expect(ids.indexOf(guideRoute.id)).toBeLessThan(ids.indexOf(hikerRoute.id));
    expect(routes).toHaveLength(createdRouteIds.length);
  });

  it('GET /api/routes/:id of the guide route returns 200 with the same decorated shape', async () => {
    const response = await request(ctx.app.getHttpServer() as App)
      .get(`/api/routes/${guideRoute.id}`)
      .expect(200);

    const route = response.body as RouteDto;
    expect(route.id).toBe(guideRoute.id);
    expect(route.name).toBe(guideRoute.name);
    expect(Object.keys(route.author).sort()).toEqual(['displayName', 'id']);
    expect(route.waypoints).toHaveLength(3);
  });
});
