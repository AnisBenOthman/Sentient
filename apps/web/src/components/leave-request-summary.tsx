import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import type { LeaveRequest } from "@/lib/api/hr-core";

type LeaveRequestSummaryMode = "compact" | "duration" | "type";

type LeaveRequestSummaryProps = {
  request: Pick<LeaveRequest, "leaveType" | "leaveTypeId" | "startDate" | "endDate" | "totalDays">;
  mode?: LeaveRequestSummaryMode;
};

function formatLeaveDate(iso: string, locale: string): string {
  const [datePart] = iso.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const date =
    Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)
      ? new Date(Date.UTC(year, month - 1, day))
      : new Date(iso);

  return date.toLocaleDateString(locale, {
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function LeaveRequestSummary({
  request,
  mode = "compact",
}: LeaveRequestSummaryProps) {
  const { t, i18n } = useTranslation("common");
  const leaveTypeName = request.leaveType?.name ?? request.leaveTypeId;
  const dateRange =
    request.startDate === request.endDate
      ? formatLeaveDate(request.startDate, i18n.language)
      : `${formatLeaveDate(request.startDate, i18n.language)} - ${formatLeaveDate(request.endDate, i18n.language)}`;

  if (mode === "type") {
    return <Badge variant="outline">{leaveTypeName}</Badge>;
  }

  if (mode === "duration") {
    return <span>{dateRange}</span>;
  }

  return (
    <span>
      {leaveTypeName}{" \u00b7 "}{t("daysCount", { count: request.totalDays })}{" \u00b7 "}{dateRange}
    </span>
  );
}
