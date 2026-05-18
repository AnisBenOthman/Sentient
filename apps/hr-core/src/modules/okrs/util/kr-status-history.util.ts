import { type PrismaClient } from '../../../generated/prisma';
import { KeyResultStatus } from '@sentient/shared';

type TxClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

interface AppendStatusHistoryArgs {
  keyResultId: string;
  fromStatus: KeyResultStatus | null;
  toStatus: KeyResultStatus;
  changedById: string | null;
  reason?: string;
}

export async function appendKrStatusHistory(
  tx: TxClient,
  args: AppendStatusHistoryArgs,
): Promise<void> {
  await tx.keyResultStatusHistory.create({
    data: {
      keyResultId: args.keyResultId,
      fromStatus: args.fromStatus ?? undefined,
      toStatus: args.toStatus,
      changedById: args.changedById ?? undefined,
      reason: args.reason,
    },
  });
}
