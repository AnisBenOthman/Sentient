import { Module } from '@nestjs/common';
import { AgentsModule } from '../../modules/agents/agents.module';
import { ConversationsModule } from '../../modules/conversations/conversations.module';
import { ChannelConversationLinkService } from '../channel-conversation-link.service';
import { TelegramService } from './telegram.service';

/**
 * WHY both imports: ConversationsService comes from ConversationsModule;
 * ActorContextFactory and ActionProposalService come from AgentsModule, which
 * ConversationsModule imports but does not re-export. Neither references the
 * channels layer, so there is no cycle. HrCoreClient arrives via the global
 * ClientsModule; PrismaService via the global PrismaModule.
 */
@Module({
  imports: [ConversationsModule, AgentsModule],
  providers: [TelegramService, ChannelConversationLinkService],
})
export class TelegramModule {}
