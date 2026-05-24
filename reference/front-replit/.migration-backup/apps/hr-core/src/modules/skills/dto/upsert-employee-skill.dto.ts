import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ProficiencyLevel, SourceLevel } from '@sentient/shared';

export class UpsertEmployeeSkillDto {
  @ApiProperty({ description: 'UUID of the skill to assign', format: 'uuid' })
  @IsUUID()
  skillId!: string;

  @ApiProperty({ enum: ProficiencyLevel, description: 'Proficiency level' })
  @IsEnum(ProficiencyLevel)
  proficiency!: ProficiencyLevel;

  @ApiProperty({ enum: SourceLevel, description: 'Origin of the assessment' })
  @IsEnum(SourceLevel)
  source!: SourceLevel;

  @ApiPropertyOptional({ description: 'Free-text justification (max 1000 chars)', maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  @ApiPropertyOptional({ description: 'When the employee first acquired the skill (ISO date)', format: 'date' })
  @IsOptional()
  @IsDateString()
  acquiredDate?: string;

  @ApiPropertyOptional({ description: 'Effective date of this assessment (defaults to now; may be backdated)', format: 'date' })
  @IsOptional()
  @IsDateString()
  effectiveDate?: string;
}
