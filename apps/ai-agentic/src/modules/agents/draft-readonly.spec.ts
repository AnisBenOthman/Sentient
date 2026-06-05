import { AgentType } from '../../generated/prisma';
import { DraftPolicyService } from '../../common/safety';

describe('draft read-only policy', () => {
  const service = new DraftPolicyService();

  it('allows draft help while keeping official records read-only', () => {
    const result = service.evaluate(AgentType.OKR_AGENT, 'Draft an OKR for me');

    expect(result.allowed).toBe(true);
    expect(result.readOnlyOfficialRecords).toBe(true);
  });

  it('blocks official record mutation requests during drafting', () => {
    const result = service.evaluate(AgentType.LEAVE_AGENT, 'Draft this leave request and submit it');

    expect(result.allowed).toBe(false);
    expect(result.blockedReason).toContain('cannot mutate official records');
  });
});
