import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ProficiencyLevel, SkillRequirementLevel } from '@sentient/shared';

export class UpsertPositionSkillDto {
  @ApiProperty({ description: 'UUID of the skill to require', format: 'uuid' })
  @IsUUID()
  skillId!: string;

  @ApiProperty({ enum: ProficiencyLevel, description: 'Minimum proficiency level the position requires' })
  @IsEnum(ProficiencyLevel)
  minimumProficiency!: ProficiencyLevel;

  @ApiPropertyOptional({
    enum: SkillRequirementLevel,
    description: 'MANDATORY = hard bar; EXPECTED = development plan target; NICE_TO_HAVE = bonus signal',
    default: SkillRequirementLevel.MANDATORY,
  })
  @IsOptional()
  @IsEnum(SkillRequirementLevel)
  requirementLevel?: SkillRequirementLevel;
}
