import type { Difficulty } from './domain'

export type TagVariant = 'neutral' | 'accent' | 'accent-2' | 'outline'

export function difficultyTagVariant(d: Difficulty): TagVariant {
  switch (d) {
    case 'Easy':
      return 'accent-2'
    case 'Hard':
      return 'accent'
    case 'Moderate':
    default:
      return 'neutral'
  }
}

export function seatTagState(
  booked: number,
  capacity: number,
  isBookedByMe: boolean,
): { variant: TagVariant; label: string } {
  const seatsLeft = capacity - booked

  if (isBookedByMe) {
    return { variant: 'accent-2', label: 'You are in' }
  }

  // <= 0, not === 0: an over-booked tour (a booking race, or a guide lowering
  // capacity after seats sold) must still read "Full" rather than "-1 seats left".
  if (seatsLeft <= 0) {
    return { variant: 'accent', label: 'Full' }
  }

  if (seatsLeft <= 3) {
    return { variant: 'outline', label: `${seatsLeft} seats left` }
  }

  return { variant: 'neutral', label: `${seatsLeft} seats left` }
}
