import { Test } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { BookingsService } from './bookings.service';
import { Booking } from './booking.entity';
import { Tour } from '../tours/tour.entity';
import { ToursService } from '../tours/tours.service';
import { TourDto } from '../tours/dto/tour-dto';
import type { AuthUser } from '../auth/auth-user';
import { UserRole } from '../users/user.entity';

type UpdateBuilderMock = {
  update: jest.Mock<UpdateBuilderMock, [unknown]>;
  set: jest.Mock<UpdateBuilderMock, [Record<string, unknown>]>;
  where: jest.Mock<UpdateBuilderMock, [string, Record<string, unknown>]>;
  execute: jest.Mock<Promise<{ affected: number }>, []>;
};

const updateBuilderMock: UpdateBuilderMock = {
  update: jest.fn<UpdateBuilderMock, [unknown]>().mockReturnThis(),
  set: jest.fn<UpdateBuilderMock, [Record<string, unknown>]>().mockReturnThis(),
  where: jest
    .fn<UpdateBuilderMock, [string, Record<string, unknown>]>()
    .mockReturnThis(),
  execute: jest.fn<Promise<{ affected: number }>, []>(),
};

type EntityManagerMock = {
  findOne: jest.Mock<Promise<unknown>, [unknown, unknown]>;
  insert: jest.Mock<Promise<unknown>, [unknown, unknown]>;
  delete: jest.Mock<Promise<unknown>, [unknown, unknown]>;
  createQueryBuilder: jest.Mock<UpdateBuilderMock, []>;
};

const entityManagerMock: EntityManagerMock = {
  findOne: jest.fn<Promise<unknown>, [unknown, unknown]>(),
  insert: jest.fn<Promise<unknown>, [unknown, unknown]>(),
  // Defaults to one affected row: cancel only decrements when its delete
  // actually removed something, so an undefined result is not a valid stand-in.
  delete: jest
    .fn<Promise<unknown>, [unknown, unknown]>()
    .mockResolvedValue({ affected: 1 }),
  createQueryBuilder: jest.fn<UpdateBuilderMock, []>(() => updateBuilderMock),
};

const dataSourceMock = {
  transaction: jest.fn(
    (runInTransaction: (em: EntityManager) => Promise<unknown>) =>
      runInTransaction(entityManagerMock as unknown as EntityManager),
  ),
};

type BookingsQueryBuilderMock = {
  innerJoin: jest.Mock<BookingsQueryBuilderMock, [string, string]>;
  where: jest.Mock<BookingsQueryBuilderMock, [string, Record<string, unknown>]>;
  andWhere: jest.Mock<BookingsQueryBuilderMock, [string]>;
  orderBy: jest.Mock<BookingsQueryBuilderMock, [string, string]>;
  addOrderBy: jest.Mock<BookingsQueryBuilderMock, [string, string]>;
  getMany: jest.Mock<Promise<Booking[]>, []>;
};

const bookingsQueryBuilderMock: BookingsQueryBuilderMock = {
  innerJoin: jest
    .fn<BookingsQueryBuilderMock, [string, string]>()
    .mockReturnThis(),
  where: jest
    .fn<BookingsQueryBuilderMock, [string, Record<string, unknown>]>()
    .mockReturnThis(),
  andWhere: jest.fn<BookingsQueryBuilderMock, [string]>().mockReturnThis(),
  orderBy: jest
    .fn<BookingsQueryBuilderMock, [string, string]>()
    .mockReturnThis(),
  addOrderBy: jest
    .fn<BookingsQueryBuilderMock, [string, string]>()
    .mockReturnThis(),
  getMany: jest.fn<Promise<Booking[]>, []>(),
};

const bookingsRepositoryMock = {
  findOneOrFail: jest.fn<Promise<Booking>, [unknown]>(),
  createQueryBuilder: jest.fn<BookingsQueryBuilderMock, [string]>(
    () => bookingsQueryBuilderMock,
  ),
};

const toursServiceMock = {
  findById: jest.fn<Promise<TourDto>, [string, AuthUser?]>(),
  findManyByIds: jest.fn<Promise<TourDto[]>, [string[], AuthUser?]>(),
};

const pad = (value: number): string => String(value).padStart(2, '0');

// The service parses a tour start in server-local time, so fixtures are built
// from local calendar parts rather than an ISO string.
function tourAt(offsetMs: number): Pick<Tour, 'date' | 'startTime'> {
  const at = new Date(Date.now() + offsetMs);
  return {
    date: `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`,
    startTime: `${pad(at.getHours())}:${pad(at.getMinutes())}:00`,
  };
}

const HOUR_MS = 60 * 60 * 1000;

describe('BookingsService', () => {
  let service: BookingsService;

  const hiker: AuthUser = {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    displayName: 'Luka Horvat',
    email: 'luka@trailshare.hr',
    role: UserRole.HIKER,
  };

  const tourId = '33333333-3333-4333-8333-333333333333';

  const futureTour = { id: tourId, ...tourAt(48 * HOUR_MS) } as Tour;

  const bookingRow = {
    id: '55555555-5555-4555-8555-555555555555',
    tourId,
    hikerId: hiker.id,
    status: 'CONFIRMED' as const,
    createdAt: new Date('2026-08-13T10:00:00.000Z'),
  } as Booking;

  const tourDto = { id: tourId, isBookedByMe: true } as TourDto;

  beforeEach(async () => {
    jest.clearAllMocks();
    entityManagerMock.createQueryBuilder.mockReturnValue(updateBuilderMock);
    bookingsRepositoryMock.createQueryBuilder.mockReturnValue(
      bookingsQueryBuilderMock,
    );
    updateBuilderMock.execute.mockResolvedValue({ affected: 1 });
    bookingsRepositoryMock.findOneOrFail.mockResolvedValue(bookingRow);
    toursServiceMock.findById.mockResolvedValue(tourDto);
    toursServiceMock.findManyByIds.mockResolvedValue([]);

    const module = await Test.createTestingModule({
      providers: [
        BookingsService,
        { provide: DataSource, useValue: dataSourceMock },
        {
          provide: getRepositoryToken(Booking),
          useValue: bookingsRepositoryMock,
        },
        { provide: ToursService, useValue: toursServiceMock },
      ],
    }).compile();

    service = module.get(BookingsService);
  });

  describe('book', () => {
    it('rejects with NotFoundException for an unknown tour and never inserts', async () => {
      entityManagerMock.findOne.mockResolvedValue(null);

      await expect(service.book(tourId, hiker)).rejects.toThrow(
        NotFoundException,
      );
      expect(entityManagerMock.insert).not.toHaveBeenCalled();
    });

    it('rejects with ConflictException when the tour has already started', async () => {
      entityManagerMock.findOne.mockResolvedValue({
        id: tourId,
        ...tourAt(-HOUR_MS),
      });

      await expect(service.book(tourId, hiker)).rejects.toThrow(
        new ConflictException('Tour has already started'),
      );
      expect(entityManagerMock.insert).not.toHaveBeenCalled();
    });

    it('translates a Postgres unique violation into a double-book conflict', async () => {
      entityManagerMock.findOne.mockResolvedValue(futureTour);
      entityManagerMock.insert.mockRejectedValue({ code: '23505' });

      await expect(service.book(tourId, hiker)).rejects.toThrow(
        new ConflictException('You already booked this tour'),
      );
      // The counter is never touched when the insert loses the race.
      expect(updateBuilderMock.execute).not.toHaveBeenCalled();
    });

    it('rethrows an insert failure that is not a unique violation', async () => {
      entityManagerMock.findOne.mockResolvedValue(futureTour);
      entityManagerMock.insert.mockRejectedValue(new Error('connection lost'));

      await expect(service.book(tourId, hiker)).rejects.toThrow(
        'connection lost',
      );
    });

    it('rejects with Tour is full inside the transaction when the guarded update affects no row', async () => {
      entityManagerMock.findOne.mockResolvedValue(futureTour);
      entityManagerMock.insert.mockResolvedValue({});
      updateBuilderMock.execute.mockResolvedValue({ affected: 0 });

      await expect(service.book(tourId, hiker)).rejects.toThrow(
        new ConflictException('Tour is full'),
      );

      // The insert did run: the conflict is raised inside the callback so the
      // whole transaction, booking row included, rolls back.
      expect(entityManagerMock.insert).toHaveBeenCalledTimes(1);
      expect(dataSourceMock.transaction).toHaveBeenCalledTimes(1);
      expect(bookingsRepositoryMock.findOneOrFail).not.toHaveBeenCalled();
    });

    it('inserts, increments under the capacity guard and returns the contract shape', async () => {
      entityManagerMock.findOne.mockResolvedValue(futureTour);
      entityManagerMock.insert.mockResolvedValue({});

      const dto = await service.book(tourId, hiker);

      expect(entityManagerMock.insert).toHaveBeenCalledWith(Booking, {
        tourId,
        hikerId: hiker.id,
      });
      expect(updateBuilderMock.update).toHaveBeenCalledWith(Tour);
      expect(updateBuilderMock.where).toHaveBeenCalledWith(
        'id = :id AND "bookedCount" < capacity',
        { id: tourId },
      );
      expect(updateBuilderMock.execute).toHaveBeenCalledTimes(1);
      expect(toursServiceMock.findById).toHaveBeenCalledWith(tourId, hiker);
      expect(Object.keys(dto).sort()).toEqual([
        'createdAt',
        'id',
        'status',
        'tour',
      ]);
      expect(dto).toEqual({
        id: bookingRow.id,
        status: 'CONFIRMED',
        createdAt: bookingRow.createdAt.toISOString(),
        tour: tourDto,
      });
    });
  });

  describe('cancel', () => {
    it('rejects with NotFoundException when the booking is unknown or belongs to someone else', async () => {
      entityManagerMock.findOne.mockResolvedValue(null);

      await expect(service.cancel(bookingRow.id, hiker)).rejects.toThrow(
        new NotFoundException('Booking not found'),
      );
      expect(entityManagerMock.delete).not.toHaveBeenCalled();
    });

    it('rejects a cancellation less than 24 h before the start', async () => {
      entityManagerMock.findOne.mockResolvedValue({
        ...bookingRow,
        tour: { id: tourId, ...tourAt(23 * HOUR_MS + 59 * 60 * 1000) } as Tour,
      });

      await expect(service.cancel(bookingRow.id, hiker)).rejects.toThrow(
        new ConflictException(
          'Bookings can only be cancelled up to 24 h before the tour starts',
        ),
      );
      expect(entityManagerMock.delete).not.toHaveBeenCalled();
      expect(updateBuilderMock.execute).not.toHaveBeenCalled();
    });

    it('deletes the row and decrements the counter with a zero floor', async () => {
      entityManagerMock.findOne.mockResolvedValue({
        ...bookingRow,
        tour: { id: tourId, ...tourAt(25 * HOUR_MS) } as Tour,
      });

      await service.cancel(bookingRow.id, hiker);

      expect(entityManagerMock.delete).toHaveBeenCalledWith(
        Booking,
        bookingRow.id,
      );
      expect(updateBuilderMock.update).toHaveBeenCalledWith(Tour);
      expect(updateBuilderMock.where).toHaveBeenCalledWith('id = :id', {
        id: tourId,
      });
      expect(updateBuilderMock.execute).toHaveBeenCalledTimes(1);

      const setArgument = updateBuilderMock.set.mock.calls[0][0];
      const bookedCount = setArgument.bookedCount as () => string;
      expect(bookedCount()).toBe('GREATEST("bookedCount" - 1, 0)');
    });
  });

  describe('findMine', () => {
    it('stitches bookings in query order from a single findManyByIds call', async () => {
      const other = 'tour-other';
      const rows = [
        { ...bookingRow, id: 'b-1', tourId: other, status: 'PAID' as const },
        { ...bookingRow, id: 'b-2', tourId },
      ] as Booking[];

      bookingsQueryBuilderMock.getMany.mockResolvedValue(rows);
      // Deliberately returned in the other order: the booking query owns the
      // ordering, so the stitch must not inherit this one.
      toursServiceMock.findManyByIds.mockResolvedValue([
        tourDto,
        { id: other, isBookedByMe: true } as TourDto,
      ]);

      const result = await service.findMine(hiker);

      expect(toursServiceMock.findManyByIds).toHaveBeenCalledTimes(1);
      expect(toursServiceMock.findManyByIds).toHaveBeenCalledWith(
        [other, tourId],
        hiker,
      );
      expect(result.map((booking) => booking.id)).toEqual(['b-1', 'b-2']);
      expect(result.map((booking) => booking.tour.id)).toEqual([other, tourId]);
      expect(result[0].status).toBe('PAID');
      expect(result[0].createdAt).toBe(bookingRow.createdAt.toISOString());
    });

    it('filters to the caller and to upcoming tours', async () => {
      bookingsQueryBuilderMock.getMany.mockResolvedValue([]);

      const result = await service.findMine(hiker);

      expect(result).toEqual([]);
      expect(bookingsQueryBuilderMock.where).toHaveBeenCalledWith(
        'booking.hikerId = :hikerId',
        { hikerId: hiker.id },
      );
      expect(bookingsQueryBuilderMock.andWhere).toHaveBeenCalledWith(
        'tour.date >= CURRENT_DATE',
      );
      expect(bookingsQueryBuilderMock.orderBy).toHaveBeenCalledWith(
        'tour.date',
        'ASC',
      );
      expect(bookingsQueryBuilderMock.addOrderBy).toHaveBeenCalledWith(
        'tour.startTime',
        'ASC',
      );
    });
  });
});
