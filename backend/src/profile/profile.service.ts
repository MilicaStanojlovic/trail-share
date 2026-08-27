import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
// import type, not a value import: AuthUser only ever appears in type position
// here, and a value import of it trips TS1272 at decorated call sites.
import type { AuthUser } from '../auth/auth-user';
import { Booking } from '../bookings/booking.entity';
import { Route } from '../routes/route.entity';
import { Tour } from '../tours/tour.entity';
import { UserRole } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import type { ProfileDto, ProfileRatingDto } from './dto/profile-dto';

// Display-only, and the third copy of this figure: GUIDE_RATING_STUB in
// tours.service.ts backs the guide card, RATING_STUB in guide.service.ts backs
// the dashboard tile. All three must agree, or a guide's profile contradicts
// their own tour page. There is no rating entity to derive it from.
const RATING_STUB: ProfileRatingDto = { value: 4.9, count: 38 };

@Injectable()
export class ProfileService {
  constructor(
    private readonly users: UsersService,
    @InjectRepository(Route)
    private readonly routes: Repository<Route>,
    @InjectRepository(Tour)
    private readonly tours: Repository<Tour>,
    @InjectRepository(Booking)
    private readonly bookings: Repository<Booking>,
  ) {}

  async getProfile(user: AuthUser): Promise<ProfileDto> {
    // JwtAuthGuard already loaded this user to build the AuthUser, so a miss
    // here means the account was deleted mid-request. Re-read anyway: createdAt
    // is the one field AuthUser does not carry.
    const record = await this.users.findById(user.id);
    if (record === null) {
      throw new NotFoundException('User not found');
    }

    const routesPublished = await this.routes.count({
      where: { authorId: user.id },
    });

    // No date filter: "tours led" and "seats hosted" both count the tours
    // already run. COALESCE plus Number() keeps seatsHosted 0 rather than null
    // or NaN for someone who leads no tours, where SUM is null.
    const led = await this.tours
      .createQueryBuilder('tour')
      .select('COUNT(*)', 'toursLed')
      .addSelect('COALESCE(SUM(tour.bookedCount), 0)', 'seatsHosted')
      .where('tour.guideId = :id', { id: user.id })
      .getRawOne<{ toursLed: string; seatsHosted: string }>();

    // innerJoin, never innerJoinAndSelect: the tour is joined only so the
    // FILTER clause can read its date. Cancelling a booking deletes the row, so
    // these counts are seats actually held, not seats ever requested.
    const booked = await this.bookings
      .createQueryBuilder('booking')
      .innerJoin('booking.tour', 'tour')
      .select('COUNT(*)', 'toursBooked')
      .addSelect(
        'COUNT(*) FILTER (WHERE tour.date >= CURRENT_DATE)',
        'upcomingBookings',
      )
      .where('booking.hikerId = :id', { id: user.id })
      .getRawOne<{ toursBooked: string; upcomingBookings: string }>();

    // Field by field, never a spread of `record`: that entity carries
    // passwordHash.
    return {
      id: record.id,
      displayName: record.displayName,
      email: record.email,
      role: record.role,
      createdAt: record.createdAt.toISOString(),
      stats: {
        routesPublished,
        toursLed: Number(led?.toursLed ?? 0),
        seatsHosted: Number(led?.seatsHosted ?? 0),
        toursBooked: Number(booked?.toursBooked ?? 0),
        upcomingBookings: Number(booked?.upcomingBookings ?? 0),
        rating: record.role === UserRole.GUIDE ? RATING_STUB : null,
      },
    };
  }
}
