import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { ProficiencyLevel } from '@sentient/shared';

export class EmployeeSkillQueryDto {
  @ApiPropertyOptional({ enum: ProficiencyLevel, description: 'Filter employees at or above this proficiency level' })
  @IsOptional()
  @IsEnum(ProficiencyLevel)
  minLevel?: ProficiencyLevel;

  @ApiPropertyOptional({ format: 'uuid', description: 'Restrict results to a specific department' })
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Restrict results to a specific team' })
  @IsOptional()
  @IsUUID()
  teamId?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
