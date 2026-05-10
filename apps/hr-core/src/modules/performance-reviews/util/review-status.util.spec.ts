import { ConflictException } from '@nestjs/common';
import { ReviewCycleStatus, ReviewStatus } from '../../../generated/prisma';
import { assertActiveCycle, assertReviewStatusTransition, isManagerReviewEditable, isSelfReviewEditable } from './review-status.util';

describe('review-status.util', () => {
  it('allows expected status transitions', () => {
    expect(() => assertReviewStatusTransition(ReviewStatus.PENDING, ReviewStatus.SUBMITTED)).not.toThrow();
    expect(() => assertReviewStatusTransition(ReviewStatus.SUBMITTED, ReviewStatus.COMPLETED)).not.toThrow();
  });

  it('rejects invalid status transitions', () => {
    expect(() => assertReviewStatusTransition(ReviewStatus.CANCELLED, ReviewStatus.REOPENED)).toThrow(ConflictException);
  });

  it('identifies editable windows', () => {
    expect(isSelfReviewEditable(ReviewStatus.PENDING)).toBe(true);
    expect(isManagerReviewEditable(ReviewStatus.SUBMITTED)).toBe(true);
    expect(() => assertActiveCycle(ReviewCycleStatus.CLOSED)).toThrow(ConflictException);
  });
});
