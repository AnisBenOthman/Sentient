import { Injectable } from '@nestjs/common';
import { AgentNodeRun, AgentNodeType, AgentRunStatus, AgentType, Prisma } from '../../generated/prisma';
import { PrismaService } from '../../prisma/prisma.service';

export interface RecordNodeRunInput {
  conversationId: string;
  taskLogId: string;
  nodeType: AgentNodeType;
  agentType: AgentType;
  status: AgentRunStatus;
  sequence: number;
  stateBefore?: Prisma.InputJsonValue;
  stateAfter?: Prisma.InputJsonValue;
}

@Injectable()
export class AgentNodeRunService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: RecordNodeRunInput): Promise<AgentNodeRun> {
    return this.prisma.agentNodeRun.create({
      data: {
        conversationId: input.conversationId,
        taskLogId: input.taskLogId,
        nodeType: input.nodeType,
        agentType: input.agentType,
        status: input.status,
        sequence: input.sequence,
        stateBefore: input.stateBefore,
        stateAfter: input.stateAfter,
      },
    });
  }
}
