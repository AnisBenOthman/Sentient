import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AgentNodeType, AgentRunStatus, AgentTaskLog, AgentType, PermissionDecision } from '../../generated/prisma';
import { RoutingTrace } from '../../common/dto';
import { AgentGuardrailService, DraftPolicyService, SafetyPolicyResult } from '../../common/safety';
import { AiAgenticConfig } from '../../config';
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
  INTENT_CLASSIFIER,
  IntentClassifier,
  SupervisorIntentClassification,
} from './intent-classifier.types';
import { GreetingAgentService } from './greeting-agent.service';
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
  draftBlock: string | null;
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
  private readonly logger = new Logger(SupervisorLangGraphRunnerService.name);
  private readonly specialists: Record<AgentType, SpecialistAgent | undefined>;
  private graph: CompiledSupervisorGraph | null = null;

  constructor(
    private readonly guardrails: AgentGuardrailService,
    private readonly draftPolicy: DraftPolicyService,
    @Inject(INTENT_CLASSIFIER) private readonly classifier: IntentClassifier,
    private readonly greetingAgent: GreetingAgentService,
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
    private readonly config?: ConfigService,
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
    this.logTrace('turn.start', {
      conversationId: input.conversationId,
      userMessageId: input.userMessageId,
      correlationId: input.actor.correlationId,
      userId: input.actor.userId,
      employeeId: input.actor.employeeId,
      roles: input.actor.roles,
      userMessage: input.userMessage,
      recentMessageCount: input.conversationContext.recentMessages.length,
      priorHandoffAgents: input.conversationContext.priorHandoffAgents,
    });

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
      draftBlock: null,
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
      draftBlock: langGraph.Annotation<string | null>(),
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

    const safety = this.guardrails.evaluate(state.input.userMessage, state.input.actor);
    let classification = await this.classifier.classify(
      state.input.userMessage,
      state.input.conversationContext,
    );

    /**
     * WHY: A low-confidence classification routed to specialists anyway, which
     * contradicts the "ask when not confident" edge case. Below the configured
     * threshold the supervisor asks one focused clarification instead.
     */
    const confidenceThreshold = this.confidenceThreshold();
    if (
      !classification.isGreeting &&
      !classification.isHumanEscalationIntent &&
      !classification.requiresClarification &&
      classification.confidence < confidenceThreshold
    ) {
      classification = {
        ...classification,
        requiredAgents: [],
        requiresClarification: true,
        clarificationReason: 'The request could not be routed confidently; one more detail is needed.',
      };
    }

    let draftBlock: string | null = null;
    if (classification.isDraftIntent) {
      const draftPolicy = this.draftPolicy.evaluate(
        classification.requiredAgents[0] ?? AgentType.SUPERVISOR_AGENT,
        state.input.userMessage,
      );
      if (!draftPolicy.allowed) {
        draftBlock = `I can help prepare a draft, but I cannot submit, approve, publish, or otherwise change official Sentient records. ${draftPolicy.humanReviewReminder}`;
        this.logTrace('supervisor.draftBlocked', {
          blockedReason: draftPolicy.blockedReason,
        });
      }
    }

    this.logTrace('supervisor.classified', {
      safety: {
        classification: safety.classification,
        allowed: safety.allowed,
        status: safety.status,
        shouldEscalate: safety.shouldEscalate,
        requiresClarification: safety.requiresClarification,
        allowedAgents: safety.allowedAgents,
        declinedTopics: safety.declinedTopics,
        sensitivity: safety.sensitivity,
      },
      intent: {
        source: classification.source,
        normalizedIntent: classification.normalizedIntent,
        requiredAgents: classification.requiredAgents,
        requiresClarification: classification.requiresClarification,
        clarificationReason: classification.clarificationReason,
        isDraftIntent: classification.isDraftIntent,
        draftCategory: classification.draftCategory,
        isHumanEscalationIntent: classification.isHumanEscalationIntent,
        isGreeting: classification.isGreeting,
        confidence: classification.confidence,
      },
    });

    return {
      parentLog,
      sequence: state.sequence + 1,
      safety,
      classification,
      draftBlock,
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
    const route = this.resolveSupervisorRoute(state);
    this.logTrace('supervisor.route', {
      route,
      classifierSource: state.classification?.source ?? null,
      requiredAgents: state.classification?.requiredAgents ?? [],
      safetyClassification: state.safety?.classification ?? null,
      reason: this.routeReason(state, route),
    });
    return route;
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
    // WHY: classifier-detected escalations ("let me talk to HR") reach this node
    // with a benign safety classification; the reason must reflect the user
    // request rather than a guardrail category.
    const escalationReason = safety.shouldEscalate ? safety.classification : 'USER_REQUESTED_HUMAN_SUPPORT';
    const escalationResult = await this.humanEscalationAgent.record(
      specialistInput,
      escalationReason,
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
    this.logTrace('humanEscalation.completed', {
      status: escalationResult.status,
      summary: escalationResult.summary,
      target: escalationResult.escalation,
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
    this.logTrace('clarification.asked', {
      reason: classification.clarificationReason,
      question: clarification.question,
      summary: clarification.summary,
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
    this.logTrace('specialists.route', {
      agents: classification.requiredAgents,
      normalizedIntent: classification.normalizedIntent,
      isDraftIntent: classification.isDraftIntent,
      draftCategory: classification.draftCategory,
    });

    for (const agentType of this.runnableSpecialists(classification)) {
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
    const finalAnswer = classification.isGreeting
      ? this.greetingAgent.compose()
      : this.finalAnswerNode.compose({
          guardrailMessage: safety.allowed ? (safety.classification === 'MIXED' ? safety.message : null) : safety.message,
          guardrailStatus: safety.allowed ? null : safety.status,
          policyRefusalMessage: state.draftBlock,
          clarificationQuestion: state.clarificationQuestion,
          specialistResults: state.specialistResults,
          escalation: state.escalation,
          declinedTopics: safety.declinedTopics,
          isDraft: classification.isDraftIntent && !state.draftBlock,
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
      // WHY: UNAVAILABLE children previously rolled up as ALLOWED, hiding
      // partially-served turns from the governance metrics.
      permissionDecision: state.specialistResults.some(
        (result) =>
          result.permissionDecision === PermissionDecision.DENIED ||
          result.permissionDecision === PermissionDecision.UNAVAILABLE,
      )
        ? PermissionDecision.PARTIAL
        : PermissionDecision.ALLOWED,
    });
    this.logTrace('finalAnswer.completed', {
      status: finalAnswer.status,
      routingSummary: finalAnswer.routingSummary,
      sourceContext: finalAnswer.sourceContext,
      content: finalAnswer.content,
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
      this.logTrace('specialist.unavailable', {
        agentType,
        normalizedIntent,
      });
      return {
        agentType,
        status: AgentRunStatus.DEGRADED,
        summary: `${agentType} is not available.`,
        userVisibleContent: `${agentType} is not available yet, so I cannot complete that part.`,
        sourceContext: [],
        permissionDecision: PermissionDecision.UNAVAILABLE,
      };
    }

    this.logTrace('specialist.start', {
      agentType,
      normalizedIntent,
      isDraftRequest,
    });
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
    this.logTrace('specialist.completed', {
      agentType,
      status: result.status,
      summary: result.summary,
      permissionDecision: result.permissionDecision,
      sourceContext: result.sourceContext,
      recommendedNextStep: result.recommendedNextStep ?? null,
      draftLabel: result.draftLabel ?? null,
      userVisibleContent: result.userVisibleContent,
    });
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

  private resolveSupervisorRoute(state: LangGraphState): SupervisorRoute {
    if (!state.safety || !state.classification) return 'finalAnswerNode';
    if (state.safety.shouldEscalate) return 'humanEscalationNode';
    if (!state.safety.allowed) return 'finalAnswerNode';
    if (state.classification.isGreeting) return 'finalAnswerNode';
    if (state.draftBlock) return 'finalAnswerNode';
    /**
     * WHY: The classifier can request a human handoff (FR-043), but no runnable
     * specialist exists for HUMAN_ESCALATION_AGENT — routing it through the
     * specialists map produced a dead-end "agent not available" reply with no
     * recorded handoff. Escalation intents go to the escalation node directly.
     */
    if (this.classifierRequestsEscalation(state.classification)) return 'humanEscalationNode';
    if (state.classification.requiresClarification) return 'clarificationNode';
    if (this.runnableSpecialists(state.classification).length > 0) return 'specialistsNode';
    return 'finalAnswerNode';
  }

  private classifierRequestsEscalation(classification: SupervisorIntentClassification): boolean {
    return (
      classification.isHumanEscalationIntent ||
      classification.requiredAgents.includes(AgentType.HUMAN_ESCALATION_AGENT)
    );
  }

  private runnableSpecialists(classification: SupervisorIntentClassification): AgentType[] {
    return classification.requiredAgents.filter((agentType) => agentType !== AgentType.HUMAN_ESCALATION_AGENT);
  }

  private routeReason(state: LangGraphState, route: SupervisorRoute): string {
    if (!state.safety || !state.classification) return 'Missing supervisor state; finishing safely.';
    if (state.safety.shouldEscalate && route === 'humanEscalationNode') return 'Guardrail requested human escalation.';
    if (!state.safety.allowed && route === 'finalAnswerNode') return 'Guardrail refused the request before specialist routing.';
    if (state.classification.isGreeting && route === 'finalAnswerNode') return 'Greeting handled directly by supervisor.';
    if (state.draftBlock && route === 'finalAnswerNode') return 'Draft policy blocked a mutation-phrased draft request.';
    if (route === 'humanEscalationNode') return 'Classifier identified an explicit human-support request.';
    if (state.classification.requiresClarification && route === 'clarificationNode') return 'Classifier requested clarification.';
    if (state.classification.requiredAgents.length > 0 && route === 'specialistsNode') return 'Classifier selected specialist agents.';
    return 'No specialist route selected; finishing with supervisor response.';
  }

  private confidenceThreshold(): number {
    return this.config?.get<AiAgenticConfig>('aiAgentic')?.intentConfidenceThreshold ?? 0.4;
  }

  private logTrace(event: string, payload: Record<string, unknown>): void {
    if (!this.debugLogsEnabled()) return;
    this.logger.log(`AI process ${event}:\n${JSON.stringify(payload, null, 2)}`);
  }

  private debugLogsEnabled(): boolean {
    const configured = this.config?.get<AiAgenticConfig>('aiAgentic')?.intentClassifierDebugLogs;
    if (typeof configured === 'boolean') return configured;
    const raw = process.env.AI_AGENT_INTENT_DEBUG_LOGS?.trim().toLowerCase();
    return raw === 'true' || raw === '1' || raw === 'yes';
  }
}
