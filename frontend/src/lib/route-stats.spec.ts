import { describe, it, expect } from 'vitest'

import {
  computeRouteStats,
  durationHours,
  elevationGainM,
  formatDuration,
  haversineKm,
  pathDistanceKm,
} from './route-stats'

describe('haversineKm', () => {
  it('returns the great-circle distance between two nearby coordinates', () => {
    expect(haversineKm([45.9, 15.96], [45.909, 15.96])).toBeCloseTo(1.0008, 3)
  })
})

describe('pathDistanceKm', () => {
  it('sums the segment distance between two points', () => {
    const segment: [number, number][] = [
      [45.9, 15.96],
      [45.909, 15.96],
    ]
    expect(pathDistanceKm(segment)).toBeCloseTo(1.0008, 3)
  })

  it('is 0 for an empty path', () => {
    const empty: [number, number][] = []
    expect(pathDistanceKm(empty)).toBe(0)
  })

  it('is 0 for a single waypoint', () => {
    const single: [number, number][] = [[45.9, 15.96]]
    expect(pathDistanceKm(single)).toBe(0)
  })
})

describe('elevationGainM', () => {
  it('combines distance and point count into a rounded multiple of 10', () => {
    expect(elevationGainM(1.0008, 2)).toBe(70)
  })

  it('is always a multiple of 10 for representative inputs', () => {
    const cases: [number, number][] = [
      [0, 0],
      [1, 2],
      [3.5, 5],
      [10.2, 12],
      [42, 100],
    ]
    cases.forEach(([distKm, numPoints]) => {
      expect(elevationGainM(distKm, numPoints) % 10).toBe(0)
    })
  })
})

describe('durationHours', () => {
  it('normalises a 14 km bike ride to ~1 hour', () => {
    expect(durationHours(14, 0, 'Biking')).toBeCloseTo(1, 6)
  })

  it('normalises a 4.1 km hike to ~1 hour', () => {
    expect(durationHours(4.1, 0, 'Hiking')).toBeCloseTo(1, 6)
  })

  it('normalises 620 m of elevation to ~1 hour of hiking', () => {
    expect(durationHours(0, 620, 'Hiking')).toBeCloseTo(1, 6)
  })
})

describe('formatDuration', () => {
  it('rounds 0.357 hours to 20 min', () => {
    expect(formatDuration(0.357)).toBe('20 min')
  })

  it('formats 2.7 hours as 2 h 40 min', () => {
    expect(formatDuration(2.7)).toBe('2 h 40 min')
  })

  it('formats 1.99 hours as 2 h', () => {
    // This is the minutes-round-to-60 rollover that stops 1 h 60 min from rendering.
    expect(formatDuration(1.99)).toBe('2 h')
  })

  it('formats 3 hours as 3 h', () => {
    expect(formatDuration(3)).toBe('3 h')
  })

  it('formats 0 hours as 0 min', () => {
    expect(formatDuration(0)).toBe('0 min')
  })

  it('rounds 0.04 hours down to 0 min', () => {
    expect(formatDuration(0.04)).toBe('0 min')
  })
})

describe('computeRouteStats', () => {
  const sample: [number, number][] = [
    [45.9, 15.96],
    [45.909, 15.96],
  ]

  it('uses Hiking defaults for the sample segment', () => {
    const stats = computeRouteStats(sample, 'Hiking')
    expect(stats.durationLabel).toBe('20 min')
    expect(stats.elevationM).toBe(70)
  })

  it('threads Biking through instead of defaulting to Hiking', () => {
    // This proves the activity is threaded through rather than defaulted to hiking.
    const stats = computeRouteStats(sample, 'Biking')
    expect(stats.durationLabel).toBe('10 min')
  })

  it('returns zeroed labels for an empty path without throwing', () => {
    const empty: [number, number][] = []
    const stats = computeRouteStats(empty, 'Hiking')
    expect(stats.distanceKm).toBe(0)
    expect(stats.distanceLabel).toBe('0.0 km')
  })

  it('returns zeroed labels for a single waypoint', () => {
    const single: [number, number][] = [[45.9, 15.96]]
    const stats = computeRouteStats(single, 'Hiking')
    expect(stats.distanceKm).toBe(0)
    expect(stats.distanceLabel).toBe('0.0 km')
  })

  it('matches the verified Medvednica Ridge Loop values', () => {
    // These are routes index 0 waypoints from docs/seed-data.json.
    const MEDVEDNICA: [number, number][] = [
      [45.9002, 15.9432],
      [45.9068, 15.9508],
      [45.9121, 15.9601],
      [45.9155, 15.9723],
      [45.9098, 15.9805],
      [45.9012, 15.9748],
      [45.8961, 15.9612],
      [45.9002, 15.9432],
    ]

    expect(MEDVEDNICA.length).toBe(8)

    const hiking = computeRouteStats(MEDVEDNICA, 'Hiking')
    expect(hiking.distanceKm).toBe(7.5)
    expect(hiking.distanceLabel).toBe('7.5 km')
    expect(hiking.distanceLabel).toMatch(/^\d+\.\d km$/)
    expect(hiking.elevationM).toBe(440)
    expect(hiking.elevationLabel).toBe('440 m')
    expect(hiking.elevationM % 10).toBe(0)
    expect(hiking.durationLabel).toBe('2 h 30 min')
    expect(hiking.durationLabel).toMatch(/^(\d+ h( \d+ min)?|\d+ min)$/)

    const biking = computeRouteStats(MEDVEDNICA, 'Biking')
    expect(biking.durationLabel).toBe('1 h 15 min')
  })
})
