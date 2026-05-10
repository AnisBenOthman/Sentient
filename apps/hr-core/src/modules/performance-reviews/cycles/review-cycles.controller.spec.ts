import { ReviewCyclesController } from './review-cycles.controller';
import { ReviewCyclesService } from './review-cycles.service';

describe('ReviewCyclesController', () => {
  it('delegates list requests to the service', async () => {
    const service = { list: jest.fn<Promise<unknown[]>, []>().mockResolvedValue([]) };
    const controller = new ReviewCyclesController(service as unknown as ReviewCyclesService);
    await expect(controller.findAll()).resolves.toEqual([]);
    expect(service.list).toHaveBeenCalledTimes(1);
  });
});
