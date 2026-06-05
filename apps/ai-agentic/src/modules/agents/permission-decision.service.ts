import { Injectable } from '@nestjs/common';
import {
  AgentType,
  PermissionDecision,
  PermissionDecisionRecord,
} from '../../generated/prisma';
import { PrismaService } from '../../prisma/prisma.service';

export interface RecordPermissionDecisionInput {
  conversationId?: string | null;
  taskLogId: string;
  agentType: AgentType;
  decision: PermissionDecision;
  resourceType: string;
  resourceId?: string | null;
  reason: string;
}

@Injectable()
export class PermissionDecisionService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: RecordPermissionDecisionInput): Promise<PermissionDecisionRecord> {
    return this.prisma.permissionDecisionRecord.create({
      data: {
        conversationId: input.conversationId ?? null,
        taskLogId: input.taskLogId,
        agentType: input.agentType,
        decision: input.decision,
        resourceType: input.resourceType,
        resourceId: input.resourceId ?? null,
        reason: input.reason,
      },
    });
  }

  mapDownstreamStatus(status: number | null): PermissionDecision {
    if (status === 403) return PermissionDecision.DENIED;
    if (status === 404) return PermissionDecision.UNAVAILABLE;
    if (status !== null && status >= 500) return PermissionDecision.UNAVAILABLE;
    return PermissionDecision.ALLOWED;
  }
}
