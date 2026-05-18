import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LeaveStatus } from '@sentient/shared';
import { LeaveType, Prisma } from '../../../generated/prisma';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateLeaveTypeDto } from '../dto/create-leave-type.dto';
import { UpdateLeaveTypeDto } from '../dto/update-leave-type.dto';

export interface LeaveTypeQueryDto {
  businessUnitId?: string;
  includeInactive?: boolean | string;
}

@Injectable()
export class LeaveTypesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filter: LeaveTypeQueryDto): Promise<LeaveType[]> {
    const showInactive = filter.includeInactive === true || filter.includeInactive === 'true';
    return this.prisma.leaveType.findMany({
      where: {
        ...(showInactive ? {} : { isActive: true }),
        ...(filter.businessUnitId ? { businessUnitId: filter.businessUnitId } : {}),
      },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
  }

  async findOne(id: string): Promise<LeaveType> {
    const lt = await this.prisma.leaveType.findUnique({ where: { id } });
    if (!lt) throw new NotFoundException(`LeaveType ${id} not found`);
    return lt;
  }

  async create(dto: CreateLeaveTypeDto): Promise<LeaveType> {
    try {
      return await this.prisma.leaveType.create({
        data: {
          businessUnitId: dto.businessUnitId,
          name: dto.name,
          defaultDaysPerYear: dto.defaultDaysPerYear,
          accrualFrequency: dto.accrualFrequency,
          maxCarryoverDays: dto.maxCarryoverDays,
          requiresApproval: dto.requiresApproval,
          color: dto.color,
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('DuplicateLeaveTypeName');
      }
      throw e;
    }
  }

  async update(id: string, dto: UpdateLeaveTypeDto): Promise<LeaveType> {
    await this.findOne(id);

    if (dto.defaultDaysPerYear !== undefined || dto.color !== undefined) {
      // accrualFrequency is omitted from update DTO already — check here anyway
    }

    // Guard: if any balance or adjustment references this type, accrualFrequency is locked
    // (accrualFrequency is not in UpdateLeaveTypeDto, but guard is still useful for future)
    const hasReferences =
      (await this.prisma.leaveBalance.count({ where: { leaveTypeId: id } })) > 0 ||
      (await this.prisma.leaveBalanceAdjustment.count({
        where: { balance: { leaveTypeId: id } },
      })) > 0;

    if (hasReferences && (dto as { accrualFrequency?: unknown }).accrualFrequency !== undefined) {
      throw new BadRequestException('AccrualFrequencyLocked');
    }

    try {
      return await this.prisma.leaveType.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.defaultDaysPerYear !== undefined
            ? { defaultDaysPerYear: dto.defaultDaysPerYear }
            : {}),
          ...(dto.maxCarryoverDays !== undefined ? { maxCarryoverDays: dto.maxCarryoverDays } : {}),
          ...(dto.requiresApproval !== undefined ? { requiresApproval: dto.requiresApproval } : {}),
          ...(dto.color !== undefined ? { color: dto.color } : {}),
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('DuplicateLeaveTypeName');
      }
      throw e;
    }
  }

  async deactivate(id: string): Promise<LeaveType> {
    await this.findOne(id);

    // Block if any leave request for this type is still pending approval.
    const pendingCount = await this.prisma.leaveRequest.count({
      where: { leaveTypeId: id, status: LeaveStatus.PENDING },
    });
    if (pendingCount > 0) {
      throw new BadRequestException(
        'LeaveTypeHasPendingRequests',
      );
    }

    return this.prisma.leaveType.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async reactivate(id: string): Promise<LeaveType> {
    await this.findOne(id);
    return this.prisma.leaveType.update({
      where: { id },
      data: { isActive: true },
    });
  }
}
