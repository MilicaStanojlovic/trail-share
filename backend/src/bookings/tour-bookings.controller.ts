import {
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { BookingsService } from './bookings.service';
import type { BookingDto } from './dto/booking-dto';

@Controller('tours/:tourId/bookings')
export class TourBookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  // Hiker-only: a guide never holds a seat on a tour. The guards run in this
  // order so RolesGuard reads a request.user JwtAuthGuard has already set.
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('HIKER')
  book(
    @Param('tourId', ParseUUIDPipe) tourId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<BookingDto> {
    return this.bookingsService.book(tourId, user);
  }
}
