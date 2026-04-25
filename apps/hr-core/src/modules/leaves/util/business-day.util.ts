import { Decimal } from '../../../generated/prisma/runtime/library';
import { HalfDay } from '@sentient/shared';

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * WHY: Pure function so it can be unit-tested against dozens of permutations
 * without any DB or framework setup. totalDays is fixed at submission time
 * and never recomputed — this is the single source of truth for that value.
 */
export function countBusinessDays(
  startDate: Date,
  endDate: Date,
  startHalfDay: HalfDay | null | undefined,
  endHalfDay: HalfDay | null | undefined,
  holidays: Set<string>,
): Decimal {
  let total = new Decimal(0);
  const current = new Date(startDate);
  current.setUTCHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setUTCHours(0, 0, 0, 0);

  while (current <= end) {
    const dow = current.getUTCDay();
    const dateStr = toDateString(current);

    if (dow !== 0 && dow !== 6 && !holidays.has(dateStr)) {
      const isStart = toDateString(current) === toDateString(startDate);
      const isEnd = toDateString(current) === toDateString(endDate);

      if (isStart && isEnd) {
        // Single day: both flags set → 0.5 (any non-null half-day flag)
        if (startHalfDay !== null && startHalfDay !== undefined) {
          total = total.plus(new Decimal('0.5'));
        } else {
          total = total.plus(new Decimal('1'));
        }
      } else if (isStart && startHalfDay !== null && startHalfDay !== undefined) {
        total = total.plus(new Decimal('0.5'));
      } else if (isEnd && endHalfDay !== null && endHalfDay !== undefined) {
        total = total.plus(new Decimal('0.5'));
      } else {
        total = total.plus(new Decimal('1'));
      }
    }

    current.setUTCDate(current.getUTCDate() + 1);
  }

  return total;
}
