import { ApiProperty } from '@nestjs/swagger';
import {
  NotificationCategory,
  NotificationEventType,
  NotificationStatus,
} from '@sentient/shared';

export class NotificationResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() recipientUserId!: string;
  @ApiProperty({ enum: NotificationCategory }) category!: NotificationCategory;
  @ApiProperty({ enum: NotificationEventType }) eventType!: NotificationEventType;
  @ApiProperty() title!: string;
  @ApiProperty() body!: string;
  @ApiProperty({ type: 'object', additionalProperties: true }) payload!: Record<string, unknown>;
  @ApiProperty({ nullable: true }) referenceType!: string | null;
  @ApiProperty({ nullable: true }) referenceId!: string | null;
  @ApiProperty({ enum: NotificationStatus }) status!: NotificationStatus;
  @ApiProperty() createdAt!: string;
  @ApiProperty({ nullable: true }) readAt!: string | null;
}
