import { AgentType } from '../../generated/prisma';
import { StreamEligibilityService } from './stream-eligibility.service';

function buildGate(overrides: {
  streamingEnabled?: boolean;
  streamingAgentTypes?: AgentType[];
  route?: string;
  requiredAgents?: AgentType[];
}) {
  const {
    streamingEnabled = true,
    streamingAgentTypes = [AgentType.LEAVE_AGENT, AgentType.GENERAL_HELP_AGENT],
    route = 'specialistsNode',
    requiredAgents = [AgentType.LEAVE_AGENT],
  } = overrides;

  const gate = {
    runnableSpecialists: (classification: { requiredAgents: AgentType[] }) =>
      classification.requiredAgents.filter((agentType) => agentType !== AgentType.HUMAN_ESCALATION_AGENT),
  } as never;
  const config = {
    get: () => ({ streamingEnabled, streamingAgentTypes }),
  } as never;

  const service = new StreamEligibilityService(gate, config);
  const gateResult = {
    route,
    classification: { requiredAgents },
  } as never;

  return { service, gateResult };
}

describe('StreamEligibilityService', () => {
  it('is eligible for a single streaming-registered agent on the specialists route', () => {
    const { service, gateResult } = buildGate({});
    expect(service.check(gateResult)).toEqual({ eligible: true, agentType: AgentType.LEAVE_AGENT });
  });

  it('is ineligible when the feature flag is off', () => {
    const { service, gateResult } = buildGate({ streamingEnabled: false });
    expect(service.check(gateResult)).toEqual({ eligible: false });
  });

  it('is ineligible off the specialists route', () => {
    const { service, gateResult } = buildGate({ route: 'clarificationNode' });
    expect(service.check(gateResult)).toEqual({ eligible: false });
  });

  it('is ineligible for a multi-specialist turn', () => {
    const { service, gateResult } = buildGate({
      requiredAgents: [AgentType.LEAVE_AGENT, AgentType.OKR_AGENT],
    });
    expect(service.check(gateResult)).toEqual({ eligible: false });
  });

  it('is ineligible for a specialist not in the streaming allowlist', () => {
    const { service, gateResult } = buildGate({ requiredAgents: [AgentType.OKR_AGENT] });
    expect(service.check(gateResult)).toEqual({ eligible: false });
  });

  it('drops HUMAN_ESCALATION_AGENT from the runnable count so a solo escalation intent never streams', () => {
    const { service, gateResult } = buildGate({ requiredAgents: [AgentType.HUMAN_ESCALATION_AGENT] });
    expect(service.check(gateResult)).toEqual({ eligible: false });
  });
});
