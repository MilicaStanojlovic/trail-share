// A display-only stub today: nothing in the schema records ratings, so the
// value and the count are constants (see RATING_STUB in guide.service.ts).
export interface GuideRatingDto {
  value: number;
  count: number;
}

export interface GuideDashboardDto {
  // Upcoming tours only (date >= CURRENT_DATE).
  toursScheduled: number;
  // Whole days from today to the soonest upcoming tour: 0 when it runs today,
  // null when there are no upcoming tours at all.
  nextTourInDays: number | null;
  // Summed over every tour the guide leads, past ones included — the design's
  // tile note reads "across all tours".
  seatsBooked: number;
  routesPublished: number;
  rating: GuideRatingDto;
}
