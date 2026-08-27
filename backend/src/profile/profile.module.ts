import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking } from '../bookings/booking.entity';
import { Route } from '../routes/route.entity';
import { Tour } from '../tours/tour.entity';
import { UsersModule } from '../users/users.module';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';

@Module({
  // UsersModule twice over: JwtAuthGuard on the endpoint is instantiated in
  // this module's own injector and needs UsersService, and ProfileService
  // injects it directly for the user's createdAt. JwtService needs no import:
  // JwtModule is registered globally.
  //
  // The controller lives here rather than on UsersModule because UsersModule
  // cannot import AuthModule — AuthModule already imports it, and that would
  // be a cycle.
  imports: [TypeOrmModule.forFeature([Route, Tour, Booking]), UsersModule],
  controllers: [ProfileController],
  providers: [ProfileService],
})
export class ProfileModule {}
