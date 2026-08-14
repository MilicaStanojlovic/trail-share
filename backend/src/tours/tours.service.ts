import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CreateTourDto } from './dto/create-tour.dto';
import { RosterEntryDto, TourDto } from './dto/tour-dto';
// import type, not a value import: AuthUser only ever appears in type position
// here, and a value import of it trips TS1272 at decorated call sites.
import type { AuthUser } from '../auth/auth-user';
import { Booking } from '../bookings/booking.entity';
import { Tour } from './tour.entity';
import { computeEndTime, normalizeTime, timeLabel } from './tour-time';
import { Route } from '../routes/route.entity';
import {
  computeRouteStats,
  durationHours,
  elevationGainM,
  pathDistanceKm,
} from '../routes/route-stats';

// Every guide shows the same rating: there is no rating entity behind it, and
// the design's per-guide numbers are not derivable from anything we store.
const GUIDE_RATING_STUB = 4.9;

@Injectable()
export class ToursService {
  constructor(
    @InjectRepository(Tour)
    private readonly tours: Repository<Tour>,
    @InjectRepository(Route)
    private readonly routes: Repository<Route>,
    @InjectRepository(Booking)
    private readonly bookings: Repository<Booking>,
  ) {}

  private baseQuery() {
    return (
      this.tours
        .createQueryBuilder('tour')
        // The route is joined whole — it carries no sensitive columns. The guide
        // is not: leftJoinAndSelect would read the password hash out of Postgres,
        // so only id and displayName are selected, exactly as RoutesService does
        // for a route's author.
        .leftJoinAndSelect('tour.route', 'route')
        .leftJoin('tour.guide', 'guide')
        .addSelect(['guide.id', 'guide.displayName'])
    );
  }

  // One predicate for "upcoming", shared by the tours list, a route's tour list
  // and RouteDto.tourCount, so a route card's count always equals the length of
  // the list on its detail page.
  private upcomingQuery() {
    return this.baseQuery()
      .where('tour.date >= CURRENT_DATE')
      .orderBy('tour.date', 'ASC')
      .addOrderBy('tour.startTime', 'ASC')
      .addOrderBy('tour.createdAt', 'ASC');
  }

  async findUpcoming(viewer?: AuthUser): Promise<TourDto[]> {
    const rows = await this.upcomingQuery().getMany();
    return this.decorateMany(rows, viewer);
  }

  async findById(id: string, viewer?: AuthUser): Promise<TourDto> {
    // No upcoming filter here: a deep link to a tour must keep working the day
    // after it ran.
    const tour = await this.baseQuery().where('tour.id = :id', { id }).getOne();

    if (tour === null) {
      throw new NotFoundException('Tour not found');
    }

    return this.decorateOne(tour, viewer);
  }

  // Upcoming only, like every other tour list: the dashboard and My tours both
  // describe tours still on the calendar.
  async findMine(guide: AuthUser): Promise<TourDto[]> {
    const rows = await this.upcomingQuery()
      .andWhere('tour.guideId = :guideId', { guideId: guide.id })
      .getMany();

    return this.decorateMany(rows, guide);
  }

  async findForRoute(routeId: string, viewer?: AuthUser): Promise<TourDto[]> {
    await this.assertRouteExists(routeId);

    const rows = await this.upcomingQuery()
      .andWhere('tour.routeId = :routeId', { routeId })
      .getMany();

    return this.decorateMany(rows, viewer);
  }

  // BookingsService uses this to decorate the caller's My bookings list.
  async findManyByIds(ids: string[], viewer?: AuthUser): Promise<TourDto[]> {
    if (ids.length === 0) {
      return [];
    }

    const rows = await this.baseQuery()
      .where('tour.id IN (:...ids)', { ids })
      .orderBy('tour.date', 'ASC')
      .addOrderBy('tour.startTime', 'ASC')
      .getMany();

    return this.decorateMany(rows, viewer);
  }

  async create(
    routeId: string,
    dto: CreateTourDto,
    guideId: string,
    viewer?: AuthUser,
  ): Promise<TourDto> {
    await this.assertRouteExists(routeId);

    if (dto.date < today()) {
      throw new BadRequestException('date must not be in the past');
    }

    const tour = this.tours.create({
      routeId,
      // The guide is always the caller, never anything the body claims.
      guideId,
      date: dto.date,
      startTime: dto.startTime,
      capacity: dto.capacity,
      meetingPoint: dto.meetingPoint,
      pace: dto.pace,
      notes: dto.notes?.trim() ?? '',
    });
    const saved = await this.tours.save(tour);
    return this.findById(saved.id, viewer);
  }

  private async assertRouteExists(routeId: string): Promise<void> {
    const routeExists = await this.routes.exists({ where: { id: routeId } });
    if (!routeExists) {
      throw new NotFoundException('Route not found');
    }
  }

  // One query for the whole page, never one per tour — the N+1 the plan forbids.
  private async bookedTourIds(
    tourIds: string[],
    viewer?: AuthUser,
  ): Promise<Set<string>> {
    if (viewer === undefined || tourIds.length === 0) {
      return new Set<string>();
    }

    const rows = await this.bookings.find({
      where: { hikerId: viewer.id, tourId: In(tourIds) },
      select: { tourId: true },
    });

    return new Set(rows.map((row) => row.tourId));
  }

  // Counts every tour a guide leads, past ones included. One grouped query for
  // the whole page keeps list decoration free of an N+1.
  private async toursLedByGuide(
    guideIds: string[],
  ): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    if (guideIds.length === 0) {
      return counts;
    }

    const rows = await this.tours
      .createQueryBuilder('tour')
      .select('tour.guideId', 'guideId')
      .addSelect('COUNT(*)', 'count')
      .where('tour.guideId IN (:...guideIds)', { guideIds })
      .groupBy('tour.guideId')
      .getRawMany<{ guideId: string; count: string }>();

    for (const row of rows) {
      counts.set(row.guideId, Number(row.count));
    }

    return counts;
  }

  private async decorateMany(
    rows: Tour[],
    viewer?: AuthUser,
  ): Promise<TourDto[]> {
    const guideIds = [...new Set(rows.map((tour) => tour.guide.id))];
    const counts = await this.toursLedByGuide(guideIds);
    const booked = await this.bookedTourIds(
      rows.map((tour) => tour.id),
      viewer,
    );
    return rows.map((tour) =>
      this.toDto(tour, counts.get(tour.guide.id) ?? 0, booked.has(tour.id)),
    );
  }

  private async decorateOne(tour: Tour, viewer?: AuthUser): Promise<TourDto> {
    const counts = await this.toursLedByGuide([tour.guide.id]);
    const booked = await this.bookedTourIds([tour.id], viewer);
    const dto = this.toDto(
      tour,
      counts.get(tour.guide.id) ?? 0,
      booked.has(tour.id),
    );

    // The roster belongs to the owning guide alone. Every other viewer — a
    // hiker, another guide, an anonymous reader — gets no roster key at all,
    // so the property is left unset rather than assigned undefined.
    if (viewer !== undefined && viewer.id === tour.guideId) {
      const rows = await this.bookings
        .createQueryBuilder('booking')
        // leftJoin plus an explicit addSelect, never leftJoinAndSelect: the
        // latter would read the hiker's password hash out of Postgres.
        .leftJoin('booking.hiker', 'hiker')
        .addSelect(['hiker.id', 'hiker.displayName'])
        .where('booking.tourId = :tourId', { tourId: tour.id })
        .orderBy('booking.createdAt', 'ASC')
        .getMany();

      const roster: RosterEntryDto[] = rows.map((row) => ({
        name: row.hiker.displayName,
        bookedAt: row.createdAt.toISOString(),
        status: row.status,
      }));
      dto.roster = roster;
    }

    return dto;
  }

  private toDto(tour: Tour, toursLed: number, isBookedByMe: boolean): TourDto {
    const { waypoints, activity } = tour.route;
    // The end time rounds off the same unrounded distance and elevation that
    // computeRouteStats feeds durationHours, so the range on screen always
    // agrees with the route's durationLabel.
    const distance = pathDistanceKm(waypoints);
    const elevation = elevationGainM(distance, waypoints.length);
    const startTime = normalizeTime(tour.startTime);
    const endTime = computeEndTime(
      startTime,
      durationHours(distance, elevation, activity),
    );
    const seatsLeft = tour.capacity - tour.bookedCount;

    return {
      id: tour.id,
      route: {
        id: tour.route.id,
        name: tour.route.name,
        difficulty: tour.route.difficulty,
        activity: tour.route.activity,
        waypoints,
        ...computeRouteStats(waypoints, activity),
      },
      guide: {
        id: tour.guide.id,
        displayName: tour.guide.displayName,
        toursLed,
        rating: GUIDE_RATING_STUB,
      },
      date: tour.date,
      startTime,
      endTime,
      timeLabel: timeLabel(startTime, endTime),
      capacity: tour.capacity,
      bookedCount: tour.bookedCount,
      seatsLeft,
      isFull: seatsLeft <= 0,
      isBookedByMe,
      meetingPoint: tour.meetingPoint,
      pace: tour.pace,
      notes: tour.notes,
      createdAt: tour.createdAt.toISOString(),
    };
  }
}

// The server's local calendar day, not toISOString's UTC one — a tour scheduled
// for "today" from a browser in the same timezone must not read as past.
function today(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}
