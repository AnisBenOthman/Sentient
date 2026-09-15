import { AgentType } from '../../generated/prisma';
import { DraftPolicyService } from '../../common/safety';

describe('draft read-only policy', () => {
  const service = new DraftPolicyService();

  it('allows draft help while keeping official records read-only', () => {
    const result = service.evaluate(AgentType.OKR_AGENT, 'Draft an OKR for me');

    expect(result.allowed).toBe(true);
    expect(result.readOnlyOfficialRecords).toBe(true);
  });

  /**
   * WHY these specialists specifically: they are the seven AgentType values
   * actually dispatched through SupervisorLangGraphRunnerService.specialistInput()
   * (the six live entries in the `specialists` map, plus HUMAN_ESCALATION_AGENT
   * from the dedicated humanEscalationNode call site) with no entry in the
   * action-capability registry (action-capability.ts). HR_ASSISTANT and
   * ENGAGEMENT_AGENT are excluded deliberately — both are `undefined` in the
   * specialists map and are never dispatched today, so they are not part of
   * this guarantee's live surface. Spec 017 D1/D2 require the read-only
   * guarantee to survive unweakened for every specialist except LEAVE_AGENT —
   * this is the regression net for that guarantee at the DraftPolicyService
   * boundary.
   */
  const READ_ONLY_SPECIALISTS: AgentType[] = [
    AgentType.OKR_AGENT,
    AgentType.CAREER_AGENT,
    AgentType.LANGUAGE_AGENT,
    AgentType.ANALYTICS_AGENT,
    AgentType.ONBOARDING_AGENT,
    AgentType.GENERAL_HELP_AGENT,
    AgentType.HUMAN_ESCALATION_AGENT,
  ];

  it.each(READ_ONLY_SPECIALISTS)(
    'blocks official record mutation requests during drafting for %s',
    (agentType) => {
      const result = service.evaluate(agentType, 'Draft this and submit it');

      expect(result.allowed).toBe(false);
      expect(result.readOnlyOfficialRecords).toBe(true);
      expect(result.blockedReason).toContain('cannot mutate official records');
    },
  );

  /**
   * WHY LEAVE_AGENT is asserted separately rather than folded into the table
   * above: it is the one specialist spec 017 deliberately grants a capability
   * to (LEAVE_BOOKING). A blanket "submit" no longer blocks it here — but that
   * does NOT mean it can construct anything beyond a LEAVE_BOOKING proposal;
   * that narrower guarantee is enforced by the compiler on
   * SpecialistInput.constraints (agent-graph.types.ts), not by this gate.
   */
  it('routes a capable specialist through instead of blocking it', () => {
    const result = service.evaluate(AgentType.LEAVE_AGENT, 'Draft this leave request and submit it');

    expect(result.allowed).toBe(true);
    expect(result.readOnlyOfficialRecords).toBe(false);
    expect(result.blockedReason).toBeNull();
  });

  it('still allows LEAVE_AGENT draft help when no mutation term is present', () => {
    const result = service.evaluate(AgentType.LEAVE_AGENT, 'Draft a summary of my leave policy');

    expect(result.allowed).toBe(true);
    expect(result.readOnlyOfficialRecords).toBe(true);
  });

  /**
   * WHY this is asserted separately from the capable-bypass case above: the
   * bypass is scoped to the action the specialist actually holds a capability
   * for (spec 017 D2). LEAVE_AGENT holds only LEAVE_BOOKING, so decision and
   * destructive verbs — which map to no action kind any specialist has — must
   * stay blocked for it too. An agent-level "holds any capability" check would
   * wrongly let all of these through.
   */
  const NEVER_BYPASSABLE_TERMS = ['approve', 'reject', 'delete', 'publish now', 'update the record'];

  it.each(NEVER_BYPASSABLE_TERMS)(
    'still blocks LEAVE_AGENT on "%s" — it has no capability for that action',
    (term) => {
      const result = service.evaluate(AgentType.LEAVE_AGENT, `Draft this and ${term} for me`);

      expect(result.allowed).toBe(false);
      expect(result.readOnlyOfficialRecords).toBe(true);
      expect(result.blockedReason).toContain('cannot mutate official records');
    },
  );

  it.each(['submit', 'book it', 'save it to'])(
    'lets LEAVE_AGENT through on "%s" — these map to its LEAVE_BOOKING capability',
    (term) => {
      const result = service.evaluate(AgentType.LEAVE_AGENT, `Draft my leave request and ${term} please`);

      expect(result.allowed).toBe(true);
      expect(result.readOnlyOfficialRecords).toBe(false);
    },
  );

  it('blocks a booking-intent term for a specialist with no capability at all', () => {
    const result = service.evaluate(AgentType.OKR_AGENT, 'Draft my OKR and submit it');

    expect(result.allowed).toBe(false);
    expect(result.readOnlyOfficialRecords).toBe(true);
  });
});
