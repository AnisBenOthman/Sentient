import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Decimal } from '../../../generated/prisma/runtime/library';
import { LeaveBalance, LeaveBalanceAdjustment } from '../../../generated/prisma';
import { PrismaService } from '../../../prisma/prisma.service';
import { AdjustBalanceDto } from '../dto/adjust-balance.dto';

export interface LeaveBalanceDto {
  id: string;
  employeeId: string;
  leaveTypeId: string;
  leaveTypeName: string;
  year: number;
  totalDays: Decimal;
  usedDays: Decimal;
  pendingDays: Decimal;
  remainingDays: Decimal;
}

@Injectable()
export class BalancesService {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmployee(employeeId: string, year: number): Promise<LeaveBalanceDto[]> {
    const balances = await this.prisma.leaveBalance.findMany({
      where: { employeeId, year },
      include: { leaveType: { select: { name: true } } },
    });

    return balances.map((b) => this.toDto(b));
  }

  async adjust(
    balanceId: string,
    dto: AdjustBalanceDto,
    adjustedBy: string,
  ): Promise<LeaveBalanceDto> {
    const balance = await this.prisma.leaveBalance.findUnique({ where: { id: balanceId } });
    if (!balance) throw new NotFoundException(`LeaveBalance ${balanceId} not found`);

    const previousTotalDays = balance.totalDays;
    const newTotalDays = new Decimal(dto.newTotalDays);

    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedBalance = await tx.leaveBalance.update({
        where: { id: balanceId },
        data: { totalDays: newTotalDays },
        include: { leaveType: { select: { name: true } } },
      });

      await tx.leaveBalanceAdjustment.create({
        data: {
          balanceId,
          adjustedBy,
          previousTotalDays,
          newTotalDays,
          reason: dto.reason,
        },
      });

      return updatedBalance;
    });

    return this.toDto(updated);
  }

  async findAdjustments(balanceId: string): Promise<LeaveBalanceAdjustment[]> {
    const balance = await this.prisma.leaveBalance.findUnique({ where: { id: balanceId } });
    if (!balance) throw new NotFoundException(`LeaveBalance ${balanceId} not found`);

    return this.prisma.leaveBalanceAdjustment.findMany({
      where: { balanceId },
      orderBy: { createdAt: 'desc' },
    });
  }

  private toDto(
    b: LeaveBalance & { leaveType: { name: string } },
  ): LeaveBalanceDto {
    if (!b.leaveType) throw new BadRequestException('LeaveType relation missing');
    const remainingDays = b.totalDays.minus(b.usedDays).minus(b.pendingDays);
    return {
      id: b.id,
      employeeId: b.employeeId,
      leaveTypeId: b.leaveTypeId,
      leaveTypeName: b.leaveType.name,
      year: b.year,
      totalDays: b.totalDays,
      usedDays: b.usedDays,
      pendingDays: b.pendingDays,
      remainingDays,
    };
  }
}
