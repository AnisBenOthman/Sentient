import { IsEnum, IsOptional } from 'class-validator';
import { ConversationStatus } from '../../../generated/prisma';
import { PaginationQueryDto } from '../../../common/dto';

export class ListConversationsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(ConversationStatus)
  status?: ConversationStatus;
}
