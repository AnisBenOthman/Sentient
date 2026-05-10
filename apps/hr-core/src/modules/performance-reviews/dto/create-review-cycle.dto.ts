import { ApiProperty } from '@nestjs/swagger';
import { ReviewType } from '@sentient/shared';
import { IsDateString, IsEnum, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateReviewCycleDto {
  @ApiProperty({ example: '2026 Annual Review' })
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  name!: string;

  @ApiProperty({ enum: ReviewType })
  @IsEnum(ReviewType)
  reviewType!: ReviewType;

  @ApiProperty({ format: 'date' })
  @IsDateString()
  periodStart!: string;

  @ApiProperty({ format: 'date' })
  @IsDateString()
  periodEnd!: string;

  @ApiProperty({ format: 'date-time' })
  @IsDateString()
  selfReviewOpensAt!: string;

  @ApiProperty({ format: 'date-time' })
  @IsDateString()
  selfReviewClosesAt!: string;

  @ApiProperty({ format: 'date-time' })
  @IsDateString()
  managerReviewDueAt!: string;
}
