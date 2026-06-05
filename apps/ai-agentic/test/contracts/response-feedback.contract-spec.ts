import { FeedbackRating } from '../../src/generated/prisma';
import { ActorContextFactory, AiActorContext } from '../../src/common/graph';
import { FeedbackController } from '../../src/modules/feedback/feedback.controller';
import { FeedbackService } from '../../src/modules/feedback/feedback.service';

const actor: AiActorContext = {
  jwt: 'token',
  userId: 'user-1',
  employeeId: 'employee-1',
  roles: ['EMPLOYEE'],
  departmentId: null,
  teamId: null,
  businessUnitId: null,
  correlationId: 'corr-1',
};

describe('AI response feedback contract', () => {
  it('saves feedback for assistant responses', async () => {
    const controller = new FeedbackController(
      {
        upsert: async () => ({
          id: 'feedback-1',
          messageId: 'message-1',
          rating: FeedbackRating.POSITIVE,
          comment: 'Helpful',
          createdAt: new Date(0).toISOString(),
        }),
      } as unknown as FeedbackService,
      { fromRequest: () => actor } as unknown as ActorContextFactory,
    );

    const result = await controller.upsert({} as never, 'message-1', {
      rating: FeedbackRating.POSITIVE,
      comment: 'Helpful',
    });

    expect(result.rating).toBe(FeedbackRating.POSITIVE);
  });
});
