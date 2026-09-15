import { Injectable } from '@nestjs/common';
import {
  AgentHandoff,
  AgentRunStatus,
  AgentType,
  PermissionDecision,
} from '../../generated/prisma';
import { PrismaService } from '../../prisma/prisma.service';

export interface CreateHandoffInput {
  conversationId: string;
  parentTaskLogId: string;
  fromAgentType: AgentType;
  toAgentType: AgentType;
  reason: string;
  requestedIntent: string;
  permissionDecision?: PermissionDecision;
}

@Injectable()
export class AgentHandoffService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateHandoffInput): Promise<AgentHandoff> {
    return this.prisma.agentHandoff.create({
      data: {
        conversationId: input.conversationId,
        parentTaskLogId: input.parentTaskLogId,
        fromAgentType: input.fromAgentType,
        toAgentType: input.toAgentType,
        reason: input.reason,
        requestedIntent: input.requestedIntent,
        permissionDecision: input.permissionDecision ?? PermissionDecision.ALLOWED,
        status: AgentRunStatus.RUNNING,
      },
    });
  }

  async complete(
    id: string,
    specialistTaskLogId: string | null,
    status: AgentRunStatus,
    summary: string,
  ): Promise<AgentHandoff> {
    return this.prisma.agentHandoff.update({
      where: { id },
      data: {
        specialistTaskLogId,
        status,
        summary,
        completedAt: new Date(),
      },
    });
  }
}
