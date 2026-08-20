import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GuideDashboardDto, GuideRatingDto } from './dto/guide-dashboard-dto';
import { Route } from '../routes/route.entity';
import { Tour } from '../tours/tour.entity';

// Display-only: there is no rating entity anywhere in this codebase, and the
// design shows the same figures for every guide. The value matches
// GUIDE_RATING_STUB in tours.service.ts so a guide's card and their dashboard
// never disagree.
const RATING_STUB: GuideRatingDto = { value: 4.9, count: 38 };

@Injectable()
export class GuideService {
  constructor(
    @InjectRepository(Tour)
    private readonly tours: Repository<Tour>,
    @InjectRepository(Route)
    private readonly routes: Repository<Route>,
  ) {}

  async getDashboard(guideId: string): Promise<GuideDashboardDto> {
    // The upcoming predicate is the same date >= CURRENT_DATE every other tour
    // query uses, so the tile count always equals the length of GET
    // /api/tours/mine. MIN is cast to text because the pg driver would
    // otherwise hand back a Date for a raw date column, and daysUntil wants the
    // calendar day as written.
    const upcoming = await this.tours
      .createQueryBuilder('tour')
      .select('COUNT(*)', 'count')
      .addSelect('MIN(tour.date)::text', 'nextDate')
      .where('tour.guideId = :guideId', { guideId })
      .andWhere('tour.date >= CURRENT_DATE')
      .getRawOne<{ count: string; nextDate: string | null }>();

    // No date filter: "across all tours" includes the ones already led.
    // COALESCE plus Number() keeps this 0 rather than null or NaN for a guide
    // with no tours, where SUM is null.
    const seats = await this.tours
      .createQueryBuilder('tour')
      .select('COALESCE(SUM(tour.bookedCount), 0)', 'seats')
      .where('tour.guideId = :guideId', { guideId })
      .getRawOne<{ seats: string }>();

    const routesPublished = await this.routes.count({
      where: { authorId: guideId },
    });

    const nextDate = upcoming?.nextDate ?? null;

    return {
      toursScheduled: Number(upcoming?.count ?? 0),
      nextTourInDays: nextDate === null ? null : daysUntil(nextDate),
      seatsBooked: Number(seats?.seats ?? 0),
      routesPublished,
      rating: RATING_STUB,
    };
  }
}

// Whole days between two local calendar days, never a UTC-shifted one — the
// same reasoning as today() in tours.service.ts: a tour dated today must read
// as 0 days away for a server and a browser in the same timezone. Both sides
// collapse to local midnight and the rounding absorbs DST's 23- and 25-hour
// days. Exported pure so it can be tested with an explicit `from`.
export function daysUntil(dateIso: string, from = new Date()): number {
  const target = new Date(dateIso + 'T00:00:00');
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  return Math.round((target.getTime() - start.getTime()) / 86_400_000);
}
