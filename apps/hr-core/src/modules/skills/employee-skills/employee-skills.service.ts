import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { EVENT_BUS, IEventBus, ProficiencyLevel, SourceLevel } from '@sentient/shared';
import { EmployeeSkill, EmploymentStatus, SkillHistory } from '../../../generated/prisma';
import { PrismaService } from '../../../prisma/prisma.service';
import { EmployeeSkillQueryDto } from '../dto/employee-skill-query.dto';
import { UpsertEmployeeSkillDto } from '../dto/upsert-employee-skill.dto';

export interface UpsertResult {
  changed: boolean;
  current: EmployeeSkill;
  history: SkillHistory | null;
}

export interface EmployeeSkillWithEmployee {
  id: string;
  employeeId: string;
  skillId: string;
  proficiency: ProficiencyLevel;
  acquiredDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
  employee: { id: string; firstName: string; lastName: string; departmentId: string | null; teamId: string | null };
  skill: { id: string; name: string; category: string | null };
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

const PROFICIENCY_RANK: Record<ProficiencyLevel, number> = {
  [ProficiencyLevel.BEGINNER]: 0,
  [ProficiencyLevel.INTERMEDIATE]: 1,
  [ProficiencyLevel.ADVANCED]: 2,
  [ProficiencyLevel.EXPERT]: 3,
};

const TERMINAL_STATUSES = new Set<EmploymentStatus>([
  EmploymentStatus.TERMINATED,
  EmploymentStatus.RESIGNED,
]);

// WHY: Prisma's PrismaClientKnownRequestError shape varies between major versions.
// Duck-typing the P2002 unique-violation code is stable across upgrades.
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}

@Injectable()
export class EmployeeSkillsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(EVENT_BUS) private readonly eventBus: IEventBus,
  ) {}

  async upsert(employeeId: string, dto: UpsertEmployeeSkillDto): Promise<UpsertResult> {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, deletedAt: null },
      select: { id: true, employmentStatus: true },
    });
    if (!employee) throw new NotFoundException(`Employee ${employeeId} not found`);
    if (TERMINAL_STATUSES.has(employee.employmentStatus)) {
      throw new ConflictException('Employee is terminated or resigned — writes blocked');
    }

    const skill = await this.prisma.skill.findUnique({ where: { id: dto.skillId } });
    if (!skill) throw new NotFoundException(`Skill ${dto.skillId} not found`);

    const activeRow = await this.prisma.employeeSkill.findFirst({
      where: { employeeId, skillId: dto.skillId, deletedAt: null },
    });

    const effectiveDate = dto.effectiveDate ? new Date(dto.effectiveDate) : new Date();
    const acquiredDate = dto.acquiredDate ? new Date(dto.acquiredDate) : undefined;
    // const assessedById = user.employeeId; // TODO: re-enable when IAM module is implemented
    const assessedById: string | null = null;

    // Case B — no-op
    if (activeRow && activeRow.proficiency === dto.proficiency) {
      return { changed: false, current: activeRow, history: null };
    }

    if (!activeRow) {
      // Case A — first assignment. The partial unique index
      // employee_skills_employeeId_skillId_active_unique serializes concurrent
      // creates; convert P2002 into a clean 409.
      try {
        const result = await this.prisma.$transaction(async (tx) => {
          const current = await tx.employeeSkill.create({
            data: {
              employeeId,
              skillId: dto.skillId,
              proficiency: dto.proficiency,
              acquiredDate,
            },
          });
          const history = await tx.skillHistory.create({
            data: {
              employeeId,
              skillId: dto.skillId,
              previousLevel: null,
              newLevel: dto.proficiency,
              effectiveDate,
              source: dto.source,
              note: dto.note ?? null,
              assessedById,
            },
          });
          return { current, history };
        });

        await this.eventBus.emit({
          id: randomUUID(),
          type: 'skill.assessed',
          source: 'hr-core',
          timestamp: new Date(),
          payload: {
            employeeId,
            skillId: dto.skillId,
            previousLevel: null,
            newLevel: dto.proficiency,
            source: dto.source,
            assessedById,
            isFirstAssessment: true,
          },
          metadata: { userId: null, correlationId: randomUUID() },
        });

        return { changed: true, current: result.current, history: result.history };
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new ConflictException(
            'An active skill assignment already exists for this employee',
          );
        }
        throw error;
      }
    }

    // Case C — level change
    const previousLevel = activeRow.proficiency;
    const result = await this.prisma.$transaction(async (tx) => {
      const current = await tx.employeeSkill.update({
        where: { id: activeRow.id },
        data: { proficiency: dto.proficiency, acquiredDate },
      });
      const history = await tx.skillHistory.create({
        data: {
          employeeId,
          skillId: dto.skillId,
          previousLevel,
          newLevel: dto.proficiency,
          effectiveDate,
          source: dto.source,
          note: dto.note ?? null,
          assessedById,
        },
      });
      return { current, history };
    });

    await this.eventBus.emit({
      id: randomUUID(),
      type: 'skill.assessed',
      source: 'hr-core',
      timestamp: new Date(),
      payload: {
        employeeId,
        skillId: dto.skillId,
        previousLevel,
        newLevel: dto.proficiency,
        source: dto.source,
        assessedById,
        isFirstAssessment: false,
      },
      metadata: { userId: null, correlationId: randomUUID() },
    });

    return { changed: true, current: result.current, history: result.history };
  }

  async remove(employeeId: string, skillId: string): Promise<void> {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, deletedAt: null },
      select: { id: true, employmentStatus: true },
    });
    if (!employee) throw new NotFoundException(`Employee ${employeeId} not found`);
    if (TERMINAL_STATUSES.has(employee.employmentStatus)) {
      throw new ConflictException('Employee is terminated or resigned — writes blocked');
    }

    const activeRow = await this.prisma.employeeSkill.findFirst({
      where: { employeeId, skillId, deletedAt: null },
    });
    if (!activeRow) throw new NotFoundException(`Active skill assignment not found for employee ${employeeId}`);

    const previousLevel = activeRow.proficiency;
    // const assessedById = user.employeeId; // TODO: re-enable when IAM module is implemented
    const assessedById: string | null = null;

    // Soft-delete + append a removal tombstone in SkillHistory so the audit
    // trail records when and why the assignment ended. newLevel=null marks removal.
    await this.prisma.$transaction(async (tx) => {
      await tx.employeeSkill.update({
        where: { id: activeRow.id },
        data: { deletedAt: new Date() },
      });
      await tx.skillHistory.create({
        data: {
          employeeId,
          skillId,
          previousLevel,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          newLevel: null as any,
          effectiveDate: new Date(),
          source: SourceLevel.MANAGER,
          note: 'Skill removed from employee portfolio',
          assessedById,
        },
      });
    });

    await this.eventBus.emit({
      id: randomUUID(),
      type: 'skill.removed',
      source: 'hr-core',
      timestamp: new Date(),
      payload: {
        employeeId,
        skillId,
        previousLevel,
        assessedById,
      },
      metadata: { userId: null, correlationId: randomUUID() },
    });
  }

  async findForEmployee(
    employeeId: string,
    query: { minLevel?: ProficiencyLevel },
  ): Promise<EmployeeSkill[]> {
    // const scope = buildScopeFilter(user, 'employee_skill', 'READ'); // TODO: re-enable when IAM module is implemented

    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, deletedAt: null },
      select: { id: true },
    });
    if (!employee) throw new NotFoundException(`Employee ${employeeId} not found`);

    const levelFilter =
      query.minLevel !== undefined
        ? this.levelsAtOrAbove(query.minLevel)
        : undefined;

    return this.prisma.employeeSkill.findMany({
      where: {
        employeeId,
        deletedAt: null,
        ...(levelFilter ? { proficiency: { in: levelFilter } } : {}),
      },
      include: {
        skill: {
          select: { id: true, name: true, category: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByEmployeesForSkill(
    skillId: string,
    query: EmployeeSkillQueryDto,
  ): Promise<PaginatedResult<EmployeeSkillWithEmployee>> {
    // const scope = buildScopeFilter(user, 'employee_skill', 'READ'); // TODO: re-enable when IAM module is implemented

    const skill = await this.prisma.skill.findUnique({ where: { id: skillId }, select: { id: true } });
    if (!skill) throw new NotFoundException(`Skill ${skillId} not found`);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const levelFilter = query.minLevel ? this.levelsAtOrAbove(query.minLevel) : undefined;

    const where = {
      skillId,
      deletedAt: null,
      ...(levelFilter ? { proficiency: { in: levelFilter } } : {}),
      employee: {
        deletedAt: null,
        ...(query.departmentId ? { departmentId: query.departmentId } : {}),
        ...(query.teamId ? { teamId: query.teamId } : {}),
      },
    };

    const [data, total] = await Promise.all([
      this.prisma.employeeSkill.findMany({
        where,
        include: {
          employee: { select: { id: true, firstName: true, lastName: true, departmentId: true, teamId: true } },
          skill: { select: { id: true, name: true, category: true } },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.employeeSkill.count({ where }),
    ]);

    return { data: data as EmployeeSkillWithEmployee[], total, page, limit };
  }

  private levelsAtOrAbove(floor: ProficiencyLevel): ProficiencyLevel[] {
    const floorRank = PROFICIENCY_RANK[floor] ?? 0;
    return (Object.keys(PROFICIENCY_RANK) as ProficiencyLevel[]).filter(
      (level) => (PROFICIENCY_RANK[level] ?? 0) >= floorRank,
    );
  }
}
