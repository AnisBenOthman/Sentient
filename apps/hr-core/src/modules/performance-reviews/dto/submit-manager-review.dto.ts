import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PerformanceRating } from '@sentient/shared';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class SubmitManagerReviewDto {
  @ApiProperty({ enum: PerformanceRating })
  @IsEnum(PerformanceRating)
  managerRating!: PerformanceRating;

  @ApiPropertyOptional({ maxLength: 4000 })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  managerComments?: string;
}
