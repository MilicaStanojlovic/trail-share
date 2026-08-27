import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { AuthUser } from '../auth/auth-user';
import { Booking } from '../bookings/booking.entity';
import { Route } from '../routes/route.entity';
import { Tour } from '../tours/tour.entity';
import { User, UserRole } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { ProfileService } from './profile.service';

type RawLed = { toursLed: string; seatsHosted: string | null };
type RawBooked = { toursBooked: string; upcomingBookings: string };

type QueryBuilderMock = {
  select: jest.Mock<QueryBuilderMock, [string, string]>;
  addSelect: jest.Mock<QueryBuilderMock, [string, string]>;
  innerJoin: jest.Mock<QueryBuilderMock, [string, string]>;
  where: jest.Mock<QueryBuilderMock, [string, Record<string, unknown>?]>;
  getRawOne: jest.Mock<Promise<RawLed | RawBooked | undefined>, []>;
};

const queryBuilderMock: QueryBuilderMock = {
  select: jest.fn<QueryBuilderMock, [string, string]>().mockReturnThis(),
  addSelect: jest.fn<QueryBuilderMock, [string, string]>().mockReturnThis(),
  innerJoin: jest.fn<QueryBuilderMock, [string, string]>().mockReturnThis(),
  where: jest
    .fn<QueryBuilderMock, [string, Record<string, unknown>?]>()
    .mockReturnThis(),
  getRawOne: jest.fn<Promise<RawLed | RawBooked | undefined>, []>(),
};

type ToursRepositoryMock = jest.Mocked<
  Pick<Repository<Tour>, 'createQueryBuilder'>
>;

const toursRepositoryMock: ToursRepositoryMock = {
  createQueryBuilder: jest.fn(
    () => queryBuilderMock,
  ) as unknown as ToursRepositoryMock['createQueryBuilder'],
};

type BookingsRepositoryMock = jest.Mocked<
  Pick<Repository<Booking>, 'createQueryBuilder'>
>;

const bookingsRepositoryMock: BookingsRepositoryMock = {
  createQueryBuilder: jest.fn(
    () => queryBuilderMock,
  ) as unknown as BookingsRepositoryMock['createQueryBuilder'],
};

type RoutesRepositoryMock = jest.Mocked<Pick<Repository<Route>, 'count'>>;

const routesRepositoryMock: RoutesRepositoryMock = {
  count: jest.fn<Promise<number>, [unknown]>() as unknown as jest.Mocked<
    Repository<Route>
  >['count'],
};

const usersServiceMock = {
  findById: jest.fn<Promise<User | null>, [string]>(),
};

const CALLER_ID = '11111111-1111-4111-8111-111111111111';
const CREATED_AT = new Date('2026-08-13T09:00:00.000Z');
const FAKE_HASH = 'not-a-real-hash';

// A full entity, password hash included, because the point of one of these
// cases is that the hash does not survive into the DTO.
function userRecord(role: UserRole): User {
  return {
    id: CALLER_ID,
    displayName: 'Ivana Kovac',
    email: 'ivana@trailshare.hr',
    passwordHash: FAKE_HASH,
    role,
    createdAt: CREATED_AT,
  };
}

const caller: AuthUser = {
  id: CALLER_ID,
  displayName: 'Ivana Kovac',
  email: 'ivana@trailshare.hr',
  role: UserRole.GUIDE,
};

describe('ProfileService', () => {
  let service: ProfileService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module = await Test.createTestingModule({
      providers: [
        ProfileService,
        { provide: UsersService, useValue: usersServiceMock },
        { provide: getRepositoryToken(Route), useValue: routesRepositoryMock },
        { provide: getRepositoryToken(Tour), useValue: toursRepositoryMock },
        {
          provide: getRepositoryToken(Booking),
          useValue: bookingsRepositoryMock,
        },
      ],
    }).compile();

    service = module.get(ProfileService);
  });

  it('maps the three queries into the profile DTO for a guide', async () => {
    usersServiceMock.findById.mockResolvedValue(userRecord(UserRole.GUIDE));
    routesRepositoryMock.count.mockResolvedValue(3);
    queryBuilderMock.getRawOne
      .mockResolvedValueOnce({ toursLed: '4', seatsHosted: '17' })
      .mockResolvedValueOnce({ toursBooked: '0', upcomingBookings: '0' });

    const dto = await service.getProfile(caller);

    expect(dto).toEqual({
      id: CALLER_ID,
      displayName: 'Ivana Kovac',
      email: 'ivana@trailshare.hr',
      role: UserRole.GUIDE,
      createdAt: '2026-08-13T09:00:00.000Z',
      stats: {
        routesPublished: 3,
        toursLed: 4,
        seatsHosted: 17,
        toursBooked: 0,
        upcomingBookings: 0,
        rating: { value: 4.9, count: 38 },
      },
    });
  });

  it('reports a null rating for a hiker and still carries their booking counts', async () => {
    usersServiceMock.findById.mockResolvedValue(userRecord(UserRole.HIKER));
    routesRepositoryMock.count.mockResolvedValue(0);
    queryBuilderMock.getRawOne
      .mockResolvedValueOnce({ toursLed: '0', seatsHosted: '0' })
      .mockResolvedValueOnce({ toursBooked: '5', upcomingBookings: '2' });

    const dto = await service.getProfile({ ...caller, role: UserRole.HIKER });

    expect(dto.role).toBe(UserRole.HIKER);
    expect(dto.stats.rating).toBeNull();
    expect(dto.stats.toursLed).toBe(0);
    expect(dto.stats.seatsHosted).toBe(0);
    expect(dto.stats.toursBooked).toBe(5);
    expect(dto.stats.upcomingBookings).toBe(2);
  });

  it('scopes every query to the caller and joins the tour only to read its date', async () => {
    usersServiceMock.findById.mockResolvedValue(userRecord(UserRole.GUIDE));
    routesRepositoryMock.count.mockResolvedValue(0);
    queryBuilderMock.getRawOne
      .mockResolvedValueOnce({ toursLed: '0', seatsHosted: '0' })
      .mockResolvedValueOnce({ toursBooked: '0', upcomingBookings: '0' });

    await service.getProfile(caller);

    expect(routesRepositoryMock.count).toHaveBeenCalledWith({
      where: { authorId: CALLER_ID },
    });
    expect(queryBuilderMock.where).toHaveBeenNthCalledWith(
      1,
      'tour.guideId = :id',
      { id: CALLER_ID },
    );
    expect(queryBuilderMock.where).toHaveBeenNthCalledWith(
      2,
      'booking.hikerId = :id',
      { id: CALLER_ID },
    );
    // innerJoin, not innerJoinAndSelect: the tour is joined only so the FILTER
    // clause can read its date.
    expect(queryBuilderMock.innerJoin).toHaveBeenCalledWith(
      'booking.tour',
      'tour',
    );
    expect(queryBuilderMock.addSelect).toHaveBeenCalledWith(
      'COUNT(*) FILTER (WHERE tour.date >= CURRENT_DATE)',
      'upcomingBookings',
    );
    // "Tours led" and "seats hosted" deliberately carry no date filter, so
    // neither aggregate query gets a second predicate.
    expect(queryBuilderMock.where).toHaveBeenCalledTimes(2);
  });

  it('reports seatsHosted as 0 rather than null or NaN when the sum is empty', async () => {
    usersServiceMock.findById.mockResolvedValue(userRecord(UserRole.GUIDE));
    routesRepositoryMock.count.mockResolvedValue(0);
    queryBuilderMock.getRawOne
      .mockResolvedValueOnce({ toursLed: '0', seatsHosted: null })
      .mockResolvedValueOnce({ toursBooked: '0', upcomingBookings: '0' });

    const dto = await service.getProfile(caller);

    expect(dto.stats.seatsHosted).toBe(0);
    expect(Number.isNaN(dto.stats.seatsHosted)).toBe(false);
  });

  it('falls back to zeros when either aggregate query returns no row', async () => {
    usersServiceMock.findById.mockResolvedValue(userRecord(UserRole.GUIDE));
    routesRepositoryMock.count.mockResolvedValue(0);
    queryBuilderMock.getRawOne
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined);

    const dto = await service.getProfile(caller);

    expect(dto.stats).toEqual({
      routesPublished: 0,
      toursLed: 0,
      seatsHosted: 0,
      toursBooked: 0,
      upcomingBookings: 0,
      rating: { value: 4.9, count: 38 },
    });
  });

  it('never lets the password hash reach the DTO', async () => {
    usersServiceMock.findById.mockResolvedValue(userRecord(UserRole.GUIDE));
    routesRepositoryMock.count.mockResolvedValue(1);
    queryBuilderMock.getRawOne
      .mockResolvedValueOnce({ toursLed: '1', seatsHosted: '2' })
      .mockResolvedValueOnce({ toursBooked: '0', upcomingBookings: '0' });

    const dto = await service.getProfile(caller);

    expect(dto).not.toHaveProperty('passwordHash');
    expect(JSON.stringify(dto)).not.toContain(FAKE_HASH);
  });

  it('throws NotFoundException when the account no longer exists', async () => {
    usersServiceMock.findById.mockResolvedValue(null);

    await expect(service.getProfile(caller)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
