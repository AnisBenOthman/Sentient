import { PerformanceRating } from '../../../generated/prisma';
import { hasRatingGap, performanceRatingRank } from './rating-gap.util';

describe('rating-gap.util', () => {
  it('maps class diagram ratings to ordered ranks', () => {
    expect(performanceRatingRank(PerformanceRating.UNACCEPTABLE)).toBe(1);
    expect(performanceRatingRank(PerformanceRating.ABOVE_AND_BEYOND)).toBe(5);
  });

  it('flags gaps of at least two points', () => {
    expect(hasRatingGap(PerformanceRating.ABOVE_AND_BEYOND, PerformanceRating.MEETS_EXPECTATIONS)).toBe(true);
    expect(hasRatingGap(PerformanceRating.EXCEEDS_EXPECTATIONS, PerformanceRating.MEETS_EXPECTATIONS)).toBe(false);
  });
});
