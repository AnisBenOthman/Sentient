import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { NotificationCategory, NotificationStatus } from '@sentient/shared';

export class NotificationQueryDto {
  @IsOptional()
  @IsEnum(NotificationStatus)
  status?: NotificationStatus;

  @IsOptional()
  @IsEnum(NotificationCategory)
  category?: NotificationCategory;

  @IsOptional()
  @IsString()
  referenceType?: string;

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 50;
}
