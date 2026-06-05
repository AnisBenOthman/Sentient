import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  it('uses the generated Prisma client delegates', async () => {
    const service = new PrismaService();

    expect(service.conversation).toBeDefined();
    expect(service.message).toBeDefined();
    expect(service.agentTaskLog).toBeDefined();
    expect(service.vectorDocument).toBeDefined();
    await service.$disconnect();
  });
});
