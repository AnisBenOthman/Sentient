import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Department, Prisma } from '../../../generated/prisma';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { DepartmentQueryDto } from './dto/department-query.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';

export interface EmployeeRef {
  id: string;
  firstName: string;
  lastName: string;
}

export interface TeamSummary {
  id: string;
  name: string;
  isActive: boolean;
}

export interface BusinessUnitRef {
  id: string;
  name: string;
  address: string;
}

export interface DepartmentDetail extends Department {
  teams: TeamSummary[];
  head: EmployeeRef | null;
  businessUnit: BusinessUnitRef | null;
}

export interface CursorPage<T> {
  data: T[];
  nextCursor: string | null;
  total: number;
}

@Injectable()
export class DepartmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateDepartmentDto): Promise<Department> {
    await this.ensureUniqueName(null, dto.name);
    await this.ensureUniqueCode(null, dto.code);

    if (dto.headId) {
      await this.resolveEmployee(dto.headId, true);
    }

    if (dto.businessUnitId) {
      await this.resolveBusinessUnit(dto.businessUnitId);
    }

    return this.prisma.department.create({
      data: {
        name: dto.name,
        code: dto.code,
        description: dto.description,
        headId: dto.headId,
        businessUnitId: dto.businessUnitId,
      },
    });
  }

  async findAll(
    query: DepartmentQueryDto,
    roles: string[],
  ): Promise<CursorPage<Department>> {
    const isAdmin = roles.includes('HR_ADMIN');

    const where: Prisma.DepartmentWhereInput = {
      // WHY: Non-admin callers always receive active departments regardless of
      // query param — prevents role escalation via filter bypass.
      isActive: isAdmin ? (query.isActive ?? true) : true,
    };

    const [data, total] = await Promise.all([
      this.prisma.department.findMany({
        where,
        orderBy: { name: 'asc' },
        take: query.limit,
        ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      }),
      this.prisma.department.count({ where }),
    ]);

    const nextCursor =
      data.length === query.limit
        ? (data[data.length - 1]?.id ?? null)
        : null;

    return { data, nextCursor, total };
  }

  async findById(id: string): Promise<DepartmentDetail> {
    const department = await this.prisma.department.findUnique({
      where: { id },
      include: {
        teams: {
          select: { id: true, name: true, isActive: true },
        },
        businessUnit: {
          select: { id: true, name: true, address: true },
        },
      },
    });

    if (!department) {
      throw new NotFoundException(`Department ${id} not found`);
    }

    // WHY: headId is a logical FK — the employee may have been terminated or
    // deleted. Return null for head without throwing; only missing dept throws.
    const head = department.headId
      ? await this.prisma.employee.findUnique({
          where: { id: department.headId },
          select: { id: true, firstName: true, lastName: true },
        })
      : null;

    return { ...department, head: head ?? null };
  }

  async update(id: string, dto: UpdateDepartmentDto): Promise<Department> {
    const existing = await this.prisma.department.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Department ${id} not found`);
    }

    if (dto.name && dto.name !== existing.name) {
      await this.ensureUniqueName(id, dto.name);
    }
    if (dto.code && dto.code !== existing.code) {
      await this.ensureUniqueCode(id, dto.code);
    }
    if (dto.headId !== undefined && dto.headId !== existing.headId) {
      if (dto.headId) {
        await this.resolveEmployee(dto.headId, true);
      }
    }
    if (dto.businessUnitId !== undefined && dto.businessUnitId !== existing.businessUnitId) {
      if (dto.businessUnitId) {
        await this.resolveBusinessUnit(dto.businessUnitId);
      }
    }

    return this.prisma.department.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.code !== undefined && { code: dto.code }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.headId !== undefined && { headId: dto.headId }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.businessUnitId !== undefined && { businessUnitId: dto.businessUnitId }),
      },
    });
  }

  async deactivate(
    id: string,
  ): Promise<Pick<Department, 'id' | 'isActive' | 'updatedAt'>> {
    const existing = await this.prisma.department.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Department ${id} not found`);
    }

    return this.prisma.department.update({
      where: { id },
      data: { isActive: false },
      select: { id: true, isActive: true, updatedAt: true },
    });
  }

  private async ensureUniqueName(
    excludeId: string | null,
    name: string,
  ): Promise<void> {
    const existing = await this.prisma.department.findFirst({
      where: { name },
    });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException('Department name already exists');
    }
  }

  private async ensureUniqueCode(
    excludeId: string | null,
    code: string,
  ): Promise<void> {
    const existing = await this.prisma.department.findFirst({
      where: { code },
    });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException('Department code already exists');
    }
  }

  private async resolveEmployee(
    employeeId: string,
    throwIfMissing: boolean,
  ): Promise<void> {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true },
    });
    if (!employee && throwIfMissing) {
      throw new NotFoundException(
        `Employee ${employeeId} not found — headId must reference an existing employee`,
      );
    }
  }

  private async resolveBusinessUnit(businessUnitId: string): Promise<void> {
    const bu = await this.prisma.businessUnit.findUnique({
      where: { id: businessUnitId },
      select: { id: true, isActive: true },
    });
    if (!bu) {
      throw new NotFoundException(
        `BusinessUnit ${businessUnitId} not found`,
      );
    }
    if (!bu.isActive) {
      throw new NotFoundException(
        `BusinessUnit ${businessUnitId} is inactive`,
      );
    }
  }
}
