import { ConflictException, NotFoundException } from '@nestjs/common';
import { BusinessUnitsService } from './business-units.service';
import { PrismaService } from '../../../prisma/prisma.service';

const businessUnit = {
  id: 'bu-1',
  name: 'Sentient HQ',
  address: 'Algiers, Algeria',
  currency: 'DZD',
  isActive: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

describe('BusinessUnitsService', () => {
  const prisma = {
    businessUnit: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  let service: BusinessUnitsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BusinessUnitsService(prisma as unknown as PrismaService);
  });

  it('creates a business unit with currency', async () => {
    prisma.businessUnit.findFirst.mockResolvedValue(null);
    prisma.businessUnit.create.mockResolvedValue(businessUnit);

    const result = await service.create({
      name: 'Sentient HQ',
      address: 'Algiers, Algeria',
      currency: 'DZD',
    });

    expect(result.currency).toBe('DZD');
    expect(prisma.businessUnit.create).toHaveBeenCalledWith({
      data: {
        name: 'Sentient HQ',
        address: 'Algiers, Algeria',
        currency: 'DZD',
      },
    });
  });

  it('updates currency when provided', async () => {
    prisma.businessUnit.findUnique.mockResolvedValue(businessUnit);
    prisma.businessUnit.update.mockResolvedValue({ ...businessUnit, currency: 'EUR' });

    const result = await service.update('bu-1', { currency: 'EUR' });

    expect(result.currency).toBe('EUR');
    expect(prisma.businessUnit.update).toHaveBeenCalledWith({
      where: { id: 'bu-1' },
      data: { currency: 'EUR' },
    });
  });

  it('rejects duplicate business unit names', async () => {
    prisma.businessUnit.findFirst.mockResolvedValue(businessUnit);

    await expect(
      service.create({
        name: 'Sentient HQ',
        address: 'Algiers, Algeria',
        currency: 'DZD',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects updates for missing business units', async () => {
    prisma.businessUnit.findUnique.mockResolvedValue(null);

    await expect(service.update('missing', { currency: 'EUR' })).rejects.toBeInstanceOf(NotFoundException);
  });
});
