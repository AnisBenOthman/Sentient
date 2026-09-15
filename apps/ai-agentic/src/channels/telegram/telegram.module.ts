import { Module } from '@nestjs/common';
import { AgentsModule } from '../../modules/agents/agents.module';
import { ConversationsModule } from '../../modules/conversations/conversations.module';
import { ChannelConversationLinkService } from '../channel-conversation-link.service';
import { TelegramController } from './telegram.controller';
import { TelegramService } from './telegram.service';

/**
 * WHY both imports: ConversationsService comes from ConversationsModule;
 * ActorContextFactory and ActionProposalService come from AgentsModule, which
 * ConversationsModule imports but does not re-export. Neither references the
 * channels layer, so there is no cycle. HrCoreClient arrives via the global
 * ClientsModule; PrismaService via the global PrismaModule.
 *
 * TelegramController serves the SYSTEM-only notify relay (HR Core pushes a DM
 * after a leave decision) and, in webhook mode, the inbound update endpoint.
 */
@Module({
  imports: [ConversationsModule, AgentsModule],
  controllers: [TelegramController],
  providers: [TelegramService, ChannelConversationLinkService],
})
export class TelegramModule {}
