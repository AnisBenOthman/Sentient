import { Decimal } from '@prisma/client/runtime/library';

import { KeyResultMetricType } from '@sentient/shared';

import { computeScore } from './kr-score.util';

const d = (v: number | string) => new Decimal(v);

describe('computeScore', () => {
  describe('BOOLEAN', () => {
    it('returns 1.0 when currentValue >= 1', () => {
      expect(computeScore(KeyResultMetricType.BOOLEAN, d(1), d(1)).toNumber()).toBe(1);
    });

    it('returns 0.0 when currentValue < 1', () => {
      expect(computeScore(KeyResultMetricType.BOOLEAN, d(0), d(1)).toNumber()).toBe(0);
    });
  });

  describe('PERCENTAGE / NUMBER / CURRENCY (linear)', () => {
    it('returns 0.45 for 45/100 (PERCENTAGE)', () => {
      expect(computeScore(KeyResultMetricType.PERCENTAGE, d(45), d(100)).toNumber()).toBeCloseTo(0.45);
    });

    it('returns linear ratio for NUMBER', () => {
      expect(computeScore(KeyResultMetricType.NUMBER, d(3), d(10)).toNumber()).toBeCloseTo(0.3);
    });

    it('returns linear ratio for CURRENCY', () => {
      expect(computeScore(KeyResultMetricType.CURRENCY, d('50000'), d('200000')).toNumber()).toBeCloseTo(0.25);
    });

    it('clamps to 1.0 when currentValue > targetValue', () => {
      expect(computeScore(KeyResultMetricType.PERCENTAGE, d(120), d(100)).toNumber()).toBe(1);
    });

    it('returns 0 when targetValue <= 0 (invalid data guard)', () => {
      expect(computeScore(KeyResultMetricType.NUMBER, d(50), d(0)).toNumber()).toBe(0);
      expect(computeScore(KeyResultMetricType.NUMBER, d(50), d(-5)).toNumber()).toBe(0);
    });

    it('returns 0 when currentValue is 0', () => {
      expect(computeScore(KeyResultMetricType.PERCENTAGE, d(0), d(100)).toNumber()).toBe(0);
    });
  });
});
