import { BadRequestException } from '@nestjs/common';
import { ReviewType } from '@sentient/shared';
import { ReviewCyclesService } from './review-cycles.service';

describe('ReviewCyclesService', () => {
  it('rejects a cycle whose period ends before it starts', async () => {
    const prisma = {
      performanceReviewCycle: {
        create: jest.fn(),
      },
    } as unknown as ConstructorParameters<typeof ReviewCyclesService>[0];
    const service = new ReviewCyclesService(prisma);

    await expect(service.create({
      name: 'Invalid cycle',
      reviewType: ReviewType.ANNUAL,
      periodStart: '2026-12-31',
      periodEnd: '2026-01-01',
      selfReviewOpensAt: '2026-11-01T09:00:00.000Z',
      selfReviewClosesAt: '2026-11-30T17:00:00.000Z',
      managerReviewDueAt: '2026-12-15T17:00:00.000Z',
    }, 'employee-1')).rejects.toThrow(BadRequestException);
  });
});
