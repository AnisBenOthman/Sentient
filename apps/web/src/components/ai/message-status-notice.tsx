import { AlertTriangle, ShieldAlert, TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
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
 *
 * WHY each row spells out its own translation key instead of interpolating
 * `messageStatus.${status}`: the template form is typed over EVERY
 * AiAgentRunStatus, including the ones deliberately left without a key
 * (SUCCESS, PENDING, RUNNING…), so it does not compile against the typed i18n
 * resources. Naming the key literally keeps the compile-time guarantee that
 * every key rendered here actually exists, and the locale-parity check then
 * guarantees every locale defines it.
 */
const NOTICES: Partial<Record<AiAgentRunStatus, { tone: "amber" | "red"; key: NoticeKey }>> = {
  DEGRADED: { tone: "amber", key: "messageStatus.DEGRADED" },
  PARTIAL: { tone: "amber", key: "messageStatus.PARTIAL" },
  UNVERIFIED: { tone: "amber", key: "messageStatus.UNVERIFIED" },
  FAILED: { tone: "red", key: "messageStatus.FAILED" },
};

type NoticeKey =
  | "messageStatus.DEGRADED"
  | "messageStatus.PARTIAL"
  | "messageStatus.UNVERIFIED"
  | "messageStatus.FAILED";

const TONE_CLASSES = {
  amber:
    "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200",
  red: "border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200",
} as const;

export function MessageStatusNotice({ status }: { status: AiAgentRunStatus }) {
  const { t } = useTranslation("ai");
  const notice = NOTICES[status];
  if (!notice) return null;

  const Icon = notice.tone === "red" ? TriangleAlert : status === "UNVERIFIED" ? ShieldAlert : AlertTriangle;

  return (
    <div
      role="status"
      className={`mb-2 flex items-start gap-2 rounded border px-2.5 py-1.5 text-xs font-medium ${TONE_CLASSES[notice.tone]}`}
    >
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{t(notice.key)}</span>
    </div>
  );
}
