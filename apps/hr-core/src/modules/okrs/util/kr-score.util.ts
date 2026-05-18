import { Decimal } from '@prisma/client/runtime/library';

import { KeyResultMetricType } from '@sentient/shared';

export function computeScore(
  metricType: KeyResultMetricType,
  currentValue: Decimal,
  targetValue: Decimal,
): Decimal {
  if (metricType === KeyResultMetricType.BOOLEAN) {
    return currentValue.greaterThanOrEqualTo(1) ? new Decimal(1) : new Decimal(0);
  }
  if (targetValue.lessThanOrEqualTo(0)) return new Decimal(0);
  const raw = currentValue.dividedBy(targetValue);
  return Decimal.max(new Decimal(0), Decimal.min(new Decimal(1), raw));
}
