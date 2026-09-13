import { ActionProposalStatus, AgentActionKind, AgentActionProposal } from '../../../generated/prisma';
import { LeaveBookingConfirmationPayload, PolicyCitation } from '../../../common/graph';

/**
 * The wire shape every channel consumes for a pending confirmation
 * (spec 017 contracts/action-execution-api.yaml `ConfirmationPayload`).
 *
 * WHY assembled here and nowhere else: the web card renders these fields as JSX
 * and the Telegram card renders them as text. If each built its own object from
 * the proposal row they would drift within a sprint. Both read THIS type, so a
 * field added here is a compile error at every consumer that forgets it.
 */
export interface ConfirmationPayloadResponse {
  confirmationToken: string;
  actionKind: AgentActionKind;
  leaveTypeId: string;
  leaveTypeName: string;
  startDate: string;
  endDate: string;
  /** Advisory only — HR Core recomputes totalDays authoritatively (research.md R4). */
  businessDays: number;
  currentBalance: number;
  balanceAfter: number;
  expiresAt: string;
  emotionalContext: 'NEUTRAL' | 'COMPASSIONATE_SICK' | null;
  /** Empty means "policy was consulted and nothing relevant was found" (FR-019). */
  policyCitations: PolicyCitation[];
}

/** Channel-neutral card content: ordered, labelled, formatted once. */
export interface CardLines {
  headline: string;
  lines: Array<{ label: string; value: string }>;
  citations: string[];
  footer: string;
}

/**
 * Returns null unless the proposal is still awaiting a decision. A consumed or
 * expired proposal must not re-render as an actionable card on a re-fetched
 * conversation — the outcome message that follows it is the record.
 */
export function buildConfirmationPayload(proposal: AgentActionProposal): ConfirmationPayloadResponse | null {
  if (proposal.status !== ActionProposalStatus.PENDING) return null;
  if (proposal.expiresAt.getTime() <= Date.now()) return null;

  const payload = readLeavePayload(proposal.payload);
  if (!payload) return null;

  return {
    confirmationToken: proposal.token,
    actionKind: proposal.actionKind,
    leaveTypeId: payload.leaveTypeId,
    leaveTypeName: payload.leaveTypeName,
    startDate: payload.startDate,
    endDate: payload.endDate,
    businessDays: payload.businessDays,
    currentBalance: payload.currentBalance,
    balanceAfter: payload.balanceAfter,
    expiresAt: proposal.expiresAt.toISOString(),
    emotionalContext: null,
    policyCitations: readCitations(proposal.policyCitations),
  };
}

export function confirmationCardLines(payload: ConfirmationPayloadResponse): CardLines {
  const sameDay = payload.startDate === payload.endDate;
  return {
    headline: `Leave booking to confirm: ${payload.leaveTypeName}`,
    lines: [
      { label: 'Dates', value: sameDay ? formatDate(payload.startDate) : `${formatDate(payload.startDate)} to ${formatDate(payload.endDate)}` },
      { label: 'Working days', value: `${payload.businessDays} (estimate — HR Core confirms the exact count)` },
      { label: 'Balance now', value: formatDays(payload.currentBalance) },
      { label: 'Balance after', value: formatDays(payload.balanceAfter) },
    ],
    citations: payload.policyCitations.length === 0
      ? ['No relevant policy document was found for this leave type.']
      : payload.policyCitations.map((citation) => `${citation.sourceLabel}: ${citation.excerpt}`),
    footer: `This proposal expires at ${formatDateTime(payload.expiresAt)}. Nothing is submitted until you confirm.`,
  };
}

// ---------------------------------------------------------------------------

export function readLeavePayload(value: unknown): LeaveBookingConfirmationPayload | null {
  if (typeof value !== 'object' || value === null) return null;
  const record = value as Record<string, unknown>;
  const str = (key: string): string | null => (typeof record[key] === 'string' ? (record[key] as string) : null);
  const num = (key: string): number | null => (typeof record[key] === 'number' ? (record[key] as number) : null);

  const leaveTypeId = str('leaveTypeId');
  const leaveTypeName = str('leaveTypeName');
  const startDate = str('startDate');
  const endDate = str('endDate');
  const employeeId = str('employeeId');
  const businessDays = num('businessDays');
  const currentBalance = num('currentBalance');
  const balanceAfter = num('balanceAfter');
  if (
    leaveTypeId === null || leaveTypeName === null || startDate === null || endDate === null ||
    employeeId === null || businessDays === null || currentBalance === null || balanceAfter === null
  ) {
    return null;
  }
  return { leaveTypeId, leaveTypeName, startDate, endDate, businessDays, currentBalance, balanceAfter, employeeId };
}

export function readCitations(value: unknown): PolicyCitation[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null)
    .map((entry) => ({
      sourceLabel: typeof entry.sourceLabel === 'string' ? entry.sourceLabel : 'Policy document',
      excerpt: typeof entry.excerpt === 'string' ? entry.excerpt : '',
    }))
    .filter((citation) => citation.excerpt.length > 0);
}

function formatDays(value: number): string {
  return `${value} ${value === 1 ? 'day' : 'days'}`;
}

function formatDate(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function formatDateTime(isoDateTime: string): string {
  const date = new Date(isoDateTime);
  if (Number.isNaN(date.getTime())) return isoDateTime;
  return date.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' UTC';
}
