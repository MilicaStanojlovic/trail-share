import { RouteActivity, RouteDifficulty } from '../../routes/route.entity';

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
  // Always false until the booking slice adds optional-token awareness.
  isBookedByMe: boolean;
  meetingPoint: string;
  pace: string;
  notes: string;
  createdAt: string;
  // There is deliberately no roster field yet: the booking slice adds it
  // additively, for the owning guide only.
}
