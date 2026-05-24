import { Test } from '@nestjs/testing';
import { EVENT_BUS, IEventBus } from '@sentient/shared';
import { AppModule } from '../../app.module';
import { PrismaService } from '../../prisma/prisma.service';

describe('EventBus smoke (AppModule)', () => {
  it('resolves EVENT_BUS and emits without throwing', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({ $connect: jest.fn(), $disconnect: jest.fn() })
      .compile();

    const bus = moduleRef.get<IEventBus>(EVENT_BUS);
    expect(bus).toBeDefined();

    await expect(
      bus.emit({
        id: 'test-uuid',
        type: 'scaffold.ping',
        source: 'social',
        timestamp: new Date(),
        payload: { ok: true },
        metadata: { userId: null, correlationId: 'test-corr' },
      }),
    ).resolves.toBeUndefined();

    await moduleRef.close();
  });
});
