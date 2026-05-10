import { ConflictException } from '@nestjs/common';
import { ReviewCycleStatus, ReviewStatus } from '../../../generated/prisma';

const ALLOWED_TRANSITIONS: Record<ReviewStatus, ReviewStatus[]> = {
  [ReviewStatus.PENDING]: [ReviewStatus.IN_PROGRESS, ReviewStatus.SUBMITTED, ReviewStatus.CANCELLED, ReviewStatus.REOPENED],
  [ReviewStatus.IN_PROGRESS]: [ReviewStatus.SUBMITTED, ReviewStatus.CANCELLED, ReviewStatus.REOPENED],
  [ReviewStatus.SUBMITTED]: [ReviewStatus.COMPLETED, ReviewStatus.REOPENED, ReviewStatus.CANCELLED],
  [ReviewStatus.COMPLETED]: [ReviewStatus.REOPENED, ReviewStatus.CLOSED],
  [ReviewStatus.REOPENED]: [ReviewStatus.SUBMITTED, ReviewStatus.COMPLETED, ReviewStatus.CLOSED, ReviewStatus.CANCELLED],
  [ReviewStatus.CLOSED]: [ReviewStatus.REOPENED],
  [ReviewStatus.CANCELLED]: [],
};

export function assertReviewStatusTransition(from: ReviewStatus, to: ReviewStatus): void {
  if (!ALLOWED_TRANSITIONS[from].includes(to)) {
    throw new ConflictException(`Invalid review status transition ${from} -> ${to}`);
  }
}

export function isSelfReviewEditable(status: ReviewStatus): boolean {
  return new Set<ReviewStatus>([ReviewStatus.PENDING, ReviewStatus.IN_PROGRESS, ReviewStatus.REOPENED]).has(status);
}

export function isManagerReviewEditable(status: ReviewStatus): boolean {
  return new Set<ReviewStatus>([ReviewStatus.SUBMITTED, ReviewStatus.REOPENED]).has(status);
}

export function assertActiveCycle(status: ReviewCycleStatus): void {
  if (status !== ReviewCycleStatus.ACTIVE) {
    throw new ConflictException('ReviewCycleNotActive');
  }
}
