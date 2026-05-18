import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import { OkrCycleType } from '@sentient/shared';

export class CreateOkrCycleDto {
  @ApiProperty({ example: 'Q1 2026', maxLength: 64 })
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  name!: string;

  @ApiProperty({ enum: OkrCycleType })
  @IsEnum(OkrCycleType)
  type!: OkrCycleType;

  @ApiProperty({ example: 2026 })
  @IsInt()
  year!: number;

  @ApiPropertyOptional({ example: 1, description: 'Required when type=QUARTERLY; 1–4' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(4)
  quarter?: number;

  @ApiProperty({ example: '2026-01-01' })
  @IsDateString()
  startDate!: string;

  @ApiProperty({ example: '2026-03-31' })
  @IsDateString()
  endDate!: string;

  @ApiPropertyOptional({ description: 'UUID of the parent ANNUAL cycle (QUARTERLY only)' })
  @IsOptional()
  @IsUUID()
  parentCycleId?: string;
}
