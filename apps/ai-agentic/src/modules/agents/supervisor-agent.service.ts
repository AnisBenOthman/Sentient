import { Injectable } from '@nestjs/common';
import { AgentNodeType, AgentRunStatus, AgentType, PermissionDecision } from '../../generated/prisma';
import { AgentGuardrailService } from '../../common/safety';
import {
  AiActorContext,
  FinalAnswerResult,
  SpecialistAgent,
  SpecialistInput,
  SpecialistResult,
} from '../../common/graph';
import { RoutingTrace } from '../../common/dto';
import { AgentHandoffService } from './agent-handoff.service';
import { AgentNodeRunService } from './agent-node-run.service';
import { AgentTaskLogService } from './agent-task-log.service';
import { SupervisorIntentClassifierService } from './supervisor-intent-classifier.service';
import { ClarificationNodeService } from './nodes/clarification-node.service';
import { FinalAnswerNodeService } from './nodes/final-answer-node.service';
import { AnalyticsAgentService } from './specialists/analytics-agent.service';
import { CareerAgentService } from './specialists/career-agent.service';
import { GeneralHelpAgentService } from './specialists/general-help-agent.service';
import { HumanEscalationAgentService } from './specialists/human-escalation-agent.service';
import { LanguageAgentService } from './specialists/language-agent.service';
import { LeaveAgentService } from './specialists/leave-agent.service';
import { OkrAgentService } from './specialists/okr-agent.service';
import { OnboardingAgentService } from './specialists/onboarding-agent.service';

export interface ExecuteConversationTurnInput {
  conversationId: string;
  userMessageId: string;
  userMessage: string;
  actor: AiActorContext;
}

export interface ExecuteConversationTurnResult {
  finalAnswer: FinalAnswerResult;
  routing: RoutingTrace;
}

@Injectable()
export class SupervisorAgentService {
  private readonly specialists: Record<AgentType, SpecialistAgent | undefined>;

  constructor(
    private readonly guardrails: AgentGuardrailService,
    private readonly classifier: SupervisorIntentClassifierService,
    private readonly taskLogs: AgentTaskLogService,
    private readonly handoffs: AgentHandoffService,
    private readonly nodeRuns: AgentNodeRunService,
    private readonly clarificationNode: ClarificationNodeService,
    private readonly finalAnswerNode: FinalAnswerNodeService,
    private readonly leaveAgent: LeaveAgentService,
    private readonly okrAgent: OkrAgentService,
    private readonly careerAgent: CareerAgentService,
    private readonly analyticsAgent: AnalyticsAgentService,
    private readonly onboardingAgent: OnboardingAgentService,
    private readonly languageAgent: LanguageAgentService,
    private readonly generalHelpAgent: GeneralHelpAgentService,
    private readonly humanEscalationAgent: HumanEscalationAgentService,
  ) {
    this.specialists = {
      [AgentType.LEAVE_AGENT]: leaveAgent,
      [AgentType.OKR_AGENT]: okrAgent,
      [AgentType.CAREER_AGENT]: careerAgent,
      [AgentType.ANALYTICS_AGENT]: analyticsAgent,
      [AgentType.ONBOARDING_AGENT]: onboardingAgent,
      [AgentType.LANGUAGE_AGENT]: languageAgent,
      [AgentType.GENERAL_HELP_AGENT]: generalHelpAgent,
      [AgentType.HR_ASSISTANT]: undefined,
      [AgentType.SUPERVISOR_AGENT]: undefined,
      [AgentType.LINGUISTIC_AGENT]: undefined,
      [AgentType.ENGAGEMENT_AGENT]: undefined,
      [AgentType.ONBOARDING_COMPANION]: undefined,
      [AgentType.HUMAN_ESCALATION_AGENT]: undefined,
    };
  }

  async executeTurn(input: ExecuteConversationTurnInput): Promise<ExecuteConversationTurnResult> {
    const routingNodes: RoutingTrace['nodes'] = [];
    let sequence = 1;
    const parentLog = await this.taskLogs.start({
      conversationId: input.conversationId,
      agentType: AgentType.SUPERVISOR_AGENT,
      nodeType: AgentNodeType.SUPERVISOR,
      taskType: 'supervisor_turn',
      actor: input.actor,
      inputSummary: input.userMessage,
    });
    routingNodes.push({ nodeType: AgentNodeType.SUPERVISOR, agentType: AgentType.SUPERVISOR_AGENT, status: AgentRunStatus.RUNNING, summary: 'Intent classified.' });
    await this.nodeRuns.record({
      conversationId: input.conversationId,
      taskLogId: parentLog.id,
      nodeType: AgentNodeType.SUPERVISOR,
      agentType: AgentType.SUPERVISOR_AGENT,
      status: AgentRunStatus.RUNNING,
      sequence: sequence++,
      stateAfter: { userMessageId: input.userMessageId },
    });

    const safety = this.guardrails.evaluate(input.userMessage);
    const classification = this.classifier.classify(input.userMessage);
    const specialistResults: SpecialistResult[] = [];
    let clarificationQuestion: string | null = null;
    let escalation = null;

    if (safety.shouldEscalate) {
      const specialistInput = this.specialistInput(input, parentLog.id, classification.normalizedIntent, classification.isDraftIntent);
      const escalationResult = await this.humanEscalationAgent.record(
        specialistInput,
        safety.classification,
        safety.classification === 'IMMEDIATE_SAFETY_RISK',
      );
      specialistResults.push(escalationResult);
      escalation = escalationResult.escalation;
      routingNodes.push({ nodeType: AgentNodeType.HUMAN_ESCALATION, agentType: AgentType.HUMAN_ESCALATION_AGENT, status: AgentRunStatus.ESCALATED, summary: escalationResult.summary });
      await this.nodeRuns.record({
        conversationId: input.conversationId,
        taskLogId: parentLog.id,
        nodeType: AgentNodeType.HUMAN_ESCALATION,
        agentType: AgentType.HUMAN_ESCALATION_AGENT,
        status: AgentRunStatus.ESCALATED,
        sequence: sequence++,
      });
    } else if (safety.allowed) {
      if (classification.requiresClarification) {
        const clarification = await this.clarificationNode.ask({
          conversationId: input.conversationId,
          parentLogId: parentLog.id,
          actor: input.actor,
          reason: classification.clarificationReason ?? 'Ambiguous request.',
        });
        clarificationQuestion = clarification.question;
        routingNodes.push({ nodeType: AgentNodeType.CLARIFICATION, agentType: AgentType.SUPERVISOR_AGENT, status: AgentRunStatus.SUCCESS, summary: clarification.summary });
        await this.nodeRuns.record({
          conversationId: input.conversationId,
          taskLogId: clarification.taskLogId,
          nodeType: AgentNodeType.CLARIFICATION,
          agentType: AgentType.SUPERVISOR_AGENT,
          status: AgentRunStatus.SUCCESS,
          sequence: sequence++,
        });
      } else {
        for (const agentType of classification.requiredAgents) {
          const result = await this.executeSpecialist(input, parentLog.id, agentType, classification.normalizedIntent, classification.isDraftIntent);
          specialistResults.push(result);
          routingNodes.push({ nodeType: AgentNodeType.SPECIALIST, agentType, status: result.status, summary: result.summary });
          await this.nodeRuns.record({
            conversationId: input.conversationId,
            taskLogId: parentLog.id,
            nodeType: AgentNodeType.SPECIALIST,
            agentType,
            status: result.status,
            sequence: sequence++,
          });
        }
      }
    }

    const finalAnswer = this.finalAnswerNode.compose({
      guardrailMessage: safety.allowed ? (safety.classification === 'MIXED' ? safety.message : null) : safety.message,
      clarificationQuestion,
      specialistResults,
      escalation,
      declinedTopics: safety.declinedTopics,
      isDraft: classification.isDraftIntent,
    });
    routingNodes.push({ nodeType: AgentNodeType.FINAL_ANSWER, agentType: AgentType.SUPERVISOR_AGENT, status: finalAnswer.status, summary: 'Final answer composed.' });
    await this.nodeRuns.record({
      conversationId: input.conversationId,
      taskLogId: parentLog.id,
      nodeType: AgentNodeType.FINAL_ANSWER,
      agentType: AgentType.SUPERVISOR_AGENT,
      status: finalAnswer.status,
      sequence,
    });
    await this.taskLogs.finish(parentLog.id, {
      status: finalAnswer.status,
      outputSummary: finalAnswer.content,
      permissionDecision: specialistResults.some((result) => result.permissionDecision === PermissionDecision.DENIED)
        ? PermissionDecision.PARTIAL
        : PermissionDecision.ALLOWED,
    });

    return {
      finalAnswer,
      routing: {
        status: finalAnswer.status,
        nodes: routingNodes,
      },
    };
  }

  private async executeSpecialist(
    input: ExecuteConversationTurnInput,
    parentTaskLogId: string,
    agentType: AgentType,
    normalizedIntent: string,
    isDraftRequest: boolean,
  ): Promise<SpecialistResult> {
    const specialist = this.specialists[agentType];
    if (!specialist) {
      return {
        agentType,
        status: AgentRunStatus.DEGRADED,
        summary: `${agentType} is not available.`,
        userVisibleContent: `${agentType} is not available yet, so I cannot complete that part.`,
        sourceContext: [],
        permissionDecision: PermissionDecision.UNAVAILABLE,
      };
    }

    const handoff = await this.handoffs.create({
      conversationId: input.conversationId,
      parentTaskLogId,
      fromAgentType: AgentType.SUPERVISOR_AGENT,
      toAgentType: agentType,
      reason: 'Supervisor classified this domain as relevant.',
      requestedIntent: normalizedIntent,
    });
    const childLog = await this.taskLogs.start({
      conversationId: input.conversationId,
      parentLogId: parentTaskLogId,
      agentType,
      nodeType: AgentNodeType.SPECIALIST,
      taskType: 'specialist_answer',
      actor: input.actor,
      inputSummary: normalizedIntent,
    });
    const result = await specialist.execute(this.specialistInput(input, childLog.id, normalizedIntent, isDraftRequest));
    await this.taskLogs.finish(childLog.id, {
      status: result.status,
      outputSummary: result.summary,
      permissionDecision: result.permissionDecision,
    });
    await this.handoffs.complete(handoff.id, childLog.id, result.status, result.summary);
    return result;
  }

  private specialistInput(
    input: ExecuteConversationTurnInput,
    parentTaskLogId: string,
    normalizedIntent: string,
    isDraftRequest: boolean,
  ): SpecialistInput {
    return {
      conversationId: input.conversationId,
      parentTaskLogId,
      userMessage: input.userMessage,
      normalizedIntent,
      actorContext: input.actor,
      sourceHints: [],
      isDraftRequest,
      constraints: {
        sentientOnly: true,
        readOnlyOfficialRecords: true,
        mustReturnToSupervisor: true,
      },
    };
  }
}
