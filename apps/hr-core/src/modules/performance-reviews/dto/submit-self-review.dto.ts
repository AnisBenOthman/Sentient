import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PerformanceRating, SatisfactionLevel } from '@sentient/shared';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class SubmitSelfReviewDto {
  @ApiProperty({ enum: SatisfactionLevel })
  @IsEnum(SatisfactionLevel)
  environmentSatisfaction!: SatisfactionLevel;

  @ApiProperty({ enum: SatisfactionLevel })
  @IsEnum(SatisfactionLevel)
  jobSatisfaction!: SatisfactionLevel;

  @ApiProperty({ enum: SatisfactionLevel })
  @IsEnum(SatisfactionLevel)
  relationshipSatisfaction!: SatisfactionLevel;

  @ApiProperty({ minimum: 0, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  trainingOpportunitiesTaken!: number;

  @ApiProperty({ enum: SatisfactionLevel })
  @IsEnum(SatisfactionLevel)
  workLifeBalance!: SatisfactionLevel;

  @ApiProperty({ enum: PerformanceRating })
  @IsEnum(PerformanceRating)
  selfRating!: PerformanceRating;

  @ApiPropertyOptional({ maxLength: 4000 })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  employeeComments?: string;
}
