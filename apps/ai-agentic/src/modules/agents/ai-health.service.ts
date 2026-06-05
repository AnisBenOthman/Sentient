import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AgentRegistryEntry, AgentRegistryService } from './agent-registry.service';

export interface AiHealthResponse {
  service: 'ai-agentic';
  status: 'healthy' | 'degraded' | 'down';
  agents: AgentRegistryEntry[];
  contextSources: Array<{ source: string; available: boolean; degradedReason: string | null }>;
  timestamp: string;
}

@Injectable()
export class AiHealthService {
  constructor(
    private readonly registry: AgentRegistryService,
    private readonly config: ConfigService,
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

    return {
      service: 'ai-agentic',
      status: degradedAgents.length > 0 || degradedSources.length > 0 ? 'degraded' : 'healthy',
      agents,
      contextSources,
      timestamp: new Date().toISOString(),
    };
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
