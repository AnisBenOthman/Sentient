import { Injectable } from '@nestjs/common';
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
  constructor(private readonly registry: AgentRegistryService) {}

  getHealth(): AiHealthResponse {
    const agents = this.registry.list();
    const degradedAgents = agents.filter((agent) => !agent.available);

    return {
      service: 'ai-agentic',
      status: degradedAgents.length > 0 ? 'degraded' : 'healthy',
      agents,
      contextSources: [
        { source: 'hr-core', available: true, degradedReason: null },
        { source: 'social', available: true, degradedReason: null },
        { source: 'knowledge', available: true, degradedReason: null },
      ],
      timestamp: new Date().toISOString(),
    };
  }
}
