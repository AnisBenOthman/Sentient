import { IsEnum, IsOptional } from 'class-validator';
import { NotificationCategory } from '@sentient/shared';

export class MarkAllReadDto {
  @IsOptional()
  @IsEnum(NotificationCategory)
  category?: NotificationCategory;
}
