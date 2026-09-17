import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AgentType } from '../../generated/prisma';
import { AiAgenticConfig } from '../../config';
import { SupervisorGateResult, SupervisorGateService } from '../agents/supervisor-gate.service';

export type StreamEligibilityResult = { eligible: true; agentType: AgentType } | { eligible: false };

/**
 * WHY a route-level pre-filter only: a specialist can still short-circuit to a
 * deterministic answer (a booking proposal, a refusal) before ever calling the
 * LLM even when this says eligible. That is fine — the streaming turn runner
 * simply never receives an `onToken` call and emits `done` immediately with the
 * complete content, identical to today's behaviour but delivered over SSE. No
 * turn is ever mis-classified as unsafe by this check; the worst case is zero
 * streamed tokens.
 */
@Injectable()
export class StreamEligibilityService {
  constructor(
    private readonly gate: SupervisorGateService,
    private readonly config?: ConfigService,
  ) {}

  check(gateResult: SupervisorGateResult): StreamEligibilityResult {
    const streaming = this.config?.get<AiAgenticConfig>('aiAgentic')?.streamingEnabled;
    if (!streaming) return { eligible: false };
    if (gateResult.route !== 'specialistsNode') return { eligible: false };

    const agents = this.gate.runnableSpecialists(gateResult.classification);
    if (agents.length !== 1) return { eligible: false };

    const [agentType] = agents;
    const streamingAgentTypes = this.config?.get<AiAgenticConfig>('aiAgentic')?.streamingAgentTypes ?? [];
    if (!agentType || !streamingAgentTypes.includes(agentType)) return { eligible: false };

    return { eligible: true, agentType };
  }
}
