import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { OkrCheckInStatus } from '@sentient/shared';

export class OkrCheckInResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  keyResultId!: string;

  @ApiProperty()
  employeeId!: string;

  @ApiProperty({ description: 'Reported value as decimal string' })
  value!: string;

  @ApiProperty({ description: 'Computed score at time of submission as decimal string' })
  score!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  comment!: string | null;

  @ApiProperty({ enum: OkrCheckInStatus })
  status!: OkrCheckInStatus;

  @ApiPropertyOptional({ type: String, nullable: true })
  reviewedById!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  reviewedAt!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  rejectionReason!: string | null;

  @ApiProperty()
  createdAt!: string;
}
