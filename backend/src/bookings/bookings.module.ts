import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tour } from '../tours/tour.entity';
import { ToursModule } from '../tours/tours.module';
import { UsersModule } from '../users/users.module';
import { Booking } from './booking.entity';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { TourBookingsController } from './tour-bookings.controller';

@Module({
  // JwtAuthGuard on the booking endpoints is instantiated in this module's own
  // injector, so its UsersService dependency has to be resolvable here.
  // JwtService needs no import because JwtModule is registered globally.
  // ToursModule exports ToursService and never imports this module — it reads
  // bookings through an injected repository — so this import stays cycle-free.
  imports: [
    TypeOrmModule.forFeature([Booking, Tour]),
    UsersModule,
    ToursModule,
  ],
  controllers: [TourBookingsController, BookingsController],
  providers: [BookingsService],
})
export class BookingsModule {}
