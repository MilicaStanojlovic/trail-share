import {
  computeRouteStats,
  durationHours,
  elevationGainM,
  formatDuration,
  haversineKm,
  pathDistanceKm,
} from './route-stats';
import { RouteActivity } from './route.entity';

describe('haversineKm', () => {
  it('returns the expected distance between two close lat/lng points', () => {
    expect(haversineKm([45.9, 15.96], [45.909, 15.96])).toBeCloseTo(1.0008, 3);
  });
});

describe('pathDistanceKm', () => {
  it('sums consecutive pairs of points', () => {
    expect(
      pathDistanceKm([
        [45.9, 15.96],
        [45.909, 15.96],
      ]),
    ).toBeCloseTo(1.0008, 3);
  });

  it('returns 0 for an empty path', () => {
    expect(pathDistanceKm([])).toBe(0);
  });

  it('returns 0 for a single-point path', () => {
    expect(pathDistanceKm([[45.9, 15.96]])).toBe(0);
  });
});

describe('elevationGainM', () => {
  it('returns the expected synthetic elevation for the sample inputs', () => {
    expect(elevationGainM(1.0008, 2)).toBe(70);
  });

  it('always rounds the result to a multiple of 10', () => {
    const cases: [number, number][] = [
      [0, 0],
      [1, 2],
      [3.5, 5],
      [10.2, 12],
      [42, 100],
    ];

    for (const [distKm, numPoints] of cases) {
      expect(elevationGainM(distKm, numPoints) % 10).toBe(0);
    }
  });
});

describe('durationHours', () => {
  it('uses the biking speed for biking', () => {
    expect(durationHours(14, 0, RouteActivity.BIKING)).toBeCloseTo(1, 6);
  });

  it('uses the hiking speed for hiking', () => {
    expect(durationHours(4.1, 0, RouteActivity.HIKING)).toBeCloseTo(1, 6);
  });

  it('adds elevation penalty independently of activity', () => {
    expect(durationHours(0, 620, RouteActivity.HIKING)).toBeCloseTo(1, 6);
  });
});

describe('formatDuration', () => {
  it('formats sub-hour durations as minutes only', () => {
    expect(formatDuration(0.357)).toBe('20 min');
  });

  it('formats mixed hours and minutes', () => {
    expect(formatDuration(2.7)).toBe('2 h 40 min');
  });

  it('rounds 60 minutes up to the next hour', () => {
    // This is the minutes-round-to-60 rollover.
    expect(formatDuration(1.99)).toBe('2 h');
  });

  it('formats whole hours without minutes', () => {
    expect(formatDuration(3)).toBe('3 h');
  });

  it('formats zero as 0 min', () => {
    expect(formatDuration(0)).toBe('0 min');
  });

  it('rounds tiny values down to 0 min', () => {
    expect(formatDuration(0.04)).toBe('0 min');
  });
});

describe('computeRouteStats', () => {
  const sample: [number, number][] = [
    [45.9, 15.96],
    [45.909, 15.96],
  ];

  it('uses the hiking speed when the activity is hiking', () => {
    const stats = computeRouteStats(sample, RouteActivity.HIKING);
    expect(stats.durationLabel).toBe('20 min');
  });

  it('uses the biking speed when the activity is biking', () => {
    // This proves the activity is honoured rather than always hiking.
    const stats = computeRouteStats(sample, RouteActivity.BIKING);
    expect(stats.durationLabel).toBe('10 min');
  });

  it('does not throw and returns zeroed labels for an empty path', () => {
    const stats = computeRouteStats([], RouteActivity.HIKING);
    expect(stats.distanceKm).toBe(0);
    expect(stats.distanceLabel).toBe('0.0 km');
  });

  it('does not throw and returns zeroed labels for a single-point path', () => {
    const stats = computeRouteStats([[45.9, 15.96]], RouteActivity.HIKING);
    expect(stats.distanceKm).toBe(0);
    expect(stats.distanceLabel).toBe('0.0 km');
  });

  it('matches the verified Medvednica hiking route values', () => {
    const MEDVEDNICA: [number, number][] = [
      [45.9002, 15.9432],
      [45.9068, 15.9508],
      [45.9121, 15.9601],
      [45.9155, 15.9723],
      [45.9098, 15.9805],
      [45.9012, 15.9748],
      [45.8961, 15.9612],
      [45.9002, 15.9432],
    ];

    const stats = computeRouteStats(MEDVEDNICA, RouteActivity.HIKING);

    expect(stats.distanceKm).toBe(7.5);
    expect(stats.distanceLabel).toBe('7.5 km');
    expect(stats.distanceLabel).toMatch(/^\d+\.\d km$/);
    expect(stats.elevationM).toBe(440);
    expect(stats.elevationLabel).toBe('440 m');
    expect(stats.elevationM % 10).toBe(0);
    expect(stats.durationLabel).toBe('2 h 30 min');
    expect(stats.durationLabel).toMatch(/^(\d+ h( \d+ min)?|\d+ min)$/);
  });
});
