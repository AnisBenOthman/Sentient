import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import type { TimeGranularity } from "@/lib/api/hr-core";

interface DashboardPeriodFilterProps {
  value: TimeGranularity;
  onChange: (value: TimeGranularity) => void;
  disabled?: boolean;
}

const OPTIONS: TimeGranularity[] = ["MONTHLY", "QUARTERLY", "YEARLY"];

export function DashboardPeriodFilter({
  value,
  onChange,
  disabled,
}: DashboardPeriodFilterProps) {
  const { t } = useTranslation("dashboard");
  const labels: Record<TimeGranularity, string> = {
    MONTHLY: t("granularity.monthly"),
    QUARTERLY: t("granularity.quarterly"),
    YEARLY: t("granularity.yearly"),
  };
  return (
    <div className="flex items-center gap-1 rounded-lg border bg-muted/40 p-1">
      {OPTIONS.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          disabled={disabled}
          className={cn(
            "rounded-md px-3 py-1 text-sm font-medium transition-colors",
            value === opt
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
            disabled && "opacity-50 cursor-not-allowed",
          )}
        >
          {labels[opt]}
        </button>
      ))}
    </div>
  );
}
