import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RoutesService } from './routes.service';
import { Route, RouteActivity, RouteDifficulty } from './route.entity';
import { Tour } from '../tours/tour.entity';
import { User, UserRole } from '../users/user.entity';
import { computeRouteStats } from './route-stats';
import { CreateRouteDto } from './dto/create-route.dto';
import { RouteDto } from './dto/route-dto';

type QueryBuilderMock = {
  leftJoin: jest.Mock<QueryBuilderMock, [string, string]>;
  addSelect: jest.Mock<QueryBuilderMock, [string[]]>;
  orderBy: jest.Mock<QueryBuilderMock, [string, string]>;
  addOrderBy: jest.Mock<QueryBuilderMock, [string, string]>;
  andWhere: jest.Mock<QueryBuilderMock, [string, Record<string, unknown>]>;
  where: jest.Mock<QueryBuilderMock, [string, Record<string, unknown>]>;
  getMany: jest.Mock<Promise<Route[]>, []>;
  getOne: jest.Mock<Promise<Route | null>, []>;
};

const queryBuilderMock: QueryBuilderMock = {
  leftJoin: jest.fn<QueryBuilderMock, [string, string]>().mockReturnThis(),
  addSelect: jest.fn<QueryBuilderMock, [string[]]>().mockReturnThis(),
  orderBy: jest.fn<QueryBuilderMock, [string, string]>().mockReturnThis(),
  addOrderBy: jest.fn<QueryBuilderMock, [string, string]>().mockReturnThis(),
  andWhere: jest
    .fn<QueryBuilderMock, [string, Record<string, unknown>]>()
    .mockReturnThis(),
  where: jest
    .fn<QueryBuilderMock, [string, Record<string, unknown>]>()
    .mockReturnThis(),
  getMany: jest.fn<Promise<Route[]>, []>(),
  getOne: jest.fn<Promise<Route | null>, []>(),
};

type TourQueryBuilderMock = {
  select: jest.Mock<TourQueryBuilderMock, [string, string]>;
  addSelect: jest.Mock<TourQueryBuilderMock, [string, string]>;
  where: jest.Mock<TourQueryBuilderMock, [string, Record<string, unknown>]>;
  andWhere: jest.Mock<TourQueryBuilderMock, [string, Record<string, unknown>]>;
  groupBy: jest.Mock<TourQueryBuilderMock, [string]>;
  getRawMany: jest.Mock<Promise<Array<{ routeId: string; count: string }>>, []>;
};

const tourQueryBuilderMock: TourQueryBuilderMock = {
  select: jest.fn<TourQueryBuilderMock, [string, string]>().mockReturnThis(),
  addSelect: jest.fn<TourQueryBuilderMock, [string, string]>().mockReturnThis(),
  where: jest
    .fn<TourQueryBuilderMock, [string, Record<string, unknown>]>()
    .mockReturnThis(),
  andWhere: jest
    .fn<TourQueryBuilderMock, [string, Record<string, unknown>]>()
    .mockReturnThis(),
  groupBy: jest.fn<TourQueryBuilderMock, [string]>().mockReturnThis(),
  getRawMany: jest.fn<Promise<Array<{ routeId: string; count: string }>>, []>(),
};

type RoutesRepositoryMock = jest.Mocked<
  Pick<Repository<Route>, 'createQueryBuilder' | 'create' | 'save'>
>;

const routesRepositoryMock: RoutesRepositoryMock = {
  createQueryBuilder: jest.fn(
    () => queryBuilderMock,
  ) as unknown as RoutesRepositoryMock['createQueryBuilder'],
  create: jest.fn(() => ({
    id: 'route-1',
  })) as unknown as RoutesRepositoryMock['create'],
  save: jest.fn(() =>
    Promise.resolve({
      id: 'route-1',
    }),
  ) as unknown as RoutesRepositoryMock['save'],
};

type ToursRepositoryMock = jest.Mocked<
  Pick<Repository<Tour>, 'createQueryBuilder'>
>;

const toursRepositoryMock: ToursRepositoryMock = {
  createQueryBuilder: jest.fn(
    () => tourQueryBuilderMock,
  ) as unknown as ToursRepositoryMock['createQueryBuilder'],
};

describe('RoutesService', () => {
  let service: RoutesService;

  const author: User = {
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
    author,
    authorId: author.id,
    waypoints,
    createdAt: new Date('2026-02-03T09:00:00.000Z'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    tourQueryBuilderMock.getRawMany.mockResolvedValue([]);

    const module = await Test.createTestingModule({
      providers: [
        RoutesService,
        {
          provide: getRepositoryToken(Route),
          useValue: routesRepositoryMock,
        },
        {
          provide: getRepositoryToken(Tour),
          useValue: toursRepositoryMock,
        },
      ],
    }).compile();

    service = module.get(RoutesService);
  });

  describe('findById', () => {
    it('maps a route entity to the DTO contract', async () => {
      queryBuilderMock.getOne.mockResolvedValue(route);

      const dto = await service.findById(route.id);

      expect(dto.id).toBe(route.id);
      expect(dto.name).toBe(route.name);
      expect(dto.description).toBe(route.description);
      expect(dto.difficulty).toBe(route.difficulty);
      expect(dto.activity).toBe(route.activity);
      expect(dto.waypoints).toEqual(waypoints);
      expect(dto.waypointCount).toBe(8);
      expect(dto.tourCount).toBe(0);
      expect(dto.createdAt).toBe('2026-02-03T09:00:00.000Z');

      const stats = computeRouteStats(waypoints, RouteActivity.HIKING);
      expect(dto.distanceKm).toBe(stats.distanceKm);
      expect(dto.distanceLabel).toBe(stats.distanceLabel);
      expect(dto.elevationM).toBe(stats.elevationM);
      expect(dto.elevationLabel).toBe(stats.elevationLabel);
      expect(dto.durationLabel).toBe(stats.durationLabel);

      expect(dto.distanceLabel).toBe('7.5 km');
      expect(dto.elevationM).toBe(440);
      expect(dto.durationLabel).toBe('2 h 30 min');
    });

    it('exposes only id and displayName on the author', async () => {
      queryBuilderMock.getOne.mockResolvedValue(route);

      const dto = await service.findById(route.id);

      expect(Object.keys(dto.author).sort()).toEqual(['displayName', 'id']);
      expect(dto.author).toEqual({
        id: author.id,
        displayName: author.displayName,
      });
      expect(dto.author).not.toHaveProperty('email');
      expect(dto.author).not.toHaveProperty('passwordHash');
    });

    it('throws NotFoundException when the route does not exist', async () => {
      queryBuilderMock.getOne.mockResolvedValue(null);

      await expect(
        service.findById('33333333-3333-4333-8333-333333333333'),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.findById('33333333-3333-4333-8333-333333333333'),
      ).rejects.toThrow('Route not found');
    });
  });

  describe('create', () => {
    const createWaypoints: [number, number][] = [
      [45.9, 15.9],
      [45.91, 15.91],
    ];

    function arrangeCreate(): {
      routeDto: RouteDto;
      findByIdSpy: jest.SpyInstance<Promise<RouteDto>, [string]>;
    } {
      routesRepositoryMock.create.mockReturnValue({
        id: 'route-1',
      } as Route);
      routesRepositoryMock.save.mockResolvedValue({
        id: 'route-1',
      } as Route);
      const routeDto: RouteDto = {
        id: 'route-1',
        name: 'Sljeme Summit Climb',
        description: 'Steep but shaded.',
        difficulty: RouteDifficulty.HARD,
        activity: RouteActivity.HIKING,
        author: {
          id: author.id,
          displayName: author.displayName,
        },
        waypoints: createWaypoints,
        waypointCount: createWaypoints.length,
        tourCount: 0,
        distanceKm: 0,
        distanceLabel: '0.0 km',
        elevationM: 0,
        elevationLabel: '0 m',
        durationLabel: '0 min',
        createdAt: '2026-01-01T00:00:00.000Z',
      };
      const findByIdSpy = jest
        .spyOn(service, 'findById')
        .mockResolvedValue(routeDto);
      return { routeDto, findByIdSpy };
    }

    it('sets authorId from the argument and passes the literal waypoints through', async () => {
      const { routeDto, findByIdSpy } = arrangeCreate();
      const dto: CreateRouteDto = {
        name: 'Sljeme Summit Climb',
        description: 'Steep but shaded.',
        difficulty: RouteDifficulty.HARD,
        activity: RouteActivity.HIKING,
        waypoints: createWaypoints,
      };

      const result = await service.create(dto, 'author-9');

      expect(routesRepositoryMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          authorId: 'author-9',
          name: 'Sljeme Summit Climb',
          difficulty: RouteDifficulty.HARD,
          activity: RouteActivity.HIKING,
          waypoints: createWaypoints,
        }),
      );
      expect(routesRepositoryMock.save).toHaveBeenCalledWith(
        routesRepositoryMock.create.mock.results[0].value,
      );
      expect(findByIdSpy).toHaveBeenCalledWith('route-1');
      expect(findByIdSpy).toHaveBeenCalledTimes(1);
      expect(result).toBe(routeDto);
    });

    it('defaults the description when it is undefined', async () => {
      arrangeCreate();
      const dto: CreateRouteDto = {
        name: 'Sljeme Summit Climb',
        difficulty: RouteDifficulty.HARD,
        activity: RouteActivity.HIKING,
        waypoints: createWaypoints,
      };

      await service.create(dto, 'author-9');

      expect(routesRepositoryMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'No description yet.',
        }),
      );
    });

    it('defaults the description when it is the empty string', async () => {
      arrangeCreate();
      const dto: CreateRouteDto = {
        name: 'Sljeme Summit Climb',
        description: '',
        difficulty: RouteDifficulty.HARD,
        activity: RouteActivity.HIKING,
        waypoints: createWaypoints,
      };

      await service.create(dto, 'author-9');

      expect(routesRepositoryMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'No description yet.',
        }),
      );
    });

    it('defaults the description when it is three spaces', async () => {
      arrangeCreate();
      const dto: CreateRouteDto = {
        name: 'Sljeme Summit Climb',
        description: '   ',
        difficulty: RouteDifficulty.HARD,
        activity: RouteActivity.HIKING,
        waypoints: createWaypoints,
      };

      await service.create(dto, 'author-9');

      expect(routesRepositoryMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'No description yet.',
        }),
      );
    });

    it('keeps and trims a real description', async () => {
      arrangeCreate();
      const dto: CreateRouteDto = {
        name: 'Sljeme Summit Climb',
        description: ' Steep but shaded. ',
        difficulty: RouteDifficulty.HARD,
        activity: RouteActivity.HIKING,
        waypoints: createWaypoints,
      };

      await service.create(dto, 'author-9');

      expect(routesRepositoryMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Steep but shaded.',
        }),
      );
    });

    it('a body that smuggles its own authorId cannot publish as someone else', async () => {
      arrangeCreate();
      const dto = Object.assign(
        {
          name: 'Sljeme Summit Climb',
          description: 'Steep but shaded.',
          difficulty: RouteDifficulty.HARD,
          activity: RouteActivity.HIKING,
          waypoints: createWaypoints,
        },
        { authorId: 'attacker-id' },
      ) as CreateRouteDto;

      await service.create(dto, 'author-9');

      expect(routesRepositoryMock.create).toHaveBeenCalledWith(
        expect.objectContaining({ authorId: 'author-9' }),
      );
      expect(routesRepositoryMock.create).toHaveBeenCalledWith(
        expect.not.objectContaining({ authorId: 'attacker-id' }),
      );
    });
  });

  describe('findAll', () => {
    it('applies the difficulty and search filters', async () => {
      queryBuilderMock.getMany.mockResolvedValue([]);

      const result = await service.findAll({
        difficulty: RouteDifficulty.EASY,
        search: 'lake',
      });

      expect(queryBuilderMock.andWhere).toHaveBeenCalledTimes(2);
      expect(queryBuilderMock.andWhere).toHaveBeenCalledWith(
        'route.difficulty = :difficulty',
        { difficulty: RouteDifficulty.EASY },
      );
      expect(queryBuilderMock.andWhere).toHaveBeenCalledWith(
        '(route.name ILIKE :search OR route.description ILIKE :search)',
        { search: '%lake%' },
      );
      expect(result).toEqual([]);
    });

    it('does not filter when the query is empty', async () => {
      queryBuilderMock.getMany.mockResolvedValue([]);

      const result = await service.findAll({});

      expect(queryBuilderMock.andWhere).not.toHaveBeenCalled();
      expect(queryBuilderMock.orderBy).toHaveBeenCalledWith(
        'route.createdAt',
        'ASC',
      );
      expect(queryBuilderMock.addOrderBy).toHaveBeenCalledWith(
        'route.name',
        'ASC',
      );
      expect(result).toEqual([]);
    });

    it('counts upcoming tours for each route with a single grouped query', async () => {
      const routeA: Route = {
        ...route,
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      };
      const routeB: Route = {
        ...route,
        id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      };
      queryBuilderMock.getMany.mockResolvedValue([routeA, routeB]);
      tourQueryBuilderMock.getRawMany.mockResolvedValue([
        { routeId: routeA.id, count: '2' },
      ]);

      const result = await service.findAll({});

      expect(result[0].tourCount).toBe(2);
      expect(result[1].tourCount).toBe(0);
      expect(toursRepositoryMock.createQueryBuilder).toHaveBeenCalledTimes(1);
    });
  });

  describe('findMine', () => {
    it('filters by the author id and orders by createdAt ASC', async () => {
      queryBuilderMock.getMany.mockResolvedValue([]);

      await service.findMine(author.id);

      expect(queryBuilderMock.where).toHaveBeenCalledWith(
        'route.authorId = :authorId',
        { authorId: author.id },
      );
      expect(queryBuilderMock.orderBy).toHaveBeenCalledWith(
        'route.createdAt',
        'ASC',
      );
      expect(queryBuilderMock.andWhere).not.toHaveBeenCalled();
      expect(queryBuilderMock.addOrderBy).not.toHaveBeenCalled();
    });

    it('returns decorated DTOs with the tour count from the grouped query', async () => {
      const routeA: Route = {
        ...route,
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      };
      const routeB: Route = {
        ...route,
        id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      };
      queryBuilderMock.getMany.mockResolvedValue([routeA, routeB]);
      tourQueryBuilderMock.getRawMany.mockResolvedValue([
        { routeId: routeB.id, count: '3' },
      ]);

      const result = await service.findMine(author.id);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(routeA.id);
      expect(result[0].tourCount).toBe(0);
      expect(result[1].id).toBe(routeB.id);
      expect(result[1].tourCount).toBe(3);

      expect(result[0].waypointCount).toBe(8);
      expect(result[0].distanceLabel).toBe('7.5 km');
      expect(result[0].author).toEqual({
        id: author.id,
        displayName: author.displayName,
      });
      expect(result[0].author).not.toHaveProperty('passwordHash');
      expect(toursRepositoryMock.createQueryBuilder).toHaveBeenCalledTimes(1);
    });

    it('returns an empty array when the author has no routes', async () => {
      queryBuilderMock.getMany.mockResolvedValue([]);

      const result = await service.findMine(
        '33333333-3333-4333-8333-333333333333',
      );

      expect(result).toEqual([]);
      expect(toursRepositoryMock.createQueryBuilder).not.toHaveBeenCalled();
    });
  });
});
