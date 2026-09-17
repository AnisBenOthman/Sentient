import { Module } from '@nestjs/common';
import { AgentsModule } from '../agents';
import { ConversationsController } from './conversations.controller';
import { ConversationContextService } from './conversation-context.service';
import { ConversationStreamController } from './conversation-stream.controller';
import { ConversationStreamRunnerService } from './conversation-stream-runner.service';
import { ConversationSummarizerService } from './conversation-summarizer.service';
import { ConversationTitleService } from './conversation-title.service';
import { ConversationsService } from './conversations.service';
import { PendingTurnStore } from './pending-turn.store';
import { StreamEligibilityService } from './stream-eligibility.service';

@Module({
  imports: [AgentsModule],
  controllers: [ConversationsController, ConversationStreamController],
  providers: [
    ConversationContextService,
    ConversationStreamRunnerService,
    ConversationsService,
    ConversationSummarizerService,
    ConversationTitleService,
    PendingTurnStore,
    StreamEligibilityService,
  ],
  exports: [ConversationContextService, ConversationsService, ConversationSummarizerService, ConversationTitleService],
})
export class ConversationsModule {}
