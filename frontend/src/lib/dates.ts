// Appending T00:00:00 forces the date to be parsed as local midnight instead of UTC,
// so a bare YYYY-MM-DD is not shifted to the previous day in negative timezones.
export function formatDateLong(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
  })
}
