import { Injectable, NotFoundException } from '@nestjs/common';
import { ProficiencyLevel, SkillDomain, SkillRequirementLevel } from '@sentient/shared';
import { PrismaService } from '../../../prisma/prisma.service';
import { BulkReplacePositionSkillsDto } from './dto/bulk-replace-position-skills.dto';
import { PositionSkillQueryDto } from './dto/position-skill-query.dto';
import { UpsertPositionSkillDto } from './dto/upsert-position-skill.dto';

export interface PositionSkillWithSkill {
  id: string;
  positionId: string;
  skillId: string;
  minimumProficiency: ProficiencyLevel;
  requirementLevel: SkillRequirementLevel;
  createdAt: Date;
  updatedAt: Date;
  skill: { id: string; name: string; domain: SkillDomain | null; category: string | null };
}

export const PROFICIENCY_RANK: Record<ProficiencyLevel, number> = {
  [ProficiencyLevel.BEGINNER]: 0,
  [ProficiencyLevel.INTERMEDIATE]: 1,
  [ProficiencyLevel.ADVANCED]: 2,
  [ProficiencyLevel.EXPERT]: 3,
};

const SKILL_SELECT = { id: true, name: true, domain: true, category: true } as const;

@Injectable()
export class PositionSkillsService {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(positionId: string, dto: UpsertPositionSkillDto): Promise<PositionSkillWithSkill> {
    const position = await this.prisma.position.findUnique({ where: { id: positionId }, select: { id: true } });
    if (!position) throw new NotFoundException(`Position ${positionId} not found`);

    const skill = await this.prisma.skill.findUnique({ where: { id: dto.skillId }, select: { id: true } });
    if (!skill) throw new NotFoundException(`Skill ${dto.skillId} not found`);

    const result = await this.prisma.positionSkill.upsert({
      where: { positionId_skillId: { positionId, skillId: dto.skillId } },
      create: {
        positionId,
        skillId: dto.skillId,
        minimumProficiency: dto.minimumProficiency,
        requirementLevel: dto.requirementLevel ?? SkillRequirementLevel.MANDATORY,
      },
      update: {
        minimumProficiency: dto.minimumProficiency,
        requirementLevel: dto.requirementLevel ?? SkillRequirementLevel.MANDATORY,
      },
      include: { skill: { select: SKILL_SELECT } },
    });

    return result as PositionSkillWithSkill;
  }

  async bulkReplace(positionId: string, dto: BulkReplacePositionSkillsDto): Promise<PositionSkillWithSkill[]> {
    const position = await this.prisma.position.findUnique({ where: { id: positionId }, select: { id: true } });
    if (!position) throw new NotFoundException(`Position ${positionId} not found`);

    if (dto.skills.length > 0) {
      const skillIds = [...new Set(dto.skills.map((s) => s.skillId))];
      const found = await this.prisma.skill.findMany({ where: { id: { in: skillIds } }, select: { id: true } });
      const foundIds = new Set(found.map((s) => s.id));
      const missing = skillIds.filter((id) => !foundIds.has(id));
      if (missing.length > 0) throw new NotFoundException(`Skills not found: ${missing.join(', ')}`);
    }

    const created = await this.prisma.$transaction(async (tx) => {
      await tx.positionSkill.deleteMany({ where: { positionId } });
      return Promise.all(
        dto.skills.map((s) =>
          tx.positionSkill.create({
            data: {
              positionId,
              skillId: s.skillId,
              minimumProficiency: s.minimumProficiency,
              requirementLevel: s.requirementLevel ?? SkillRequirementLevel.MANDATORY,
            },
            include: { skill: { select: SKILL_SELECT } },
          }),
        ),
      );
    });

    return created as PositionSkillWithSkill[];
  }

  async remove(positionId: string, skillId: string): Promise<void> {
    const existing = await this.prisma.positionSkill.findUnique({
      where: { positionId_skillId: { positionId, skillId } },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException(`Skill requirement not found for position ${positionId}`);

    await this.prisma.positionSkill.delete({ where: { id: existing.id } });
  }

  async findForPosition(positionId: string, query: PositionSkillQueryDto): Promise<PositionSkillWithSkill[]> {
    const position = await this.prisma.position.findUnique({ where: { id: positionId }, select: { id: true } });
    if (!position) throw new NotFoundException(`Position ${positionId} not found`);

    const levelFilter =
      query.minProficiency !== undefined ? this.levelsAtOrAbove(query.minProficiency) : undefined;

    const results = await this.prisma.positionSkill.findMany({
      where: {
        positionId,
        ...(levelFilter ? { minimumProficiency: { in: levelFilter } } : {}),
        ...(query.requirementLevel !== undefined ? { requirementLevel: query.requirementLevel } : {}),
      },
      include: { skill: { select: SKILL_SELECT } },
      orderBy: { createdAt: 'asc' },
    });

    return results as PositionSkillWithSkill[];
  }

  private levelsAtOrAbove(floor: ProficiencyLevel): ProficiencyLevel[] {
    const floorRank = PROFICIENCY_RANK[floor] ?? 0;
    return (Object.keys(PROFICIENCY_RANK) as ProficiencyLevel[]).filter(
      (level) => (PROFICIENCY_RANK[level] ?? 0) >= floorRank,
    );
  }
}
