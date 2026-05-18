import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayUnique,
  IsArray,
  IsDateString,
  IsDecimal,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

import { KeyResultMetricType } from '@sentient/shared';

export class CreateKeyResultDto {
  @ApiProperty({ description: 'UUID of the parent Objective' })
  @IsUUID()
  objectiveId!: string;

  @ApiProperty({ maxLength: 200 })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @ApiProperty({ enum: KeyResultMetricType })
  @IsEnum(KeyResultMetricType)
  metricType!: KeyResultMetricType;

  @ApiProperty({ description: 'Target value as decimal string (precision: 4 decimal digits)', example: '100.0000' })
  @IsDecimal({ decimal_digits: '0,4' })
  targetValue!: string;

  @ApiProperty({ description: 'Unit label (e.g. "%", "hires", "DZD")', maxLength: 32 })
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  unit!: string;

  @ApiPropertyOptional({ type: [String], description: 'Employee UUIDs assigned to this KR' })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  assigneeIds?: string[];

  @ApiPropertyOptional({ example: '2026-03-31' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
