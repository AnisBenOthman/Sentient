import { Module } from '@nestjs/common';
import { AgentsModule } from '../agents';
import { ConversationsController } from './conversations.controller';
import { ConversationContextService } from './conversation-context.service';
import { ConversationTitleService } from './conversation-title.service';
import { ConversationsService } from './conversations.service';

@Module({
  imports: [AgentsModule],
  controllers: [ConversationsController],
  providers: [ConversationContextService, ConversationsService, ConversationTitleService],
  exports: [ConversationContextService, ConversationsService, ConversationTitleService],
})
export class ConversationsModule {}
