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

export type ActionOutcomeStatus =
  | 'SUCCESS'
  | 'UNVERIFIED'
  | 'FAILED'
  | 'REFUSED'
  | 'CANCELLED'
  | 'ALREADY_SUBMITTED'
  | 'EXPIRED'
  | 'NOT_FOUND';

/**
 * The wire shape for the result of a confirm/cancel turn
 * (contracts/action-execution-api.yaml `actionOutcome`). `summary` is the one
 * plain-language sentence every channel shows; built here so web and Telegram
 * never word the same outcome two different ways.
 */
export interface ActionOutcomeResponse {
  actionKind: AgentActionKind | null;
  status: ActionOutcomeStatus;
  recordId: string | null;
  /** HR Core's own status on the created record (PENDING or APPROVED), when known. */
  recordStatus: string | null;
  httpStatus: number | null;
  /** The downstream reason verbatim (FR-010), or the refusal reason. */
  reason: string | null;
  verificationState: 'MATCHED' | 'MISMATCHED' | 'UNAVAILABLE' | null;
  summary: string;
}

export interface BuildOutcomeInput {
  actionKind: AgentActionKind | null;
  status: ActionOutcomeStatus;
  payload: LeaveBookingConfirmationPayload | null;
  recordId?: string | null;
  recordStatus?: string | null;
  httpStatus?: number | null;
  reason?: string | null;
  verificationState?: 'MATCHED' | 'MISMATCHED' | 'UNAVAILABLE' | null;
}

export function buildActionOutcome(input: BuildOutcomeInput): ActionOutcomeResponse {
  return {
    actionKind: input.actionKind,
    status: input.status,
    recordId: input.recordId ?? null,
    recordStatus: input.recordStatus ?? null,
    httpStatus: input.httpStatus ?? null,
    reason: input.reason ?? null,
    verificationState: input.verificationState ?? null,
    summary: outcomeSummary(input),
  };
}

function outcomeSummary(input: BuildOutcomeInput): string {
  const p = input.payload;
  const what = p
    ? `your ${p.leaveTypeName} ${p.startDate === p.endDate ? `on ${formatDate(p.startDate)}` : `from ${formatDate(p.startDate)} to ${formatDate(p.endDate)}`}`
    : 'that booking';
  switch (input.status) {
    case 'SUCCESS': {
      // FR-024: never name a specific approver — routing may fall back to HR admins.
      const next = input.recordStatus?.toUpperCase() === 'APPROVED'
        ? 'It was approved automatically.'
        : 'It is now pending approval and the approver has been notified.';
      return `Done — ${what} has been submitted and I verified it in HR Core${input.recordId ? ` (reference ${input.recordId.slice(0, 8)})` : ''}. ${next}`;
    }
    case 'UNVERIFIED':
      return `I submitted ${what}, but I could not confirm it was recorded correctly${input.reason ? ` (${input.reason})` : ''}. Please check the Leaves page in the web app, or contact HR, before assuming it went through.`;
    case 'FAILED':
      return `I could not submit ${what}. HR Core returned: ${input.reason ?? 'an unknown error'}. Nothing was booked — you can ask me to try again, or use the Leaves page.`;
    case 'REFUSED':
      return input.reason ?? `Something changed since I proposed ${what}, so I have not submitted it.`;
    case 'CANCELLED':
      return `Cancelled — ${what} was not submitted.`;
    case 'ALREADY_SUBMITTED':
      return input.recordId
        ? `${capitalize(what)} was already submitted (reference ${input.recordId.slice(0, 8)}). I have not submitted it a second time.`
        : `${capitalize(what)} is already being submitted from your earlier tap. I have not submitted it a second time — check the Leaves page in a moment.`;
    case 'EXPIRED':
      return `That confirmation has expired, so I have not submitted ${what}. Ask me again and I will re-check your balance and prepare a fresh one.`;
    case 'NOT_FOUND':
    default:
      return "I don't recognise that confirmation any more. If you still want to book leave, just ask me again.";
  }
}

export function outcomeLines(outcome: ActionOutcomeResponse): CardLines {
  const headline: Record<ActionOutcomeStatus, string> = {
    SUCCESS: 'Leave booked',
    UNVERIFIED: 'Submitted, but not verified',
    FAILED: 'Booking failed',
    REFUSED: 'Not submitted',
    CANCELLED: 'Cancelled',
    ALREADY_SUBMITTED: 'Already submitted',
    EXPIRED: 'Confirmation expired',
    NOT_FOUND: 'Unknown confirmation',
  };
  const lines: Array<{ label: string; value: string }> = [];
  if (outcome.recordId) lines.push({ label: 'Reference', value: outcome.recordId });
  if (outcome.recordStatus) lines.push({ label: 'Status', value: outcome.recordStatus });
  if (outcome.verificationState) lines.push({ label: 'Verification', value: outcome.verificationState });
  if (outcome.httpStatus !== null && outcome.status === 'FAILED') lines.push({ label: 'HR Core response', value: String(outcome.httpStatus) });
  return { headline: headline[outcome.status], lines, citations: [], footer: outcome.summary };
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
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
