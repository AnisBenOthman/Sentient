import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { OkrCycleStatus, OkrCycleType } from '@sentient/shared';

export class OkrCycleResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ enum: OkrCycleType })
  type!: OkrCycleType;

  @ApiProperty()
  year!: number;

  @ApiPropertyOptional({ type: Number, nullable: true })
  quarter!: number | null;

  @ApiProperty({ enum: OkrCycleStatus })
  status!: OkrCycleStatus;

  @ApiProperty({ description: 'ISO date (YYYY-MM-DD)' })
  startDate!: string;

  @ApiProperty({ description: 'ISO date (YYYY-MM-DD)' })
  endDate!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  parentCycleId!: string | null;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}
