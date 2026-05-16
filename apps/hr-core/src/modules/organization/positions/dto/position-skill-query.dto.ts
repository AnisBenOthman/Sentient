import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { ProficiencyLevel, SkillDomain, SkillRequirementLevel } from '@sentient/shared';

export class PositionSkillQueryDto {
  @ApiPropertyOptional({ enum: ProficiencyLevel, description: 'Return skills whose minimum proficiency is at or above this level' })
  @IsOptional()
  @IsEnum(ProficiencyLevel)
  minProficiency?: ProficiencyLevel;

  @ApiPropertyOptional({ enum: SkillRequirementLevel, description: 'Filter by requirement tier (MANDATORY / EXPECTED / NICE_TO_HAVE)' })
  @IsOptional()
  @IsEnum(SkillRequirementLevel)
  requirementLevel?: SkillRequirementLevel;

  @ApiPropertyOptional({ enum: SkillDomain, description: 'Filter by skill domain' })
  @IsOptional()
  @IsEnum(SkillDomain)
  domain?: SkillDomain;
}
