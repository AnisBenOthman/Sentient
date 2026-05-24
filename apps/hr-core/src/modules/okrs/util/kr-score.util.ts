import { Prisma } from '../../../generated/prisma';

import { KeyResultMetricType } from '@sentient/shared';

type Decimal = Prisma.Decimal;

export function computeScore(
  metricType: KeyResultMetricType,
  currentValue: Decimal,
  targetValue: Decimal,
): Decimal {
  if (metricType === KeyResultMetricType.BOOLEAN) {
    return currentValue.greaterThanOrEqualTo(1)
      ? new Prisma.Decimal(1)
      : new Prisma.Decimal(0);
  }
  if (targetValue.lessThanOrEqualTo(0)) return new Prisma.Decimal(0);
  const raw = currentValue.dividedBy(targetValue);
  return Prisma.Decimal.max(
    new Prisma.Decimal(0),
    Prisma.Decimal.min(new Prisma.Decimal(1), raw),
  );
}
