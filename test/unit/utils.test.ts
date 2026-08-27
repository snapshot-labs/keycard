import { nextMonthStart } from '../../src/utils';

describe('nextMonthStart()', () => {
  const ORIGINAL_TZ = process.env.TZ;

  afterEach(() => {
    if (ORIGINAL_TZ === undefined) delete process.env.TZ;
    else process.env.TZ = ORIGINAL_TZ;
  });

  // Instants where the process-local calendar month differs from the UTC one,
  // plus a year rollover.
  it.each([
    ['UTC', '2026-08-31T17:00:00Z', Date.UTC(2026, 8, 1) / 1e3],
    ['Asia/Singapore', '2026-08-31T17:00:00Z', Date.UTC(2026, 8, 1) / 1e3],
    ['America/New_York', '2026-09-01T02:00:00Z', Date.UTC(2026, 9, 1) / 1e3],
    ['Asia/Singapore', '2026-12-31T17:00:00Z', Date.UTC(2027, 0, 1) / 1e3]
  ])('returns the UTC month boundary in %s at %s', (tz, now, expected) => {
    process.env.TZ = tz;

    expect(nextMonthStart(new Date(now))).toBe(expected);
  });
});
