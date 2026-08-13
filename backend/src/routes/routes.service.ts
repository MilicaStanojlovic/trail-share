import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateRouteDto } from './dto/create-route.dto';
import { ListRoutesQueryDto } from './dto/list-routes-query.dto';
import { RouteDto } from './dto/route-dto';
import { Route } from './route.entity';
import { computeRouteStats } from './route-stats';

@Injectable()
export class RoutesService {
  constructor(
    @InjectRepository(Route)
    private readonly routes: Repository<Route>,
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
    return rows.map((route) => this.toDto(route));
  }

  async findById(id: string): Promise<RouteDto> {
    const route = await this.baseQuery()
      .where('route.id = :id', { id })
      .getOne();

    if (route === null) {
      throw new NotFoundException('Route not found');
    }

    return this.toDto(route);
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

  private toDto(route: Route): RouteDto {
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
      tourCount: 0, // The real count arrives with the Tour entity in slice 5.
      ...computeRouteStats(route.waypoints, route.activity),
      createdAt: route.createdAt.toISOString(),
    };
  }
}
