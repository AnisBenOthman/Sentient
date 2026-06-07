import { Injectable } from '@nestjs/common';
import { AgentNodeType, AgentRunStatus, AgentTaskLog, AgentType, PermissionDecision } from '../../generated/prisma';
import { RoutingTrace } from '../../common/dto';
import { AgentGuardrailService, SafetyPolicyResult } from '../../common/safety';
import {
  FinalAnswerResult,
  HumanEscalationResult,
  SpecialistAgent,
  SpecialistInput,
  SpecialistResult,
} from '../../common/graph';
import { AgentHandoffService } from './agent-handoff.service';
import { AgentNodeRunService } from './agent-node-run.service';
import { AgentTaskLogService } from './agent-task-log.service';
import { ClarificationNodeService } from './nodes/clarification-node.service';
import { FinalAnswerNodeService } from './nodes/final-answer-node.service';
import { PermissionDecisionService } from './permission-decision.service';
import {
  ExecuteConversationTurnInput,
  ExecuteConversationTurnResult,
} from './supervisor-agent.service';
import {
  SupervisorIntentClassification,
  SupervisorIntentClassifierService,
} from './supervisor-intent-classifier.service';
import { AnalyticsAgentService } from './specialists/analytics-agent.service';
import { CareerAgentService } from './specialists/career-agent.service';
import { GeneralHelpAgentService } from './specialists/general-help-agent.service';
import { HumanEscalationAgentService } from './specialists/human-escalation-agent.service';
import { LanguageAgentService } from './specialists/language-agent.service';
import { LeaveAgentService } from './specialists/leave-agent.service';
import { OkrAgentService } from './specialists/okr-agent.service';
import { OnboardingAgentService } from './specialists/onboarding-agent.service';

type SupervisorRoute = 'humanEscalationNode' | 'clarificationNode' | 'specialistsNode' | 'finalAnswerNode';
type LangGraphModule = typeof import('@langchain/langgraph');
type CompiledSupervisorGraph = { invoke(input: SupervisorGraphState): Promise<SupervisorGraphState> };

interface SupervisorGraphState {
  input: ExecuteConversationTurnInput;
  parentLog: AgentTaskLog | null;
  routingNodes: RoutingTrace['nodes'];
  sequence: number;
  safety: SafetyPolicyResult | null;
  classification: SupervisorIntentClassification | null;
  specialistResults: SpecialistResult[];
  clarificationQuestion: string | null;
  escalation: HumanEscalationResult | null;
  finalAnswer: FinalAnswerResult | null;
}

type LangGraphState = SupervisorGraphState;
type LangGraphUpdate = Partial<SupervisorGraphState>;

const importLangGraph = new Function('specifier', 'return import(specifier)') as (
  specifier: string,
) => Promise<LangGraphModule>;

function requireLangGraphForJest(): LangGraphModule {
  return require('@langchain/langgraph') as LangGraphModule;
}

@Injectable()
export class SupervisorLangGraphRunnerService {
  private readonly specialists: Record<AgentType, SpecialistAgent | undefined>;
  private graph: CompiledSupervisorGraph | null = null;

  constructor(
    private readonly guardrails: AgentGuardrailService,
    private readonly classifier: SupervisorIntentClassifierService,
    private readonly taskLogs: AgentTaskLogService,
    private readonly handoffs: AgentHandoffService,
    private readonly nodeRuns: AgentNodeRunService,
    private readonly permissionDecisions: PermissionDecisionService,
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

  async execute(input: ExecuteConversationTurnInput): Promise<ExecuteConversationTurnResult> {
    const graph = await this.getGraph();
    const state = await graph.invoke({
      input,
      parentLog: null,
      routingNodes: [],
      sequence: 1,
      safety: null,
      classification: null,
      specialistResults: [],
      clarificationQuestion: null,
      escalation: null,
      finalAnswer: null,
    });

    if (!state.finalAnswer) {
      throw new Error('Supervisor LangGraph finished without a final answer.');
    }

    return {
      finalAnswer: state.finalAnswer,
      routing: {
        status: state.finalAnswer.status,
        nodes: state.routingNodes,
      },
    };
  }

  private async getGraph(): Promise<CompiledSupervisorGraph> {
    if (!this.graph) {
      const langGraph = process.env.JEST_WORKER_ID
        ? requireLangGraphForJest()
        : await importLangGraph('@langchain/langgraph');
      this.graph = this.createGraph(langGraph).compile() as CompiledSupervisorGraph;
    }
    return this.graph;
  }

  private createGraph(langGraph: LangGraphModule) {
    const graphAnnotation = langGraph.Annotation.Root({
      input: langGraph.Annotation<ExecuteConversationTurnInput>(),
      parentLog: langGraph.Annotation<AgentTaskLog | null>(),
      routingNodes: langGraph.Annotation<RoutingTrace['nodes']>(),
      sequence: langGraph.Annotation<number>(),
      safety: langGraph.Annotation<SafetyPolicyResult | null>(),
      classification: langGraph.Annotation<SupervisorIntentClassification | null>(),
      specialistResults: langGraph.Annotation<SpecialistResult[]>(),
      clarificationQuestion: langGraph.Annotation<string | null>(),
      escalation: langGraph.Annotation<HumanEscalationResult | null>(),
      finalAnswer: langGraph.Annotation<FinalAnswerResult | null>(),
    });

    return new langGraph.StateGraph(graphAnnotation)
      .addNode('supervisorNode', (state) => this.supervisorNode(state))
      .addNode('humanEscalationNode', (state) => this.humanEscalationNode(state))
      .addNode('clarificationNode', (state) => this.clarificationNodeRun(state))
      .addNode('specialistsNode', (state) => this.specialistsNode(state))
      .addNode('finalAnswerNode', (state) => this.finalAnswerNodeRun(state))
      .addEdge(langGraph.START, 'supervisorNode')
      .addConditionalEdges('supervisorNode', (state) => this.routeAfterSupervisor(state), {
        humanEscalationNode: 'humanEscalationNode',
        clarificationNode: 'clarificationNode',
        specialistsNode: 'specialistsNode',
        finalAnswerNode: 'finalAnswerNode',
      })
      .addEdge('humanEscalationNode', 'finalAnswerNode')
      .addEdge('clarificationNode', 'finalAnswerNode')
      .addEdge('specialistsNode', 'finalAnswerNode')
      .addEdge('finalAnswerNode', langGraph.END);
  }

  private async supervisorNode(state: LangGraphState): Promise<LangGraphUpdate> {
    const parentLog = await this.taskLogs.start({
      conversationId: state.input.conversationId,
      agentType: AgentType.SUPERVISOR_AGENT,
      nodeType: AgentNodeType.SUPERVISOR,
      taskType: 'supervisor_turn',
      actor: state.input.actor,
      inputSummary: state.input.userMessage,
    });
    await this.nodeRuns.record({
      conversationId: state.input.conversationId,
      taskLogId: parentLog.id,
      nodeType: AgentNodeType.SUPERVISOR,
      agentType: AgentType.SUPERVISOR_AGENT,
      status: AgentRunStatus.SUCCESS,
      sequence: state.sequence,
      stateAfter: {
        orchestration: 'langgraph',
        userMessageId: state.input.userMessageId,
      },
    });

    return {
      parentLog,
      sequence: state.sequence + 1,
      safety: this.guardrails.evaluate(state.input.userMessage),
      classification: this.classifier.classify(state.input.userMessage),
      routingNodes: [
        ...state.routingNodes,
        {
          nodeType: AgentNodeType.SUPERVISOR,
          agentType: AgentType.SUPERVISOR_AGENT,
          status: AgentRunStatus.SUCCESS,
          summary: 'Intent classified by LangGraph supervisor node.',
        },
      ],
    };
  }

  private routeAfterSupervisor(state: LangGraphState): SupervisorRoute {
    if (!state.safety || !state.classification) return 'finalAnswerNode';
    if (state.safety.shouldEscalate) return 'humanEscalationNode';
    if (!state.safety.allowed) return 'finalAnswerNode';
    if (state.classification.requiresClarification) return 'clarificationNode';
    if (state.classification.requiredAgents.length > 0) return 'specialistsNode';
    return 'finalAnswerNode';
  }

  private async humanEscalationNode(state: LangGraphState): Promise<LangGraphUpdate> {
    const parentLog = this.requireParentLog(state);
    const safety = this.requireSafety(state);
    const classification = this.requireClassification(state);
    const specialistInput = this.specialistInput(
      state.input,
      parentLog.id,
      classification.normalizedIntent,
      classification.isDraftIntent,
    );
    const escalationResult = await this.humanEscalationAgent.record(
      specialistInput,
      safety.classification,
      safety.classification === 'IMMEDIATE_SAFETY_RISK',
    );
    await this.nodeRuns.record({
      conversationId: state.input.conversationId,
      taskLogId: parentLog.id,
      nodeType: AgentNodeType.HUMAN_ESCALATION,
      agentType: AgentType.HUMAN_ESCALATION_AGENT,
      status: AgentRunStatus.ESCALATED,
      sequence: state.sequence,
    });

    return {
      sequence: state.sequence + 1,
      specialistResults: [...state.specialistResults, escalationResult],
      escalation: escalationResult.escalation,
      routingNodes: [
        ...state.routingNodes,
        {
          nodeType: AgentNodeType.HUMAN_ESCALATION,
          agentType: AgentType.HUMAN_ESCALATION_AGENT,
          status: AgentRunStatus.ESCALATED,
          summary: escalationResult.summary,
        },
      ],
    };
  }

  private async clarificationNodeRun(state: LangGraphState): Promise<LangGraphUpdate> {
    const parentLog = this.requireParentLog(state);
    const classification = this.requireClassification(state);
    const clarification = await this.clarificationNode.ask({
      conversationId: state.input.conversationId,
      parentLogId: parentLog.id,
      actor: state.input.actor,
      reason: classification.clarificationReason ?? 'Ambiguous request.',
    });
    await this.nodeRuns.record({
      conversationId: state.input.conversationId,
      taskLogId: clarification.taskLogId,
      nodeType: AgentNodeType.CLARIFICATION,
      agentType: AgentType.SUPERVISOR_AGENT,
      status: AgentRunStatus.SUCCESS,
      sequence: state.sequence,
    });

    return {
      sequence: state.sequence + 1,
      clarificationQuestion: clarification.question,
      routingNodes: [
        ...state.routingNodes,
        {
          nodeType: AgentNodeType.CLARIFICATION,
          agentType: AgentType.SUPERVISOR_AGENT,
          status: AgentRunStatus.SUCCESS,
          summary: clarification.summary,
        },
      ],
    };
  }

  private async specialistsNode(state: LangGraphState): Promise<LangGraphUpdate> {
    const parentLog = this.requireParentLog(state);
    const classification = this.requireClassification(state);
    const specialistResults: SpecialistResult[] = [];
    const routingNodes = [...state.routingNodes];
    let sequence = state.sequence;

    for (const agentType of classification.requiredAgents) {
      const result = await this.executeSpecialist(
        state.input,
        parentLog.id,
        agentType,
        classification.normalizedIntent,
        classification.isDraftIntent,
      );
      specialistResults.push(result);
      routingNodes.push({
        nodeType: AgentNodeType.SPECIALIST,
        agentType,
        status: result.status,
        summary: result.summary,
      });
      await this.nodeRuns.record({
        conversationId: state.input.conversationId,
        taskLogId: parentLog.id,
        nodeType: AgentNodeType.SPECIALIST,
        agentType,
        status: result.status,
        sequence,
      });
      sequence += 1;
    }

    return {
      sequence,
      specialistResults: [...state.specialistResults, ...specialistResults],
      routingNodes,
    };
  }

  private async finalAnswerNodeRun(state: LangGraphState): Promise<LangGraphUpdate> {
    const parentLog = this.requireParentLog(state);
    const safety = this.requireSafety(state);
    const classification = this.requireClassification(state);
    const finalAnswer = this.finalAnswerNode.compose({
      guardrailMessage: safety.allowed ? (safety.classification === 'MIXED' ? safety.message : null) : safety.message,
      clarificationQuestion: state.clarificationQuestion,
      specialistResults: state.specialistResults,
      escalation: state.escalation,
      declinedTopics: safety.declinedTopics,
      isDraft: classification.isDraftIntent,
    });
    await this.nodeRuns.record({
      conversationId: state.input.conversationId,
      taskLogId: parentLog.id,
      nodeType: AgentNodeType.FINAL_ANSWER,
      agentType: AgentType.SUPERVISOR_AGENT,
      status: finalAnswer.status,
      sequence: state.sequence,
    });
    await this.taskLogs.finish(parentLog.id, {
      status: finalAnswer.status,
      outputSummary: finalAnswer.content,
      sourceCategories: this.sourceCategories(state.specialistResults),
      permissionDecision: state.specialistResults.some((result) => result.permissionDecision === PermissionDecision.DENIED)
        ? PermissionDecision.PARTIAL
        : PermissionDecision.ALLOWED,
    });

    return {
      finalAnswer,
      routingNodes: [
        ...state.routingNodes,
        {
          nodeType: AgentNodeType.FINAL_ANSWER,
          agentType: AgentType.SUPERVISOR_AGENT,
          status: finalAnswer.status,
          summary: 'Final answer composed by LangGraph final-answer node.',
        },
      ],
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
      reason: 'LangGraph supervisor classified this domain as relevant.',
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
      sourceCategories: result.sourceContext.map((source) => source.sourceType),
      permissionDecision: result.permissionDecision,
    });
    await this.permissionDecisions.record({
      conversationId: input.conversationId,
      taskLogId: childLog.id,
      agentType,
      decision: result.permissionDecision,
      resourceType: result.sourceContext[0]?.sourceType ?? 'SPECIALIST_CONTEXT',
      resourceId: result.sourceContext[0]?.referenceId ?? null,
      reason: result.summary,
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
      conversationContext: input.conversationContext,
      sourceHints: [],
      isDraftRequest,
      constraints: {
        sentientOnly: true,
        readOnlyOfficialRecords: true,
        mustReturnToSupervisor: true,
      },
    };
  }

  private requireParentLog(state: LangGraphState): AgentTaskLog {
    if (!state.parentLog) throw new Error('Supervisor LangGraph state is missing parent task log.');
    return state.parentLog;
  }

  private requireSafety(state: LangGraphState): SafetyPolicyResult {
    if (!state.safety) throw new Error('Supervisor LangGraph state is missing safety result.');
    return state.safety;
  }

  private requireClassification(state: LangGraphState): SupervisorIntentClassification {
    if (!state.classification) throw new Error('Supervisor LangGraph state is missing intent classification.');
    return state.classification;
  }

  private sourceCategories(results: SpecialistResult[]): string[] {
    return [...new Set(results.flatMap((result) => result.sourceContext.map((source) => source.sourceType)))];
  }
}
