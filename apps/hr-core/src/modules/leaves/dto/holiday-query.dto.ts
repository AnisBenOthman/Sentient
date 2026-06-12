import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Min } from 'class-validator';

/**
 * WHY: This was a plain interface, so the global ValidationPipe skipped it and
 * `year` reached Prisma as the raw query string ("2026"), failing the Int column
 * validation with a 500. A class with @Type coercion makes the filter usable by
 * the frontend and the AI Agentic holidays lookup.
 */
export class HolidayQueryDto {
  @ApiPropertyOptional({ description: 'Filter holidays by business unit' })
  @IsOptional()
  @IsUUID()
  businessUnitId?: string;

  @ApiPropertyOptional({ description: 'Calendar year; recurring holidays are always included' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1970)
  year?: number;
}
