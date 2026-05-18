import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

import { OkrCycleStatus, OkrCycleType } from '@sentient/shared';

export class OkrCycleQueryDto {
  @ApiPropertyOptional({ enum: OkrCycleType })
  @IsOptional()
  @IsEnum(OkrCycleType)
  type?: OkrCycleType;

  @ApiPropertyOptional({ example: 2026 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  year?: number;

  @ApiPropertyOptional({ enum: OkrCycleStatus })
  @IsOptional()
  @IsEnum(OkrCycleStatus)
  status?: OkrCycleStatus;

  @ApiPropertyOptional({ description: 'Filter children of a given annual cycle' })
  @IsOptional()
  @IsUUID()
  parentCycleId?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ description: 'Opaque cursor for pagination' })
  @IsOptional()
  @IsString()
  cursor?: string;
}
