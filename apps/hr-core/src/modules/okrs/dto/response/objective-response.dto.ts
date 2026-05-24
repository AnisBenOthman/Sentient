import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { ObjectiveLevel, ObjectiveStatus } from '@sentient/shared';

export class ObjectiveResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  description!: string | null;

  @ApiProperty({ enum: ObjectiveLevel })
  level!: ObjectiveLevel;

  @ApiProperty()
  cycleId!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  parentObjectiveId!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  ownerId!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  departmentId!: string | null;

  @ApiProperty({ enum: ObjectiveStatus })
  status!: ObjectiveStatus;

  @ApiProperty()
  createdById!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  closedAt!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  cancelledAt!: string | null;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}
