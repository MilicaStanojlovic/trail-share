import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GuideService, daysUntil } from './guide.service';
import { Route } from '../routes/route.entity';
import { Tour } from '../tours/tour.entity';

type RawUpcoming = { count: string; nextDate: string | null };
type RawSeats = { seats: string | null };

type QueryBuilderMock = {
  select: jest.Mock<QueryBuilderMock, [string, string]>;
  addSelect: jest.Mock<QueryBuilderMock, [string, string]>;
  where: jest.Mock<QueryBuilderMock, [string, Record<string, unknown>?]>;
  andWhere: jest.Mock<QueryBuilderMock, [string, Record<string, unknown>?]>;
  getRawOne: jest.Mock<Promise<RawUpcoming | RawSeats | undefined>, []>;
};

const queryBuilderMock: QueryBuilderMock = {
  select: jest.fn<QueryBuilderMock, [string, string]>().mockReturnThis(),
  addSelect: jest.fn<QueryBuilderMock, [string, string]>().mockReturnThis(),
  where: jest
    .fn<QueryBuilderMock, [string, Record<string, unknown>?]>()
    .mockReturnThis(),
  andWhere: jest
    .fn<QueryBuilderMock, [string, Record<string, unknown>?]>()
    .mockReturnThis(),
  getRawOne: jest.fn<Promise<RawUpcoming | RawSeats | undefined>, []>(),
};

type ToursRepositoryMock = jest.Mocked<
  Pick<Repository<Tour>, 'createQueryBuilder'>
>;

const toursRepositoryMock: ToursRepositoryMock = {
  createQueryBuilder: jest.fn(
    () => queryBuilderMock,
  ) as unknown as ToursRepositoryMock['createQueryBuilder'],
};

type RoutesRepositoryMock = jest.Mocked<Pick<Repository<Route>, 'count'>>;

const routesRepositoryMock: RoutesRepositoryMock = {
  count: jest.fn<Promise<number>, [unknown]>() as unknown as jest.Mocked<
    Repository<Route>
  >['count'],
};

// A local calendar day `offset` days from local midnight today, written the way
// Postgres hands a date column back once cast to text. Built from calendar
// fields rather than millisecond arithmetic so a DST boundary cannot shift it.
function localDayIso(offset: number): string {
  const now = new Date();
  const day = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + offset,
  );
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(
    2,
    '0',
  )}-${String(day.getDate()).padStart(2, '0')}`;
}

describe('GuideService', () => {
  let service: GuideService;

  const guideId = '11111111-1111-4111-8111-111111111111';

  beforeEach(async () => {
    jest.clearAllMocks();

    const module = await Test.createTestingModule({
      providers: [
        GuideService,
        {
          provide: getRepositoryToken(Tour),
          useValue: toursRepositoryMock,
        },
        {
          provide: getRepositoryToken(Route),
          useValue: routesRepositoryMock,
        },
      ],
    }).compile();

    service = module.get(GuideService);
  });

  describe('getDashboard', () => {
    it('maps the three queries into the dashboard DTO', async () => {
      queryBuilderMock.getRawOne
        .mockResolvedValueOnce({ count: '3', nextDate: localDayIso(9) })
        .mockResolvedValueOnce({ seats: '17' });
      routesRepositoryMock.count.mockResolvedValue(3);

      const dto = await service.getDashboard(guideId);

      expect(dto).toEqual({
        toursScheduled: 3,
        nextTourInDays: 9,
        seatsBooked: 17,
        routesPublished: 3,
        rating: { value: 4.9, count: 38 },
      });
    });

    it('scopes both aggregate queries to the guide and the upcoming predicate', async () => {
      queryBuilderMock.getRawOne
        .mockResolvedValueOnce({ count: '0', nextDate: null })
        .mockResolvedValueOnce({ seats: '0' });
      routesRepositoryMock.count.mockResolvedValue(0);

      await service.getDashboard(guideId);

      expect(toursRepositoryMock.createQueryBuilder).toHaveBeenCalledTimes(2);
      expect(queryBuilderMock.where).toHaveBeenCalledTimes(2);
      expect(queryBuilderMock.where).toHaveBeenNthCalledWith(
        1,
        'tour.guideId = :guideId',
        { guideId },
      );
      expect(queryBuilderMock.where).toHaveBeenNthCalledWith(
        2,
        'tour.guideId = :guideId',
        { guideId },
      );
      // Only the count query carries the date filter: seats sum "across all
      // tours", past ones included.
      expect(queryBuilderMock.andWhere).toHaveBeenCalledTimes(1);
      expect(queryBuilderMock.andWhere).toHaveBeenCalledWith(
        'tour.date >= CURRENT_DATE',
      );
      // MIN must come back as text, not a driver-parsed Date.
      expect(queryBuilderMock.addSelect).toHaveBeenCalledWith(
        'MIN(tour.date)::text',
        'nextDate',
      );
      expect(routesRepositoryMock.count).toHaveBeenCalledWith({
        where: { authorId: guideId },
      });
    });

    it('reports nextTourInDays as null when there are no upcoming tours', async () => {
      queryBuilderMock.getRawOne
        .mockResolvedValueOnce({ count: '0', nextDate: null })
        .mockResolvedValueOnce({ seats: '0' });
      routesRepositoryMock.count.mockResolvedValue(2);

      const dto = await service.getDashboard(guideId);

      expect(dto.toursScheduled).toBe(0);
      expect(dto.nextTourInDays).toBeNull();
      expect(dto.routesPublished).toBe(2);
    });

    it('reports nextTourInDays as 0 when the soonest tour is today', async () => {
      queryBuilderMock.getRawOne
        .mockResolvedValueOnce({ count: '1', nextDate: localDayIso(0) })
        .mockResolvedValueOnce({ seats: '4' });
      routesRepositoryMock.count.mockResolvedValue(1);

      const dto = await service.getDashboard(guideId);

      expect(dto.nextTourInDays).toBe(0);
    });

    it('reports seatsBooked as 0 rather than null or NaN when the sum is empty', async () => {
      queryBuilderMock.getRawOne
        .mockResolvedValueOnce({ count: '0', nextDate: null })
        .mockResolvedValueOnce({ seats: null });
      routesRepositoryMock.count.mockResolvedValue(0);

      const dto = await service.getDashboard(guideId);

      expect(dto.seatsBooked).toBe(0);
      expect(Number.isNaN(dto.seatsBooked)).toBe(false);
    });

    it('falls back to zeros when either aggregate query returns no row', async () => {
      queryBuilderMock.getRawOne
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined);
      routesRepositoryMock.count.mockResolvedValue(0);

      const dto = await service.getDashboard(guideId);

      expect(dto).toEqual({
        toursScheduled: 0,
        nextTourInDays: null,
        seatsBooked: 0,
        routesPublished: 0,
        rating: { value: 4.9, count: 38 },
      });
    });

    it('returns the rating stub unchanged', async () => {
      queryBuilderMock.getRawOne
        .mockResolvedValueOnce({ count: '2', nextDate: localDayIso(1) })
        .mockResolvedValueOnce({ seats: '9' });
      routesRepositoryMock.count.mockResolvedValue(5);

      const dto = await service.getDashboard(guideId);

      expect(dto.rating).toEqual({ value: 4.9, count: 38 });
    });
  });

  describe('daysUntil', () => {
    // Every case passes an explicit `from` so the wall clock cannot make these
    // flaky, and builds it from calendar fields so it is timezone-stable.
    it('returns 0 for the same calendar day', () => {
      expect(daysUntil('2026-08-13', new Date(2026, 7, 13))).toBe(0);
    });

    it('ignores the time of day on the `from` side', () => {
      expect(daysUntil('2026-08-13', new Date(2026, 7, 13, 23, 45))).toBe(0);
      expect(daysUntil('2026-08-14', new Date(2026, 7, 13, 23, 45))).toBe(1);
    });

    it('returns 1 for tomorrow', () => {
      expect(daysUntil('2026-08-14', new Date(2026, 7, 13))).toBe(1);
    });

    it('returns 9 for nine days out', () => {
      expect(daysUntil('2026-08-22', new Date(2026, 7, 13))).toBe(9);
    });

    it('counts across a month boundary', () => {
      expect(daysUntil('2026-09-02', new Date(2026, 7, 30))).toBe(3);
    });

    it('returns a negative count for a past date', () => {
      expect(daysUntil('2026-08-11', new Date(2026, 7, 13))).toBe(-2);
    });
  });
});
