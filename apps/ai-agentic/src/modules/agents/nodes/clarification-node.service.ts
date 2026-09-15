import { Injectable } from '@nestjs/common';
import { AgentNodeType, AgentRunStatus, AgentType } from '../../../generated/prisma';
import { AiActorContext } from '../../../common/graph';
import { PrismaService } from '../../../prisma/prisma.service';
import { AgentTaskLogService } from '../agent-task-log.service';

export interface ClarificationNodeResult {
  taskLogId: string;
  question: string;
  summary: string;
}

@Injectable()
export class ClarificationNodeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly taskLogs: AgentTaskLogService,
  ) {}

  async ask(input: {
    conversationId: string;
    parentLogId: string;
    actor: AiActorContext;
    reason: string;
  }): Promise<ClarificationNodeResult> {
    const taskLog = await this.taskLogs.start({
      conversationId: input.conversationId,
      parentLogId: input.parentLogId,
      agentType: AgentType.SUPERVISOR_AGENT,
      nodeType: AgentNodeType.CLARIFICATION,
      taskType: 'ask_user_for_clarification',
      actor: input.actor,
      inputSummary: input.reason,
    });
    const question = 'Could you share one more detail so I can route this safely: are you asking about leave, OKRs, career growth, analytics, onboarding, policy, or wording help?';
    await this.prisma.clarificationRequest.create({
      data: {
        conversationId: input.conversationId,
        taskLogId: taskLog.id,
        question,
        reason: input.reason,
      },
    });
    await this.taskLogs.finish(taskLog.id, {
      status: AgentRunStatus.SUCCESS,
      outputSummary: question,
    });
    return {
      taskLogId: taskLog.id,
      question,
      summary: 'Clarification requested.',
    };
  }
}
