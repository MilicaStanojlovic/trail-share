import request from 'supertest';
import type { App } from 'supertest/types';
import {
  createE2eContext,
  destroyE2eContext,
  E2eContext,
  TEST_PASSWORD,
} from './postgres-testcontainer';
import { UserRole } from '../src/users/user.entity';
import { RouteDifficulty, RouteActivity } from '../src/routes/route.entity';
import type { RouteDto } from '../src/routes/dto/route-dto';
import type { TourDto } from '../src/tours/dto/tour-dto';
import type { ProfileDto } from '../src/profile/dto/profile-dto';

interface AuthResponseBody {
  token: string;
  user: {
    id: string;
    displayName: string;
    email: string;
    role: UserRole;
  };
}

const waypoints: [number, number][] = [
  [45.9002, 15.9432],
  [45.9068, 15.9508],
  [45.9121, 15.9601],
];

const FIRST_DATE = '2030-08-01';
const SECOND_DATE = '2030-09-05';

describe('Profile (e2e)', () => {
  let ctx: E2eContext;
  let server: App;

  let guideToken: string;
  let guideId: string;
  let hikerToken: string;
  let hikerId: string;

  let firstTour: TourDto;

  async function register(
    displayName: string,
    email: string,
    role: UserRole,
  ): Promise<AuthResponseBody> {
    const response = await request(server)
      .post('/api/auth/register')
      .send({ displayName, email, password: TEST_PASSWORD, role })
      .expect(201);

    return response.body as AuthResponseBody;
  }

  async function createRoute(name: string): Promise<RouteDto> {
    const response = await request(server)
      .post('/api/routes')
      .set('Authorization', `Bearer ${guideToken}`)
      .send({
        name,
        description: 'Steep but shaded.',
        difficulty: RouteDifficulty.MODERATE,
        activity: RouteActivity.HIKING,
        waypoints,
      })
      .expect(201);

    return response.body as RouteDto;
  }

  async function createTour(routeId: string, date: string): Promise<TourDto> {
    const response = await request(server)
      .post(`/api/routes/${routeId}/tours`)
      .set('Authorization', `Bearer ${guideToken}`)
      .send({
        date,
        startTime: '08:00',
        capacity: 12,
        meetingPoint: 'Bliznec parking lot',
        pace: 'Relaxed',
        notes: '',
      })
      .expect(201);

    return response.body as TourDto;
  }

  async function getProfile(token: string): Promise<ProfileDto> {
    const response = await request(server)
      .get('/api/profile')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    return response.body as ProfileDto;
  }

  beforeAll(async () => {
    ctx = await createE2eContext();
    server = ctx.app.getHttpServer() as App;

    const guide = await register(
      'Ivana Kovac',
      'guide-profile@trailshare.hr',
      UserRole.GUIDE,
    );
    guideToken = guide.token;
    guideId = guide.user.id;

    const hiker = await register(
      'Luka Horvat',
      'hiker-profile@trailshare.hr',
      UserRole.HIKER,
    );
    hikerToken = hiker.token;
    hikerId = hiker.user.id;

    const firstRoute = await createRoute('Sljeme Summit Climb');
    await createRoute('Jarun Lake Circuit');

    firstTour = await createTour(firstRoute.id, FIRST_DATE);
    await createTour(firstRoute.id, SECOND_DATE);

    // One seat sold, by the hiker, on the guide's first tour.
    await request(server)
      .post(`/api/tours/${firstTour.id}/bookings`)
      .set('Authorization', `Bearer ${hikerToken}`)
      .expect(201);
  });

  afterAll(async () => {
    await destroyE2eContext(ctx);
  });

  describe('GET /api/profile', () => {
    it('returns the calling guide identity and counters', async () => {
      const profile = await getProfile(guideToken);

      expect(profile.id).toBe(guideId);
      expect(profile.displayName).toBe('Ivana Kovac');
      expect(profile.email).toBe('guide-profile@trailshare.hr');
      expect(profile.role).toBe(UserRole.GUIDE);
      expect(profile.stats).toEqual({
        routesPublished: 2,
        toursLed: 2,
        seatsHosted: 1,
        toursBooked: 0,
        upcomingBookings: 0,
        rating: { value: 4.9, count: 38 },
      });
    });

    it('returns a parseable ISO createdAt', async () => {
      const profile = await getProfile(guideToken);

      expect(typeof profile.createdAt).toBe('string');
      expect(Number.isNaN(Date.parse(profile.createdAt))).toBe(false);
      // The account was created by this suite, so "member since" is today.
      expect(Date.parse(profile.createdAt)).toBeLessThanOrEqual(Date.now());
    });

    it('returns the hiker counters with a null rating', async () => {
      const profile = await getProfile(hikerToken);

      expect(profile.id).toBe(hikerId);
      expect(profile.role).toBe(UserRole.HIKER);
      expect(profile.stats).toEqual({
        routesPublished: 0,
        toursLed: 0,
        seatsHosted: 0,
        toursBooked: 1,
        upcomingBookings: 1,
        rating: null,
      });
    });

    it('never exposes the password hash', async () => {
      const response = await request(server)
        .get('/api/profile')
        .set('Authorization', `Bearer ${guideToken}`)
        .expect(200);

      expect(JSON.stringify(response.body)).not.toContain('passwordHash');
      expect(JSON.stringify(response.body)).not.toContain('$2');
    });

    it('returns 401 without a token', async () => {
      await request(server).get('/api/profile').expect(401);
    });

    it('returns 401 for a malformed token', async () => {
      await request(server)
        .get('/api/profile')
        .set('Authorization', 'Bearer not-a-jwt')
        .expect(401);
    });

    it('counts a cancelled booking back out of the hiker totals', async () => {
      const bookings = await request(server)
        .get('/api/bookings/mine')
        .set('Authorization', `Bearer ${hikerToken}`)
        .expect(200);

      const [booking] = bookings.body as { id: string }[];
      expect(booking).toBeDefined();

      await request(server)
        .delete(`/api/bookings/${booking.id}`)
        .set('Authorization', `Bearer ${hikerToken}`)
        .expect(204);

      const profile = await getProfile(hikerToken);
      expect(profile.stats.toursBooked).toBe(0);
      expect(profile.stats.upcomingBookings).toBe(0);

      // ...and the guide's hosted-seat counter follows it down.
      const guideProfile = await getProfile(guideToken);
      expect(guideProfile.stats.seatsHosted).toBe(0);
    });
  });
});
