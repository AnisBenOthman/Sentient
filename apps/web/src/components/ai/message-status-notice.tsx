import { AlertTriangle, ShieldAlert, TriangleAlert } from "lucide-react";
import type { AiAgentRunStatus } from "@/lib/api/ai";

/**
 * WHY this exists: the assistant's message bubble rendered a DEGRADED or FAILED
 * answer with exactly the same styling as a complete one. The backend already
 * states the limitation in the text, but a wall of identical bubbles trains
 * people to skim past it — and in an HR assistant that can propose leave
 * bookings, "the AI service was down, nothing was submitted" is precisely the
 * sentence a user must not skim past. The badge makes the reduced answer
 * visually distinct before it is read.
 *
 * Statuses that are a normal, complete outcome of a turn (SUCCESS, REFUSED,
 * OUT_OF_SCOPE, ESCALATED, PENDING_CONFIRMATION) get no badge: the message text
 * is the whole answer and a warning strip would be noise.
 */
const NOTICES: Partial<Record<AiAgentRunStatus, { label: string; tone: "amber" | "red" }>> = {
  DEGRADED: { label: "Reduced answer — some assistant capability was unavailable", tone: "amber" },
  PARTIAL: { label: "Partial answer — not every part of your request was covered", tone: "amber" },
  UNVERIFIED: { label: "Unverified — this could not be confirmed against your records", tone: "amber" },
  FAILED: { label: "This request did not complete", tone: "red" },
};

const TONE_CLASSES = {
  amber:
    "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200",
  red: "border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200",
} as const;

export function MessageStatusNotice({ status }: { status: AiAgentRunStatus }) {
  const notice = NOTICES[status];
  if (!notice) return null;

  const Icon = notice.tone === "red" ? TriangleAlert : status === "UNVERIFIED" ? ShieldAlert : AlertTriangle;

  return (
    <div
      role="status"
      className={`mb-2 flex items-start gap-2 rounded border px-2.5 py-1.5 text-xs font-medium ${TONE_CLASSES[notice.tone]}`}
    >
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{notice.label}</span>
    </div>
  );
}
