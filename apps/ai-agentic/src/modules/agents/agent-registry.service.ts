import { Injectable } from '@nestjs/common';
import { AgentType } from '../../generated/prisma';

export interface AgentRegistryEntry {
  agentType: AgentType;
  displayName: string;
  domain: string;
  available: boolean;
  degradedReason: string | null;
}

const ROSTER: AgentRegistryEntry[] = [
  {
    agentType: AgentType.SUPERVISOR_AGENT,
    displayName: 'Supervisor Agent',
    domain: 'Routing and orchestration',
    available: true,
    degradedReason: null,
  },
  {
    agentType: AgentType.OKR_AGENT,
    displayName: 'OKR Agent',
    domain: 'Objectives and key results',
    available: true,
    degradedReason: null,
  },
  {
    agentType: AgentType.CAREER_AGENT,
    displayName: 'Career Agent',
    domain: 'Growth, skills, reviews, and development',
    available: true,
    degradedReason: null,
  },
  {
    agentType: AgentType.ANALYTICS_AGENT,
    displayName: 'Analytics Agent',
    domain: 'Dashboards, statistics, and manager or HR insights',
    available: true,
    degradedReason: null,
  },
  {
    agentType: AgentType.ONBOARDING_AGENT,
    displayName: 'Onboarding Agent',
    domain: 'New-hire welcome and onboarding progress',
    available: true,
    degradedReason: null,
  },
  {
    agentType: AgentType.LEAVE_AGENT,
    displayName: 'Leave Agent',
    domain: 'Leave balance, history, and booking preparation',
    available: true,
    degradedReason: null,
  },
  {
    agentType: AgentType.LANGUAGE_AGENT,
    displayName: 'Language Agent',
    domain: 'Workplace phrase review and rewriting',
    available: true,
    degradedReason: null,
  },
  {
    agentType: AgentType.GENERAL_HELP_AGENT,
    displayName: 'General Help Agent',
    domain: 'FAQ, handbook, and policy knowledge',
    available: true,
    degradedReason: null,
  },
  {
    agentType: AgentType.HUMAN_ESCALATION_AGENT,
    displayName: 'Human Escalation Agent',
    domain: 'Manager, HRBP, People team, and emergency handoff',
    available: true,
    degradedReason: null,
  },
];

@Injectable()
export class AgentRegistryService {
  list(): AgentRegistryEntry[] {
    return ROSTER.map((entry) => ({ ...entry }));
  }

  specialists(): AgentRegistryEntry[] {
    return this.list().filter((entry) => entry.agentType !== AgentType.SUPERVISOR_AGENT);
  }

  get(agentType: AgentType): AgentRegistryEntry | null {
    return this.list().find((entry) => entry.agentType === agentType) ?? null;
  }

  isAvailable(agentType: AgentType): boolean {
    return this.get(agentType)?.available ?? false;
  }
}
