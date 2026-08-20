// Appending T00:00:00 forces the date to be parsed as local midnight instead of UTC,
// so a bare YYYY-MM-DD is not shifted to the previous day in negative timezones.
export function formatDateLong(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
  })
}

// A zero or negative day count means the booking was made today (clock skew included).
export function bookedAgoLabel(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days <= 0) {
    return 'booked today'
  }
  if (days === 1) {
    return 'booked 1 day ago'
  }
  return 'booked ' + days + ' days ago'
}
