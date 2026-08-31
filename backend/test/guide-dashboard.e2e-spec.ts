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
import type { GuideDashboardDto } from '../src/guide/dto/guide-dashboard-dto';

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

// Two distinct future dates; the earlier one is scheduled second so an
// ascending list is never just insertion order.
const LATER_DATE = '2030-09-05';
const EARLIER_DATE = '2030-08-01';

// Independent of GuideService.daysUntil on purpose: the expectation is derived
// from the fixture date rather than the code under test, and from the calendar
// rather than a literal, so it stays true as today moves.
function wholeDaysFromToday(dateIso: string): number {
  const target = new Date(`${dateIso}T00:00:00`);
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - midnight.getTime()) / 86_400_000);
}

describe('Guide dashboard (e2e)', () => {
  let ctx: E2eContext;
  let server: App;

  let guideToken: string;
  let guideId: string;
  let hikerToken: string;
  // A second guide who publishes nothing and schedules nothing.
  let idleGuideToken: string;

  let firstRoute: RouteDto;
  let secondRoute: RouteDto;
  let laterTour: TourDto;
  let earlierTour: TourDto;

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

  beforeAll(async () => {
    ctx = await createE2eContext();
    server = ctx.app.getHttpServer() as App;

    const guide = await register(
      'Ivana Kovac',
      'guide-dashboard@trailshare.hr',
      UserRole.GUIDE,
    );
    guideToken = guide.token;
    guideId = guide.user.id;

    const hiker = await register(
      'Luka Horvat',
      'hiker-dashboard@trailshare.hr',
      UserRole.HIKER,
    );
    hikerToken = hiker.token;

    const idleGuide = await register(
      'Marko Babic',
      'guide2-dashboard@trailshare.hr',
      UserRole.GUIDE,
    );
    idleGuideToken = idleGuide.token;

    firstRoute = await createRoute('Sljeme Summit Climb');
    secondRoute = await createRoute('Jarun Lake Circuit');

    laterTour = await createTour(firstRoute.id, LATER_DATE);
    earlierTour = await createTour(firstRoute.id, EARLIER_DATE);

    // One seat sold across the guide's whole calendar.
    await request(server)
      .post(`/api/tours/${laterTour.id}/bookings`)
      .set('Authorization', `Bearer ${hikerToken}`)
      .expect(201);
  });

  afterAll(async () => {
    await destroyE2eContext(ctx);
  });

  describe('GET /api/routes/mine', () => {
    it('returns the guide own two routes in creation order', async () => {
      const response = await request(server)
        .get('/api/routes/mine')
        .set('Authorization', `Bearer ${guideToken}`)
        .expect(200);

      const routes = response.body as RouteDto[];
      expect(routes).toHaveLength(2);
      expect(routes.map((route) => route.id)).toEqual([
        firstRoute.id,
        secondRoute.id,
      ]);
      expect(routes.map((route) => route.name)).toEqual([
        'Sljeme Summit Climb',
        'Jarun Lake Circuit',
      ]);
      expect(routes.every((route) => route.author.id === guideId)).toBe(true);
      expect(Object.keys(routes[0].author).sort()).toEqual([
        'displayName',
        'id',
      ]);
      expect(routes[0].tourCount).toBe(2);
    });

    it('returns an empty array for a user who published nothing', async () => {
      const response = await request(server)
        .get('/api/routes/mine')
        .set('Authorization', `Bearer ${hikerToken}`)
        .expect(200);

      expect(response.body as RouteDto[]).toEqual([]);
    });

    it('returns 401 without a token', async () => {
      await request(server).get('/api/routes/mine').expect(401);
    });
  });

  describe('GET /api/tours/mine', () => {
    it('returns the guide own upcoming tours date ascending and never a roster', async () => {
      const response = await request(server)
        .get('/api/tours/mine')
        .set('Authorization', `Bearer ${guideToken}`)
        .expect(200);

      const tours = response.body as TourDto[];
      expect(tours.map((tour) => tour.id)).toEqual([
        earlierTour.id,
        laterTour.id,
      ]);
      expect(tours.map((tour) => tour.date)).toEqual([
        EARLIER_DATE,
        LATER_DATE,
      ]);
      expect(tours.every((tour) => tour.guide.id === guideId)).toBe(true);
      // Lists never carry the roster, not even for the owning guide.
      expect(tours.every((tour) => !('roster' in tour))).toBe(true);

      const booked = tours.find((tour) => tour.id === laterTour.id);
      expect(booked?.bookedCount).toBe(1);
      expect(booked?.seatsLeft).toBe(11);
    });

    it('returns 403 for a hiker and 401 without a token', async () => {
      await request(server)
        .get('/api/tours/mine')
        .set('Authorization', `Bearer ${hikerToken}`)
        .expect(403);

      await request(server).get('/api/tours/mine').expect(401);
    });
  });

  describe('GET /api/guide/dashboard', () => {
    it('returns the five contract keys with the guide own figures', async () => {
      const response = await request(server)
        .get('/api/guide/dashboard')
        .set('Authorization', `Bearer ${guideToken}`)
        .expect(200);

      const dashboard = response.body as GuideDashboardDto;
      expect(Object.keys(dashboard).sort()).toEqual([
        'nextTourInDays',
        'rating',
        'routesPublished',
        'seatsBooked',
        'toursScheduled',
      ]);
      expect(dashboard.toursScheduled).toBe(2);
      expect(dashboard.seatsBooked).toBe(1);
      expect(dashboard.routesPublished).toBe(2);
      expect(dashboard.nextTourInDays).toBe(wholeDaysFromToday(EARLIER_DATE));
      expect(dashboard.rating).toEqual({ value: 4.9, count: 38 });
    });

    it('reports all zeros and a null nextTourInDays for a guide with nothing', async () => {
      const response = await request(server)
        .get('/api/guide/dashboard')
        .set('Authorization', `Bearer ${idleGuideToken}`)
        .expect(200);

      const dashboard = response.body as GuideDashboardDto;
      expect(dashboard).toEqual({
        toursScheduled: 0,
        nextTourInDays: null,
        seatsBooked: 0,
        routesPublished: 0,
        rating: { value: 4.9, count: 38 },
      });
    });

    it('returns 403 for a hiker and 401 without a token', async () => {
      await request(server)
        .get('/api/guide/dashboard')
        .set('Authorization', `Bearer ${hikerToken}`)
        .expect(403);

      await request(server).get('/api/guide/dashboard').expect(401);
    });
  });
});
