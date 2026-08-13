import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RoutesService } from './routes.service';
import { Route, RouteActivity, RouteDifficulty } from './route.entity';
import { User, UserRole } from '../users/user.entity';
import { computeRouteStats } from './route-stats';

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

type RoutesRepositoryMock = jest.Mocked<
  Pick<Repository<Route>, 'createQueryBuilder'>
>;

const routesRepositoryMock: RoutesRepositoryMock = {
  createQueryBuilder: jest.fn(
    () => queryBuilderMock,
  ) as unknown as RoutesRepositoryMock['createQueryBuilder'],
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

    const module = await Test.createTestingModule({
      providers: [
        RoutesService,
        {
          provide: getRepositoryToken(Route),
          useValue: routesRepositoryMock,
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
  });
});
