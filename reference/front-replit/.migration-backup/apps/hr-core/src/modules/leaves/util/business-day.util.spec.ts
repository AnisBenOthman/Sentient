import { HalfDay } from '@sentient/shared';
import { countBusinessDays } from './business-day.util';

const NO_HOLIDAYS = new Set<string>();

function d(iso: string): Date {
  return new Date(iso + 'T00:00:00.000Z');
}

describe('countBusinessDays', () => {
  it('counts a full Mon-Fri week as 5', () => {
    const result = countBusinessDays(d('2026-01-05'), d('2026-01-09'), null, null, NO_HOLIDAYS);
    expect(result.toNumber()).toBe(5);
  });

  it('half-day start reduces start day by 0.5', () => {
    // Mon–Fri, startHalfDay set → 4.5 days
    const result = countBusinessDays(d('2026-01-05'), d('2026-01-09'), HalfDay.MORNING, null, NO_HOLIDAYS);
    expect(result.toNumber()).toBe(4.5);
  });

  it('half-day end reduces end day by 0.5', () => {
    const result = countBusinessDays(d('2026-01-05'), d('2026-01-09'), null, HalfDay.AFTERNOON, NO_HOLIDAYS);
    expect(result.toNumber()).toBe(4.5);
  });

  it('holiday on a weekday is excluded', () => {
    const holidays = new Set(['2026-01-07']); // Wednesday
    const result = countBusinessDays(d('2026-01-05'), d('2026-01-09'), null, null, holidays);
    expect(result.toNumber()).toBe(4);
  });

  it('returns 0 for a weekend-only range', () => {
    const result = countBusinessDays(d('2026-01-10'), d('2026-01-11'), null, null, NO_HOLIDAYS);
    expect(result.toNumber()).toBe(0);
  });

  it('single full day counts as 1', () => {
    const result = countBusinessDays(d('2026-01-05'), d('2026-01-05'), null, null, NO_HOLIDAYS);
    expect(result.toNumber()).toBe(1);
  });

  it('single half-day counts as 0.5', () => {
    const result = countBusinessDays(d('2026-01-05'), d('2026-01-05'), HalfDay.MORNING, null, NO_HOLIDAYS);
    expect(result.toNumber()).toBe(0.5);
  });

  it('both half-days on different ends of a multi-day range = 4.0 for Mon-Fri', () => {
    // Mon half + Fri half = 0.5 + 3 + 0.5 = 4
    const result = countBusinessDays(d('2026-01-05'), d('2026-01-09'), HalfDay.MORNING, HalfDay.AFTERNOON, NO_HOLIDAYS);
    expect(result.toNumber()).toBe(4);
  });

  it('holiday on weekend does not affect count', () => {
    const holidays = new Set(['2026-01-10']); // Saturday
    const result = countBusinessDays(d('2026-01-05'), d('2026-01-09'), null, null, holidays);
    expect(result.toNumber()).toBe(5);
  });
});
