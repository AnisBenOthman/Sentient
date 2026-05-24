import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { KeyResultMetricType, KeyResultStatus } from '@sentient/shared';

export class KeyResultResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  objectiveId!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty({ enum: KeyResultMetricType })
  metricType!: KeyResultMetricType;

  @ApiProperty({ description: 'Target value as decimal string' })
  targetValue!: string;

  @ApiProperty({ description: 'Current value as decimal string' })
  currentValue!: string;

  @ApiProperty({ description: 'Unit label (e.g. "%", "hires", "DZD")' })
  unit!: string;

  @ApiProperty({ description: 'Score in [0.0000, 1.0000] as decimal string' })
  score!: string;

  @ApiProperty({ type: [String], description: 'Assigned employee UUIDs' })
  assigneeIds!: string[];

  @ApiPropertyOptional({ type: String, nullable: true })
  dueDate!: string | null;

  @ApiProperty({ enum: KeyResultStatus })
  status!: KeyResultStatus;

  @ApiProperty({ description: 'Computed: score < 0.3 AND status not ACHIEVED/CANCELLED AND has approved check-in' })
  isAtRisk!: boolean;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}
