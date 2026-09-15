import { Injectable } from '@nestjs/common';
import { ChannelType } from '../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Which AI conversation a chat channel thread currently continues.
 *
 * WHY a table and not a Map: an in-memory map silently resets the thread on
 * every deploy and every dev hot-reload, turning "/new" into an accident the
 * user never asked for. WHY not columns on Conversation: that model has stayed
 * channel-agnostic on purpose, and a one-row link makes "/new" a delete rather
 * than a clear-then-insert dance around a unique index. onDelete: Cascade means
 * deleting the conversation in the web app drops the pointer for free.
 */
@Injectable()
export class ChannelConversationLinkService {
  constructor(private readonly prisma: PrismaService) {}

  async find(channel: ChannelType, externalId: string): Promise<string | null> {
    const link = await this.prisma.channelConversationLink.findUnique({
      where: { channel_externalId: { channel, externalId } },
      select: { conversationId: true },
    });
    return link?.conversationId ?? null;
  }

  async set(channel: ChannelType, externalId: string, conversationId: string): Promise<void> {
    await this.prisma.channelConversationLink.upsert({
      where: { channel_externalId: { channel, externalId } },
      create: { channel, externalId, conversationId },
      update: { conversationId },
    });
  }

  async clear(channel: ChannelType, externalId: string): Promise<void> {
    await this.prisma.channelConversationLink.deleteMany({ where: { channel, externalId } });
  }
}
