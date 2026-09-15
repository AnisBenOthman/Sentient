import { Module } from '@nestjs/common';
import { AgentsModule } from '../../modules/agents/agents.module';
import { ConversationsModule } from '../../modules/conversations/conversations.module';
import { ChannelConversationLinkService } from '../channel-conversation-link.service';
import { SlackController } from './slack.controller';
import { SlackService } from './slack.service';

/**
 * WHY both imports, mirroring TelegramModule: ConversationsService comes from
 * ConversationsModule; ActorContextFactory and ActionProposalService come
 * from AgentsModule, which ConversationsModule imports but does not
 * re-export. Neither references the channels layer, so there is no cycle.
 * HrCoreClient arrives via the global ClientsModule; PrismaService via the
 * global PrismaModule. ChannelConversationLinkService is provided here
 * (not exported by either module) — same as TelegramModule — since both
 * channels share the one table, keyed by channel + externalId.
 */
@Module({
  imports: [ConversationsModule, AgentsModule],
  controllers: [SlackController],
  providers: [SlackService, ChannelConversationLinkService],
})
export class SlackModule {}
