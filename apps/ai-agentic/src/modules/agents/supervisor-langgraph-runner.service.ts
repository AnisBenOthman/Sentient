import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AgentNodeType, AgentRunStatus, AgentTaskLog, AgentType, PermissionDecision } from '../../generated/prisma';
import { RoutingTrace } from '../../common/dto';
import { AgentGuardrailService, permittedActionsFor, SafetyPolicyResult } from '../../common/safety';
import { AiAgenticConfig } from '../../config';
import {
  FinalAnswerResult,
  HumanEscalationResult,
  SpecialistAgent,
  SpecialistInput,
  SpecialistResult,
} from '../../common/graph';
import { AnalyticsSqlService } from '../analytics-sql';
import { AgentHandoffService } from './agent-handoff.service';
import { AgentNodeRunService } from './agent-node-run.service';
import {
  pendingActionFrom,
  sourceCategories as rollUpSourceCategories,
  sumTokens as rollUpTokens,
} from './agent-result.util';
import { AgentTaskLogService } from './agent-task-log.service';
import { ClarificationNodeService } from './nodes/clarification-node.service';
import { FinalAnswerNodeService } from './nodes/final-answer-node.service';
import { PermissionDecisionService } from './permission-decision.service';
import {
  ExecuteConversationTurnInput,
  ExecuteConversationTurnResult,
} from './supervisor-agent.service';
import { SupervisorGateResult, SupervisorGateService, SupervisorRoute } from './supervisor-gate.service';
import { SupervisorIntentClassification } from './intent-classifier.types';
import { GreetingAgentService } from './greeting-agent.service';
import { AnalyticsAgentService } from './specialists/analytics-agent.service';
import { CareerAgentService } from './specialists/career-agent.service';
import { GeneralHelpAgentService } from './specialists/general-help-agent.service';
import { HumanEscalationAgentService } from './specialists/human-escalation-agent.service';
import { LanguageAgentService } from './specialists/language-agent.service';
import { LeaveAgentService } from './specialists/leave-agent.service';
import { OkrAgentService } from './specialists/okr-agent.service';
import { OnboardingAgentService } from './specialists/onboarding-agent.service';

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
  /** Set by ConversationsService when Phase 1-3 already ran outside the graph (the streaming turn path) — skips re-running them. */
  precomputedGate: SupervisorGateResult | null;
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
    private readonly gate: SupervisorGateService,
    private readonly guardrails: AgentGuardrailService,
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
    private readonly analyticsSql: AnalyticsSqlService,
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

  async execute(
    input: ExecuteConversationTurnInput,
    precomputedGate?: SupervisorGateResult,
  ): Promise<ExecuteConversationTurnResult> {
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
      precomputedGate: precomputedGate ?? null,
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
      pendingAction: pendingActionFrom(state.specialistResults),
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
      precomputedGate: langGraph.Annotation<SupervisorGateResult | null>(),
    });

    return new langGraph.StateGraph(graphAnnotation)
      .addNode('supervisorNode', (state) => this.supervisorNode(state))
      .addNode('humanEscalationNode', (state) => this.humanEscalationNode(state))
      .addNode('clarificationNode', (state) => this.clarificationNodeRun(state))
      .addNode('specialistsNode', (state) => this.specialistsNode(state))
      .addNode('analyticsSqlNode', (state) => this.analyticsSqlNode(state))
      .addNode('finalAnswerNode', (state) => this.finalAnswerNodeRun(state))
      .addEdge(langGraph.START, 'supervisorNode')
      .addConditionalEdges('supervisorNode', (state) => this.routeAfterSupervisor(state), {
        humanEscalationNode: 'humanEscalationNode',
        clarificationNode: 'clarificationNode',
        specialistsNode: 'specialistsNode',
        analyticsSqlNode: 'analyticsSqlNode',
        finalAnswerNode: 'finalAnswerNode',
      })
      .addEdge('humanEscalationNode', 'finalAnswerNode')
      .addEdge('clarificationNode', 'finalAnswerNode')
      .addEdge('specialistsNode', 'finalAnswerNode')
      // WHY no new state channel: the node emits a SpecialistResult onto
      // specialistResults, so finalAnswerNode consumes it unchanged.
      .addEdge('analyticsSqlNode', 'finalAnswerNode')
      .addEdge('finalAnswerNode', langGraph.END);
  }

  /**
   * WHY a thin wrapper: Phase 1-3 (security guardrail, intent classifier, RBAC/
   * scope guardrail) now live in SupervisorGateService so the streaming turn
   * path (ConversationsService) and this graph share one implementation. When
   * ConversationsService already ran the gate (a stream-eligible turn that ends
   * up NOT actually streaming, or any turn where the caller pre-evaluated it),
   * state.precomputedGate carries the result and the gate is not re-run.
   */
  private async supervisorNode(state: LangGraphState): Promise<LangGraphUpdate> {
    const gate = state.precomputedGate ?? (await this.gate.evaluate(state.input, state.sequence));
    return {
      parentLog: gate.parentLog,
      sequence: gate.sequence,
      safety: gate.safety,
      classification: gate.classification,
      draftBlock: gate.draftBlock,
      routingNodes: [...state.routingNodes, ...gate.routingNodes],
    };
  }

  private routeAfterSupervisor(state: LangGraphState): SupervisorRoute {
    const route = this.gate.resolveRoute(state);
    // WHY the explicit guard rather than letting logTrace drop it: every argument
    // below — the gate diagnostics and routeReason's string building — is pure
    // work whose only consumer is the trace, and debug logs are off by default.
    if (this.debugLogsEnabled()) {
      // WHY report the gate even when it did not decide the route: an analytical
      // question that fell through to specialistsNode because the gate was closed
      // (flag off, wrong role, mixed turn) looks identical in every other field to
      // one that was never analytical. Without this, the only trace of
      // "text-to-SQL is built but never reached" is silence.
      const analyticsSqlGate = state.classification?.isAnalyticalQuestion
        ? this.gate.analyticsSqlGateDiagnostics(state.classification, state.input.actor)
        : null;
      this.logTrace('supervisor.route', {
        route,
        classifierSource: state.classification?.source ?? null,
        requiredAgents: state.classification?.requiredAgents ?? [],
        safetyClassification: state.safety?.classification ?? null,
        analyticsSqlGate,
        reason: this.gate.routeReason(state, route),
      });
    }
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
      AgentType.HUMAN_ESCALATION_AGENT,
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
    const routingNodes = [...state.routingNodes];
    let sequence = state.sequence;
    this.logTrace('specialists.route', {
      agents: classification.requiredAgents,
      normalizedIntent: classification.normalizedIntent,
      isDraftIntent: classification.isDraftIntent,
      draftCategory: classification.draftCategory,
    });

    /**
     * WHY: Specialists share no state, so a multi-agent turn runs them
     * concurrently instead of paying each LLM loop's latency serially.
     * Results keep the classifier's ordering, and a single failing specialist
     * degrades only its own portion instead of aborting the whole turn.
     */
    const agents = this.gate.runnableSpecialists(classification);
    const specialistResults = await Promise.all(
      agents.map((agentType) =>
        this.executeSpecialist(
          state.input,
          parentLog.id,
          agentType,
          classification.normalizedIntent,
          classification.isDraftIntent,
        ).catch((error: unknown) => this.specialistFailureResult(agentType, error)),
      ),
    );

    for (const result of specialistResults) {
      routingNodes.push({
        nodeType: AgentNodeType.SPECIALIST,
        agentType: result.agentType,
        status: result.status,
        summary: result.summary,
      });
      await this.nodeRuns.record({
        conversationId: state.input.conversationId,
        taskLogId: parentLog.id,
        nodeType: AgentNodeType.SPECIALIST,
        agentType: result.agentType,
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

  /**
   * WHY a dedicated node rather than another entry in the specialists map: this
   * branch generates SQL instead of calling tools, so it needs no handoff record
   * and no tool loop. It reuses AgentType.ANALYTICS_AGENT deliberately — the
   * specialists map is Record<AgentType, ...> and exhaustive, so introducing a new
   * AgentType member would be a Prisma enum migration plus a compile break.
   */
  private async analyticsSqlNode(state: LangGraphState): Promise<LangGraphUpdate> {
    const parentLog = this.requireParentLog(state);
    const classification = this.requireClassification(state);
    this.logTrace('analytics_sql.start', { normalizedIntent: classification.normalizedIntent });

    const result = await this.analyticsSql
      .execute(
        this.specialistInput(
          state.input,
          parentLog.id,
          classification.normalizedIntent,
          false,
          AgentType.ANALYTICS_AGENT,
        ),
      )
      .catch((error: unknown) => this.specialistFailureResult(AgentType.ANALYTICS_AGENT, error));

    await this.nodeRuns.record({
      conversationId: state.input.conversationId,
      taskLogId: parentLog.id,
      nodeType: AgentNodeType.SPECIALIST,
      agentType: result.agentType,
      status: result.status,
      sequence: state.sequence,
    });
    await this.permissionDecisions.record({
      conversationId: state.input.conversationId,
      taskLogId: parentLog.id,
      agentType: AgentType.ANALYTICS_AGENT,
      decision: result.permissionDecision,
      resourceType: result.sourceContext[0]?.sourceType ?? 'ANALYTICS_SQL',
      resourceId: result.sourceContext[0]?.referenceId ?? null,
      reason: result.summary,
    });
    this.logTrace('analytics_sql.completed', { status: result.status, summary: result.summary });

    return {
      sequence: state.sequence + 1,
      specialistResults: [...state.specialistResults, result],
      routingNodes: [
        ...state.routingNodes,
        {
          nodeType: AgentNodeType.SPECIALIST,
          agentType: result.agentType,
          status: result.status,
          summary: result.summary,
        },
      ],
    };
  }

  private specialistFailureResult(agentType: AgentType, error: unknown): SpecialistResult {
    this.logger.error(
      `Specialist ${agentType} threw during execution: ${error instanceof Error ? error.message : 'unknown error'}`,
    );
    return {
      agentType,
      status: AgentRunStatus.FAILED,
      summary: `${agentType} failed with an internal error.`,
      userVisibleContent: 'One part of your request hit an internal error and could not be completed. Please try again.',
      sourceContext: [],
      permissionDecision: PermissionDecision.UNAVAILABLE,
    };
  }

  private async finalAnswerNodeRun(state: LangGraphState): Promise<LangGraphUpdate> {
    const parentLog = this.requireParentLog(state);
    const safety = this.requireSafety(state);
    const classification = this.requireClassification(state);
    const finalAnswer = classification.isGreeting
      ? this.greetingAgent.compose(state.input.userMessage)
      : this.finalAnswerNode.compose({
          guardrailMessage: safety.allowed ? (safety.classification === 'MIXED' ? safety.message : null) : safety.message,
          guardrailStatus: safety.allowed ? null : safety.status,
          policyRefusalMessage: state.draftBlock,
          clarificationQuestion: state.clarificationQuestion,
          specialistResults: state.specialistResults,
          escalation: state.escalation,
          declinedTopics: safety.declinedTopics,
          isDraft: classification.isDraftIntent && !state.draftBlock,
          hasTeamLeaveScope: this.guardrails.hasTeamLeaveScope(state.input.actor.roles),
        });
    await this.nodeRuns.record({
      conversationId: state.input.conversationId,
      taskLogId: parentLog.id,
      nodeType: AgentNodeType.FINAL_ANSWER,
      agentType: AgentType.SUPERVISOR_AGENT,
      status: finalAnswer.status,
      sequence: state.sequence,
    });
    const turnTokens = rollUpTokens(state.specialistResults);
    await this.taskLogs.finish(parentLog.id, {
      status: finalAnswer.status,
      outputSummary: finalAnswer.content,
      sourceCategories: rollUpSourceCategories(state.specialistResults),
      // WHY: UNAVAILABLE children previously rolled up as ALLOWED, hiding
      // partially-served turns from the governance metrics.
      permissionDecision: state.specialistResults.some(
        (result) =>
          result.permissionDecision === PermissionDecision.DENIED ||
          result.permissionDecision === PermissionDecision.UNAVAILABLE,
      )
        ? PermissionDecision.PARTIAL
        : PermissionDecision.ALLOWED,
      tokensIn: turnTokens.tokensIn,
      tokensOut: turnTokens.tokensOut,
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

  /**
   * WHY the streaming turn path (ConversationsService + ConversationStreamRunnerService)
   * calls this directly rather than reimplementing handoff/task-log/permission
   * bookkeeping: this is the one place that bookkeeping happens for a specialist
   * run, LangGraph or not. Passing `onToken` is the only difference from the
   * graph's own specialistsNode call site.
   */
  async executeSpecialistStreaming(
    input: ExecuteConversationTurnInput,
    parentTaskLogId: string,
    agentType: AgentType,
    normalizedIntent: string,
    isDraftRequest: boolean,
    onToken: (delta: string) => void,
    signal?: AbortSignal,
  ): Promise<SpecialistResult> {
    return this.executeSpecialist(input, parentTaskLogId, agentType, normalizedIntent, isDraftRequest, onToken, signal);
  }

  private async executeSpecialist(
    input: ExecuteConversationTurnInput,
    parentTaskLogId: string,
    agentType: AgentType,
    normalizedIntent: string,
    isDraftRequest: boolean,
    onToken?: (delta: string) => void,
    signal?: AbortSignal,
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
    const specialistInput = this.specialistInput(input, childLog.id, normalizedIntent, isDraftRequest, agentType);
    const result = onToken && specialist.executeStream
      ? await specialist.executeStream(specialistInput, onToken, signal)
      : await specialist.execute(specialistInput);
    await this.taskLogs.finish(childLog.id, {
      status: result.status,
      outputSummary: result.summary,
      sourceCategories: result.sourceContext.map((source) => source.sourceType),
      permissionDecision: result.permissionDecision,
      tokensIn: result.tokensIn ?? null,
      tokensOut: result.tokensOut ?? null,
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

  /**
   * WHY `agentType` is required (not optional): the capability-aware branch
   * below is the ONLY place `ActionCapableSpecialistConstraints` is constructed
   * (spec 017 D1). Every other call site — human escalation, the analytics SQL
   * branch — passes an agent type with no registered capability and falls
   * through to the read-only literal unchanged.
   */
  private specialistInput(
    input: ExecuteConversationTurnInput,
    parentTaskLogId: string,
    normalizedIntent: string,
    isDraftRequest: boolean,
    agentType: AgentType,
  ): SpecialistInput {
    const permittedActions = permittedActionsFor(agentType);
    return {
      conversationId: input.conversationId,
      parentTaskLogId,
      userMessage: input.userMessage,
      normalizedIntent,
      actorContext: input.actor,
      conversationContext: input.conversationContext,
      sourceHints: [],
      isDraftRequest,
      constraints:
        permittedActions.length > 0
          ? {
              sentientOnly: true,
              readOnlyOfficialRecords: false,
              mustReturnToSupervisor: true,
              permittedActions,
            }
          : {
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
