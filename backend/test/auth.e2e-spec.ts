import request from 'supertest';
import type { App } from 'supertest/types';
import {
  createE2eContext,
  destroyE2eContext,
  E2eContext,
  TEST_PASSWORD,
} from './postgres-testcontainer';
import { UserRole } from '../src/users/user.entity';

interface PublicUser {
  id: string;
  displayName: string;
  email: string;
  role: UserRole;
}

interface AuthResponseBody {
  token: string;
  user: PublicUser;
}

interface ErrorResponseBody {
  statusCode: number;
  message: string;
}

const fixture = {
  displayName: 'Ivana Kovač',
  email: 'ivana@trailshare.hr',
  password: TEST_PASSWORD,
  role: UserRole.GUIDE,
};

describe('AuthController (e2e)', () => {
  let ctx: E2eContext;
  // Captured by the register case and reused by the login and me cases.
  let userId: string;
  let loginToken: string;

  beforeAll(async () => {
    ctx = await createE2eContext();
  });

  afterAll(async () => {
    await destroyE2eContext(ctx);
  });

  it('POST /api/auth/register with the fixture returns 201', async () => {
    const response = await request(ctx.app.getHttpServer() as App)
      .post('/api/auth/register')
      .send(fixture)
      .expect(201);

    const body = response.body as AuthResponseBody;
    expect(typeof body.token).toBe('string');
    expect(body.token.length).toBeGreaterThan(0);
    expect(typeof body.user.id).toBe('string');
    expect(body.user.displayName).toBe(fixture.displayName);
    expect(body.user.email).toBe(fixture.email);
    expect(body.user.role).toBe(fixture.role);
    expect(body.user).not.toHaveProperty('passwordHash');

    userId = body.user.id;
  });

  it('POST /api/auth/register with the same email in different casing returns 409', async () => {
    const response = await request(ctx.app.getHttpServer() as App)
      .post('/api/auth/register')
      .send({
        displayName: 'Ivana Kovac 2',
        email: 'IVANA@trailshare.hr',
        password: 'trailshare2',
        role: 'HIKER',
      })
      .expect(409);

    const body = response.body as ErrorResponseBody;
    expect(body.message).toBe('Email is already registered');
  });

  it('POST /api/auth/register with password short1 returns 400', () => {
    return request(ctx.app.getHttpServer() as App)
      .post('/api/auth/register')
      .send({
        displayName: 'Short Password',
        email: 'case3@trailshare.hr',
        password: 'short1',
        role: 'HIKER',
      })
      .expect(400);
  });

  it('POST /api/auth/register with password longpassword returns 400', () => {
    return request(ctx.app.getHttpServer() as App)
      .post('/api/auth/register')
      .send({
        displayName: 'No Digit',
        email: 'case4@trailshare.hr',
        password: 'longpassword',
        role: 'HIKER',
      })
      .expect(400);
  });

  it('POST /api/auth/register with role ADMIN returns 400', () => {
    return request(ctx.app.getHttpServer() as App)
      .post('/api/auth/register')
      .send({
        displayName: 'Admin Role',
        email: 'case5@trailshare.hr',
        password: TEST_PASSWORD,
        role: 'ADMIN',
      })
      .expect(400);
  });

  it('POST /api/auth/register with an extra unknown field returns 400', () => {
    return request(ctx.app.getHttpServer() as App)
      .post('/api/auth/register')
      .send({
        displayName: 'Unknown Field',
        email: 'case6@trailshare.hr',
        password: TEST_PASSWORD,
        role: 'HIKER',
        isAdmin: true,
      })
      .expect(400);
  });

  it('POST /api/auth/login with the fixture returns 200', async () => {
    const response = await request(ctx.app.getHttpServer() as App)
      .post('/api/auth/login')
      .send({
        email: fixture.email,
        password: fixture.password,
      })
      .expect(200);

    const body = response.body as AuthResponseBody;
    expect(typeof body.token).toBe('string');
    expect(body.token.length).toBeGreaterThan(0);
    expect(body.user).toEqual({
      id: userId,
      displayName: fixture.displayName,
      email: fixture.email,
      role: fixture.role,
    });
    expect(body.user).not.toHaveProperty('passwordHash');

    loginToken = body.token;
  });

  it('POST /api/auth/login with the wrong password returns 401', async () => {
    const response = await request(ctx.app.getHttpServer() as App)
      .post('/api/auth/login')
      .send({
        email: fixture.email,
        password: 'wrongpassword1',
      })
      .expect(401);

    const body = response.body as ErrorResponseBody;
    expect(body.message).toBe('Invalid email or password');
  });

  it('POST /api/auth/login with an unregistered email returns 401', () => {
    return request(ctx.app.getHttpServer() as App)
      .post('/api/auth/login')
      .send({
        email: 'unknown@trailshare.hr',
        password: TEST_PASSWORD,
      })
      .expect(401);
  });

  it('GET /api/auth/me with the login token returns the user', async () => {
    const response = await request(ctx.app.getHttpServer() as App)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${loginToken}`)
      .expect(200);

    const body = response.body as PublicUser;
    expect(body).toEqual({
      id: userId,
      displayName: fixture.displayName,
      email: fixture.email,
      role: fixture.role,
    });
  });

  it('GET /api/auth/me with no Authorization header returns 401', async () => {
    const response = await request(ctx.app.getHttpServer() as App)
      .get('/api/auth/me')
      .expect(401);

    const body = response.body as ErrorResponseBody;
    expect(body.statusCode).toBe(401);
    expect(body.message).toBe('Unauthorized');
  });

  it('GET /api/auth/me with a garbage token returns 401', async () => {
    const response = await request(ctx.app.getHttpServer() as App)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer garbage')
      .expect(401);

    const body = response.body as ErrorResponseBody;
    expect(body.statusCode).toBe(401);
    expect(body.message).toBe('Unauthorized');
  });
});
