import { useEffect, useState } from "react";
import { AlertTriangle, CalendarCheck, CheckCircle2, Clock, FileText, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ActionOutcome, ConfirmationPayload } from "@/lib/api/ai";
import { cn } from "@/lib/utils";

function formatDate(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

function formatDays(value: number): string {
  return `${value} ${value === 1 ? "day" : "days"}`;
}

/**
 * The confirmation card rendered wherever a message carries a pending
 * confirmationPayload (spec 017 FR-042, FR-043). The field ORDER and labels
 * mirror confirmationCardLines() in apps/ai-agentic — the Telegram card is the
 * same content as text — so a user who sees both recognises them as one thing.
 *
 * Confirm disables on first click and re-enables only when the parent reports
 * a FAILED outcome (FR-044): a double-click must never look like it could book
 * twice, even though the server's single-use token already guarantees it cannot.
 */
export function ActionConfirmationCard({
  payload,
  pending,
  lastOutcomeStatus,
  onDecide,
}: {
  payload: ConfirmationPayload;
  /** True while a decision request is in flight. */
  pending: boolean;
  /** The most recent outcome for THIS proposal, if any — re-enables Confirm on FAILED. */
  lastOutcomeStatus?: ActionOutcome["status"] | null;
  onDecide: (confirmed: boolean) => void;
}) {
  const [tapped, setTapped] = useState(false);
  const expired = new Date(payload.expiresAt).getTime() <= Date.now();

  useEffect(() => {
    if (lastOutcomeStatus === "FAILED") setTapped(false);
  }, [lastOutcomeStatus]);

  const locked = tapped || pending || expired;
  const sameDay = payload.startDate === payload.endDate;

  return (
    <Card className="mt-3 max-w-[78ch] border-blue-200 bg-blue-50/40 dark:border-blue-900 dark:bg-blue-950/20">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-200">
          <CalendarCheck className="h-4 w-4 text-blue-600" />
          Leave booking to confirm: {payload.leaveTypeName}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <Field label="Dates" value={sameDay ? formatDate(payload.startDate) : `${formatDate(payload.startDate)} to ${formatDate(payload.endDate)}`} />
          <Field label="Working days" value={`${payload.businessDays}`} hint="estimate — HR Core confirms the exact count" />
          <Field label="Balance now" value={formatDays(payload.currentBalance)} />
          <Field label="Balance after" value={formatDays(payload.balanceAfter)} />
        </dl>

        <div className="rounded-md border border-gray-200 bg-white p-3 text-sm dark:border-gray-800 dark:bg-gray-900">
          <p className="mb-1 flex items-center gap-1.5 font-medium text-gray-700 dark:text-gray-300">
            <FileText className="h-3.5 w-3.5" /> Policy notes
          </p>
          {payload.policyCitations.length === 0 ? (
            <p className="text-xs text-muted-foreground">No relevant policy document was found for this leave type.</p>
          ) : (
            <ul className="space-y-1.5">
              {payload.policyCitations.map((citation, index) => (
                <li key={`${citation.sourceLabel}-${index}`} className="text-xs text-gray-700 dark:text-gray-300">
                  <span className="font-medium">{citation.sourceLabel}:</span> {citation.excerpt}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            {expired
              ? "This proposal has expired — ask the assistant again for a fresh one."
              : `Expires ${new Date(payload.expiresAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}. Nothing is submitted until you confirm.`}
          </p>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" disabled={locked} onClick={() => { setTapped(true); onDecide(false); }}>
              <XCircle className="mr-1 h-3.5 w-3.5" /> Cancel
            </Button>
            <Button size="sm" disabled={locked} onClick={() => { setTapped(true); onDecide(true); }}>
              <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> {pending ? "Submitting…" : "Confirm"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="font-medium text-gray-900 dark:text-gray-100">
        {value}
        {hint && <span className="ml-1 text-xs font-normal text-muted-foreground">({hint})</span>}
      </dd>
    </div>
  );
}

/**
 * Structured outcome for a confirm/cancel turn (spec 017 FR-046): a card with
 * the specific reason and the manual fallback, never a toast. Rendered under the
 * outcome message; the message text itself is the shared summary sentence.
 */
export function ActionOutcomeNotice({ outcome }: { outcome: ActionOutcome }) {
  const tone: Record<ActionOutcome["status"], { icon: typeof CheckCircle2; className: string; title: string }> = {
    SUCCESS: { icon: CheckCircle2, className: "border-green-200 bg-green-50 text-green-900 dark:border-green-900 dark:bg-green-950/30 dark:text-green-200", title: "Leave booked and verified" },
    UNVERIFIED: { icon: AlertTriangle, className: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200", title: "Submitted, but not verified" },
    FAILED: { icon: XCircle, className: "border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200", title: "Booking failed" },
    REFUSED: { icon: AlertTriangle, className: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200", title: "Not submitted" },
    CANCELLED: { icon: XCircle, className: "border-gray-200 bg-gray-50 text-gray-800 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200", title: "Cancelled" },
    ALREADY_SUBMITTED: { icon: CheckCircle2, className: "border-gray-200 bg-gray-50 text-gray-800 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200", title: "Already submitted" },
    EXPIRED: { icon: Clock, className: "border-gray-200 bg-gray-50 text-gray-800 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200", title: "Confirmation expired" },
    NOT_FOUND: { icon: AlertTriangle, className: "border-gray-200 bg-gray-50 text-gray-800 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200", title: "Unknown confirmation" },
  };
  const { icon: Icon, className, title } = tone[outcome.status];

  return (
    <div className={cn("mt-3 max-w-[78ch] rounded-md border px-4 py-3 text-sm", className)}>
      <p className="flex items-center gap-2 font-semibold">
        <Icon className="h-4 w-4" /> {title}
      </p>
      <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
        {outcome.recordId && <Row label="Reference" value={outcome.recordId} />}
        {outcome.recordStatus && <Row label="Status in HR Core" value={outcome.recordStatus} />}
        {outcome.verificationState && <Row label="Verification" value={outcome.verificationState} />}
        {outcome.status === "FAILED" && outcome.httpStatus !== null && <Row label="HR Core response" value={String(outcome.httpStatus)} />}
        {outcome.reason && outcome.status !== "SUCCESS" && <Row label="Detail" value={outcome.reason} />}
      </dl>
      {(outcome.status === "UNVERIFIED" || outcome.status === "FAILED") && (
        <p className="mt-2 text-xs">
          Check the <span className="font-medium">Leaves</span> page before assuming anything — it is the authoritative record.
        </p>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="shrink-0 opacity-70">{label}:</dt>
      <dd className="break-all font-medium">{value}</dd>
    </div>
  );
}
