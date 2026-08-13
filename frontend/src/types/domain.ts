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
