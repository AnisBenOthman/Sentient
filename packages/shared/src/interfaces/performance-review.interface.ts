import {
  PerformanceRating,
  PerformanceReviewAuditAction,
  ReviewCycleStatus,
  ReviewStatus,
  ReviewType,
  SatisfactionLevel,
} from '../enums';

export interface PerformanceReviewCycleDto {
  id: string;
  name: string;
  reviewType: ReviewType;
  periodStart: string;
  periodEnd: string;
  selfReviewOpensAt: string;
  selfReviewClosesAt: string;
  managerReviewDueAt: string;
  status: ReviewCycleStatus;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  cancelledAt: string | null;
}

export interface PerformanceReviewPersonDto {
  id: string;
  firstName: string;
  lastName: string;
}

export interface PerformanceReviewDto {
  id: string;
  cycleId: string;
  employeeId: string;
  reviewerId: string;
  reviewDate: string;
  dueDate: string;
  status: ReviewStatus;
  businessUnitId: string | null;
  businessUnitName: string | null;
  departmentId: string | null;
  departmentName: string | null;
  teamId: string | null;
  teamName: string | null;
  positionId: string | null;
  positionTitle: string | null;
  environmentSatisfaction: SatisfactionLevel | null;
  jobSatisfaction: SatisfactionLevel | null;
  relationshipSatisfaction: SatisfactionLevel | null;
  trainingOpportunitiesTaken: number | null;
  workLifeBalance: SatisfactionLevel | null;
  selfRating: PerformanceRating | null;
  managerRating: PerformanceRating | null;
  employeeComments: string | null;
  managerComments: string | null;
  submittedAt: string | null;
  completedAt: string | null;
  reopenedAt: string | null;
  reopenReason: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  ratingGap: boolean;
  overdue: boolean;
  salaryFollowUps?: PerformanceReviewSalaryFollowUpDto[];
  employee?: PerformanceReviewPersonDto;
  reviewer?: PerformanceReviewPersonDto;
  cycle?: PerformanceReviewCycleDto;
}

export interface PerformanceReviewListDto {
  data: PerformanceReviewDto[];
  total: number;
  page: number;
  limit: number;
}

export interface PerformanceReviewCycleInitiationDto {
  cycle: PerformanceReviewCycleDto;
  created: number;
  skippedExisting: number;
  missingReviewers: Array<{
    employeeId: string;
    employeeName: string;
    reason: string;
  }>;
}

export interface PerformanceReviewCycleSummaryDto {
  cycleId: string;
  total: number;
  pending: number;
  inProgress: number;
  submitted: number;
  completed: number;
  reopened: number;
  closed: number;
  cancelled: number;
  overdue: number;
  ratingGaps: number;
}

export interface PerformanceReviewAuditDto {
  id: string;
  reviewId: string;
  action: PerformanceReviewAuditAction;
  actorId: string;
  fromStatus: ReviewStatus | null;
  toStatus: ReviewStatus | null;
  reason: string | null;
  metadata: unknown;
  createdAt: string;
}

export interface PerformanceReviewSalaryFollowUpDto {
  id: string;
  reviewId: string;
  salaryHistoryId: string | null;
  reason: string;
  createdById: string;
  createdAt: string;
}
