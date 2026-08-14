import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateRouteDto } from './dto/create-route.dto';
import { ListRoutesQueryDto } from './dto/list-routes-query.dto';
import { RouteDto } from './dto/route-dto';
import { Tour } from '../tours/tour.entity';
import { Route } from './route.entity';
import { computeRouteStats } from './route-stats';

@Injectable()
export class RoutesService {
  constructor(
    @InjectRepository(Route)
    private readonly routes: Repository<Route>,
    @InjectRepository(Tour)
    private readonly tours: Repository<Tour>,
  ) {}

  private baseQuery() {
    return this.routes
      .createQueryBuilder('route')
      .leftJoin('route.author', 'author')
      .addSelect(['author.id', 'author.displayName']);
  }

  async findAll(query: ListRoutesQueryDto): Promise<RouteDto[]> {
    const qb = this.baseQuery()
      .orderBy('route.createdAt', 'ASC')
      .addOrderBy('route.name', 'ASC');

    if (query.difficulty) {
      qb.andWhere('route.difficulty = :difficulty', {
        difficulty: query.difficulty,
      });
    }

    const search = query.search?.trim();
    if (search) {
      qb.andWhere(
        '(route.name ILIKE :search OR route.description ILIKE :search)',
        { search: '%' + search + '%' },
      );
    }

    const rows = await qb.getMany();
    const counts = await this.upcomingTourCounts(rows.map((r) => r.id));
    return rows.map((route) => this.toDto(route, counts.get(route.id) ?? 0));
  }

  async findMine(authorId: string): Promise<RouteDto[]> {
    const rows = await this.baseQuery()
      .where('route.authorId = :authorId', { authorId })
      .orderBy('route.createdAt', 'ASC')
      .getMany();

    const counts = await this.upcomingTourCounts(rows.map((r) => r.id));
    return rows.map((route) => this.toDto(route, counts.get(route.id) ?? 0));
  }

  async findById(id: string): Promise<RouteDto> {
    const route = await this.baseQuery()
      .where('route.id = :id', { id })
      .getOne();

    if (route === null) {
      throw new NotFoundException('Route not found');
    }

    const counts = await this.upcomingTourCounts([route.id]);
    return this.toDto(route, counts.get(route.id) ?? 0);
  }

  async create(dto: CreateRouteDto, authorId: string): Promise<RouteDto> {
    const description = dto.description?.trim()
      ? dto.description.trim()
      : 'No description yet.';
    const route = this.routes.create({
      name: dto.name,
      description,
      difficulty: dto.difficulty,
      activity: dto.activity,
      waypoints: dto.waypoints,
      authorId,
    });
    const saved = await this.routes.save(route);
    return this.findById(saved.id);
  }

  // The date >= CURRENT_DATE predicate is deliberately identical to the one in
  // ToursService so a route card count always equals the length of the list on
  // the route detail page.
  private async upcomingTourCounts(
    routeIds: string[],
  ): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    if (routeIds.length === 0) {
      return counts;
    }

    const rows = await this.tours
      .createQueryBuilder('tour')
      .select('tour.routeId', 'routeId')
      .addSelect('COUNT(*)', 'count')
      .where('tour.routeId IN (:...routeIds)', { routeIds })
      .andWhere('tour.date >= CURRENT_DATE')
      .groupBy('tour.routeId')
      .getRawMany<{ routeId: string; count: string }>();

    for (const row of rows) {
      counts.set(row.routeId, Number(row.count));
    }

    return counts;
  }

  private toDto(route: Route, tourCount: number): RouteDto {
    return {
      id: route.id,
      name: route.name,
      description: route.description,
      difficulty: route.difficulty,
      activity: route.activity,
      author: {
        id: route.author.id,
        displayName: route.author.displayName,
      },
      waypoints: route.waypoints,
      waypointCount: route.waypoints.length,
      tourCount,
      ...computeRouteStats(route.waypoints, route.activity),
      createdAt: route.createdAt.toISOString(),
    };
  }
}
