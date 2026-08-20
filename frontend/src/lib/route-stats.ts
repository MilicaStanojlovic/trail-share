import type { Activity } from '@/types/domain';

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function haversineKm(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const dLat = toRadians(b[0] - a[0]);
  const dLon = toRadians(b[1] - a[1]);
  const latA = toRadians(a[0]);
  const latB = toRadians(b[0]);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(latA) * Math.cos(latB) * Math.sin(dLon / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(h));
}

export function pathDistanceKm(coords: [number, number][]): number {
  let total = 0;
  for (let i = 1; i < coords.length; i += 1) {
    // Non-null assertions only because the frontend compiles with
    // noUncheckedIndexedAccess, which the backend copy does not. The loop
    // bounds guarantee both indices exist. This is the sole difference from
    // backend/src/routes/route-stats.ts — the arithmetic stays identical, and
    // route-stats.spec.ts pins the outputs against the backend's values.
    total += haversineKm(coords[i - 1]!, coords[i]!);
  }
  return total;
}

export function elevationGainM(distKm: number, numPoints: number): number {
  // Synthetic: the design has no real elevation data, so the number is derived
  // from distance and point count and is always a multiple of 10.
  return Math.round((distKm * 46 + numPoints * 12) / 10) * 10;
}

export function durationHours(
  distKm: number,
  elevM: number,
  activity: Activity,
): number {
  const speed = activity === 'Biking' ? 14 : 4.1;
  return distKm / speed + elevM / 620;
}

export function formatDuration(hours: number): string {
  let h = Math.floor(hours);
  let m = Math.round(((hours - h) * 60) / 5) * 5;

  // The rollover that stops 4 h 60 min from ever rendering.
  if (m === 60) {
    h += 1;
    m = 0;
  }

  if (h === 0) {
    return `${m} min`;
  }

  if (m === 0) {
    return `${h} h`;
  }

  return `${h} h ${m} min`;
}

export interface RouteStats {
  distanceKm: number;
  distanceLabel: string;
  elevationM: number;
  elevationLabel: string;
  durationLabel: string;
}

export function computeRouteStats(
  coords: [number, number][],
  activity: Activity,
): RouteStats {
  const distance = pathDistanceKm(coords);
  const elevationM = elevationGainM(distance, coords.length);

  return {
    // Elevation and duration are computed from the UNROUNDED distance, exactly
    // like the prototype.
    distanceKm: Number(distance.toFixed(1)),
    distanceLabel: `${distance.toFixed(1)} km`,
    elevationM,
    elevationLabel: `${elevationM} m`,
    durationLabel: formatDuration(
      durationHours(distance, elevationM, activity),
    ),
  };
}
