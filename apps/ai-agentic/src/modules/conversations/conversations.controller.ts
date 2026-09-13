import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '@sentient/shared';
import { Request } from 'express';
import { ActorContextFactory, AI_USER_ROLES } from '../../common/graph';
import { ConversationTurnResponse } from './conversation-response.mapper';
import { ConversationsService } from './conversations.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { ListConversationsQueryDto } from './dto/list-conversations-query.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';

@ApiTags('AI Conversations')
@ApiBearerAuth()
@Controller('conversations')
export class ConversationsController {
  constructor(
    private readonly conversations: ConversationsService,
    private readonly actorFactory: ActorContextFactory,
  ) {}

  @Get()
  @Roles(...AI_USER_ROLES)
  @ApiOperation({ summary: 'List current user AI conversations' })
  @ApiOkResponse({ description: 'Paginated conversation summaries' })
  list(@Req() request: Request, @Query() query: ListConversationsQueryDto) {
    return this.conversations.list(this.actorFactory.fromRequest(request), query);
  }

  @Post()
  @Roles(...AI_USER_ROLES)
  @ApiOperation({ summary: 'Start a new supervisor-agent conversation' })
  @ApiCreatedResponse({ description: 'Conversation turn response with routing trace' })
  create(
    @Req() request: Request,
    @Body() dto: CreateConversationDto,
  ): Promise<ConversationTurnResponse> {
    return this.conversations.createConversation(this.actorFactory.fromRequest(request), dto);
  }

  @Post(':conversationId/messages')
  @Roles(...AI_USER_ROLES)
  @ApiOperation({ summary: 'Send a message to an existing AI conversation' })
  @ApiOkResponse({ description: 'Conversation turn response with routing trace' })
  sendMessage(
    @Req() request: Request,
    @Param('conversationId') conversationId: string,
    @Body() dto: CreateMessageDto,
  ): Promise<ConversationTurnResponse> {
    return this.conversations.sendMessage(conversationId, this.actorFactory.fromRequest(request), dto);
  }

  @Get(':conversationId')
  @Roles(...AI_USER_ROLES)
  @ApiOperation({ summary: 'Get a conversation with messages' })
  @ApiOkResponse({ description: 'Conversation detail' })
  detail(@Req() request: Request, @Param('conversationId') conversationId: string) {
    return this.conversations.detail(conversationId, this.actorFactory.fromRequest(request));
  }

  @Patch(':conversationId')
  @Roles(...AI_USER_ROLES)
  @ApiOperation({ summary: 'Archive or restore a conversation' })
  @ApiOkResponse({ description: 'Updated conversation summary' })
  update(
    @Req() request: Request,
    @Param('conversationId') conversationId: string,
    @Body() dto: UpdateConversationDto,
  ) {
    return this.conversations.update(conversationId, this.actorFactory.fromRequest(request), dto);
  }

  @Delete(':conversationId')
  @Roles(...AI_USER_ROLES)
  @HttpCode(204)
  @ApiOperation({ summary: 'Remove a conversation from current user active view' })
  @ApiNoContentResponse({ description: 'Conversation removed from active list' })
  async delete(@Req() request: Request, @Param('conversationId') conversationId: string): Promise<void> {
    await this.conversations.delete(conversationId, this.actorFactory.fromRequest(request));
  }
}
