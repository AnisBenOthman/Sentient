import { PerformanceReviewsController } from './performance-reviews.controller';
import { PerformanceReviewsService } from './performance-reviews.service';

describe('PerformanceReviewsController', () => {
  it('delegates list requests to the service', async () => {
    const service = {
      findAll: jest.fn().mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 }),
    };
    const controller = new PerformanceReviewsController(service as unknown as PerformanceReviewsService);
    const user = {
      sub: 'user-1',
      employeeId: 'employee-1',
      roles: ['EMPLOYEE'],
      departmentId: null,
      teamId: null,
      businessUnitId: null,
      channel: 'WEB',
      roleAssignments: [],
      sessionId: 'session-1',
      iat: 0,
      exp: 1,
    } as Parameters<typeof controller.findAll>[1];

    await expect(controller.findAll({}, user)).resolves.toEqual({ data: [], total: 0, page: 1, limit: 20 });
    expect(service.findAll).toHaveBeenCalledTimes(1);
  });
});
