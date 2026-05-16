import { cn } from "@/lib/utils";
import type { TimeGranularity } from "@/lib/api/hr-core";

interface DashboardPeriodFilterProps {
  value: TimeGranularity;
  onChange: (value: TimeGranularity) => void;
  disabled?: boolean;
}

const OPTIONS: { label: string; value: TimeGranularity }[] = [
  { label: "Monthly", value: "MONTHLY" },
  { label: "Quarterly", value: "QUARTERLY" },
  { label: "Yearly", value: "YEARLY" },
];

export function DashboardPeriodFilter({
  value,
  onChange,
  disabled,
}: DashboardPeriodFilterProps) {
  return (
    <div className="flex items-center gap-1 rounded-lg border bg-muted/40 p-1">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          disabled={disabled}
          className={cn(
            "rounded-md px-3 py-1 text-sm font-medium transition-colors",
            value === opt.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
            disabled && "opacity-50 cursor-not-allowed",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
