import { KeyResultStatus } from '@sentient/shared';

import { appendKrStatusHistory } from './kr-status-history.util';

function makeTx() {
  return {
    keyResultStatusHistory: {
      create: jest.fn().mockResolvedValue({}),
    },
  };
}

describe('appendKrStatusHistory', () => {
  it('calls tx.keyResultStatusHistory.create with the correct payload', async () => {
    const tx = makeTx();
    await appendKrStatusHistory(tx as never, {
      keyResultId: 'kr-1',
      fromStatus: KeyResultStatus.ON_TRACK,
      toStatus: KeyResultStatus.AT_RISK,
      changedById: 'user-1',
      reason: 'External blocker',
    });

    expect(tx.keyResultStatusHistory.create).toHaveBeenCalledWith({
      data: {
        keyResultId: 'kr-1',
        fromStatus: KeyResultStatus.ON_TRACK,
        toStatus: KeyResultStatus.AT_RISK,
        changedById: 'user-1',
        reason: 'External blocker',
      },
    });
  });

  it('passes null changedById (undefined in Prisma) for system-induced changes', async () => {
    const tx = makeTx();
    await appendKrStatusHistory(tx as never, {
      keyResultId: 'kr-2',
      fromStatus: null,
      toStatus: KeyResultStatus.CANCELLED,
      changedById: null,
    });

    expect(tx.keyResultStatusHistory.create).toHaveBeenCalledWith({
      data: {
        keyResultId: 'kr-2',
        fromStatus: undefined,
        toStatus: KeyResultStatus.CANCELLED,
        changedById: undefined,
        reason: undefined,
      },
    });
  });
});
