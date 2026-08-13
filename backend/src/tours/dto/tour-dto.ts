import { RouteActivity, RouteDifficulty } from '../../routes/route.entity';
import type { BookingStatus } from '../../bookings/booking.entity';

export interface TourRouteSummaryDto {
  id: string;
  name: string;
  difficulty: RouteDifficulty;
  activity: RouteActivity;
  waypoints: [number, number][];
  distanceKm: number;
  distanceLabel: string;
  elevationM: number;
  elevationLabel: string;
  durationLabel: string;
}

export interface TourGuideDto {
  id: string;
  displayName: string;
  toursLed: number;
  rating: number;
}

// bookedAt is a raw ISO timestamp; the frontend formats the "booked n days
// ago" label from it.
export interface RosterEntryDto {
  name: string;
  bookedAt: string;
  status: BookingStatus;
}

export interface TourDto {
  id: string;
  route: TourRouteSummaryDto;
  guide: TourGuideDto;
  date: string;
  startTime: string;
  endTime: string;
  timeLabel: string;
  capacity: number;
  bookedCount: number;
  seatsLeft: number;
  isFull: boolean;
  // Real for token-bearing viewers on every tour GET — those endpoints run
  // behind OptionalAuthGuard — and false for anonymous ones.
  isBookedByMe: boolean;
  meetingPoint: string;
  pace: string;
  notes: string;
  createdAt: string;
  // Present only on GET /api/tours/:id, and only when the viewer is the owning
  // guide: an owning guide with no bookings gets [], while for every other
  // viewer the key is absent entirely rather than undefined.
  roster?: RosterEntryDto[];
}
