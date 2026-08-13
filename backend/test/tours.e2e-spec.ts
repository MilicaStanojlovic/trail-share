import request from 'supertest';
import type { App } from 'supertest/types';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  createE2eContext,
  destroyE2eContext,
  E2eContext,
} from './postgres-testcontainer';
import { UserRole } from '../src/users/user.entity';
import { RouteDifficulty, RouteActivity } from '../src/routes/route.entity';
import type { RouteDto } from '../src/routes/dto/route-dto';
import type { TourDto } from '../src/tours/dto/tour-dto';
import { Tour } from '../src/tours/tour.entity';
import { timeLabel } from '../src/tours/tour-time';

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

const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

const validBody = {
  date: '2030-09-05',
  startTime: '08:00',
  capacity: 12,
  meetingPoint: 'Bliznec parking lot',
  pace: 'Relaxed',
  notes: 'Bring water.',
};

describe('ToursController and RouteToursController (e2e)', () => {
  let ctx: E2eContext;
  let guideId: string;
  let guideToken: string;
  let hikerToken: string;
  let routeId: string;
  let routeName: string;
  let emptyRouteId: string;
  let createdTour: TourDto;
  let secondTour: TourDto;

  beforeAll(async () => {
    ctx = await createE2eContext();

    const guideResponse = await request(ctx.app.getHttpServer() as App)
      .post('/api/auth/register')
      .send({
        displayName: 'Ivana Kovac',
        email: 'guide-tours@trailshare.hr',
        password: 'trailshare1',
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
        email: 'hiker-tours@trailshare.hr',
        password: 'trailshare1',
        role: UserRole.HIKER,
      })
      .expect(201);

    const hikerBody = hikerResponse.body as AuthResponseBody;
    hikerToken = hikerBody.token;

    const firstRouteResponse = await request(ctx.app.getHttpServer() as App)
      .post('/api/routes')
      .set('Authorization', `Bearer ${guideToken}`)
      .send({
        name: 'Sljeme Summit Climb',
        description: 'Steep but shaded.',
        difficulty: RouteDifficulty.MODERATE,
        activity: RouteActivity.HIKING,
        waypoints,
      })
      .expect(201);

    const firstRoute = firstRouteResponse.body as RouteDto;
    routeId = firstRoute.id;
    routeName = firstRoute.name;

    const secondRouteResponse = await request(ctx.app.getHttpServer() as App)
      .post('/api/routes')
      .set('Authorization', `Bearer ${guideToken}`)
      .send({
        name: 'Jarun Lake Circuit',
        description: 'Flat and lakeside.',
        difficulty: RouteDifficulty.MODERATE,
        activity: RouteActivity.HIKING,
        waypoints,
      })
      .expect(201);

    const secondRoute = secondRouteResponse.body as RouteDto;
    emptyRouteId = secondRoute.id;
  });

  afterAll(async () => {
    await destroyE2eContext(ctx);
  });

  it('POST /api/routes/{routeId}/tours with no Authorization header expects 401; the same request with the hiker token expects 403', async () => {
    await request(ctx.app.getHttpServer() as App)
      .post(`/api/routes/${routeId}/tours`)
      .send(validBody)
      .expect(401);

    await request(ctx.app.getHttpServer() as App)
      .post(`/api/routes/${routeId}/tours`)
      .set('Authorization', `Bearer ${hikerToken}`)
      .send(validBody)
      .expect(403);
  });

  it('POST /api/routes/{routeId}/tours with the guide token and validBody expects 201 and returns the decorated tour shape', async () => {
    const response = await request(ctx.app.getHttpServer() as App)
      .post(`/api/routes/${routeId}/tours`)
      .set('Authorization', `Bearer ${guideToken}`)
      .send(validBody)
      .expect(201);

    const body = response.body as TourDto;
    createdTour = body;

    expect(body.id).toMatch(uuidRegex);
    expect(body.date).toBe(validBody.date);
    expect(body.startTime).toBe(validBody.startTime);
    expect(body.capacity).toBe(validBody.capacity);
    expect(body.meetingPoint).toBe(validBody.meetingPoint);
    expect(body.pace).toBe(validBody.pace);
    expect(body.notes).toBe(validBody.notes);
    expect(body.bookedCount).toBe(0);
    expect(body.seatsLeft).toBe(12);
    expect(body.isFull).toBe(false);
    expect(body.isBookedByMe).toBe(false);
    expect(body.endTime).toMatch(timeRegex);
    expect(body.timeLabel).toBe(timeLabel(body.startTime, body.endTime));
    expect(body.timeLabel.startsWith(body.startTime)).toBe(true);
    expect(body.timeLabel.endsWith(body.endTime)).toBe(true);
    expect(body.guide).toEqual({
      id: guideId,
      displayName: 'Ivana Kovac',
      toursLed: 1,
      rating: 4.9,
    });
    expect(Object.keys(body.guide).sort()).toEqual([
      'displayName',
      'id',
      'rating',
      'toursLed',
    ]);
    expect(body.route.name).toBe(routeName);
    expect(body.route.waypoints).toHaveLength(3);
    expect('roster' in body).toBe(false);
  });

  describe('400 validation cases', () => {
    it('date in DD-MM-YYYY format returns 400', async () => {
      await request(ctx.app.getHttpServer() as App)
        .post(`/api/routes/${routeId}/tours`)
        .set('Authorization', `Bearer ${guideToken}`)
        .send({ ...validBody, date: '05-09-2030' })
        .expect(400);
    });

    it('yesterdays date returns 400 with message date must not be in the past', async () => {
      const yesterday = new Date(Date.now() - 86400000);
      const yesterdayString = `${yesterday.getFullYear()}-${String(
        yesterday.getMonth() + 1,
      ).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

      const response = await request(ctx.app.getHttpServer() as App)
        .post(`/api/routes/${routeId}/tours`)
        .set('Authorization', `Bearer ${guideToken}`)
        .send({ ...validBody, date: yesterdayString })
        .expect(400);

      const errorBody = response.body as ErrorResponseBody;
      expect(errorBody.message).toBe('date must not be in the past');
    });

    it('startTime 25:00 returns 400', async () => {
      await request(ctx.app.getHttpServer() as App)
        .post(`/api/routes/${routeId}/tours`)
        .set('Authorization', `Bearer ${guideToken}`)
        .send({ ...validBody, startTime: '25:00' })
        .expect(400);
    });

    it('capacity 0 returns 400', async () => {
      await request(ctx.app.getHttpServer() as App)
        .post(`/api/routes/${routeId}/tours`)
        .set('Authorization', `Bearer ${guideToken}`)
        .send({ ...validBody, capacity: 0 })
        .expect(400);
    });

    it('body missing meetingPoint returns 400', async () => {
      const { meetingPoint: _meetingPoint, ...bodyWithoutMeetingPoint } =
        validBody;
      void _meetingPoint;

      await request(ctx.app.getHttpServer() as App)
        .post(`/api/routes/${routeId}/tours`)
        .set('Authorization', `Bearer ${guideToken}`)
        .send(bodyWithoutMeetingPoint)
        .expect(400);
    });

    it('body with extra guideId returns 400 from forbidNonWhitelisted', async () => {
      const response = await request(ctx.app.getHttpServer() as App)
        .post(`/api/routes/${routeId}/tours`)
        .set('Authorization', `Bearer ${guideToken}`)
        .send({
          ...validBody,
          guideId: 'a29c3acc-9f02-4e7e-8e1b-6f6e6f6e6f6e',
        })
        .expect(400);

      const errorBody = response.body as ErrorResponseBody;
      expect(errorBody.statusCode).toBe(400);
    });
  });

  it('POST to a non-existent route returns 404 with message Route not found', async () => {
    const response = await request(ctx.app.getHttpServer() as App)
      .post('/api/routes/00000000-0000-4000-8000-000000000000/tours')
      .set('Authorization', `Bearer ${guideToken}`)
      .send(validBody)
      .expect(404);

    const errorBody = response.body as ErrorResponseBody;
    expect(errorBody.message).toBe('Route not found');
  });

  it('GET /api/tours with no Authorization header returns 200 and contains the created tour id', async () => {
    const response = await request(ctx.app.getHttpServer() as App)
      .get('/api/tours')
      .expect(200);

    const tours = response.body as TourDto[];
    const ids = tours.map((tour) => tour.id);
    expect(ids).toContain(createdTour.id);
  });

  it('POST a second tour and GET /api/tours returns them in date ascending order', async () => {
    const response = await request(ctx.app.getHttpServer() as App)
      .post(`/api/routes/${routeId}/tours`)
      .set('Authorization', `Bearer ${guideToken}`)
      .send({ ...validBody, date: '2030-08-01' })
      .expect(201);

    secondTour = response.body as TourDto;

    const listResponse = await request(ctx.app.getHttpServer() as App)
      .get('/api/tours')
      .expect(200);

    const tours = listResponse.body as TourDto[];
    const ids = tours.map((tour) => tour.id);
    expect(ids).toContain(createdTour.id);
    expect(ids).toContain(secondTour.id);
    expect(ids.indexOf(secondTour.id)).toBeLessThan(
      ids.indexOf(createdTour.id),
    );
  });

  it('GET /api/tours/{id} returns 200 for an existing tour, 404 for a missing tour, 400 for invalid uuid', async () => {
    const detailResponse = await request(ctx.app.getHttpServer() as App)
      .get(`/api/tours/${createdTour.id}`)
      .expect(200);

    const tour = detailResponse.body as TourDto;
    expect(tour.id).toBe(createdTour.id);
    expect(tour.guide).toEqual({
      id: guideId,
      displayName: 'Ivana Kovac',
      toursLed: 2,
      rating: 4.9,
    });

    const missingResponse = await request(ctx.app.getHttpServer() as App)
      .get('/api/tours/00000000-0000-4000-8000-000000000000')
      .expect(404);

    const missingBody = missingResponse.body as ErrorResponseBody;
    expect(missingBody.message).toBe('Tour not found');

    await request(ctx.app.getHttpServer() as App)
      .get('/api/tours/not-a-uuid')
      .expect(400);
  });

  it('GET /api/routes/{routeId}/tours returns the tours in date order; empty route returns empty array', async () => {
    const routeToursResponse = await request(ctx.app.getHttpServer() as App)
      .get(`/api/routes/${routeId}/tours`)
      .expect(200);

    const routeTours = routeToursResponse.body as TourDto[];
    const ids = routeTours.map((tour) => tour.id);
    expect(ids).toEqual([secondTour.id, createdTour.id]);

    const emptyResponse = await request(ctx.app.getHttpServer() as App)
      .get(`/api/routes/${emptyRouteId}/tours`)
      .expect(200);

    const emptyTours = emptyResponse.body as TourDto[];
    expect(emptyTours).toHaveLength(0);
  });

  it('GET /api/routes/{routeId} reports tourCount 2 matching its tour list length; route list reflects counts', async () => {
    const detailResponse = await request(ctx.app.getHttpServer() as App)
      .get(`/api/routes/${routeId}`)
      .expect(200);

    const route = detailResponse.body as RouteDto;
    expect(route.tourCount).toBe(2);

    const routeToursResponse = await request(ctx.app.getHttpServer() as App)
      .get(`/api/routes/${routeId}/tours`)
      .expect(200);

    const routeTours = routeToursResponse.body as TourDto[];
    expect(routeTours).toHaveLength(route.tourCount);

    const listResponse = await request(ctx.app.getHttpServer() as App)
      .get('/api/routes')
      .expect(200);

    const routes = listResponse.body as RouteDto[];
    const mainRoute = routes.find((r) => r.id === routeId);
    const emptyRoute = routes.find((r) => r.id === emptyRouteId);

    expect(mainRoute).toBeDefined();
    expect(emptyRoute).toBeDefined();
    expect(mainRoute?.tourCount).toBe(2);
    expect(emptyRoute?.tourCount).toBe(0);
  });

  it('upcoming filter hides past tours from lists and counts but deep links still work', async () => {
    const repo = ctx.app.get<Repository<Tour>>(getRepositoryToken(Tour));
    const past = await repo.save(
      repo.create({
        routeId,
        guideId,
        date: '2020-01-01',
        startTime: '07:00',
        capacity: 5,
        bookedCount: 0,
        meetingPoint: 'Old lot',
        pace: 'Slow',
        notes: '',
      }),
    );
    const pastId = past.id;

    const listResponse = await request(ctx.app.getHttpServer() as App)
      .get('/api/tours')
      .expect(200);

    const listIds = (listResponse.body as TourDto[]).map((tour) => tour.id);
    expect(listIds).not.toContain(pastId);

    const routeListResponse = await request(ctx.app.getHttpServer() as App)
      .get(`/api/routes/${routeId}/tours`)
      .expect(200);

    const routeListIds = (routeListResponse.body as TourDto[]).map(
      (tour) => tour.id,
    );
    expect(routeListIds).not.toContain(pastId);

    const routeDetailResponse = await request(ctx.app.getHttpServer() as App)
      .get(`/api/routes/${routeId}`)
      .expect(200);

    const route = routeDetailResponse.body as RouteDto;
    expect(route.tourCount).toBe(2);

    const pastDetailResponse = await request(ctx.app.getHttpServer() as App)
      .get(`/api/tours/${pastId}`)
      .expect(200);

    const pastTour = pastDetailResponse.body as TourDto;
    expect(pastTour.id).toBe(pastId);
  });
});
