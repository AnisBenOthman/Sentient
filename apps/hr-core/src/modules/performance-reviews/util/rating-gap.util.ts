import { PerformanceRating } from '../../../generated/prisma';

const RATING_RANK: Record<PerformanceRating, number> = {
  [PerformanceRating.UNACCEPTABLE]: 1,
  [PerformanceRating.NEEDS_IMPROVEMENT]: 2,
  [PerformanceRating.MEETS_EXPECTATIONS]: 3,
  [PerformanceRating.EXCEEDS_EXPECTATIONS]: 4,
  [PerformanceRating.ABOVE_AND_BEYOND]: 5,
};

export function performanceRatingRank(rating: PerformanceRating): number {
  return RATING_RANK[rating];
}

export function hasRatingGap(
  selfRating: PerformanceRating | null,
  managerRating: PerformanceRating | null,
): boolean {
  if (!selfRating || !managerRating) return false;
  return Math.abs(performanceRatingRank(selfRating) - performanceRatingRank(managerRating)) >= 2;
}
