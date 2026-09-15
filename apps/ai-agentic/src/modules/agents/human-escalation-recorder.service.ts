import { Injectable } from '@nestjs/common';
import {
  HumanEscalation,
  HumanEscalationTargetType,
} from '../../generated/prisma';
import { AiActorContext, HumanEscalationResult } from '../../common/graph';
import { PrismaService } from '../../prisma/prisma.service';

export interface RecordHumanEscalationInput {
  conversationId: string;
  taskLogId: string;
  actor: AiActorContext;
  reason: string;
  userMessage: string;
  immediateSafetyRisk?: boolean;
}

@Injectable()
export class HumanEscalationRecorderService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: RecordHumanEscalationInput): Promise<HumanEscalationResult> {
    const targetType = this.selectTarget(input);
    const targetLabel = this.targetLabel(targetType);
    const summaryForHuman = this.neutralSummary(input.userMessage);

    await this.prisma.humanEscalation.create({
      data: {
        conversationId: input.conversationId,
        taskLogId: input.taskLogId,
        requestedByUserId: input.actor.userId,
        targetType,
        targetLabel,
        reason: input.reason,
        summaryForHuman,
      },
    });

    return {
      targetType,
      targetLabel,
      reason: input.reason,
      summaryForHuman,
      nextStep: `Please contact ${targetLabel} for support. I can help you prepare a neutral summary of the facts before that conversation.`,
    };
  }

  private selectTarget(input: RecordHumanEscalationInput): HumanEscalationTargetType {
    if (input.immediateSafetyRisk) return HumanEscalationTargetType.EMERGENCY_PROCESS;
    if (input.actor.roles.includes('MANAGER') || input.actor.roles.includes('HR_ADMIN')) {
      return HumanEscalationTargetType.PEOPLE_TEAM;
    }
    return HumanEscalationTargetType.MANAGER;
  }

  private targetLabel(targetType: HumanEscalationTargetType): string {
    if (targetType === HumanEscalationTargetType.EMERGENCY_PROCESS) return 'the company emergency process or urgent local help';
    if (targetType === HumanEscalationTargetType.PEOPLE_TEAM) return 'the People team';
    if (targetType === HumanEscalationTargetType.HR_BUSINESS_PARTNER) return 'your HR business partner';
    if (targetType === HumanEscalationTargetType.MANAGER) return 'your manager';
    return 'the appropriate human support channel';
  }

  private neutralSummary(message: string): string {
    const normalized = message.trim().replace(/\s+/g, ' ');
    return normalized.length > 500 ? `${normalized.slice(0, 497)}...` : normalized;
  }
}
