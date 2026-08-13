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
