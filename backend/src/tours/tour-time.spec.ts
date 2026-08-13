import { computeEndTime, normalizeTime, timeLabel } from './tour-time';

describe('computeEndTime', () => {
  it('adds whole and fractional hours to a morning start time', () => {
    expect(computeEndTime('08:00', 2.5)).toBe('10:30');
  });

  it('rounds a one-and-a-half hour duration up to the next half hour', () => {
    expect(computeEndTime('09:00', 1.5)).toBe('10:30');
  });

  it('rounds fractional minutes to the nearest five-minute step', () => {
    expect(computeEndTime('08:30', 0.9166)).toBe('09:25');
  });

  it('rolls 60 rounded minutes up to the next hour', () => {
    // 1.99 h rounds up through the 60-minute rollover.
    expect(computeEndTime('07:30', 1.99)).toBe('09:30');
  });

  it('wraps past midnight to the next day', () => {
    expect(computeEndTime('23:30', 1)).toBe('00:30');
  });

  it('returns midnight for a zero-length duration at midnight', () => {
    expect(computeEndTime('00:00', 0)).toBe('00:00');
  });
});

describe('the five seeded tours', () => {
  // durationHours() over each seeded route's waypoints, as computeRouteStats
  // feeds it: Medvednica Ridge Loop 7.498 km / 440 m hiking, Sljeme Summit
  // Climb 2.941 km / 200 m hiking, Sava Riverside Cruise 9.370 km / 490 m
  // biking, Samobor Hills Traverse 5.888 km / 330 m biking. These pin the
  // ranges every tour screen renders for the design's own data.
  const medvednica = 2.5385;
  const sljeme = 1.0398;
  const sava = 1.4596;
  const samobor = 0.9528;

  it.each([
    ['08:00', medvednica, '08:00 – 10:30'],
    ['07:30', sljeme, '07:30 – 08:30'],
    ['09:00', sava, '09:00 – 10:30'],
    ['08:30', samobor, '08:30 – 09:25'],
    ['09:00', medvednica, '09:00 – 11:30'],
  ])(
    'renders %s plus %f h as %s',
    (start: string, hours: number, expected: string) => {
      expect(timeLabel(start, computeEndTime(start, hours))).toBe(expected);
    },
  );
});

describe('normalizeTime', () => {
  it('trims a Postgres HH:MM:SS value to HH:MM', () => {
    expect(normalizeTime('08:00:00')).toBe('08:00');
  });

  it('leaves an already-short HH:MM value unchanged', () => {
    expect(normalizeTime('08:00')).toBe('08:00');
  });
});

describe('timeLabel', () => {
  it('joins start and end with an en dash and spaces', () => {
    expect(timeLabel('08:00', '10:30')).toBe('08:00 – 10:30');
  });
});
