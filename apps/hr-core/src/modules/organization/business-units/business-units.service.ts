import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BusinessUnit, Prisma } from '../../../generated/prisma';
import { PrismaService } from '../../../prisma/prisma.service';
import { BusinessUnitQueryDto } from './dto/business-unit-query.dto';
import { CreateBusinessUnitDto } from './dto/create-business-unit.dto';
import { UpdateBusinessUnitDto } from './dto/update-business-unit.dto';

export interface CursorPage<T> {
  data: T[];
  nextCursor: string | null;
  total: number;
}

@Injectable()
export class BusinessUnitsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateBusinessUnitDto): Promise<BusinessUnit> {
    await this.ensureUniqueName(null, dto.name);

    return this.prisma.businessUnit.create({
      data: {
        name: dto.name,
        address: dto.address,
      },
    });
  }

  async findAll(
    query: BusinessUnitQueryDto,
    roles: string[],
  ): Promise<CursorPage<BusinessUnit>> {
    const isAdmin = roles.includes('HR_ADMIN');

    const where: Prisma.BusinessUnitWhereInput = {
      // WHY: Non-admin callers always receive active business units —
      // prevents role escalation via isActive filter bypass.
      isActive: isAdmin ? (query.isActive ?? true) : true,
    };

    const [data, total] = await Promise.all([
      this.prisma.businessUnit.findMany({
        where,
        orderBy: { name: 'asc' },
        take: query.limit,
        ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      }),
      this.prisma.businessUnit.count({ where }),
    ]);

    const nextCursor =
      data.length === query.limit
        ? (data[data.length - 1]?.id ?? null)
        : null;

    return { data, nextCursor, total };
  }

  async findById(id: string): Promise<BusinessUnit & { departments: { id: string; name: string; isActive: boolean }[] }> {
    const businessUnit = await this.prisma.businessUnit.findUnique({
      where: { id },
      include: {
        departments: {
          select: { id: true, name: true, isActive: true },
        },
      },
    });

    if (!businessUnit) {
      throw new NotFoundException(`BusinessUnit ${id} not found`);
    }

    return businessUnit;
  }

  async update(id: string, dto: UpdateBusinessUnitDto): Promise<BusinessUnit> {
    const existing = await this.prisma.businessUnit.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`BusinessUnit ${id} not found`);
    }

    if (dto.name !== undefined && dto.name !== existing.name) {
      await this.ensureUniqueName(id, dto.name);
    }

    return this.prisma.businessUnit.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async deactivate(id: string): Promise<Pick<BusinessUnit, 'id' | 'isActive' | 'updatedAt'>> {
    const existing = await this.prisma.businessUnit.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`BusinessUnit ${id} not found`);
    }

    return this.prisma.businessUnit.update({
      where: { id },
      data: { isActive: false },
      select: { id: true, isActive: true, updatedAt: true },
    });
  }

  private async ensureUniqueName(excludeId: string | null, name: string): Promise<void> {
    const existing = await this.prisma.businessUnit.findFirst({ where: { name } });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException('Business unit name already exists');
    }
  }
}
