import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AgentNodeType, AgentRunStatus, AgentTaskLog, AgentType } from '../../generated/prisma';
import { RoutingTrace } from '../../common/dto';
import { AgentGuardrailService, DraftPolicyService, SafetyPolicyResult } from '../../common/safety';
import { AiAgenticConfig } from '../../config';
import { AiActorContext } from '../../common/graph';
import { hasAnalyticsSqlAccess } from '../analytics-sql';
import { AgentNodeRunService } from './agent-node-run.service';
import { AgentTaskLogService } from './agent-task-log.service';
import { ExecuteConversationTurnInput } from './supervisor-agent.service';
import {
  INTENT_CLASSIFIER,
  IntentClassifier,
  SupervisorIntentClassification,
} from './intent-classifier.types';

export type SupervisorRoute =
  | 'humanEscalationNode'
  | 'clarificationNode'
  | 'specialistsNode'
  | 'analyticsSqlNode'
  | 'finalAnswerNode';

/** The minimal shape resolveRoute()/routeReason() need — LangGraph's own state satisfies this structurally. */
export interface SupervisorGateState {
  input: ExecuteConversationTurnInput;
  safety: SafetyPolicyResult | null;
  classification: SupervisorIntentClassification | null;
  draftBlock: string | null;
}

export interface SupervisorGateResult {
  parentLog: AgentTaskLog;
  safety: SafetyPolicyResult;
  classification: SupervisorIntentClassification;
  draftBlock: string | null;
  route: SupervisorRoute;
  routingNodes: RoutingTrace['nodes'];
  /** The next sequence number for a caller (graph node runs, the streaming runner) to continue from. */
  sequence: number;
}

/**
 * WHY extracted from SupervisorLangGraphRunnerService.supervisorNode(): the
 * streaming turn path (ConversationsService, deciding whether a turn is
 * stream-eligible before ever calling the LangGraph) needs to run exactly this
 * three-phase gate once, outside the graph, without a second implementation of
 * security-critical guardrail/classifier/routing logic drifting from the
 * LangGraph path. supervisorNode() becomes a thin wrapper around evaluate()/
 * resolveRoute() so both paths share this one implementation.
 */
@Injectable()
export class SupervisorGateService {
  private readonly logger = new Logger(SupervisorGateService.name);

  constructor(
    private readonly guardrails: AgentGuardrailService,
    private readonly draftPolicy: DraftPolicyService,
    @Inject(INTENT_CLASSIFIER) private readonly classifier: IntentClassifier,
    private readonly taskLogs: AgentTaskLogService,
    private readonly nodeRuns: AgentNodeRunService,
    private readonly config?: ConfigService,
  ) {}

  async evaluate(input: ExecuteConversationTurnInput, startSequence = 1): Promise<SupervisorGateResult> {
    const parentLog = await this.taskLogs.start({
      conversationId: input.conversationId,
      agentType: AgentType.SUPERVISOR_AGENT,
      nodeType: AgentNodeType.SUPERVISOR,
      taskType: 'supervisor_turn',
      actor: input.actor,
      inputSummary: input.userMessage,
    });
    await this.nodeRuns.record({
      conversationId: input.conversationId,
      taskLogId: parentLog.id,
      nodeType: AgentNodeType.SUPERVISOR,
      agentType: AgentType.SUPERVISOR_AGENT,
      status: AgentRunStatus.SUCCESS,
      sequence: startSequence,
      stateAfter: {
        orchestration: 'langgraph',
        userMessageId: input.userMessageId,
      },
    });

    /**
     * PHASE 1 — Security guardrail, before any LLM call.
     *
     * WHY: Attack patterns are decidable from the message alone, so they short-
     * circuit here: no tokens spent, no attacker-controlled text reaching the
     * LLM, and the refusal is deterministic rather than model-dependent.
     */
    const securityRefusal = this.guardrails.evaluateSecurity(input.userMessage);
    if (securityRefusal) {
      this.logTrace('supervisor.securityRefused', {
        classification: securityRefusal.classification,
        status: securityRefusal.status,
        shouldEscalate: securityRefusal.shouldEscalate,
        declinedTopics: securityRefusal.declinedTopics,
        intentClassifierInvoked: false,
      });
      // WHY: downstream nodes (human escalation, final answer) call
      // requireClassification() unconditionally. The classifier never ran, so
      // a neutral rules-sourced stub keeps routing, logging, and the escalation
      // path working instead of throwing on a null classification.
      const classification = this.securityBlockedClassification(input.userMessage);
      const routingNodes: RoutingTrace['nodes'] = [
        {
          nodeType: AgentNodeType.SUPERVISOR,
          agentType: AgentType.SUPERVISOR_AGENT,
          status: AgentRunStatus.SUCCESS,
          summary: 'Security guardrail refused the request before intent classification.',
        },
      ];
      return {
        parentLog,
        safety: securityRefusal,
        classification,
        draftBlock: null,
        route: this.resolveRoute({ input, safety: securityRefusal, classification, draftBlock: null }),
        routingNodes,
        sequence: startSequence + 1,
      };
    }

    /** PHASE 2 — Intent classifier (LLM). Only reached by security-clean input. */
    let classification = await this.classifier.classify(input.userMessage, input.conversationContext);

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
     * WHY after Phase 2: everything evaluated here is role-aware or benefits
     * from the classifier's context-aware reading of the message.
     */
    let safety = this.guardrails.evaluateScope(input.userMessage, input.actor);

    /**
     * WHY: The guardrail scope gate is a static keyword list. When an LLM
     * classifier — which sees the conversation context — confidently selects
     * a specialist or an escalation, that judgment outranks the keyword gate.
     * Only the benign OUT_OF_SCOPE verdict is overridable; hard safety
     * refusals are never bypassed, and Phase 1 security refusals never reach
     * this point at all.
     */
    if (
      safety.classification === 'OUT_OF_SCOPE' &&
      classification.source !== 'rules' &&
      !classification.requiresClarification &&
      classification.confidence >= this.scopeOverrideThreshold() &&
      (this.runnableSpecialists(classification).length > 0 || this.classifierRequestsEscalation(classification))
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
        input.userMessage,
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

    const routingNodes: RoutingTrace['nodes'] = [
      {
        nodeType: AgentNodeType.SUPERVISOR,
        agentType: AgentType.SUPERVISOR_AGENT,
        status: AgentRunStatus.SUCCESS,
        summary: 'Intent classified by LangGraph supervisor node.',
      },
    ];

    return {
      parentLog,
      safety,
      classification,
      draftBlock,
      route: this.resolveRoute({ input, safety, classification, draftBlock }),
      routingNodes,
      sequence: startSequence + 1,
    };
  }

  resolveRoute(state: SupervisorGateState): SupervisorRoute {
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
     */
    if (this.shouldRouteToAnalyticsSql(state.classification, state.input.actor)) return 'analyticsSqlNode';
    if (this.runnableSpecialists(state.classification).length > 0) return 'specialistsNode';
    return 'finalAnswerNode';
  }

  routeReason(state: SupervisorGateState, route: SupervisorRoute): string {
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

  runnableSpecialists(classification: SupervisorIntentClassification): AgentType[] {
    return classification.requiredAgents.filter((agentType) => agentType !== AgentType.HUMAN_ESCALATION_AGENT);
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
