import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AgentNodeType, AgentRunStatus, AgentTaskLog, AgentType, PermissionDecision } from '../../generated/prisma';
import { RoutingTrace } from '../../common/dto';
import { AgentGuardrailService, DraftPolicyService, permittedActionsFor, SafetyPolicyResult } from '../../common/safety';
import { AiAgenticConfig } from '../../config';
import {
  AiActorContext,
  FinalAnswerResult,
  HumanEscalationResult,
  PendingActionDraft,
  SpecialistAgent,
  SpecialistInput,
  SpecialistResult,
} from '../../common/graph';
import { AnalyticsSqlService, hasAnalyticsSqlAccess } from '../analytics-sql';
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

type SupervisorRoute =
  | 'humanEscalationNode'
  | 'clarificationNode'
  | 'specialistsNode'
  | 'analyticsSqlNode'
  | 'finalAnswerNode';
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
      pendingAction: this.pendingActionFrom(state),
    };
  }

  /**
   * WHY keyed off the specialist's own status rather than finalAnswer.status: the
   * final-answer node runs its output through FinalAnswerPolicyService, which can
   * rewrite content and force REFUSED. Lifting the draft unconditionally here and
   * letting ConversationsService gate the mint on the REVIEWED status means a swept
   * turn simply never mints — a refusal can never ship with a live token attached.
   */
  private pendingActionFrom(state: SupervisorGraphState): PendingActionDraft | undefined {
    const pending = state.specialistResults.find(
      (result) => result.status === AgentRunStatus.PENDING_CONFIRMATION,
    );
    if (!pending?.confirmationPayload) return undefined;

    if (!pending.pendingActionKind) return undefined;

    /**
     * Defence in depth: re-check the capability registry here, not just inside the
     * specialist. permittedActionsFor is the same source the specialist's own
     * constraints were built from (T008/T010), so a specialist that somehow emitted
     * an action kind it was never granted is dropped rather than minted.
     */
    if (!permittedActionsFor(pending.agentType).includes(pending.pendingActionKind)) {
      this.logger.error(
        `Specialist ${pending.agentType} proposed ${pending.pendingActionKind} without the capability; draft discarded.`,
      );
      return undefined;
    }

    return {
      actionKind: pending.pendingActionKind,
      payload: pending.confirmationPayload,
      policyCitations: pending.policyCitations ?? [],
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

    /**
     * PHASE 1 — Security guardrail, before any LLM call.
     *
     * WHY: The turn used to evaluate the whole guardrail and then call the
     * classifier unconditionally, so a prompt-injection or destructive-SQL
     * payload was still forwarded to the model provider even though the answer
     * was already decided. Attack patterns are decidable from the message alone,
     * so they short-circuit here: no tokens spent, no attacker-controlled text
     * reaching the LLM, and the refusal is deterministic rather than model-dependent.
     */
    const securityRefusal = this.guardrails.evaluateSecurity(state.input.userMessage);
    if (securityRefusal) {
      this.logTrace('supervisor.securityRefused', {
        classification: securityRefusal.classification,
        status: securityRefusal.status,
        shouldEscalate: securityRefusal.shouldEscalate,
        declinedTopics: securityRefusal.declinedTopics,
        intentClassifierInvoked: false,
      });
      return {
        parentLog,
        sequence: state.sequence + 1,
        safety: securityRefusal,
        // WHY: downstream nodes (human escalation, final answer) call
        // requireClassification() unconditionally. The classifier never ran, so
        // a neutral rules-sourced stub keeps routing, logging, and the escalation
        // path working instead of throwing on a null classification.
        classification: this.securityBlockedClassification(state.input.userMessage),
        draftBlock: null,
        routingNodes: [
          ...state.routingNodes,
          {
            nodeType: AgentNodeType.SUPERVISOR,
            agentType: AgentType.SUPERVISOR_AGENT,
            status: AgentRunStatus.SUCCESS,
            summary: 'Security guardrail refused the request before intent classification.',
          },
        ],
      };
    }

    /** PHASE 2 — Intent classifier (LLM). Only reached by security-clean input. */
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

    /**
     * PHASE 3 — RBAC / scope guardrail, after intent classification.
     *
     * WHY: Everything evaluated here is role-aware (a manager IS entitled to
     * team leave answers that are refused for an employee) or benefits from the
     * classifier's context-aware reading of the message. Running it after Phase 2
     * lets the confident-classification override below consume a real intent
     * signal instead of patching a verdict that was computed blind.
     */
    let safety = this.guardrails.evaluateScope(state.input.userMessage, state.input.actor);

    /**
     * WHY: The guardrail scope gate is a static keyword list and cannot keep up
     * with real HR vocabulary ("bank holidays in my country" carried no listed
     * term and was refused even though the LLM classifier routed it to the
     * Leave Agent at 0.9 confidence). When an LLM classifier — which sees
     * the conversation context — confidently selects a specialist or an
     * escalation, that judgment outranks the keyword gate. Only the benign
     * OUT_OF_SCOPE verdict is overridable; hard safety refusals (unauthorized
     * data, unsafe actions, conflict escalations) are never bypassed, and Phase 1
     * security refusals never reach this point at all.
     *
     * The source check is "any LLM classifier, not the rule-based fallback":
     * pinning it to 'gemini' silently disabled the override for the Groq and
     * OpenRouter providers, which are selected by AI_AGENT_INTENT_PROVIDER.
     */
    if (
      safety.classification === 'OUT_OF_SCOPE' &&
      classification.source !== 'rules' &&
      !classification.requiresClarification &&
      classification.confidence >= this.scopeOverrideThreshold() &&
      (this.runnableSpecialists(classification).length > 0 ||
        this.classifierRequestsEscalation(classification))
    ) {
      this.logTrace('supervisor.scopeOverride', {
        guardrailClassification: safety.classification,
        classifierSource: classification.source,
        confidence: classification.confidence,
        requiredAgents: classification.requiredAgents,
        isHumanEscalationIntent: classification.isHumanEscalationIntent,
      });
      safety = {
        classification: 'SENTIENT',
        allowed: true,
        status: AgentRunStatus.SUCCESS,
        message: 'Scope allowed by confident intent classification.',
        shouldEscalate: false,
        requiresClarification: false,
        allowedAgents: [],
        declinedTopics: [],
        sensitivity: 'LOW',
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

  /**
   * WHY: A Phase-1 security refusal skips the intent classifier entirely, but the
   * escalation and final-answer nodes both call requireClassification(). This
   * neutral stub keeps those nodes total: no specialist is requested, no
   * clarification is asked, and confidence 0 with source 'rules' records honestly
   * in the trace that no model judgment backed this turn.
   */
  private securityBlockedClassification(userMessage: string): SupervisorIntentClassification {
    return {
      normalizedIntent: userMessage,
      requiredAgents: [],
      requiresClarification: false,
      clarificationReason: null,
      isDraftIntent: false,
      draftCategory: null,
      isHumanEscalationIntent: false,
      isGreeting: false,
      // WHY explicitly false: a Phase-1 security refusal must never reach the
      // generated-SQL branch. Leaving this to a default would make the guarantee
      // depend on the field's initialiser rather than on this stub.
      isAnalyticalQuestion: false,
      confidence: 0,
      source: 'rules',
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
    const agents = this.runnableSpecialists(classification);
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
    const turnTokens = this.sumTokens(state.specialistResults);
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
    const result = await specialist.execute(
      this.specialistInput(input, childLog.id, normalizedIntent, isDraftRequest, agentType),
    );
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

  private sourceCategories(results: SpecialistResult[]): string[] {
    return [...new Set(results.flatMap((result) => result.sourceContext.map((source) => source.sourceType)))];
  }

  /** Turn-level token rollup: null when no specialist reported usage (e.g. deterministic paths). */
  private sumTokens(results: SpecialistResult[]): { tokensIn: number | null; tokensOut: number | null } {
    const reported = results.filter((result) => result.tokensIn != null || result.tokensOut != null);
    if (reported.length === 0) return { tokensIn: null, tokensOut: null };
    return {
      tokensIn: reported.reduce((sum, result) => sum + (result.tokensIn ?? 0), 0),
      tokensOut: reported.reduce((sum, result) => sum + (result.tokensOut ?? 0), 0),
    };
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
    /**
     * WHY this outranks the specialist check below: the rules classifier already
     * routes `trend`/`attrition` phrasing to ANALYTICS_AGENT, so an analytical
     * question usually has a runnable specialist too. Placing the SQL branch after
     * that check would make it unreachable.
     *
     * The gate is deliberately narrow — flag on, actor role permitted, and the
     * classifier confident it is a pure reporting question. Any miss falls through
     * to existing behaviour rather than failing the turn.
     */
    if (this.shouldRouteToAnalyticsSql(state.classification, state.input.actor)) return 'analyticsSqlNode';
    if (this.runnableSpecialists(state.classification).length > 0) return 'specialistsNode';
    return 'finalAnswerNode';
  }

  private shouldRouteToAnalyticsSql(
    classification: SupervisorIntentClassification,
    actor: AiActorContext,
  ): boolean {
    if (!classification.isAnalyticalQuestion) return false;
    if (!this.config?.get<AiAgenticConfig>('aiAgentic')?.analyticsSqlEnabled) return false;
    if (!hasAnalyticsSqlAccess(actor.roles)) return false;
    // A turn that also asks for something operational keeps the tool-calling path,
    // which can act; the SQL branch only reads.
    return this.runnableSpecialists(classification).every(
      (agentType) => agentType === AgentType.ANALYTICS_AGENT,
    );
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
    const isSecurityPhase =
      state.safety.classification === 'UNSAFE_SYSTEM_ACTION' ||
      state.safety.classification === 'IMMEDIATE_SAFETY_RISK';
    if (state.safety.shouldEscalate && route === 'humanEscalationNode') {
      return isSecurityPhase
        ? 'Security guardrail escalated the request before intent classification.'
        : 'Guardrail requested human escalation.';
    }
    if (!state.safety.allowed && route === 'finalAnswerNode') {
      return isSecurityPhase
        ? 'Security guardrail refused the request before intent classification.'
        : 'Scope guardrail refused the request before specialist routing.';
    }
    if (state.classification.isGreeting && route === 'finalAnswerNode') return 'Greeting handled directly by supervisor.';
    if (state.draftBlock && route === 'finalAnswerNode') return 'Draft policy blocked a mutation-phrased draft request.';
    if (route === 'humanEscalationNode') return 'Classifier identified an explicit human-support request.';
    if (state.classification.requiresClarification && route === 'clarificationNode') return 'Classifier requested clarification.';
    if (route === 'analyticsSqlNode') return 'Classifier identified an analytical reporting question; routed to generated SQL.';
    if (state.classification.requiredAgents.length > 0 && route === 'specialistsNode') return 'Classifier selected specialist agents.';
    return 'No specialist route selected; finishing with supervisor response.';
  }

  private confidenceThreshold(): number {
    return this.config?.get<AiAgenticConfig>('aiAgentic')?.intentConfidenceThreshold ?? 0.4;
  }

  private scopeOverrideThreshold(): number {
    return this.config?.get<AiAgenticConfig>('aiAgentic')?.intentScopeOverrideThreshold ?? 0.7;
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
