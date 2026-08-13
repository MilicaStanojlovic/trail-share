export function normalizeTime(value: string): string {
  // Postgres returns a time column as HH:MM:SS while every screen shows HH:MM.
  return value.slice(0, 5);
}

export function computeEndTime(startTime: string, durationHrs: number): string {
  // end times must round identically to the durationLabel a route shows, so this
  // rounding is copied deliberately rather than shared, and any change to
  // formatDuration must be mirrored here.
  let h = Math.floor(durationHrs);
  let m = Math.round(((durationHrs - h) * 60) / 5) * 5;

  if (m === 60) {
    h += 1;
    m = 0;
  }

  const startH = Number(startTime.slice(0, 2));
  const startM = Number(startTime.slice(3, 5));

  let totalMinutes = (startH + h) * 60 + startM + m;
  totalMinutes = ((totalMinutes % 1440) + 1440) % 1440;

  const endH = Math.floor(totalMinutes / 60);
  const endM = totalMinutes % 60;

  return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
}

export function timeLabel(start: string, end: string): string {
  return `${start} – ${end}`;
}
