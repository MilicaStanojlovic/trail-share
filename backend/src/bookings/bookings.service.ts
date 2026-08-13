import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
// import type, not a value import: AuthUser only ever appears in type position
// here, and a value import of it trips TS1272 at decorated call sites.
import type { AuthUser } from '../auth/auth-user';
import { Tour } from '../tours/tour.entity';
import { normalizeTime } from '../tours/tour-time';
import { ToursService } from '../tours/tours.service';
import { Booking } from './booking.entity';
import type { BookingDto } from './dto/booking-dto';

// Postgres reports a unique-constraint violation with this SQLSTATE.
const UNIQUE_VIOLATION = '23505';

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class BookingsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Booking)
    private readonly bookings: Repository<Booking>,
    private readonly toursService: ToursService,
  ) {}

  // The tour's start instant in server-local time, matching the local calendar
  // day ToursService uses for "upcoming". Postgres hands back HH:MM:SS, so the
  // time is normalized before the string is parsed.
  private tourStart(tour: Tour): Date {
    return new Date(`${tour.date}T${normalizeTime(tour.startTime)}:00`);
  }

  async book(tourId: string, hiker: AuthUser): Promise<BookingDto> {
    await this.dataSource.transaction(async (em) => {
      const tour = await em.findOne(Tour, { where: { id: tourId } });
      if (tour === null) {
        throw new NotFoundException('Tour not found');
      }

      if (this.tourStart(tour).getTime() <= Date.now()) {
        throw new ConflictException('Tour has already started');
      }

      try {
        await em.insert(Booking, { tourId, hikerId: hiker.id });
      } catch (error: unknown) {
        // The unique index on (tourId, hikerId) is the race-safe double-book
        // check, not a pre-SELECT: two concurrent inserts cannot both win.
        if ((error as { code?: string }).code === UNIQUE_VIOLATION) {
          throw new ConflictException('You already booked this tour');
        }
        throw error;
      }

      // A conditional UPDATE whose affected-row count is checked, rather than a
      // SELECT ... FOR UPDATE, because the UPDATE itself takes the row lock: a
      // second racer blocks on the tour row, re-evaluates the predicate after
      // the first commit, affects 0 rows, and its whole transaction — booking
      // insert included — rolls back. Same serialization, less code, no
      // explicit lock mode, and no deadlock window against the cancel path.
      const result = await em
        .createQueryBuilder()
        .update(Tour)
        .set({ bookedCount: () => '"bookedCount" + 1' })
        .where('id = :id AND "bookedCount" < capacity', { id: tourId })
        .execute();

      if (result.affected === 0) {
        throw new ConflictException('Tour is full');
      }
    });

    // Read back after the commit so the DTO carries the incremented counter and
    // isBookedByMe true.
    const booking = await this.bookings.findOneOrFail({
      where: { tourId, hikerId: hiker.id },
    });

    return {
      id: booking.id,
      status: booking.status,
      createdAt: booking.createdAt.toISOString(),
      tour: await this.toursService.findById(tourId, hiker),
    };
  }

  async findMine(user: AuthUser): Promise<BookingDto[]> {
    // innerJoin, never innerJoinAndSelect: the tour is joined only to filter and
    // order by it, and the hiker is not joined at all (password hash).
    const rows = await this.bookings
      .createQueryBuilder('booking')
      .innerJoin('booking.tour', 'tour')
      .where('booking.hikerId = :hikerId', { hikerId: user.id })
      .andWhere('tour.date >= CURRENT_DATE')
      .orderBy('tour.date', 'ASC')
      .addOrderBy('tour.startTime', 'ASC')
      .getMany();

    const tours = await this.toursService.findManyByIds(
      rows.map((row) => row.tourId),
      user,
    );
    const tourById = new Map(tours.map((tour) => [tour.id, tour]));

    // A hiker holds at most one seat per tour, so tour ids are unique here and
    // the booking order survives the stitch.
    return rows.flatMap((row) => {
      const tour = tourById.get(row.tourId);
      if (tour === undefined) {
        return [];
      }

      return [
        {
          id: row.id,
          status: row.status,
          createdAt: row.createdAt.toISOString(),
          tour,
        },
      ];
    });
  }

  async cancel(bookingId: string, user: AuthUser): Promise<void> {
    await this.dataSource.transaction(async (em) => {
      // Scoped to the caller's own bookings, so an unknown id and someone
      // else's booking are indistinguishable — booking ids never leak.
      const booking = await em.findOne(Booking, {
        where: { id: bookingId, hikerId: user.id },
        relations: { tour: true },
      });

      if (booking === null) {
        throw new NotFoundException('Booking not found');
      }

      if (
        this.tourStart(booking.tour).getTime() - Date.now() <
        TWENTY_FOUR_HOURS_MS
      ) {
        throw new ConflictException(
          'Bookings can only be cancelled up to 24 h before the tour starts',
        );
      }

      // Decrement only if this request is the one that actually removed the
      // row. Two overlapping cancels of the same booking both load it and both
      // pass the 24 h check; without this guard the loser's delete affects
      // nothing but its decrement still lands, freeing one seat while dropping
      // the counter by two — the tour then advertises a seat nobody holds.
      const deletion = await em.delete(Booking, bookingId);
      if (!deletion.affected) {
        return;
      }

      // GREATEST floors the counter at zero: the seeded bookings were never
      // counted into bookedCount, so cancelling one must not drive it negative.
      await em
        .createQueryBuilder()
        .update(Tour)
        .set({ bookedCount: () => 'GREATEST("bookedCount" - 1, 0)' })
        .where('id = :id', { id: booking.tourId })
        .execute();
    });
  }
}
