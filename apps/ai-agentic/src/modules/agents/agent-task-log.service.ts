import { Injectable } from '@nestjs/common';
import {
  AgentNodeType,
  AgentRunStatus,
  AgentTaskLog,
  AgentType,
  PermissionDecision,
  TaskTrigger,
} from '../../generated/prisma';
import { PrismaService } from '../../prisma/prisma.service';
import { AiActorContext } from '../../common/graph';
import { redactSensitiveText } from '../../common/safety';

export interface StartTaskLogInput {
  conversationId?: string | null;
  parentLogId?: string | null;
  agentType: AgentType;
  nodeType: AgentNodeType;
  taskType: string;
  trigger?: TaskTrigger;
  actor?: AiActorContext | null;
  sourceCategories?: string[];
  inputSummary?: string | null;
}

export interface FinishTaskLogInput {
  status: AgentRunStatus;
  outputSummary?: string | null;
  permissionDecision?: PermissionDecision | null;
  sourceCategories?: string[];
  errorCode?: string | null;
  errorMessage?: string | null;
  /** LLM token usage attributed to this task (governance cost telemetry). */
  tokensIn?: number | null;
  tokensOut?: number | null;
}

@Injectable()
export class AgentTaskLogService {
  constructor(private readonly prisma: PrismaService) {}

  async start(input: StartTaskLogInput): Promise<AgentTaskLog> {
    return this.prisma.agentTaskLog.create({
      data: {
        conversationId: input.conversationId ?? null,
        parentLogId: input.parentLogId ?? null,
        agentType: input.agentType,
        nodeType: input.nodeType,
        taskType: input.taskType,
        trigger: input.trigger ?? TaskTrigger.USER_MESSAGE,
        actorUserId: input.actor?.userId ?? null,
        actorEmployeeId: input.actor?.employeeId ?? null,
        status: AgentRunStatus.RUNNING,
        sourceCategories: input.sourceCategories ?? [],
        // WHY: FR-023 — governance reviewers see these summaries; emails and
        // long identifiers are masked while keeping the audit text readable.
        inputSummary: input.inputSummary ? redactSensitiveText(input.inputSummary) : null,
        correlationId: input.actor?.correlationId ?? 'system',
      },
    });
  }

  async finish(id: string, input: FinishTaskLogInput): Promise<AgentTaskLog> {
    return this.prisma.agentTaskLog.update({
      where: { id },
      data: {
        status: input.status,
        outputSummary: input.outputSummary ? redactSensitiveText(input.outputSummary) : null,
        permissionDecision: input.permissionDecision ?? null,
        ...(input.sourceCategories ? { sourceCategories: input.sourceCategories } : {}),
        errorCode: input.errorCode ?? null,
        errorMessage: input.errorMessage ?? null,
        tokensIn: input.tokensIn ?? null,
        tokensOut: input.tokensOut ?? null,
        finishedAt: new Date(),
      },
    });
  }
}
