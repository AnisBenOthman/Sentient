import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AgentRegistryEntry, AgentRegistryService } from './agent-registry.service';
import { LlmFallbackOrchestratorService, LlmProviderStatus } from './tools';

/**
 * WHY reported separately from contextSources: an LLM outage and an HR Core
 * outage degrade the assistant in completely different ways, and an operator
 * paged at 3am needs to see which one it is without reading assistant
 * transcripts. `down` means no provider in the rotation can answer at all.
 */
export interface AiLlmHealth {
  status: 'healthy' | 'degraded' | 'down';
  providers: LlmProviderStatus[];
  degradedReason: string | null;
}

export interface AiHealthResponse {
  service: 'ai-agentic';
  status: 'healthy' | 'degraded' | 'down';
  agents: AgentRegistryEntry[];
  contextSources: Array<{ source: string; available: boolean; degradedReason: string | null }>;
  llm: AiLlmHealth;
  timestamp: string;
}

@Injectable()
export class AiHealthService {
  constructor(
    private readonly registry: AgentRegistryService,
    private readonly config: ConfigService,
    @Optional() private readonly llm?: LlmFallbackOrchestratorService,
  ) {}

  async getHealth(): Promise<AiHealthResponse> {
    const agents = this.registry.list();
    const degradedAgents = agents.filter((agent) => !agent.available);
    const [hrCore, social] = await Promise.all([
      this.probe('hr-core', this.config.get<string>('aiAgentic.hrCoreUrl') ?? 'http://localhost:3001'),
      this.probe('social', this.config.get<string>('aiAgentic.socialUrl') ?? 'http://localhost:3002'),
    ]);
    const contextSources = [
      hrCore,
      social,
      { source: 'knowledge', available: true, degradedReason: null },
    ];
    const degradedSources = contextSources.filter((source) => !source.available);
    const llm = this.llmHealth();

    return {
      service: 'ai-agentic',
      /**
       * WHY an LLM outage reports `down` rather than `degraded`: with no provider
       * able to answer, every conversational turn falls back to deterministic
       * record reads. That is a different service level, not a minor wobble.
       */
      status: llm.status === 'down'
        ? 'down'
        : degradedAgents.length > 0 || degradedSources.length > 0 || llm.status === 'degraded'
          ? 'degraded'
          : 'healthy',
      agents,
      contextSources,
      llm,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * WHY it never issues a request: a health check must not consume LLM quota,
   * and a synthetic probe would not exercise the tool-calling path that actually
   * fails in production. This reports configuration plus the last real outcome
   * the orchestrator observed while serving traffic.
   */
  private llmHealth(): AiLlmHealth {
    if (!this.llm) {
      return { status: 'down', providers: [], degradedReason: 'No LLM provider rotation is wired into this process.' };
    }

    const providers = this.llm.describeProviders();
    const configured = providers.filter((provider) => provider.configured);
    if (configured.length === 0) {
      return {
        status: 'down',
        providers,
        degradedReason: 'No LLM provider in AI_AGENT_LLM_PROVIDER_ORDER has an API key configured.',
      };
    }

    const failing = configured.filter((provider) => provider.lastOutcome === 'FAILED');
    if (failing.length === configured.length) {
      return {
        status: 'down',
        providers,
        degradedReason: `Every configured provider last failed: ${failing
          .map((provider) => `${provider.provider}=${provider.lastFailureReason ?? 'unknown'}`)
          .join(', ')}.`,
      };
    }
    if (failing.length > 0) {
      return {
        status: 'degraded',
        providers,
        degradedReason: `${failing.map((provider) => provider.provider).join(', ')} last failed; the rotation is running on fallbacks.`,
      };
    }
    return { status: 'healthy', providers, degradedReason: null };
  }

  private async probe(source: string, baseUrl: string): Promise<{ source: string; available: boolean; degradedReason: string | null }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1_500);
    try {
      const response = await fetch(`${baseUrl}/health`, { signal: controller.signal });
      return {
        source,
        available: response.ok,
        degradedReason: response.ok ? null : `${source} health returned ${response.status}.`,
      };
    } catch (error: unknown) {
      return {
        source,
        available: false,
        degradedReason: error instanceof Error ? error.message : `${source} health check failed.`,
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
