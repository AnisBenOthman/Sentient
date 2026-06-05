import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { FeedbackRating } from '../../../generated/prisma';

export class FeedbackDto {
  @ApiProperty({ enum: FeedbackRating })
  @IsEnum(FeedbackRating)
  rating!: FeedbackRating;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}

export interface FeedbackResponse {
  id: string;
  messageId: string;
  rating: FeedbackRating;
  comment: string | null;
  createdAt: string;
}
