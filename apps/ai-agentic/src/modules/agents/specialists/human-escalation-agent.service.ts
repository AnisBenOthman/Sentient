import { Injectable } from '@nestjs/common';
import { AgentRunStatus, AgentType, PermissionDecision } from '../../../generated/prisma';
import { HumanEscalationResult, SpecialistInput, SpecialistResult } from '../../../common/graph';
import { HumanEscalationRecorderService } from '../human-escalation-recorder.service';

@Injectable()
export class HumanEscalationAgentService {
  readonly agentType = AgentType.HUMAN_ESCALATION_AGENT;

  constructor(private readonly recorder: HumanEscalationRecorderService) {}

  async record(input: SpecialistInput, reason: string, immediateSafetyRisk = false): Promise<SpecialistResult & { escalation: HumanEscalationResult }> {
    const escalation = await this.recorder.record({
      conversationId: input.conversationId,
      taskLogId: input.parentTaskLogId,
      actor: input.actorContext,
      reason,
      userMessage: input.userMessage,
      immediateSafetyRisk,
    });

    return {
      escalation,
      agentType: this.agentType,
      status: AgentRunStatus.ESCALATED,
      summary: 'Human support handoff recorded.',
      userVisibleContent: escalation.nextStep,
      sourceContext: [{ sourceType: 'HUMAN_ESCALATION', title: escalation.targetLabel, referenceId: null }],
      permissionDecision: PermissionDecision.ALLOWED,
      recommendedNextStep: escalation.nextStep,
    };
  }
}
