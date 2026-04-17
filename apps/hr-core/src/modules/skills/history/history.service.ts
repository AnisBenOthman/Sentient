import { BadRequestException, Injectable } from '@nestjs/common';
import { SkillHistory } from '../../../generated/prisma';
import { PrismaService } from '../../../prisma/prisma.service';
import { HistoryQueryDto } from '../dto/history-query.dto';

export interface PaginatedHistory {
  data: SkillHistory[];
  total: number;
  page: number;
  limit: number;
}

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

@Injectable()
export class HistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async query(dto: HistoryQueryDto): Promise<PaginatedHistory> {
    // const if (user.role === 'EMPLOYEE' && dto.employeeId !== user.employeeId) throw new ForbiddenException(); // TODO: re-enable when IAM module is implemented

    if (dto.fromDate && dto.toDate && new Date(dto.fromDate) > new Date(dto.toDate)) {
      throw new BadRequestException('fromDate must be before or equal to toDate');
    }

    // WHY: When toDate is a date-only string (YYYY-MM-DD) it parses as UTC midnight,
    // which makes `lte` exclude intra-day rows on that day. Expanding to end-of-day
    // restores the inclusive semantics advertised by the DTO description.
    const fromDate = dto.fromDate ? new Date(dto.fromDate) : undefined;
    let toDate: Date | undefined;
    if (dto.toDate) {
      toDate = new Date(dto.toDate);
      if (DATE_ONLY_REGEX.test(dto.toDate)) {
        toDate.setUTCHours(23, 59, 59, 999);
      }
    }

    const page = dto.page ?? 1;
    const limit = dto.limit ?? 50;

    const where = {
      ...(dto.employeeId ? { employeeId: dto.employeeId } : {}),
      ...(dto.skillId ? { skillId: dto.skillId } : {}),
      ...(dto.source ? { source: dto.source } : {}),
      ...(dto.teamId ? { employee: { teamId: dto.teamId } } : {}),
      ...(dto.departmentId ? { employee: { departmentId: dto.departmentId } } : {}),
      ...(fromDate || toDate
        ? {
            effectiveDate: {
              ...(fromDate ? { gte: fromDate } : {}),
              ...(toDate ? { lte: toDate } : {}),
            },
          }
        : {}),
    };

    const order = dto.order ?? 'desc';
    const [data, total] = await Promise.all([
      this.prisma.skillHistory.findMany({
        where,
        include: {
          skill: { select: { id: true, name: true, category: true } },
          assessedBy: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: [{ effectiveDate: order }, { createdAt: order }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.skillHistory.count({ where }),
    ]);

    return { data, total, page, limit };
  }
}
