import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EmploymentStatus } from '@sentient/shared';
import { Prisma, Team } from '../../../generated/prisma';
import { JwtPayload } from '@sentient/shared';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { TeamQueryDto } from './dto/team-query.dto';
import { UpdateTeamDto } from './dto/update-team.dto';

export interface TeamWithVacancy extends Team {
  leadVacant: boolean;
}

export interface CursorPage<T> {
  data: T[];
  nextCursor: string | null;
  total: number;
}

@Injectable()
export class TeamsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateTeamDto): Promise<Team> {
    // WHY: Department must be active — creating a team under an inactive dept
    // would produce an orphaned record that can't be reached from the org chart.
    const department = await this.prisma.department.findFirst({
      where: { id: dto.departmentId, isActive: true },
    });
    if (!department) {
      throw new BadRequestException(
        `Department ${dto.departmentId} is inactive or does not exist`,
      );
    }

    if (dto.leadId) {
      const lead = await this.prisma.employee.findUnique({
        where: { id: dto.leadId },
        select: { id: true },
      });
      if (!lead) {
        throw new NotFoundException(
          `Employee ${dto.leadId} not found — leadId must reference an existing employee`,
        );
      }
    }

    if (dto.code) {
      await this.ensureUniqueCode(null, dto.code);
    }

    return this.prisma.team.create({
      data: {
        name: dto.name,
        code: dto.code,
        description: dto.description,
        departmentId: dto.departmentId,
        leadId: dto.leadId,
        projectFocus: dto.projectFocus,
      },
    });
  }

  async findAll(
    query: TeamQueryDto,
    user: JwtPayload,
  ): Promise<CursorPage<Team>> {
    const isManager = user.roles.includes('MANAGER');
    const isAdminOrExec =
      user.roles.includes('HR_ADMIN') || user.roles.includes('EXECUTIVE');

    let where: Prisma.TeamWhereInput;

    if (isManager && !isAdminOrExec) {
      // WHY: MANAGER scope = only the team they lead. If teamId is absent
      // (not yet assigned), return empty list rather than 403 — the lack of
      // assignment is a data state, not a security violation.
      if (!user.teamId) {
        return { data: [], nextCursor: null, total: 0 };
      }
      where = { id: user.teamId };
    } else {
      where = {
        isActive: isAdminOrExec ? (query.isActive ?? true) : true,
        ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      };
    }

    const [data, total] = await Promise.all([
      this.prisma.team.findMany({
        where,
        orderBy: { name: 'asc' },
        take: query.limit,
        ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      }),
      this.prisma.team.count({ where }),
    ]);

    const nextCursor =
      data.length === query.limit
        ? (data[data.length - 1]?.id ?? null)
        : null;

    return { data, nextCursor, total };
  }

  async findById(id: string, user: JwtPayload): Promise<TeamWithVacancy> {
    const isManager = user.roles.includes('MANAGER');
    const isAdminOrExec =
      user.roles.includes('HR_ADMIN') || user.roles.includes('EXECUTIVE');

    // WHY: Return ForbiddenException (not NotFoundException) when a MANAGER
    // requests a team they do not lead — do not reveal whether the team exists.
    if (isManager && !isAdminOrExec) {
      if (user.teamId !== id) {
        throw new ForbiddenException(
          'Managers can only access their own team',
        );
      }
    }

    const team = await this.prisma.team.findUnique({ where: { id } });
    if (!team) {
      throw new NotFoundException(`Team ${id} not found`);
    }

    // WHY: leadVacant is resolved at read time — no scheduled job needed.
    // A team has a vacant lead when leadId is set but the employee is TERMINATED.
    let leadVacant = false;
    if (team.leadId) {
      const lead = await this.prisma.employee.findUnique({
        where: { id: team.leadId },
        select: { employmentStatus: true },
      });
      leadVacant =
        !lead || lead.employmentStatus === EmploymentStatus.TERMINATED;
    }

    return { ...team, leadVacant };
  }

  async update(id: string, dto: UpdateTeamDto): Promise<Team> {
    const existing = await this.prisma.team.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Team ${id} not found`);
    }

    if (dto.departmentId && dto.departmentId !== existing.departmentId) {
      const department = await this.prisma.department.findFirst({
        where: { id: dto.departmentId, isActive: true },
      });
      if (!department) {
        throw new BadRequestException(
          `Department ${dto.departmentId} is inactive or does not exist`,
        );
      }
    }

    if (dto.leadId !== undefined && dto.leadId !== existing.leadId) {
      if (dto.leadId) {
        const lead = await this.prisma.employee.findUnique({
          where: { id: dto.leadId },
          select: { id: true },
        });
        if (!lead) {
          throw new NotFoundException(
            `Employee ${dto.leadId} not found — leadId must reference an existing employee`,
          );
        }
      }
    }

    if (dto.code !== undefined && dto.code !== existing.code) {
      if (dto.code) {
        await this.ensureUniqueCode(id, dto.code);
      }
    }

    return this.prisma.team.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.code !== undefined && { code: dto.code }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.departmentId !== undefined && {
          departmentId: dto.departmentId,
        }),
        ...(dto.leadId !== undefined && { leadId: dto.leadId }),
        ...(dto.projectFocus !== undefined && {
          projectFocus: dto.projectFocus,
        }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async deactivate(
    id: string,
  ): Promise<Pick<Team, 'id' | 'isActive' | 'updatedAt'>> {
    const existing = await this.prisma.team.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Team ${id} not found`);
    }

    return this.prisma.team.update({
      where: { id },
      data: { isActive: false },
      select: { id: true, isActive: true, updatedAt: true },
    });
  }

  private async ensureUniqueCode(
    excludeId: string | null,
    code: string,
  ): Promise<void> {
    const existing = await this.prisma.team.findFirst({ where: { code } });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException('Team code already exists');
    }
  }
}
