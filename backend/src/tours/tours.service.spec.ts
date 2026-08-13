import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ToursService } from './tours.service';
import { Tour } from './tour.entity';
import { Route, RouteActivity, RouteDifficulty } from '../routes/route.entity';
import { User, UserRole } from '../users/user.entity';
import {
  durationHours,
  elevationGainM,
  pathDistanceKm,
} from '../routes/route-stats';
import { computeEndTime, timeLabel } from './tour-time';
import { CreateTourDto } from './dto/create-tour.dto';
import { TourDto } from './dto/tour-dto';

type QueryBuilderMock = {
  leftJoinAndSelect: jest.Mock<QueryBuilderMock, [string, string]>;
  leftJoin: jest.Mock<QueryBuilderMock, [string, string]>;
  addSelect: jest.Mock<QueryBuilderMock, [string | string[], string?]>;
  where: jest.Mock<QueryBuilderMock, [string, Record<string, unknown>?]>;
  andWhere: jest.Mock<QueryBuilderMock, [string, Record<string, unknown>]>;
  orderBy: jest.Mock<QueryBuilderMock, [string, string]>;
  addOrderBy: jest.Mock<QueryBuilderMock, [string, string]>;
  select: jest.Mock<QueryBuilderMock, [string, string]>;
  groupBy: jest.Mock<QueryBuilderMock, [string]>;
  getMany: jest.Mock<Promise<Tour[]>, []>;
  getOne: jest.Mock<Promise<Tour | null>, []>;
  getRawMany: jest.Mock<Promise<Array<{ guideId: string; count: string }>>, []>;
};

const queryBuilderMock: QueryBuilderMock = {
  leftJoinAndSelect: jest
    .fn<QueryBuilderMock, [string, string]>()
    .mockReturnThis(),
  leftJoin: jest.fn<QueryBuilderMock, [string, string]>().mockReturnThis(),
  addSelect: jest
    .fn<QueryBuilderMock, [string | string[], string?]>()
    .mockReturnThis(),
  where: jest
    .fn<QueryBuilderMock, [string, Record<string, unknown>?]>()
    .mockReturnThis(),
  andWhere: jest
    .fn<QueryBuilderMock, [string, Record<string, unknown>]>()
    .mockReturnThis(),
  orderBy: jest.fn<QueryBuilderMock, [string, string]>().mockReturnThis(),
  addOrderBy: jest.fn<QueryBuilderMock, [string, string]>().mockReturnThis(),
  select: jest.fn<QueryBuilderMock, [string, string]>().mockReturnThis(),
  groupBy: jest.fn<QueryBuilderMock, [string]>().mockReturnThis(),
  getMany: jest.fn<Promise<Tour[]>, []>(),
  getOne: jest.fn<Promise<Tour | null>, []>(),
  getRawMany: jest.fn<Promise<Array<{ guideId: string; count: string }>>, []>(),
};

type ToursRepositoryMock = jest.Mocked<
  Pick<Repository<Tour>, 'createQueryBuilder' | 'create' | 'save'>
>;

const toursRepositoryMock: ToursRepositoryMock = {
  createQueryBuilder: jest.fn(
    () => queryBuilderMock,
  ) as unknown as ToursRepositoryMock['createQueryBuilder'],
  create: jest.fn(() => ({
    id: 'tour-1',
  })) as unknown as ToursRepositoryMock['create'],
  save: jest.fn(() =>
    Promise.resolve({
      id: 'tour-1',
    }),
  ) as unknown as ToursRepositoryMock['save'],
};

type RoutesRepositoryMock = jest.Mocked<Pick<Repository<Route>, 'exists'>>;

const routesRepositoryMock: RoutesRepositoryMock = {
  exists: jest
    .fn<Promise<boolean>, [unknown]>()
    .mockResolvedValue(true) as unknown as RoutesRepositoryMock['exists'],
};

describe('ToursService', () => {
  let service: ToursService;

  const guide: User = {
    id: '11111111-1111-4111-8111-111111111111',
    displayName: 'Ivana Kovac',
    email: 'ivana@trailshare.hr',
    passwordHash: 'hashed-secret',
    role: UserRole.GUIDE,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  const waypoints: [number, number][] = [
    [45.9002, 15.9432],
    [45.9068, 15.9508],
    [45.9121, 15.9601],
    [45.9155, 15.9723],
    [45.9098, 15.9805],
    [45.9012, 15.9748],
    [45.8961, 15.9612],
    [45.9002, 15.9432],
  ];

  const route: Route = {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'Medvednica Ridge Loop',
    description: 'A steady climb through beech forest onto the ridge.',
    difficulty: RouteDifficulty.MODERATE,
    activity: RouteActivity.HIKING,
    author: guide,
    authorId: guide.id,
    waypoints,
    createdAt: new Date('2026-02-03T09:00:00.000Z'),
  };

  const tour: Tour = {
    id: '33333333-3333-4333-8333-333333333333',
    route,
    routeId: route.id,
    guide,
    guideId: guide.id,
    date: '2030-08-22',
    startTime: '08:00:00',
    capacity: 12,
    bookedCount: 9,
    meetingPoint: 'Park entrance',
    pace: 'Moderate',
    notes: 'Bring water.',
    createdAt: new Date('2026-03-04T10:00:00.000Z'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    queryBuilderMock.getRawMany.mockResolvedValue([]);

    const module = await Test.createTestingModule({
      providers: [
        ToursService,
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

    service = module.get(ToursService);
  });

  describe('create', () => {
    it('rejects with NotFoundException when the route does not exist', async () => {
      routesRepositoryMock.exists.mockResolvedValue(false);

      const dto: CreateTourDto = {
        date: '2030-08-22',
        startTime: '08:00',
        capacity: 12,
        meetingPoint: 'Park entrance',
        pace: 'Moderate',
      };

      await expect(service.create(route.id, dto, guide.id)).rejects.toThrow(
        NotFoundException,
      );
      expect(toursRepositoryMock.save).not.toHaveBeenCalled();
    });

    it('rejects with BadRequestException when the date is in the past', async () => {
      routesRepositoryMock.exists.mockResolvedValue(true);

      const yesterday = new Date(Date.now() - 86400000);
      const yesterdayStr = `${yesterday.getFullYear()}-${String(
        yesterday.getMonth() + 1,
      ).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

      const dto: CreateTourDto = {
        date: yesterdayStr,
        startTime: '08:00',
        capacity: 12,
        meetingPoint: 'Park entrance',
        pace: 'Moderate',
      };

      await expect(service.create(route.id, dto, guide.id)).rejects.toThrow(
        BadRequestException,
      );
      expect(toursRepositoryMock.save).not.toHaveBeenCalled();
    });

    it('passes guideId and stores empty notes for undefined or whitespace input', async () => {
      routesRepositoryMock.exists.mockResolvedValue(true);
      toursRepositoryMock.create.mockReturnValue({ id: 'tour-new' } as Tour);
      toursRepositoryMock.save.mockResolvedValue({ id: 'tour-new' } as Tour);
      jest
        .spyOn(service, 'findById')
        .mockResolvedValue({ id: 'tour-new' } as TourDto);

      const baseDto: CreateTourDto = {
        date: '2030-08-22',
        startTime: '08:00',
        capacity: 12,
        meetingPoint: 'Park entrance',
        pace: 'Moderate',
      };

      await service.create(
        route.id,
        { ...baseDto, notes: undefined },
        guide.id,
      );
      await service.create(route.id, { ...baseDto, notes: '   ' }, guide.id);

      expect(toursRepositoryMock.create).toHaveBeenCalledTimes(2);
      // Both a missing and a blank notes field land in the column as ''.
      expect(toursRepositoryMock.create).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          routeId: route.id,
          guideId: guide.id,
          notes: '',
        }),
      );
      expect(toursRepositoryMock.create).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          routeId: route.id,
          guideId: guide.id,
          notes: '',
        }),
      );
    });
  });

  describe('findById', () => {
    it('decorates a tour with computed time, seats and guide stats', async () => {
      queryBuilderMock.getOne.mockResolvedValue(tour);
      queryBuilderMock.getRawMany.mockResolvedValue([
        { guideId: guide.id, count: '3' },
      ]);

      const dto = await service.findById(tour.id);

      expect(dto.startTime).toBe('08:00');

      const distance = pathDistanceKm(route.waypoints);
      const elevation = elevationGainM(distance, route.waypoints.length);
      const expectedEndTime = computeEndTime(
        dto.startTime,
        durationHours(distance, elevation, route.activity),
      );

      expect(dto.endTime).toBe(expectedEndTime);
      expect(dto.timeLabel).toBe(timeLabel(dto.startTime, dto.endTime));
      expect(dto.seatsLeft).toBe(tour.capacity - tour.bookedCount);
      expect(dto.isFull).toBe(false);
      expect(dto.isBookedByMe).toBe(false);
      expect(dto.guide.rating).toBe(4.9);
      expect(dto.guide.toursLed).toBe(3);
      expect(Object.keys(dto.guide).sort()).toEqual([
        'displayName',
        'id',
        'rating',
        'toursLed',
      ]);
      expect('roster' in dto).toBe(false);
    });

    it('marks a tour as full when capacity is reached', async () => {
      const fullTour: Tour = { ...tour, bookedCount: tour.capacity };
      queryBuilderMock.getOne.mockResolvedValue(fullTour);
      queryBuilderMock.getRawMany.mockResolvedValue([
        { guideId: guide.id, count: '3' },
      ]);

      const dto = await service.findById(fullTour.id);

      expect(dto.seatsLeft).toBe(0);
      expect(dto.isFull).toBe(true);
    });
  });

  describe('findUpcoming', () => {
    it('resolves guide tour counts with a single grouped query', async () => {
      const guideB: User = {
        ...guide,
        id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        displayName: 'Marko Horvat',
      };

      const routeB: Route = {
        ...route,
        id: '44444444-4444-4444-8444-444444444444',
      };

      const tourA: Tour = {
        ...tour,
        id: 'tour-a',
        guide,
        guideId: guide.id,
      };
      const tourB: Tour = {
        ...tour,
        id: 'tour-b',
        guide: guideB,
        guideId: guideB.id,
        route: routeB,
        routeId: routeB.id,
      };
      const tourC: Tour = {
        ...tour,
        id: 'tour-c',
        guide,
        guideId: guide.id,
      };

      queryBuilderMock.getMany.mockResolvedValue([tourA, tourB, tourC]);
      queryBuilderMock.getRawMany.mockResolvedValue([
        { guideId: guide.id, count: '5' },
        { guideId: guideB.id, count: '2' },
      ]);

      const result = await service.findUpcoming();

      expect(queryBuilderMock.getRawMany).toHaveBeenCalledTimes(1);
      expect(result[0].guide.toursLed).toBe(5);
      expect(result[1].guide.toursLed).toBe(2);
      expect(result[2].guide.toursLed).toBe(5);
    });
  });
});
