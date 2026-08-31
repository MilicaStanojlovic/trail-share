import request from 'supertest';
import type { App } from 'supertest/types';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
import type { BookingDto } from '../src/bookings/dto/booking-dto';
import { Tour } from '../src/tours/tour.entity';

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

const MISSING_UUID = '00000000-0000-4000-8000-000000000000';
const HOUR_MS = 60 * 60 * 1000;

const pad = (value: number): string => String(value).padStart(2, '0');

// The server reads a tour start in local time, so a tour pinned relative to now
// has to be written with local calendar parts.
function localParts(offsetMs: number): { date: string; startTime: string } {
  const at = new Date(Date.now() + offsetMs);
  return {
    date: `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`,
    startTime: `${pad(at.getHours())}:${pad(at.getMinutes())}`,
  };
}

describe('Bookings (e2e)', () => {
  let ctx: E2eContext;
  let server: App;
  let tourRepository: Repository<Tour>;

  let guideToken: string;
  let guideId: string;
  let otherGuideToken: string;
  let hikerTokens: string[] = [];
  let routeId: string;

  // Tours reused across the cases below.
  let tourA: TourDto; // capacity 12, the happy path and the roster
  let tourB: TourDto; // capacity 2, the full-tour case

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

  async function createTour(date: string, capacity: number): Promise<TourDto> {
    const response = await request(server)
      .post(`/api/routes/${routeId}/tours`)
      .set('Authorization', `Bearer ${guideToken}`)
      .send({
        date,
        startTime: '08:00',
        capacity,
        meetingPoint: 'Bliznec parking lot',
        pace: 'Relaxed',
        notes: '',
      })
      .expect(201);

    return response.body as TourDto;
  }

  async function getTour(id: string, token?: string): Promise<TourDto> {
    const call = request(server).get(`/api/tours/${id}`);
    if (token !== undefined) {
      void call.set('Authorization', `Bearer ${token}`);
    }
    const response = await call.expect(200);
    return response.body as TourDto;
  }

  function bookRequest(tourId: string, token: string) {
    return request(server)
      .post(`/api/tours/${tourId}/bookings`)
      .set('Authorization', `Bearer ${token}`);
  }

  beforeAll(async () => {
    ctx = await createE2eContext();
    server = ctx.app.getHttpServer() as App;
    tourRepository = ctx.app.get<Repository<Tour>>(getRepositoryToken(Tour));

    const guide = await register(
      'Ivana Kovac',
      'guide-bookings@trailshare.hr',
      UserRole.GUIDE,
    );
    guideToken = guide.token;
    guideId = guide.user.id;

    const otherGuide = await register(
      'Marko Babic',
      'guide2-bookings@trailshare.hr',
      UserRole.GUIDE,
    );
    otherGuideToken = otherGuide.token;

    const hikers = await Promise.all(
      [1, 2, 3, 4].map((n) =>
        register(
          `Hiker ${n}`,
          `hiker${n}-bookings@trailshare.hr`,
          UserRole.HIKER,
        ),
      ),
    );
    hikerTokens = hikers.map((hiker) => hiker.token);

    const routeResponse = await request(server)
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
    routeId = (routeResponse.body as RouteDto).id;

    tourA = await createTour('2030-09-05', 12);
    tourB = await createTour('2030-09-06', 2);
  });

  afterAll(async () => {
    await destroyE2eContext(ctx);
  });

  describe('POST /api/tours/:tourId/bookings guards and parameters', () => {
    it('rejects an anonymous caller with 401 and a guide with 403', async () => {
      await request(server).post(`/api/tours/${tourA.id}/bookings`).expect(401);

      await request(server)
        .post(`/api/tours/${tourA.id}/bookings`)
        .set('Authorization', `Bearer ${guideToken}`)
        .expect(403);
    });

    it('returns 404 for an unknown tour and 400 for a non-uuid id', async () => {
      const missing = await bookRequest(MISSING_UUID, hikerTokens[0]).expect(
        404,
      );
      expect((missing.body as ErrorResponseBody).message).toBe(
        'Tour not found',
      );

      await bookRequest('not-a-uuid', hikerTokens[0]).expect(400);
    });
  });

  it('books a seat and returns the BookingDto contract shape', async () => {
    const response = await bookRequest(tourA.id, hikerTokens[0]).expect(201);
    const body = response.body as BookingDto;

    expect(Object.keys(body).sort()).toEqual([
      'createdAt',
      'id',
      'status',
      'tour',
    ]);
    expect(body.status).toBe('CONFIRMED');
    expect(body.tour.id).toBe(tourA.id);
    expect(body.tour.bookedCount).toBe(tourA.bookedCount + 1);
    expect(body.tour.seatsLeft).toBe(tourA.capacity - 1);
    expect(body.tour.isBookedByMe).toBe(true);
    expect('roster' in body.tour).toBe(false);
  });

  it('rejects a second booking by the same hiker with 409 and leaves the counter alone', async () => {
    const response = await bookRequest(tourA.id, hikerTokens[0]).expect(409);
    expect((response.body as ErrorResponseBody).message).toBe(
      'You already booked this tour',
    );

    const tour = await getTour(tourA.id);
    expect(tour.bookedCount).toBe(1);
  });

  it('rejects the booking that would exceed capacity with 409 Tour is full', async () => {
    await bookRequest(tourB.id, hikerTokens[0]).expect(201);
    await bookRequest(tourB.id, hikerTokens[1]).expect(201);

    const response = await bookRequest(tourB.id, hikerTokens[2]).expect(409);
    expect((response.body as ErrorResponseBody).message).toBe('Tour is full');

    const tour = await getTour(tourB.id);
    expect(tour.bookedCount).toBe(2);
    expect(tour.seatsLeft).toBe(0);
    expect(tour.isFull).toBe(true);
  });

  it('lets only one of two hikers racing for the last seat win, three times over', async () => {
    for (const day of ['01', '02', '03']) {
      const tour = await createTour(`2030-10-${day}`, 1);

      // Both requests are built first and dispatched together: nothing is
      // awaited between the two sends, so they genuinely overlap in the server.
      const first = bookRequest(tour.id, hikerTokens[2]);
      const second = bookRequest(tour.id, hikerTokens[3]);
      const [firstResponse, secondResponse] = await Promise.all([
        first,
        second,
      ]);

      const statuses = [firstResponse.status, secondResponse.status].sort();
      expect(statuses).toEqual([201, 409]);

      const rejected = [firstResponse, secondResponse].filter(
        (response) => response.status === 409,
      );
      expect(rejected).toHaveLength(1);
      expect((rejected[0].body as ErrorResponseBody).message).toBe(
        'Tour is full',
      );

      // The owning guide's roster is the row-level check: one seat sold, one
      // booking row, no orphan from the rolled-back transaction.
      const detail = await getTour(tour.id, guideToken);
      expect(detail.bookedCount).toBe(1);
      expect(detail.isFull).toBe(true);
      expect(detail.roster).toHaveLength(1);
    }
  });

  describe('GET /api/bookings/mine', () => {
    it('returns the caller bookings ordered by tour date', async () => {
      const response = await request(server)
        .get('/api/bookings/mine')
        .set('Authorization', `Bearer ${hikerTokens[0]}`)
        .expect(200);

      const bookings = response.body as BookingDto[];
      expect(bookings.map((booking) => booking.tour.id)).toEqual([
        tourA.id,
        tourB.id,
      ]);
      expect(
        bookings.every((booking) => booking.tour.isBookedByMe === true),
      ).toBe(true);
      expect(bookings.every((booking) => !('roster' in booking.tour))).toBe(
        true,
      );
    });

    it('returns an empty array for a hiker without bookings and for a guide, and 401 without a token', async () => {
      const fresh = await register(
        'Hiker Fresh',
        'hiker-fresh-bookings@trailshare.hr',
        UserRole.HIKER,
      );

      const freshResponse = await request(server)
        .get('/api/bookings/mine')
        .set('Authorization', `Bearer ${fresh.token}`)
        .expect(200);
      expect(freshResponse.body as BookingDto[]).toEqual([]);

      const guideResponse = await request(server)
        .get('/api/bookings/mine')
        .set('Authorization', `Bearer ${guideToken}`)
        .expect(200);
      expect(guideResponse.body as BookingDto[]).toEqual([]);

      await request(server).get('/api/bookings/mine').expect(401);
    });
  });

  describe('DELETE /api/bookings/:id', () => {
    it('cancels the caller own booking, frees the seat and lets them book again', async () => {
      const tour = await createTour('2030-08-01', 5);
      const booked = await bookRequest(tour.id, hikerTokens[0]).expect(201);
      const bookingId = (booked.body as BookingDto).id;

      // Someone else's booking is indistinguishable from an unknown one.
      await request(server)
        .delete(`/api/bookings/${bookingId}`)
        .set('Authorization', `Bearer ${hikerTokens[1]}`)
        .expect(404);

      await request(server)
        .delete(`/api/bookings/${MISSING_UUID}`)
        .set('Authorization', `Bearer ${hikerTokens[0]}`)
        .expect(404);

      await request(server)
        .delete('/api/bookings/not-a-uuid')
        .set('Authorization', `Bearer ${hikerTokens[0]}`)
        .expect(400);

      await request(server)
        .delete(`/api/bookings/${bookingId}`)
        .set('Authorization', `Bearer ${hikerTokens[0]}`)
        .expect(204);

      const afterCancel = await getTour(tour.id, hikerTokens[0]);
      expect(afterCancel.bookedCount).toBe(0);
      expect(afterCancel.isBookedByMe).toBe(false);

      const mineResponse = await request(server)
        .get('/api/bookings/mine')
        .set('Authorization', `Bearer ${hikerTokens[0]}`)
        .expect(200);
      const mineIds = (mineResponse.body as BookingDto[]).map(
        (booking) => booking.tour.id,
      );
      expect(mineIds).not.toContain(tour.id);

      // The unique slot is free again.
      await bookRequest(tour.id, hikerTokens[0]).expect(201);
    });

    it('refuses a cancellation inside the 24 h window and a booking on a started tour', async () => {
      const soon = await tourRepository.save(
        tourRepository.create({
          routeId,
          guideId,
          ...localParts(2 * HOUR_MS),
          capacity: 5,
          bookedCount: 0,
          meetingPoint: 'Bliznec parking lot',
          pace: 'Relaxed',
          notes: '',
        }),
      );

      const booked = await bookRequest(soon.id, hikerTokens[1]).expect(201);
      const bookingId = (booked.body as BookingDto).id;

      const cancelResponse = await request(server)
        .delete(`/api/bookings/${bookingId}`)
        .set('Authorization', `Bearer ${hikerTokens[1]}`)
        .expect(409);
      expect((cancelResponse.body as ErrorResponseBody).message).toBe(
        'Bookings can only be cancelled up to 24 h before the tour starts',
      );

      const started = await tourRepository.save(
        tourRepository.create({
          routeId,
          guideId,
          ...localParts(-HOUR_MS),
          capacity: 5,
          bookedCount: 0,
          meetingPoint: 'Bliznec parking lot',
          pace: 'Relaxed',
          notes: '',
        }),
      );

      const bookResponse = await bookRequest(started.id, hikerTokens[1]).expect(
        409,
      );
      expect((bookResponse.body as ErrorResponseBody).message).toBe(
        'Tour has already started',
      );
    });
  });

  describe('roster visibility on GET /api/tours/:id', () => {
    it('shows the roster to the owning guide only', async () => {
      const forGuide = await getTour(tourB.id, guideToken);
      expect(forGuide.roster).toBeDefined();
      expect(forGuide.roster).toHaveLength(2);

      const roster = forGuide.roster ?? [];
      for (const entry of roster) {
        expect(Object.keys(entry).sort()).toEqual([
          'bookedAt',
          'name',
          'status',
        ]);
        expect(['CONFIRMED', 'PAID']).toContain(entry.status);
      }
      const bookedAt = roster.map((entry) => Date.parse(entry.bookedAt));
      expect(bookedAt).toEqual([...bookedAt].sort((a, b) => a - b));
      expect(roster.map((entry) => entry.name)).toEqual(['Hiker 1', 'Hiker 2']);

      const forHiker = await getTour(tourB.id, hikerTokens[0]);
      expect('roster' in forHiker).toBe(false);
      expect(forHiker.isBookedByMe).toBe(true);

      const forOtherGuide = await getTour(tourB.id, otherGuideToken);
      expect('roster' in forOtherGuide).toBe(false);

      const anonymous = await getTour(tourB.id);
      expect('roster' in anonymous).toBe(false);
      expect(anonymous.isBookedByMe).toBe(false);
    });

    it('treats a garbage token on a public list as anonymous', async () => {
      const response = await request(server)
        .get('/api/tours')
        .set('Authorization', 'Bearer garbage')
        .expect(200);

      const tours = response.body as TourDto[];
      expect(tours.length).toBeGreaterThan(0);
      expect(tours.every((tour) => tour.isBookedByMe === false)).toBe(true);
    });
  });
});
