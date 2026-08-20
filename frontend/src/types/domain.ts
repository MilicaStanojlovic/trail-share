export type Difficulty = 'Easy' | 'Moderate' | 'Hard'
export type Activity = 'Hiking' | 'Biking'
export type Role = 'HIKER' | 'GUIDE'

export const DIFFICULTIES: readonly Difficulty[] = ['Easy', 'Moderate', 'Hard']
export const ACTIVITIES: readonly Activity[] = ['Hiking', 'Biking']

export interface AuthUser {
  id: string
  displayName: string
  email: string
  role: Role
}

export interface AuthResponse {
  token: string
  user: AuthUser
}

export interface RouteAuthor {
  id: string
  displayName: string
}

export interface TrailRoute {
  id: string
  name: string
  description: string
  difficulty: Difficulty
  activity: Activity
  author: RouteAuthor
  waypoints: [number, number][]
  waypointCount: number
  tourCount: number
  distanceKm: number
  distanceLabel: string
  elevationM: number
  elevationLabel: string
  durationLabel: string
  createdAt: string
}

export interface CreateRoutePayload {
  name: string
  description?: string
  difficulty: Difficulty
  activity: Activity
  waypoints: [number, number][]
}

export interface TourRouteSummary {
  id: string
  name: string
  difficulty: Difficulty
  activity: Activity
  waypoints: [number, number][]
  distanceKm: number
  distanceLabel: string
  elevationM: number
  elevationLabel: string
  durationLabel: string
}

export interface TourGuide {
  id: string
  displayName: string
  toursLed: number
  rating: number
}

export interface Tour {
  id: string
  route: TourRouteSummary
  guide: TourGuide
  date: string
  startTime: string
  endTime: string
  timeLabel: string
  capacity: number
  bookedCount: number
  seatsLeft: number
  isFull: boolean
  isBookedByMe: boolean
  meetingPoint: string
  pace: string
  notes: string
  createdAt: string
  // Present only for the owning guide, on single-tour responses. Test key
  // presence rather than length: absent and [] are different states.
  roster?: RosterEntry[]
}

export interface CreateTourPayload {
  date: string
  startTime: string
  capacity: number
  meetingPoint: string
  pace: string
  notes?: string
}

export type BookingStatus = 'CONFIRMED' | 'PAID'

export interface RosterEntry {
  name: string
  bookedAt: string
  status: BookingStatus
}

export interface Booking {
  id: string
  status: BookingStatus
  createdAt: string
  tour: Tour
}

export interface GuideRating {
  value: number
  count: number
}

export interface GuideDashboard {
  toursScheduled: number
  // null when the guide has no upcoming tours.
  nextTourInDays: number | null
  seatsBooked: number
  routesPublished: number
  rating: GuideRating
}
