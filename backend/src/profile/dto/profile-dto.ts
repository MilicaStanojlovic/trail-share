import type { UserRole } from '../../users/user.entity';

// A display-only stub today: nothing in the schema records ratings, so the
// value and the count are constants (see RATING_STUB in profile.service.ts).
export interface ProfileRatingDto {
  value: number;
  count: number;
}

export interface ProfileStatsDto {
  // Routes this user authored.
  routesPublished: number;
  // Every tour this user leads, past ones included, so the figure matches
  // TourGuideDto.toursLed on the tour-detail guide card. 0 for a hiker.
  toursLed: number;
  // Seats booked across all of this user's tours, past ones included. 0 for a
  // hiker.
  seatsHosted: number;
  // Seats this user holds, all time.
  toursBooked: number;
  // ...of which the tour has not happened yet (date >= CURRENT_DATE, the same
  // predicate every other tour query uses).
  upcomingBookings: number;
  // Guides only; null for a hiker, who has nothing to be rated on.
  rating: ProfileRatingDto | null;
}

export interface ProfileDto {
  id: string;
  displayName: string;
  email: string;
  role: UserRole;
  // ISO string — the "Member since" line. GET /api/auth/me deliberately does
  // not carry this (see plans/auth-and-roles.md), which is why this endpoint
  // exists at all.
  createdAt: string;
  stats: ProfileStatsDto;
}
