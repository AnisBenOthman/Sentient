import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { ConversationStatus } from '../../../generated/prisma';

export class UpdateConversationDto {
  @ApiProperty({ enum: [ConversationStatus.ACTIVE, ConversationStatus.ARCHIVED] })
  @IsEnum(ConversationStatus)
  status!: ConversationStatus;
}
