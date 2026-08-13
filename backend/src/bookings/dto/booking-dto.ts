import type { BookingStatus } from '../booking.entity';
import type { TourDto } from '../../tours/dto/tour-dto';

// Shape returned by POST /api/tours/:tourId/bookings and listed by
// GET /api/bookings/mine: createdAt is an ISO string, and tour carries
// isBookedByMe true and no roster.
export interface BookingDto {
  id: string;
  status: BookingStatus;
  createdAt: string;
  tour: TourDto;
}
