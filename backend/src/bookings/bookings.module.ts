import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tour } from '../tours/tour.entity';
import { UsersModule } from '../users/users.module';
import { Booking } from './booking.entity';

@Module({
  // JwtAuthGuard on the booking endpoints is instantiated in this module's own
  // injector, so its UsersService dependency has to be resolvable here.
  // JwtService needs no import because JwtModule is registered globally.
  // Controllers and providers stay empty for now; later tasks fill them.
  imports: [TypeOrmModule.forFeature([Booking, Tour]), UsersModule],
  controllers: [],
  providers: [],
})
export class BookingsModule {}
