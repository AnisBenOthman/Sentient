import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

import { ObjectiveLevel } from '@sentient/shared';

export class CreateObjectiveDto {
  @ApiProperty({ example: 'Grow ARR to 5M DZD', maxLength: 200 })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ enum: ObjectiveLevel })
  @IsEnum(ObjectiveLevel)
  level!: ObjectiveLevel;

  @ApiProperty({ description: 'UUID of the OKR cycle' })
  @IsUUID()
  cycleId!: string;

  @ApiPropertyOptional({ description: 'Required for DEPARTMENT and EMPLOYEE levels' })
  @IsOptional()
  @IsUUID()
  parentObjectiveId?: string;

  @ApiPropertyOptional({ description: 'User.id of the owner; required for EMPLOYEE level' })
  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @ApiPropertyOptional({ description: 'Department UUID; required for DEPARTMENT level' })
  @IsOptional()
  @IsUUID()
  departmentId?: string;
}
