import { ForbiddenException } from '@nestjs/common';
import { ChannelType } from '@sentient/shared';
import { ReviewStatus } from '../../../generated/prisma';
import { PerformanceReviewsService } from './performance-reviews.service';

describe('PerformanceReviewsService', () => {
  it('denies viewing reviews outside the employee scope', async () => {
    const prisma = {
      performanceReview: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'review-1',
          employeeId: 'employee-2',
          reviewerId: 'employee-3',
          departmentId: null,
          teamId: null,
          businessUnitId: null,
          status: ReviewStatus.PENDING,
        }),
      },
    } as unknown as ConstructorParameters<typeof PerformanceReviewsService>[0];
    const service = new PerformanceReviewsService(prisma);

    await expect(service.findOne('review-1', {
      sub: 'user-1',
      employeeId: 'employee-1',
      roles: ['EMPLOYEE'],
      departmentId: null,
      teamId: null,
      businessUnitId: null,
      channel: ChannelType.WEB,
      roleAssignments: [],
      sessionId: 'session-1',
      iat: 0,
      exp: 1,
    })).rejects.toThrow(ForbiddenException);
  });
});
