import { Module } from '@nestjs/common';
import { AgentsModule } from '../agents';
import { ConversationsController } from './conversations.controller';
import { ConversationContextService } from './conversation-context.service';
import { ConversationSummarizerService } from './conversation-summarizer.service';
import { ConversationTitleService } from './conversation-title.service';
import { ConversationsService } from './conversations.service';

@Module({
  imports: [AgentsModule],
  controllers: [ConversationsController],
  providers: [ConversationContextService, ConversationsService, ConversationSummarizerService, ConversationTitleService],
  exports: [ConversationContextService, ConversationsService, ConversationSummarizerService, ConversationTitleService],
})
export class ConversationsModule {}
